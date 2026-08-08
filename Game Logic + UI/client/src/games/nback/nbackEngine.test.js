import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_STIMULUS_SET_SIZE,
  DEFAULT_TRIAL_COUNT,
  PHASES,
  OUTCOMES,
  generateStimulusSequence,
  createNBackSession,
  pressMatch,
  advanceToNextTrial,
  computeAccuracy,
  computeAverageResponseLatencyMs,
  summarizeErrorType,
  buildSessionEvent,
} from "./nbackEngine.js";

import { validateGameSessionEvent } from "../../shared/eventSchema.js";

function makeQueueRandom(values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

function makeConstantRandom(value) {
  return () => value;
}

// ---- generateStimulusSequence ----

test("generateStimulusSequence produces the requested length", () => {
  const { stimuli, isMatchAt } = generateStimulusSequence(10, 2, 6, 0.3, Math.random);
  assert.equal(stimuli.length, 10);
  assert.equal(isMatchAt.length, 10);
});

test("generateStimulusSequence: warm-up trials (i < n) are always isMatchAt = false", () => {
  const n = 3;
  const { isMatchAt } = generateStimulusSequence(10, n, 6, 0.5, Math.random);
  for (let i = 0; i < n; i++) {
    assert.equal(isMatchAt[i], false);
  }
});

test("generateStimulusSequence: hand-verified deterministic case matches exact expected output", () => {
  // n=2, stimulusSetSize=4, matchProbability=0.5, length=6
  // Values chosen and hand-traced against the engine's exact call order:
  //   i=0 (warmup): 1 call -> stimulus
  //   i=1 (warmup): 1 call -> stimulus
  //   i=2 (scored, target=stimuli[0]): 1 call (decide) -> match -> stimuli[2]=stimuli[0]
  //   i=3 (scored, target=stimuli[1]): 1 call (decide=non-match) + 1 call (pick, first try succeeds)
  //   i=4 (scored, target=stimuli[2]): 1 call (decide) -> match -> stimuli[4]=stimuli[2]
  //   i=5 (scored, target=stimuli[3]): 1 call (decide=non-match) + 1 call (pick, first try succeeds)
  const values = [0.1, 0.6, 0.2, 0.8, 0.05, 0.1, 0.9, 0.6];
  const { stimuli, isMatchAt } = generateStimulusSequence(6, 2, 4, 0.5, makeQueueRandom(values));

  assert.deepEqual(stimuli, [0, 2, 0, 0, 0, 2]);
  assert.deepEqual(isMatchAt, [false, false, true, false, true, false]);
});

test("generateStimulusSequence: isMatchAt is always consistent with the actual stimuli generated (ground truth check)", () => {
  const n = 2;
  const { stimuli, isMatchAt } = generateStimulusSequence(30, n, 5, 0.4, Math.random);
  for (let i = n; i < stimuli.length; i++) {
    const actualMatch = stimuli[i] === stimuli[i - n];
    assert.equal(
      isMatchAt[i],
      actualMatch,
      `isMatchAt[${i}] claims ${isMatchAt[i]} but stimuli says ${actualMatch}`
    );
  }
});

test("generateStimulusSequence: roughly matches the target matchProbability over many scored trials (statistical)", () => {
  const n = 1;
  const matchProbability = 0.3;
  const { isMatchAt } = generateStimulusSequence(2000, n, 8, matchProbability, Math.random);
  const scored = isMatchAt.slice(n);
  const matchRate = scored.filter(Boolean).length / scored.length;
  // Generous tolerance band since this is inherently probabilistic.
  assert.ok(
    Math.abs(matchRate - matchProbability) < 0.05,
    `match rate ${matchRate} too far from target ${matchProbability}`
  );
});

test("generateStimulusSequence: pathological constant randomFn does not infinite-loop and still resolves ground truth", () => {
  // constant 0.9 with n=1, stimulusSetSize=3, matchProbability=0.5:
  // decide = 0.9 < 0.5 -> false (non-match) every scored trial, forcing the
  // anti-collision fallback repeatedly. Should terminate, not hang.
  const { stimuli, isMatchAt } = generateStimulusSequence(8, 1, 3, 0.5, makeConstantRandom(0.9));
  assert.equal(stimuli.length, 8);
  for (let i = 1; i < stimuli.length; i++) {
    // every scored trial was forced non-match
    assert.equal(isMatchAt[i], false);
    assert.notEqual(stimuli[i], stimuli[i - 1]);
  }
});

test("generateStimulusSequence throws when length <= n", () => {
  assert.throws(() => generateStimulusSequence(3, 3, 6), /must be greater than n/);
  assert.throws(() => generateStimulusSequence(2, 3, 6), /must be greater than n/);
});

test("generateStimulusSequence throws on invalid n", () => {
  assert.throws(() => generateStimulusSequence(10, 0, 6), /n must be a positive integer/);
  assert.throws(() => generateStimulusSequence(10, -1, 6), /n must be a positive integer/);
});

test("generateStimulusSequence throws on stimulusSetSize < 2", () => {
  assert.throws(() => generateStimulusSequence(10, 2, 1), /stimulusSetSize must be an integer >= 2/);
});

test("generateStimulusSequence throws on out-of-range matchProbability", () => {
  assert.throws(() => generateStimulusSequence(10, 2, 6, 1.5), /matchProbability must be a number between 0 and 1/);
  assert.throws(() => generateStimulusSequence(10, 2, 6, -0.1), /matchProbability must be a number between 0 and 1/);
});

// ---- createNBackSession ----

test("createNBackSession uses difficultyConfig's n per level", () => {
  // From difficultyConfig.js: level 1 -> n=1, level 3 -> n=2, level 5 -> n=3
  const level1 = createNBackSession(1, 1000, { trialCount: 10 });
  const level3 = createNBackSession(3, 1000, { trialCount: 10 });
  const level5 = createNBackSession(5, 1000, { trialCount: 10 });
  assert.equal(level1.n, 1);
  assert.equal(level3.n, 2);
  assert.equal(level5.n, 3);
});

test("createNBackSession starts IN_PROGRESS at trial 0 with trialStartedAt = createdAt", () => {
  const session = createNBackSession(1, 5000, { trialCount: 10 });
  assert.equal(session.phase, PHASES.IN_PROGRESS);
  assert.equal(session.currentIndex, 0);
  assert.equal(session.trialStartedAt, 5000);
  assert.equal(session.hits, 0);
  assert.equal(session.misses, 0);
  assert.equal(session.falseAlarms, 0);
  assert.equal(session.correctRejections, 0);
  assert.equal(session.completedAt, null);
});

test("createNBackSession defaults trialCount and stimulusSetSize when not overridden", () => {
  const session = createNBackSession(1, 1000);
  assert.equal(session.stimuli.length, DEFAULT_TRIAL_COUNT);
  assert.equal(session.stimulusSetSize, DEFAULT_STIMULUS_SET_SIZE);
});

test("createNBackSession is deterministic with an injected randomFn", () => {
  const opts = { trialCount: 8, randomFn: makeQueueRandom([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) };
  const a = createNBackSession(1, 1000, opts);
  const b = createNBackSession(
    1,
    1000,
    { trialCount: 8, randomFn: makeQueueRandom([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) }
  );
  assert.deepEqual(a.stimuli, b.stimuli);
  assert.deepEqual(a.isMatchAt, b.isMatchAt);
});

test("createNBackSession returns a frozen session with frozen arrays", () => {
  const session = createNBackSession(1, 1000, { trialCount: 5 });
  assert.equal(Object.isFrozen(session), true);
  assert.equal(Object.isFrozen(session.stimuli), true);
  assert.equal(Object.isFrozen(session.responses), true);
});

test("createNBackSession throws on invalid createdAt", () => {
  assert.throws(() => createNBackSession(1, "now"), /createdAt must be a number/);
});

test("createNBackSession throws on invalid difficultyLevel (delegates to difficultyConfig)", () => {
  assert.throws(() => createNBackSession(9, 1000), /must be an integer between/);
});

// ---- session flow: pressMatch / advanceToNextTrial ----

/**
 * Builds a fully deterministic 6-trial session: n=2, stimulusSetSize=4,
 * matchProbability=0.5, reusing the hand-verified sequence from the
 * generateStimulusSequence test above:
 *   stimuli    = [0, 2, 0, 0, 0, 2]
 *   isMatchAt  = [false, false, true, false, true, false]
 * i=0,1: warmup. i=2: match. i=3: non-match. i=4: match. i=5: non-match.
 */
function buildDeterministicSession(createdAt = 1000) {
  const values = [0.1, 0.6, 0.2, 0.8, 0.05, 0.1, 0.9, 0.6];
  return createNBackSession(3, createdAt, {
    trialCount: 6,
    stimulusSetSize: 4,
    matchProbability: 0.5,
    randomFn: makeQueueRandom(values),
  });
  // Note: difficulty level 3 gives n=2 per difficultyConfig, matching the plan above.
}

test("advanceToNextTrial: warmup trials are never scored regardless of press", () => {
  let session = buildDeterministicSession(1000);
  session = advanceToNextTrial(session, 1200); // trial 0, warmup, no press
  assert.equal(session.outcomes[0], OUTCOMES.WARMUP);
  assert.equal(session.warmupCount, 1);
  assert.equal(session.hits + session.misses + session.falseAlarms + session.correctRejections, 0);
});

test("full deterministic round: correct hit/miss/false-alarm/correct-rejection classification", () => {
  let session = buildDeterministicSession(1000);

  // Trial 0 (warmup): no press
  session = advanceToNextTrial(session, 1200);
  assert.equal(session.outcomes[0], OUTCOMES.WARMUP);

  // Trial 1 (warmup): no press
  session = advanceToNextTrial(session, 1400);
  assert.equal(session.outcomes[1], OUTCOMES.WARMUP);

  // Trial 2 (isMatch=true): player presses -> HIT
  session = pressMatch(session, 1450);
  session = advanceToNextTrial(session, 1600);
  assert.equal(session.outcomes[2], OUTCOMES.HIT);
  assert.equal(session.hits, 1);
  assert.equal(session.responseLatencies[2], 50); // 1450 - 1400 (trialStartedAt was set to 1400 after trial 1)

  // Trial 3 (isMatch=false): player does NOT press -> CORRECT_REJECTION
  session = advanceToNextTrial(session, 1800);
  assert.equal(session.outcomes[3], OUTCOMES.CORRECT_REJECTION);
  assert.equal(session.correctRejections, 1);

  // Trial 4 (isMatch=true): player does NOT press -> MISS
  session = advanceToNextTrial(session, 2000);
  assert.equal(session.outcomes[4], OUTCOMES.MISS);
  assert.equal(session.misses, 1);

  // Trial 5 (isMatch=false): player presses anyway -> FALSE_ALARM
  session = pressMatch(session, 2050);
  session = advanceToNextTrial(session, 2200);
  assert.equal(session.outcomes[5], OUTCOMES.FALSE_ALARM);
  assert.equal(session.falseAlarms, 1);

  assert.equal(session.phase, PHASES.COMPLETE);
  assert.equal(session.completedAt, 2200);
});

test("pressMatch does not mutate the input session (pure function)", () => {
  let session = buildDeterministicSession(1000);
  session = advanceToNextTrial(session, 1200); // trial 0
  session = advanceToNextTrial(session, 1400); // trial 1, now at trial 2
  const before = session;
  pressMatch(session, 1450);
  assert.equal(before.responses[2], null);
});

test("pressMatch throws if called twice in the same trial", () => {
  let session = buildDeterministicSession(1000);
  session = advanceToNextTrial(session, 1200);
  session = advanceToNextTrial(session, 1400); // now at trial 2
  session = pressMatch(session, 1450);
  assert.throws(() => pressMatch(session, 1470), /pressMatch called twice/);
});

test("pressMatch throws if timestamp is before trialStartedAt", () => {
  let session = buildDeterministicSession(1000);
  assert.throws(() => pressMatch(session, 500), /cannot be before trialStartedAt/);
});

test("pressMatch throws once session is COMPLETE", () => {
  let session = buildDeterministicSession(1000);
  for (let i = 0; i < 6; i++) {
    session = advanceToNextTrial(session, 1000 + (i + 1) * 200);
  }
  assert.equal(session.phase, PHASES.COMPLETE);
  assert.throws(() => pressMatch(session, 9999), /invalid phase "complete"/);
});

test("advanceToNextTrial throws once session is already COMPLETE", () => {
  let session = buildDeterministicSession(1000);
  for (let i = 0; i < 6; i++) {
    session = advanceToNextTrial(session, 1000 + (i + 1) * 200);
  }
  assert.throws(() => advanceToNextTrial(session, 9999), /invalid phase "complete"/);
});

test("advanceToNextTrial throws on invalid timestamp", () => {
  const session = buildDeterministicSession(1000);
  assert.throws(() => advanceToNextTrial(session, "later"), /timestamp must be a number/);
});

// ---- computeAccuracy / computeAverageResponseLatencyMs / summarizeErrorType ----

function runFullDeterministicRoundWithPresses(pressAtIndices) {
  let session = buildDeterministicSession(1000);
  for (let i = 0; i < 6; i++) {
    const trialStart = session.trialStartedAt;
    if (pressAtIndices.includes(i)) {
      session = pressMatch(session, trialStart + 50);
    }
    session = advanceToNextTrial(session, trialStart + 200);
  }
  return session;
}

test("computeAccuracy: perfect play (hit on matches, no press on non-matches) scores 1.0", () => {
  // scored matches at indices 2 and 4; correctly press only those.
  const session = runFullDeterministicRoundWithPresses([2, 4]);
  assert.equal(computeAccuracy(session), 1);
});

test("computeAccuracy: all wrong scores 0", () => {
  // scored trials: 2(match),3(non-match),4(match),5(non-match).
  // Press on the non-matches (3,5) and skip the matches (2,4) -> all 4 wrong.
  const session = runFullDeterministicRoundWithPresses([3, 5]);
  assert.equal(computeAccuracy(session), 0);
});

test("computeAccuracy: partial credit for a mixed round", () => {
  // Press correctly on match at 2 (hit), skip match at 4 (miss),
  // correctly skip non-match at 3 (correct rejection), press wrongly on non-match at 5 (false alarm).
  const session = runFullDeterministicRoundWithPresses([2, 5]);
  assert.equal(computeAccuracy(session), 2 / 4); // hit(2) + correctRejection(3) = 2 of 4 scored
});

test("computeAverageResponseLatencyMs averages only over trials with an actual press", () => {
  const session = runFullDeterministicRoundWithPresses([2, 5]);
  // Both presses happen 50ms after their trial start in the helper above.
  assert.equal(computeAverageResponseLatencyMs(session), 50);
});

test("computeAverageResponseLatencyMs returns 0 if the player never pressed", () => {
  const session = runFullDeterministicRoundWithPresses([]);
  assert.equal(computeAverageResponseLatencyMs(session), 0);
});

test("summarizeErrorType: none when there are zero misses and zero false alarms", () => {
  const session = runFullDeterministicRoundWithPresses([2, 4]); // both hits, no misses/false-alarms
  assert.equal(summarizeErrorType(session), "none");
});

test("summarizeErrorType: miss when only misses occurred", () => {
  // press correctly on 2 (hit) but skip 4 (miss); correctly skip 3 (correct rejection); skip 5 too (correct rejection)
  const session = runFullDeterministicRoundWithPresses([2]);
  assert.equal(session.misses > 0, true);
  assert.equal(session.falseAlarms, 0);
  assert.equal(summarizeErrorType(session), "miss");
});

test("summarizeErrorType: false-alarm when only false alarms occurred", () => {
  // hit both matches (2,4), but also wrongly press non-match 3 -> false alarm; skip 5 correctly.
  const session = runFullDeterministicRoundWithPresses([2, 3, 4]);
  assert.equal(session.falseAlarms > 0, true);
  assert.equal(session.misses, 0);
  assert.equal(summarizeErrorType(session), "false-alarm");
});

test("summarizeErrorType: mixed-errors when both misses and false alarms occurred", () => {
  // skip match 2 (miss), press non-match 3 (false alarm), skip match 4 (miss), skip non-match 5 (correct rejection)
  const session = runFullDeterministicRoundWithPresses([3]);
  assert.equal(session.misses > 0, true);
  assert.equal(session.falseAlarms > 0, true);
  assert.equal(summarizeErrorType(session), "mixed-errors");
});

// ---- buildSessionEvent ----

test("buildSessionEvent produces a valid GameSessionEvent for a perfect round", () => {
  const session = runFullDeterministicRoundWithPresses([2, 4]);
  const event = buildSessionEvent(session);
  assert.equal(event.gameId, "n-back");
  assert.equal(event.difficultyLevel, 3);
  assert.equal(event.accuracy, 1);
  assert.equal(event.errorType, "none");

  const errors = validateGameSessionEvent(event);
  assert.deepEqual(errors, []);
});

test("buildSessionEvent produces a valid GameSessionEvent for a mixed-error round", () => {
  const session = runFullDeterministicRoundWithPresses([3]);
  const event = buildSessionEvent(session);
  assert.equal(event.errorType, "mixed-errors");

  const errors = validateGameSessionEvent(event);
  assert.deepEqual(errors, []);
});

test("buildSessionEvent never leaks a patientId or other identifying field", () => {
  const session = runFullDeterministicRoundWithPresses([2, 4]);
  const event = buildSessionEvent(session);
  assert.equal("patientId" in event, false);
  assert.equal("email" in event, false);
  assert.equal("name" in event, false);
});

test("buildSessionEvent throws if the session isn't complete yet", () => {
  let session = buildDeterministicSession(1000);
  session = advanceToNextTrial(session, 1200); // only 1 of 6 trials done
  assert.throws(() => buildSessionEvent(session), /requires phase "complete"/);
});
