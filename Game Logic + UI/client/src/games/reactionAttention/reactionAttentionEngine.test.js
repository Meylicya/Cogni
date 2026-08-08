import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TRIAL_COUNT,
  TRIAL_TYPES,
  PHASES,
  OUTCOMES,
  generateTrialPlan,
  createReactionAttentionSession,
  pressGo,
  advanceToNextTrial,
  computeAccuracy,
  computeAverageResponseLatencyMs,
  summarizeErrorType,
  buildSessionEvent,
} from "./reactionAttentionEngine.js";

import { validateGameSessionEvent } from "../../shared/eventSchema.js";

function makeQueueRandom(values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

// ---- generateTrialPlan ----

test("generateTrialPlan produces the requested length", () => {
  const trials = generateTrialPlan(10, 0.2, [1000, 2000], Math.random);
  assert.equal(trials.length, 10);
});

test("generateTrialPlan: hand-verified deterministic case matches exact expected output", () => {
  // length=4, noGoRatio=0.5, intervalRange=[1000,1200] (width=200)
  // Call order per trial: 1 call for type decision, 1 call for interval.
  //   i0: v=0.8 (>=0.5) -> go;    interval v=0.25 -> 1000+floor(0.25*201)=1050
  //   i1: v=0.1 (<0.5)  -> no-go; interval v=0.75 -> 1000+floor(0.75*201)=1150
  //   i2: v=0.9 (>=0.5) -> go;    interval v=0.5  -> 1000+floor(0.5*201)=1100
  //   i3: v=0.05(<0.5)  -> no-go; interval v=0.0  -> 1000+floor(0*201)=1000
  const values = [0.8, 0.25, 0.1, 0.75, 0.9, 0.5, 0.05, 0.0];
  const trials = generateTrialPlan(4, 0.5, [1000, 1200], makeQueueRandom(values));

  assert.deepEqual(
    trials.map((t) => t.type),
    [TRIAL_TYPES.GO, TRIAL_TYPES.NO_GO, TRIAL_TYPES.GO, TRIAL_TYPES.NO_GO]
  );
  assert.deepEqual(
    trials.map((t) => t.intervalMs),
    [1050, 1150, 1100, 1000]
  );
});

test("generateTrialPlan: intervalMs always falls within [min, max]", () => {
  const trials = generateTrialPlan(50, 0.3, [800, 1500], Math.random);
  for (const trial of trials) {
    assert.ok(trial.intervalMs >= 800 && trial.intervalMs <= 1500);
  }
});

test("generateTrialPlan: roughly matches the target noGoRatio over many trials (statistical)", () => {
  const noGoRatio = 0.25;
  const trials = generateTrialPlan(2000, noGoRatio, [1000, 1500], Math.random);
  const noGoCount = trials.filter((t) => t.type === TRIAL_TYPES.NO_GO).length;
  const actualRatio = noGoCount / trials.length;
  assert.ok(
    Math.abs(actualRatio - noGoRatio) < 0.05,
    `no-go ratio ${actualRatio} too far from target ${noGoRatio}`
  );
});

test("generateTrialPlan throws on invalid length", () => {
  assert.throws(() => generateTrialPlan(0, 0.2, [1000, 2000]), /positive integer/);
  assert.throws(() => generateTrialPlan(-1, 0.2, [1000, 2000]), /positive integer/);
});

test("generateTrialPlan throws on out-of-range noGoRatio", () => {
  assert.throws(() => generateTrialPlan(5, 1.5, [1000, 2000]), /noGoRatio must be a number between 0 and 1/);
  assert.throws(() => generateTrialPlan(5, -0.1, [1000, 2000]), /noGoRatio must be a number between 0 and 1/);
});

test("generateTrialPlan throws on invalid intervalRange", () => {
  assert.throws(() => generateTrialPlan(5, 0.2, [2000, 1000]), /intervalRange must be/); // max < min
  assert.throws(() => generateTrialPlan(5, 0.2, [1000]), /intervalRange must be/); // wrong length
  assert.throws(() => generateTrialPlan(5, 0.2, "not-an-array"), /intervalRange must be/);
});

// ---- createReactionAttentionSession ----

test("createReactionAttentionSession uses difficultyConfig's params per level", () => {
  // From difficultyConfig.js: level 1 -> noGoRatio 0.15, responseWindowMs 1200
  const session = createReactionAttentionSession(1, 1000, { trialCount: 10 });
  assert.equal(session.noGoRatio, 0.15);
  assert.equal(session.responseWindowMs, 1200);
  assert.deepEqual(session.stimulusIntervalMsRange, [1500, 2500]);
});

test("createReactionAttentionSession starts IN_PROGRESS at trial 0 with trialStartedAt = createdAt", () => {
  const session = createReactionAttentionSession(1, 5000, { trialCount: 10 });
  assert.equal(session.phase, PHASES.IN_PROGRESS);
  assert.equal(session.currentIndex, 0);
  assert.equal(session.trialStartedAt, 5000);
  assert.equal(session.hits, 0);
  assert.equal(session.omissionErrors, 0);
  assert.equal(session.commissionErrors, 0);
  assert.equal(session.correctWithholds, 0);
  assert.equal(session.completedAt, null);
});

test("createReactionAttentionSession defaults trialCount when not overridden", () => {
  const session = createReactionAttentionSession(1, 1000);
  assert.equal(session.trials.length, DEFAULT_TRIAL_COUNT);
});

test("createReactionAttentionSession is deterministic with an injected randomFn", () => {
  const a = createReactionAttentionSession(1, 1000, {
    trialCount: 6,
    randomFn: makeQueueRandom([0.9, 0.1, 0.05, 0.2, 0.8, 0.3, 0.95, 0.4, 0.1, 0.6, 0.99, 0.7]),
  });
  const b = createReactionAttentionSession(1, 1000, {
    trialCount: 6,
    randomFn: makeQueueRandom([0.9, 0.1, 0.05, 0.2, 0.8, 0.3, 0.95, 0.4, 0.1, 0.6, 0.99, 0.7]),
  });
  assert.deepEqual(a.trials, b.trials);
});

test("createReactionAttentionSession returns a frozen session with frozen arrays", () => {
  const session = createReactionAttentionSession(1, 1000, { trialCount: 5 });
  assert.equal(Object.isFrozen(session), true);
  assert.equal(Object.isFrozen(session.trials), true);
  assert.equal(Object.isFrozen(session.responses), true);
});

test("createReactionAttentionSession throws on invalid createdAt", () => {
  assert.throws(() => createReactionAttentionSession(1, "now"), /createdAt must be a number/);
});

test("createReactionAttentionSession throws on invalid difficultyLevel (delegates to difficultyConfig)", () => {
  assert.throws(() => createReactionAttentionSession(9, 1000), /must be an integer between/);
});

// ---- session flow: pressGo / advanceToNextTrial ----

/**
 * Builds a fully deterministic 4-trial session at difficulty level 1
 * (noGoRatio=0.15, responseWindowMs=1200, stimulusIntervalMsRange=[1500,2500]):
 *   trial types = [go, no-go, go, no-go], all intervalMs = 1500
 * Hand-traced: type decisions at 0.5(go)/0.05(no-go)/0.9(go)/0.1(no-go),
 * interval decisions all 0.0 -> minMs (1500).
 */
function buildDeterministicSession(createdAt = 1000) {
  const values = [0.5, 0.0, 0.05, 0.0, 0.9, 0.0, 0.1, 0.0];
  return createReactionAttentionSession(1, createdAt, {
    trialCount: 4,
    randomFn: makeQueueRandom(values),
  });
}

test("buildDeterministicSession sanity check: trial types match the hand trace", () => {
  const session = buildDeterministicSession();
  assert.deepEqual(
    session.trials.map((t) => t.type),
    [TRIAL_TYPES.GO, TRIAL_TYPES.NO_GO, TRIAL_TYPES.GO, TRIAL_TYPES.NO_GO]
  );
});

test("go trial + in-window press -> HIT", () => {
  let session = buildDeterministicSession(1000); // trial 0 is "go", trialStartedAt=1000, responseWindowMs=1200
  session = pressGo(session, 1300); // latency 300ms, well within 1200ms window
  session = advanceToNextTrial(session, 2500);
  assert.equal(session.outcomes[0], OUTCOMES.HIT);
  assert.equal(session.hits, 1);
  assert.equal(session.responseLatencies[0], 300);
});

test("go trial + no press -> OMISSION_ERROR", () => {
  let session = buildDeterministicSession(1000); // trial 0 is "go"
  session = advanceToNextTrial(session, 2500); // never pressed
  assert.equal(session.outcomes[0], OUTCOMES.OMISSION_ERROR);
  assert.equal(session.omissionErrors, 1);
});

test("go trial + press AFTER the response window -> still OMISSION_ERROR, not a hit", () => {
  let session = buildDeterministicSession(1000); // trial 0 is "go", responseWindowMs=1200
  session = pressGo(session, 1000 + 1500); // latency 1500ms > 1200ms window
  session = advanceToNextTrial(session, 3000);
  assert.equal(session.outcomes[0], OUTCOMES.OMISSION_ERROR);
  assert.equal(session.omissionErrors, 1);
  assert.equal(session.hits, 0);
  // The late press is still recorded as a raw response latency, just not scored as valid.
  assert.equal(session.responseLatencies[0], 1500);
});

test("no-go trial + press -> COMMISSION_ERROR", () => {
  let session = buildDeterministicSession(1000);
  session = advanceToNextTrial(session, 2500); // trial 0 (go), skip press -> omission, moves to trial 1
  const trial1Start = session.trialStartedAt;
  session = pressGo(session, trial1Start + 100); // trial 1 is "no-go", pressing is an error
  session = advanceToNextTrial(session, trial1Start + 1500);
  assert.equal(session.outcomes[1], OUTCOMES.COMMISSION_ERROR);
  assert.equal(session.commissionErrors, 1);
});

test("no-go trial + no press -> CORRECT_WITHHOLD", () => {
  let session = buildDeterministicSession(1000);
  session = advanceToNextTrial(session, 2500); // trial 0
  const trial1Start = session.trialStartedAt;
  session = advanceToNextTrial(session, trial1Start + 1500); // trial 1 (no-go), correctly no press
  assert.equal(session.outcomes[1], OUTCOMES.CORRECT_WITHHOLD);
  assert.equal(session.correctWithholds, 1);
});

test("full 4-trial deterministic round completes with correct classification and totals", () => {
  let session = buildDeterministicSession(1000);

  // Trial 0 (go): press in-window -> HIT
  session = pressGo(session, session.trialStartedAt + 200);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);

  // Trial 1 (no-go): no press -> CORRECT_WITHHOLD
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);

  // Trial 2 (go): no press -> OMISSION_ERROR
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);

  // Trial 3 (no-go): press -> COMMISSION_ERROR
  session = pressGo(session, session.trialStartedAt + 100);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);

  assert.equal(session.phase, PHASES.COMPLETE);
  assert.deepEqual(session.outcomes, [
    OUTCOMES.HIT,
    OUTCOMES.CORRECT_WITHHOLD,
    OUTCOMES.OMISSION_ERROR,
    OUTCOMES.COMMISSION_ERROR,
  ]);
  assert.equal(session.hits, 1);
  assert.equal(session.correctWithholds, 1);
  assert.equal(session.omissionErrors, 1);
  assert.equal(session.commissionErrors, 1);
});

