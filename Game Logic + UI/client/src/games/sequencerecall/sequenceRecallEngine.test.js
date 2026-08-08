import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_GRID_SIZE,
  PHASES,
  OUTCOMES,
  generateSequence,
  createSequenceRecallSession,
  advanceShowing,
  submitResponse,
  computeAccuracy,
  computeAverageResponseLatencyMs,
  summarizeErrorType,
  buildSessionEvent,
} from "./sequenceRecallEngine.js";

import { validateGameSessionEvent } from "../../shared/eventSchema.js";

function makeQueueRandom(values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

// ---- generateSequence ----

test("generateSequence produces the requested length", () => {
  const seq = generateSequence(6, 9, Math.random);
  assert.equal(seq.length, 6);
});

test("generateSequence: hand-verified deterministic case matches exact expected output", () => {
  // gridSize=9, one randomFn call per position: floor(v * 9)
  const values = [0.0, 0.5, 0.99, 0.11, 0.89, 0.33];
  const seq = generateSequence(6, 9, makeQueueRandom(values));
  // floor(0*9)=0, floor(0.5*9)=4, floor(0.99*9)=8, floor(0.11*9)=0, floor(0.89*9)=8, floor(0.33*9)=2
  assert.deepEqual(seq, [0, 4, 8, 0, 8, 2]);
});

test("generateSequence: every value falls within [0, gridSize)", () => {
  const seq = generateSequence(100, 9, Math.random);
  for (const v of seq) {
    assert.ok(v >= 0 && v < 9);
  }
});

test("generateSequence allows consecutive repeats (no anti-repeat constraint)", () => {
  // constant randomFn -> every position identical, and that's valid for this engine
  const seq = generateSequence(5, 9, () => 0.5);
  assert.deepEqual(seq, [4, 4, 4, 4, 4]);
});

test("generateSequence throws on invalid length", () => {
  assert.throws(() => generateSequence(0, 9), /length must be a positive integer/);
  assert.throws(() => generateSequence(-1, 9), /length must be a positive integer/);
});

test("generateSequence throws on gridSize < 2", () => {
  assert.throws(() => generateSequence(5, 1), /gridSize must be an integer >= 2/);
});

// ---- createSequenceRecallSession ----

test("createSequenceRecallSession uses difficultyConfig's sequenceLength/showIntervalMs per level", () => {
  // From difficultyConfig.js: level 1 -> length 3 / 900ms, level 5 -> length 7 / 500ms
  const level1 = createSequenceRecallSession(1, 1000);
  const level5 = createSequenceRecallSession(5, 1000);
  assert.equal(level1.sequenceLength, 3);
  assert.equal(level1.showIntervalMs, 900);
  assert.equal(level5.sequenceLength, 7);
  assert.equal(level5.showIntervalMs, 500);
});

test("createSequenceRecallSession starts in SHOWING phase at showIndex 0", () => {
  const session = createSequenceRecallSession(1, 5000);
  assert.equal(session.phase, PHASES.SHOWING);
  assert.equal(session.showIndex, 0);
  assert.equal(session.showStepStartedAt, 5000);
  assert.equal(session.inputs.length, 0);
  assert.equal(session.correctCount, 0);
  assert.equal(session.completedAt, null);
});

test("createSequenceRecallSession defaults gridSize when not overridden", () => {
  const session = createSequenceRecallSession(1, 1000);
  assert.equal(session.gridSize, DEFAULT_GRID_SIZE);
});

test("createSequenceRecallSession is deterministic with an injected randomFn", () => {
  const a = createSequenceRecallSession(1, 1000, { randomFn: makeQueueRandom([0.1, 0.2, 0.3]) });
  const b = createSequenceRecallSession(1, 1000, { randomFn: makeQueueRandom([0.1, 0.2, 0.3]) });
  assert.deepEqual(a.sequence, b.sequence);
});

test("createSequenceRecallSession returns a frozen session with frozen arrays", () => {
  const session = createSequenceRecallSession(1, 1000);
  assert.equal(Object.isFrozen(session), true);
  assert.equal(Object.isFrozen(session.sequence), true);
  assert.equal(Object.isFrozen(session.inputs), true);
});

test("createSequenceRecallSession throws on invalid createdAt", () => {
  assert.throws(() => createSequenceRecallSession(1, "now"), /createdAt must be a number/);
});

test("createSequenceRecallSession throws on invalid difficultyLevel (delegates to difficultyConfig)", () => {
  assert.throws(() => createSequenceRecallSession(9, 1000), /must be an integer between/);
});

// ---- session flow: advanceShowing / submitResponse ----

/**
 * Builds a deterministic level-1 session (sequenceLength=3, showIntervalMs=900,
 * gridSize=9) with a hand-verified sequence, then fully plays back the
 * SHOWING phase so the caller starts at INPUT.
 *   values -> sequence = [0, 4, 8] (see generateSequence hand-verified test)
 */
function buildSessionAtInputPhase(createdAt = 1000) {
  let session = createSequenceRecallSession(1, createdAt, {
    randomFn: makeQueueRandom([0.0, 0.5, 0.99]),
  });
  assert.deepEqual(session.sequence, [0, 4, 8]); // sanity check on the fixture itself
  session = advanceShowing(session, createdAt + 900); // showIndex 0 -> 1
  session = advanceShowing(session, createdAt + 1800); // showIndex 1 -> 2
  session = advanceShowing(session, createdAt + 2700); // showIndex 2 -> finished showing -> INPUT
  return session;
}

test("advanceShowing steps through showIndex and stays in SHOWING until the last position", () => {
  let session = createSequenceRecallSession(1, 1000, { randomFn: makeQueueRandom([0.0, 0.5, 0.99]) });
  session = advanceShowing(session, 1900);
  assert.equal(session.phase, PHASES.SHOWING);
  assert.equal(session.showIndex, 1);
  session = advanceShowing(session, 2800);
  assert.equal(session.phase, PHASES.SHOWING);
  assert.equal(session.showIndex, 2);
});

test("advanceShowing transitions to INPUT phase after the final position", () => {
  const session = buildSessionAtInputPhase(1000);
  assert.equal(session.phase, PHASES.INPUT);
  assert.equal(session.inputStartedAt, 1000 + 2700);
  assert.equal(session.lastInputAt, 1000 + 2700);
});

test("advanceShowing throws when called outside SHOWING phase", () => {
  const session = buildSessionAtInputPhase(1000);
  assert.throws(() => advanceShowing(session, 9999), /invalid phase "input"/);
});

test("advanceShowing throws on invalid timestamp", () => {
  const session = createSequenceRecallSession(1, 1000);
  assert.throws(() => advanceShowing(session, "later"), /timestamp must be a number/);
});

test("submitResponse: correct selection scores CORRECT and increments correctCount", () => {
  let session = buildSessionAtInputPhase(1000);
  session = submitResponse(session, 0, 1000 + 2700 + 400); // sequence[0] === 0
  assert.equal(session.outcomes[0], OUTCOMES.CORRECT);
  assert.equal(session.correctCount, 1);
  assert.equal(session.responseLatencies[0], 400);
});

test("submitResponse: incorrect selection scores INCORRECT and does not increment correctCount", () => {
  let session = buildSessionAtInputPhase(1000);
  session = submitResponse(session, 7, 1000 + 2700 + 400); // sequence[0] === 0, player picked 7
  assert.equal(session.outcomes[0], OUTCOMES.INCORRECT);
  assert.equal(session.correctCount, 0);
});

test("full deterministic round: mixed correct/incorrect classification and completion", () => {
  let session = buildSessionAtInputPhase(1000); // sequence = [0, 4, 8]
  const t0 = session.inputStartedAt;

  session = submitResponse(session, 0, t0 + 300); // correct
  assert.equal(session.phase, PHASES.INPUT);
  assert.equal(session.outcomes[0], OUTCOMES.CORRECT);

  session = submitResponse(session, 1, t0 + 300 + 500); // wrong (expected 4)
  assert.equal(session.phase, PHASES.INPUT);
  assert.equal(session.outcomes[1], OUTCOMES.INCORRECT);

  session = submitResponse(session, 8, t0 + 300 + 500 + 250); // correct, and last input
  assert.equal(session.phase, PHASES.COMPLETE);
  assert.equal(session.outcomes[2], OUTCOMES.CORRECT);
  assert.equal(session.completedAt, t0 + 300 + 500 + 250);
  assert.equal(session.correctCount, 2);
});

test("submitResponse continues collecting inputs after an early mistake (fixed-length round)", () => {
  let session = buildSessionAtInputPhase(1000);
  session = submitResponse(session, 7, session.inputStartedAt + 100); // wrong
  assert.equal(session.phase, PHASES.INPUT, "round should not end early on a mistake");
  session = submitResponse(session, 7, session.lastInputAt + 100); // wrong again
  session = submitResponse(session, 7, session.lastInputAt + 100); // wrong again, now complete
  assert.equal(session.phase, PHASES.COMPLETE);
  assert.equal(session.correctCount, 0);
  assert.equal(session.inputs.length, 3);
});

test("submitResponse does not mutate the input session (pure function)", () => {
  const session = buildSessionAtInputPhase(1000);
  const before = session;
  submitResponse(session, 0, session.inputStartedAt + 100);
  assert.equal(before.inputs.length, 0);
});

test("submitResponse throws when called outside INPUT phase", () => {
  const session = createSequenceRecallSession(1, 1000); // still SHOWING
  assert.throws(() => submitResponse(session, 0, 1500), /invalid phase "showing"/);
});

test("submitResponse throws once session is COMPLETE", () => {
  let session = buildSessionAtInputPhase(1000);
  for (let i = 0; i < 3; i++) {
    session = submitResponse(session, 0, session.lastInputAt + 100);
  }
  assert.equal(session.phase, PHASES.COMPLETE);
  assert.throws(() => submitResponse(session, 0, 999999), /invalid phase "complete"/);
});

test("submitResponse throws on out-of-range position", () => {
  const session = buildSessionAtInputPhase(1000);
  assert.throws(() => submitResponse(session, -1, session.inputStartedAt + 100), /position must be an integer between/);
  assert.throws(() => submitResponse(session, 9, session.inputStartedAt + 100), /position must be an integer between/);
  assert.throws(() => submitResponse(session, 1.5, session.inputStartedAt + 100), /position must be an integer between/);
});

test("submitResponse throws on invalid timestamp", () => {
  const session = buildSessionAtInputPhase(1000);
  assert.throws(() => submitResponse(session, 0, "later"), /timestamp must be a number/);
});

test("submitResponse throws if timestamp is before lastInputAt", () => {
  const session = buildSessionAtInputPhase(1000);
  assert.throws(() => submitResponse(session, 0, session.lastInputAt - 10), /cannot be before lastInputAt/);
});

// ---- computeAccuracy / computeAverageResponseLatencyMs / summarizeErrorType ----

function runFullRoundWithSelections(selections) {
  let session = buildSessionAtInputPhase(1000); // sequence = [0, 4, 8]
  for (const sel of selections) {
    session = submitResponse(session, sel, session.lastInputAt + 200);
  }
  return session;
}

test("computeAccuracy: perfect play scores 1.0", () => {
  const session = runFullRoundWithSelections([0, 4, 8]);
  assert.equal(computeAccuracy(session), 1);
});

test("computeAccuracy: all wrong scores 0", () => {
  const session = runFullRoundWithSelections([1, 1, 1]);
  assert.equal(computeAccuracy(session), 0);
});

test("computeAccuracy: partial credit for a mixed round", () => {
  const session = runFullRoundWithSelections([0, 1, 8]); // 2 of 3 correct
  assert.equal(computeAccuracy(session), 2 / 3);
});

test("computeAverageResponseLatencyMs averages latency across all recorded inputs", () => {
  const session = runFullRoundWithSelections([0, 4, 8]); // 200ms latency each, from the helper
  assert.equal(computeAverageResponseLatencyMs(session), 200);
});

test("computeAverageResponseLatencyMs returns 0 when no inputs have been recorded yet", () => {
  const session = buildSessionAtInputPhase(1000);
  assert.equal(computeAverageResponseLatencyMs(session), 0);
});

test("summarizeErrorType: none when every position was correct", () => {
  const session = runFullRoundWithSelections([0, 4, 8]);
  assert.equal(summarizeErrorType(session), "none");
});

test("summarizeErrorType: position-error when at least one position was wrong", () => {
  const session = runFullRoundWithSelections([0, 1, 8]);
  assert.equal(summarizeErrorType(session), "position-error");
});

// ---- buildSessionEvent ----

test("buildSessionEvent produces a valid GameSessionEvent for a perfect round", () => {
  const session = runFullRoundWithSelections([0, 4, 8]);
  const event = buildSessionEvent(session);
  assert.equal(event.gameId, "sequence-recall");
  assert.equal(event.difficultyLevel, 1);
  assert.equal(event.accuracy, 1);
  assert.equal(event.errorType, "none");

  const errors = validateGameSessionEvent(event);
  assert.deepEqual(errors, []);
});

test("buildSessionEvent produces a valid GameSessionEvent for a round with errors", () => {
  const session = runFullRoundWithSelections([0, 1, 8]);
  const event = buildSessionEvent(session);
  assert.equal(event.errorType, "position-error");

  const errors = validateGameSessionEvent(event);
  assert.deepEqual(errors, []);
});

test("buildSessionEvent never leaks a patientId or other identifying field", () => {
  const session = runFullRoundWithSelections([0, 4, 8]);
  const event = buildSessionEvent(session);
  assert.equal("patientId" in event, false);
  assert.equal("email" in event, false);
  assert.equal("name" in event, false);
});

test("buildSessionEvent throws if the session isn't complete yet", () => {
  const session = buildSessionAtInputPhase(1000); // 0 of 3 inputs submitted
  assert.throws(() => buildSessionEvent(session), /requires phase "complete"/);
});
