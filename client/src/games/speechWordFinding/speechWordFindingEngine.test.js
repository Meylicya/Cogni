import test from "node:test";
import assert from "node:assert/strict";

import {
  PHASES,
  OUTCOMES,
  normalizeAnswer,
  isAnswerCorrect,
  selectPrompts,
  createSpeechWordFindingSession,
  submitAnswer,
  advanceOnTimeout,
  computeAccuracy,
  computeAverageResponseLatencyMs,
  summarizeErrorType,
  buildSessionEvent,
} from "./speechWordFindingEngine.js";

import { validateGameSessionEvent } from "../../../../shared/eventSchema.js";
import { WORD_FINDING_PROMPTS } from "./wordFindingPrompts.js";

function makeQueueRandom(values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

// ---- normalizeAnswer / isAnswerCorrect ----

test("normalizeAnswer lowercases, trims, and strips trailing punctuation", () => {
  assert.equal(normalizeAnswer("  Dog.  "), "dog");
  assert.equal(normalizeAnswer("The Sun!"), "the sun");
});

test("isAnswerCorrect accepts target and acceptable aliases", () => {
  const prompt = { target: "autumn", acceptable: ["autumn", "fall"] };
  assert.equal(isAnswerCorrect("Fall", prompt), true);
  assert.equal(isAnswerCorrect("summer", prompt), false);
});

test("isAnswerCorrect rejects empty or whitespace-only answers", () => {
  const prompt = { target: "dog", acceptable: ["dog"] };
  assert.equal(isAnswerCorrect("   ", prompt), false);
});

// ---- selectPrompts ----

test("selectPrompts returns the requested count of distinct prompts", () => {
  const prompts = selectPrompts(6, Math.random);
  assert.equal(prompts.length, 6);
  const ids = new Set(prompts.map((p) => p.id));
  assert.equal(ids.size, 6);
});

test("selectPrompts is deterministic with an injected randomFn", () => {
  const randomFn = makeQueueRandom([0.0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  const a = selectPrompts(3, randomFn);
  const b = selectPrompts(3, makeQueueRandom([0.0, 0.1, 0.2, 0.3, 0.4, 0.5]));
  assert.deepEqual(a.map((p) => p.id), b.map((p) => p.id));
});

test("selectPrompts throws when count exceeds bank size", () => {
  assert.throws(
    () => selectPrompts(WORD_FINDING_PROMPTS.length + 1),
    /exceeds prompt bank size/
  );
});

// ---- createSpeechWordFindingSession ----

test("createSpeechWordFindingSession uses difficultyConfig promptCount/responseWindowMs", () => {
  const level1 = createSpeechWordFindingSession(1, 1000);
  const level5 = createSpeechWordFindingSession(5, 1000);
  assert.equal(level1.promptCount, 6);
  assert.equal(level1.responseWindowMs, 8000);
  assert.equal(level5.promptCount, 12);
  assert.equal(level5.responseWindowMs, 4000);
});

test("createSpeechWordFindingSession starts in IN_PROGRESS at prompt 0", () => {
  const session = createSpeechWordFindingSession(1, 5000);
  assert.equal(session.phase, PHASES.IN_PROGRESS);
  assert.equal(session.currentIndex, 0);
  assert.equal(session.promptStartedAt, 5000);
  assert.equal(session.correctCount, 0);
  assert.equal(session.completedAt, null);
});

test("createSpeechWordFindingSession returns a frozen session", () => {
  const session = createSpeechWordFindingSession(1, 1000);
  assert.equal(Object.isFrozen(session), true);
  assert.equal(Object.isFrozen(session.prompts), true);
});

test("createSpeechWordFindingSession throws on invalid createdAt", () => {
  assert.throws(() => createSpeechWordFindingSession(1, "now"), /createdAt must be a number/);
});

test("createSpeechWordFindingSession throws on invalid difficultyLevel", () => {
  assert.throws(() => createSpeechWordFindingSession(9, 1000), /must be an integer between/);
});

// ---- submitAnswer / advanceOnTimeout ----

const FIXTURE_PROMPTS = [
  WORD_FINDING_PROMPTS[0], // dog
  WORD_FINDING_PROMPTS[1], // kitchen
  WORD_FINDING_PROMPTS[3], // autumn (accepts "fall")
  WORD_FINDING_PROMPTS[4], // elephant
  WORD_FINDING_PROMPTS[5], // cold
  WORD_FINDING_PROMPTS[6], // banana
];

function buildDeterministicSession(createdAt = 1000) {
  return createSpeechWordFindingSession(1, createdAt, { prompts: FIXTURE_PROMPTS });
}

test("submitAnswer: correct answer scores CORRECT and increments correctCount", () => {
  let session = buildDeterministicSession(1000);
  assert.equal(session.prompts[0].target, "dog");
  session = submitAnswer(session, "dog", 1000 + 1500);
  assert.equal(session.outcomes[0], OUTCOMES.CORRECT);
  assert.equal(session.correctCount, 1);
  assert.equal(session.responseLatencies[0], 1500);
});

test("submitAnswer: wrong answer scores INCORRECT", () => {
  let session = buildDeterministicSession(1000);
  session = submitAnswer(session, "cat", 1000 + 2000);
  assert.equal(session.outcomes[0], OUTCOMES.INCORRECT);
  assert.equal(session.incorrectCount, 1);
});

test("submitAnswer: accepts acceptable alias", () => {
  let session = buildDeterministicSession(1000);
  session = submitAnswer(session, "dog", 1100);
  session = submitAnswer(session, "kitchen", session.promptStartedAt + 200);
  session = submitAnswer(session, "fall", session.promptStartedAt + 200);
  assert.equal(session.outcomes[2], OUTCOMES.CORRECT);
});

test("advanceOnTimeout scores TIMEOUT when no answer was submitted", () => {
  let session = buildDeterministicSession(1000);
  session = advanceOnTimeout(session, 1000 + 8000);
  assert.equal(session.outcomes[0], OUTCOMES.TIMEOUT);
  assert.equal(session.timeoutCount, 1);
  assert.equal(session.responses[0], null);
});

test("full deterministic round: mixed correct, incorrect, and timeout", () => {
  let session = buildDeterministicSession(1000);
  session = submitAnswer(session, "dog", 1100);
  session = submitAnswer(session, "wrong", session.promptStartedAt + 500);
  session = advanceOnTimeout(session, session.promptStartedAt + 8000);
  session = submitAnswer(session, "elephant", session.promptStartedAt + 300);
  session = submitAnswer(session, "cold", session.promptStartedAt + 300);
  session = submitAnswer(session, "banana", session.promptStartedAt + 300);
  assert.equal(session.phase, PHASES.COMPLETE);
  assert.equal(session.correctCount, 4);
  assert.equal(session.incorrectCount, 1);
  assert.equal(session.timeoutCount, 1);
});

test("submitAnswer does not mutate the input session (pure function)", () => {
  const session = buildDeterministicSession(1000);
  submitAnswer(session, "dog", 1500);
  assert.equal(session.responses[0], null);
});

test("submitAnswer advances to the next prompt after each submission", () => {
  let session = buildDeterministicSession(1000);
  assert.equal(session.currentIndex, 0);
  session = submitAnswer(session, "dog", 1100);
  assert.equal(session.currentIndex, 1);
  assert.equal(session.responses[0], "dog");
});

test("advanceOnTimeout advances to the next prompt after a timeout", () => {
  let session = buildDeterministicSession(1000);
  session = advanceOnTimeout(session, 9000);
  assert.equal(session.currentIndex, 1);
  assert.equal(session.outcomes[0], OUTCOMES.TIMEOUT);
});

test("submitAnswer throws on empty answer", () => {
  const session = buildDeterministicSession(1000);
  assert.throws(() => submitAnswer(session, "   ", 1500), /non-empty string/);
});

test("submitAnswer throws once session is COMPLETE", () => {
  let session = buildDeterministicSession(1000);
  for (let i = 0; i < session.promptCount; i++) {
    session = submitAnswer(session, session.prompts[session.currentIndex].target, session.promptStartedAt + 100);
  }
  assert.equal(session.phase, PHASES.COMPLETE);
  assert.throws(() => submitAnswer(session, "dog", 99999), /invalid phase "complete"/);
});

test("computeAccuracy: perfect play scores 1.0", () => {
  let session = buildDeterministicSession(1000);
  for (let i = 0; i < session.promptCount; i++) {
    session = submitAnswer(session, session.prompts[i].target, session.promptStartedAt + 200);
  }
  assert.equal(computeAccuracy(session), 1);
});

test("computeAverageResponseLatencyMs excludes timeout trials", () => {
  let session = buildDeterministicSession(1000);
  session = submitAnswer(session, "dog", 1200);
  session = advanceOnTimeout(session, session.promptStartedAt + 8000);
  for (let i = 2; i < session.promptCount; i++) {
    session = submitAnswer(session, session.prompts[i].target, session.promptStartedAt + 300);
  }
  const latencies = session.responseLatencies.filter((v) => v !== null);
  assert.equal(computeAverageResponseLatencyMs(session), latencies.reduce((a, v) => a + v, 0) / latencies.length);
});

test("summarizeErrorType: none when every prompt was correct", () => {
  let session = buildDeterministicSession(1000);
  for (let i = 0; i < session.promptCount; i++) {
    session = submitAnswer(session, session.prompts[i].target, session.promptStartedAt + 200);
  }
  assert.equal(summarizeErrorType(session), "none");
});

test("summarizeErrorType: mixed-errors when both wrong answers and timeouts occurred", () => {
  let session = buildDeterministicSession(1000);
  session = submitAnswer(session, "dog", 1100);
  session = submitAnswer(session, "wrong", session.promptStartedAt + 200);
  session = advanceOnTimeout(session, session.promptStartedAt + 8000);
  for (let i = 3; i < session.promptCount; i++) {
    session = submitAnswer(session, session.prompts[i].target, session.promptStartedAt + 200);
  }
  assert.equal(summarizeErrorType(session), "mixed-errors");
});

// ---- buildSessionEvent ----

test("buildSessionEvent produces a valid GameSessionEvent for a perfect round", () => {
  let session = buildDeterministicSession(1000);
  for (let i = 0; i < session.promptCount; i++) {
    session = submitAnswer(session, session.prompts[i].target, session.promptStartedAt + 200);
  }
  const event = buildSessionEvent(session);
  assert.equal(event.gameId, "speech-word-finding");
  assert.equal(event.difficultyLevel, 1);
  assert.equal(event.accuracy, 1);
  assert.equal(event.errorType, "none");
  assert.deepEqual(validateGameSessionEvent(event), []);
});

test("buildSessionEvent never leaks a patientId or other identifying field", () => {
  let session = buildDeterministicSession(1000);
  session = submitAnswer(session, "dog", 1100);
  for (let i = 1; i < session.promptCount; i++) {
    session = submitAnswer(session, session.prompts[i].target, session.promptStartedAt + 100);
  }
  const event = buildSessionEvent(session);
  assert.equal("patientId" in event, false);
  assert.equal("email" in event, false);
});

test("buildSessionEvent throws if the session isn't complete yet", () => {
  const session = buildDeterministicSession(1000);
  assert.throws(() => buildSessionEvent(session), /requires phase "complete"/);
});