test("pressGo does not mutate the input session (pure function)", () => {
  let session = buildDeterministicSession(1000);
  const before = session;
  pressGo(session, session.trialStartedAt + 200);
  assert.equal(before.responses[0], null);
});

test("pressGo throws if called twice in the same trial", () => {
  let session = buildDeterministicSession(1000);
  session = pressGo(session, session.trialStartedAt + 100);
  assert.throws(() => pressGo(session, session.trialStartedAt + 150), /pressGo called twice/);
});

test("pressGo throws if timestamp is before trialStartedAt", () => {
  const session = buildDeterministicSession(1000);
  assert.throws(() => pressGo(session, 500), /cannot be before trialStartedAt/);
});

test("pressGo throws once session is COMPLETE", () => {
  let session = buildDeterministicSession(1000);
  for (let i = 0; i < 4; i++) {
    session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  }
  assert.equal(session.phase, PHASES.COMPLETE);
  assert.throws(() => pressGo(session, 9999999), /invalid phase "complete"/);
});

test("advanceToNextTrial throws once session is already COMPLETE", () => {
  let session = buildDeterministicSession(1000);
  for (let i = 0; i < 4; i++) {
    session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  }
  assert.throws(() => advanceToNextTrial(session, 9999999), /invalid phase "complete"/);
});

test("advanceToNextTrial throws on invalid timestamp", () => {
  const session = buildDeterministicSession(1000);
  assert.throws(() => advanceToNextTrial(session, "later"), /timestamp must be a number/);
});

// ---- computeAccuracy / computeAverageResponseLatencyMs / summarizeErrorType ----

test("computeAccuracy: perfect play scores 1.0", () => {
  let session = buildDeterministicSession(1000);
  session = pressGo(session, session.trialStartedAt + 200); // trial 0 go -> hit
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 1 no-go, no press -> correct withhold
  session = pressGo(session, session.trialStartedAt + 200); // trial 2 go -> hit
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 3 no-go, no press -> correct withhold
  assert.equal(computeAccuracy(session), 1);
});

test("computeAccuracy: all wrong scores 0", () => {
  let session = buildDeterministicSession(1000);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 0 go, no press -> omission
  session = pressGo(session, session.trialStartedAt + 100); // trial 1 no-go, press -> commission
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 2 go, no press -> omission
  session = pressGo(session, session.trialStartedAt + 100); // trial 3 no-go, press -> commission
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  assert.equal(computeAccuracy(session), 0);
});

test("computeAccuracy: partial credit for a mixed round (2 of 4 correct)", () => {
  let session = buildDeterministicSession(1000);
  session = pressGo(session, session.trialStartedAt + 200); // trial 0 go -> hit (correct)
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = pressGo(session, session.trialStartedAt + 100); // trial 1 no-go -> commission (wrong)
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 2 go, no press -> omission (wrong)
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 3 no-go, no press -> correct withhold (correct)
  assert.equal(computeAccuracy(session), 2 / 4);
});

test("computeAverageResponseLatencyMs averages only over HIT trials, not commission-error presses", () => {
  let session = buildDeterministicSession(1000);
  session = pressGo(session, session.trialStartedAt + 300); // trial 0 go -> hit, latency 300
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = pressGo(session, session.trialStartedAt + 999); // trial 1 no-go -> commission, latency 999 (should NOT count)
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = pressGo(session, session.trialStartedAt + 500); // trial 2 go -> hit, latency 500
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 3 no-go, no press
  // Only the two hits count: (300 + 500) / 2 = 400
  assert.equal(computeAverageResponseLatencyMs(session), 400);
});

test("computeAverageResponseLatencyMs returns 0 if there were no hits", () => {
  let session = buildDeterministicSession(1000);
  for (let i = 0; i < 4; i++) {
    session = advanceToNextTrial(session, session.trialStartedAt + 1500); // never press
  }
  assert.equal(computeAverageResponseLatencyMs(session), 0);
});

test("summarizeErrorType: none when there are zero omissions and zero commissions", () => {
  let session = buildDeterministicSession(1000);
  session = pressGo(session, session.trialStartedAt + 200);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = pressGo(session, session.trialStartedAt + 200);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  assert.equal(summarizeErrorType(session), "none");
});

test("summarizeErrorType: omission-error when only omissions occurred", () => {
  let session = buildDeterministicSession(1000);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 0 go, omission
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 1 no-go, correct withhold
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 2 go, omission
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 3 no-go, correct withhold
  assert.equal(session.omissionErrors > 0, true);
  assert.equal(session.commissionErrors, 0);
  assert.equal(summarizeErrorType(session), "omission-error");
});

test("summarizeErrorType: commission-error when only commissions occurred", () => {
  let session = buildDeterministicSession(1000);
  session = pressGo(session, session.trialStartedAt + 200); // trial 0 go, hit
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = pressGo(session, session.trialStartedAt + 100); // trial 1 no-go, commission
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = pressGo(session, session.trialStartedAt + 200); // trial 2 go, hit
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = pressGo(session, session.trialStartedAt + 100); // trial 3 no-go, commission
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  assert.equal(session.commissionErrors > 0, true);
  assert.equal(session.omissionErrors, 0);
  assert.equal(summarizeErrorType(session), "commission-error");
});

test("summarizeErrorType: mixed-errors when both omissions and commissions occurred", () => {
  let session = buildDeterministicSession(1000);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 0 go, omission
  session = pressGo(session, session.trialStartedAt + 100); // trial 1 no-go, commission
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 2 go, omission
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // trial 3 no-go, correct withhold
  assert.equal(session.omissionErrors > 0, true);
  assert.equal(session.commissionErrors > 0, true);
  assert.equal(summarizeErrorType(session), "mixed-errors");
});

// ---- buildSessionEvent ----

test("buildSessionEvent produces a valid GameSessionEvent for a perfect round", () => {
  let session = buildDeterministicSession(1000);
  session = pressGo(session, session.trialStartedAt + 200);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = pressGo(session, session.trialStartedAt + 200);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);

  const event = buildSessionEvent(session);
  assert.equal(event.gameId, "reaction-attention");
  assert.equal(event.difficultyLevel, 1);
  assert.equal(event.accuracy, 1);
  assert.equal(event.errorType, "none");

  const errors = validateGameSessionEvent(event);
  assert.deepEqual(errors, []);
});

test("buildSessionEvent produces a valid GameSessionEvent for a mixed-error round", () => {
  let session = buildDeterministicSession(1000);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // omission
  session = pressGo(session, session.trialStartedAt + 100); // commission
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // omission
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // correct withhold

  const event = buildSessionEvent(session);
  assert.equal(event.errorType, "mixed-errors");

  const errors = validateGameSessionEvent(event);
  assert.deepEqual(errors, []);
});

test("buildSessionEvent never leaks a patientId or other identifying field", () => {
  let session = buildDeterministicSession(1000);
  session = pressGo(session, session.trialStartedAt + 200);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = pressGo(session, session.trialStartedAt + 200);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500);

  const event = buildSessionEvent(session);
  assert.equal("patientId" in event, false);
  assert.equal("email" in event, false);
  assert.equal("name" in event, false);
});

test("buildSessionEvent throws if the session isn't complete yet", () => {
  let session = buildDeterministicSession(1000);
  session = advanceToNextTrial(session, session.trialStartedAt + 1500); // only 1 of 4 trials done
  assert.throws(() => buildSessionEvent(session), /requires phase "complete"/);
});
