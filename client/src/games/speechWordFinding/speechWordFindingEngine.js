/**
 * speechWordFindingEngine.js
 *
 * Pure game logic for Speech & Word-Finding — a cognitive-communication
 * retrieval task. The player reads a semantic cue and types the word they
 * are searching for. Shown only when intake flags language/communication
 * symptoms (languageSymptomsFlagged — see project doc Section 2, Pillar A).
 *
 * DESIGN NOTES — same discipline as the other engines:
 * - No React/DOM/timers in here. The UI drives the per-prompt response
 *   window (responseWindowMs from difficultyConfig) and calls
 *   submitAnswer() or advanceOnTimeout() at the right moments.
 * - Every function is pure: returns a NEW session object, never mutates.
 * - No hidden Date.now() calls — timestamps are always passed in.
 * - No modification to eventSchema.js was needed: "speech-word-finding"
 *   is already a valid gameId.
 * - difficultyConfig.js already carries {promptCount, responseWindowMs}
 *   per level — no changes needed here.
 * - Typing is used as the retrieval response mode for this prototype;
 *   Person 2's voiceMonitor can layer speech-hesitation signals on top
 *   without this engine needing to know about audio.
 */

import { createGameSessionEvent } from "../../../../shared/eventSchema.js";
import { getDifficultyParams } from "../../../../shared/difficultyConfig.js";
import { WORD_FINDING_PROMPTS } from "./wordFindingPrompts.js";

const PHASES = Object.freeze({
  IN_PROGRESS: "in-progress",
  COMPLETE: "complete",
});

const OUTCOMES = Object.freeze({
  CORRECT: "correct",
  INCORRECT: "incorrect",
  TIMEOUT: "timeout",
});

/**
 * Normalizes a free-text answer for comparison: lowercase, trim, collapse
 * internal whitespace, strip trailing sentence punctuation.
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeAnswer(text) {
  if (typeof text !== "string") return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]+$/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Returns true if `submitted` matches the prompt's target or any acceptable
 * alias after normalization.
 *
 * @param {string} submitted
 * @param {{ target: string, acceptable: string[] }} prompt
 * @returns {boolean}
 */
function isAnswerCorrect(submitted, prompt) {
  const normalized = normalizeAnswer(submitted);
  if (!normalized) return false;
  const aliases = new Set([prompt.target, ...prompt.acceptable].map(normalizeAnswer));
  return aliases.has(normalized);
}

/**
 * Selects `count` distinct prompts from the bank without replacement.
 * randomFn is injectable for deterministic tests.
 *
 * @param {number} count
 * @param {() => number} [randomFn]
 * @returns {Object[]}
 */
function selectPrompts(count, randomFn = Math.random) {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`count must be a positive integer, got ${count}`);
  }
  if (count > WORD_FINDING_PROMPTS.length) {
    throw new Error(
      `count (${count}) exceeds prompt bank size (${WORD_FINDING_PROMPTS.length})`
    );
  }

  const indices = WORD_FINDING_PROMPTS.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices.slice(0, count).map((i) => WORD_FINDING_PROMPTS[i]);
}

/**
 * Creates a new Speech & Word-Finding session at the given difficulty level.
 * Prompt 0's clock starts immediately at `createdAt`.
 *
 * @param {number} difficultyLevel - 1-5
 * @param {number} createdAt - ms epoch timestamp supplied by the caller
 * @param {Object} [options]
 * @param {() => number} [options.randomFn] - injectable RNG for tests
 * @param {Object[]} [options.prompts] - inject fixed prompts (must match promptCount)
 * @returns {Object} frozen session state
 */
function createSpeechWordFindingSession(difficultyLevel, createdAt, options = {}) {
  if (typeof createdAt !== "number" || Number.isNaN(createdAt)) {
    throw new Error(`createdAt must be a number (ms epoch), got ${createdAt}`);
  }

  const { promptCount, responseWindowMs } = getDifficultyParams(
    "speech-word-finding",
    difficultyLevel
  );
  const randomFn = options.randomFn ?? Math.random;

  let prompts;
  if (options.prompts) {
    if (!Array.isArray(options.prompts) || options.prompts.length !== promptCount) {
      throw new Error(
        `options.prompts must be an array of length ${promptCount}, got ${options.prompts?.length}`
      );
    }
    prompts = options.prompts;
  } else {
    prompts = selectPrompts(promptCount, randomFn);
  }

  return Object.freeze({
    difficultyLevel,
    promptCount,
    responseWindowMs,
    prompts: Object.freeze(prompts.map((p) => Object.freeze({ ...p }))),
    currentIndex: 0,
    responses: Object.freeze(new Array(prompts.length).fill(null)),
    responseLatencies: Object.freeze(new Array(prompts.length).fill(null)),
    outcomes: Object.freeze(new Array(prompts.length).fill(null)),
    correctCount: 0,
    incorrectCount: 0,
    timeoutCount: 0,
    phase: PHASES.IN_PROGRESS,
    createdAt,
    promptStartedAt: createdAt,
    completedAt: null,
  });
}

/**
 * Scores the current prompt and advances internal tallies. Shared by
 * submitAnswer() and advanceOnTimeout().
 *
 * @param {Object} session
 * @param {string|null} answer - player's text, or null for timeout
 * @param {number} timestamp
 * @returns {Object} new session state
 */
function _finalizeCurrentPrompt(session, answer, timestamp) {
  const i = session.currentIndex;
  const prompt = session.prompts[i];

  let outcome;
  let correctCount = session.correctCount;
  let incorrectCount = session.incorrectCount;
  let timeoutCount = session.timeoutCount;
  let latency = null;

  if (answer === null) {
    outcome = OUTCOMES.TIMEOUT;
    timeoutCount += 1;
  } else if (isAnswerCorrect(answer, prompt)) {
    outcome = OUTCOMES.CORRECT;
    correctCount += 1;
    latency = timestamp - session.promptStartedAt;
  } else {
    outcome = OUTCOMES.INCORRECT;
    incorrectCount += 1;
    latency = timestamp - session.promptStartedAt;
  }

  const newResponses = session.responses.slice();
  newResponses[i] = answer;
  const newLatencies = session.responseLatencies.slice();
  newLatencies[i] = latency;
  const newOutcomes = session.outcomes.slice();
  newOutcomes[i] = outcome;

  const nextIndex = i + 1;
  const isSessionComplete = nextIndex >= session.prompts.length;

  return Object.freeze({
    ...session,
    responses: Object.freeze(newResponses),
    responseLatencies: Object.freeze(newLatencies),
    outcomes: Object.freeze(newOutcomes),
    correctCount,
    incorrectCount,
    timeoutCount,
    currentIndex: isSessionComplete ? session.currentIndex : nextIndex,
    promptStartedAt: isSessionComplete ? session.promptStartedAt : timestamp,
    phase: isSessionComplete ? PHASES.COMPLETE : PHASES.IN_PROGRESS,
    completedAt: isSessionComplete ? timestamp : null,
  });
}

/**
 * Records the player's typed answer for the CURRENT prompt. Can only be
 * called once per prompt — a second call before advancing throws.
 *
 * @param {Object} session
 * @param {string} answer - player's typed response (non-empty)
 * @param {number} timestamp - ms epoch when the answer was submitted
 * @returns {Object} new session state
 */
function submitAnswer(session, answer, timestamp) {
  if (session.phase !== PHASES.IN_PROGRESS) {
    throw new Error(
      `submitAnswer called from invalid phase "${session.phase}" (expected "${PHASES.IN_PROGRESS}")`
    );
  }
  if (typeof answer !== "string" || normalizeAnswer(answer).length === 0) {
    throw new Error(`answer must be a non-empty string, got ${JSON.stringify(answer)}`);
  }
  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    throw new Error(`timestamp must be a number (ms epoch), got ${timestamp}`);
  }
  if (session.responses[session.currentIndex] !== null) {
    throw new Error(
      `submitAnswer called twice for prompt ${session.currentIndex} — one answer per prompt is allowed`
    );
  }
  if (timestamp < session.promptStartedAt) {
    throw new Error(
      `timestamp (${timestamp}) cannot be before promptStartedAt (${session.promptStartedAt})`
    );
  }

  return _finalizeCurrentPrompt(session, answer, timestamp);
}

/**
 * Finalizes the current prompt as a timeout when the response window
 * expires without a submission.
 *
 * @param {Object} session
 * @param {number} timestamp - ms epoch when the window ended
 * @returns {Object} new session state
 */
function advanceOnTimeout(session, timestamp) {
  if (session.phase !== PHASES.IN_PROGRESS) {
    throw new Error(
      `advanceOnTimeout called from invalid phase "${session.phase}" (expected "${PHASES.IN_PROGRESS}")`
    );
  }
  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    throw new Error(`timestamp must be a number (ms epoch), got ${timestamp}`);
  }
  if (session.responses[session.currentIndex] !== null) {
    throw new Error(
      `advanceOnTimeout called for prompt ${session.currentIndex} but an answer was already recorded`
    );
  }

  return _finalizeCurrentPrompt(session, null, timestamp);
}

/**
 * Accuracy across all prompts: correctCount / promptCount.
 *
 * @param {Object} session
 * @returns {number} 0-1
 */
function computeAccuracy(session) {
  if (session.promptCount === 0) return 0;
  return session.correctCount / session.promptCount;
}

/**
 * Average response latency across CORRECT and INCORRECT submissions
 * (timeouts contribute no latency data point).
 *
 * @param {Object} session
 * @returns {number} ms, >= 0
 */
function computeAverageResponseLatencyMs(session) {
  const recorded = session.responseLatencies.filter((v) => v !== null);
  if (recorded.length === 0) return 0;
  return recorded.reduce((acc, v) => acc + v, 0) / recorded.length;
}

/**
 * Summarizes the round's error pattern into a single free-form string, per
 * eventSchema.js's errorType convention.
 *
 * @param {Object} session
 * @returns {string}
 */
function summarizeErrorType(session) {
  const hadIncorrect = session.incorrectCount > 0;
  const hadTimeout = session.timeoutCount > 0;
  if (!hadIncorrect && !hadTimeout) return "none";
  if (hadIncorrect && hadTimeout) return "mixed-errors";
  if (hadTimeout) return "timeout";
  return "word-retrieval-error";
}

/**
 * Builds a validated, patient-agnostic GameSessionEvent summarizing a
 * completed round. Throws if the session isn't complete.
 *
 * @param {Object} session
 * @returns {Object} frozen GameSessionEvent
 */
function buildSessionEvent(session) {
  if (session.phase !== PHASES.COMPLETE) {
    throw new Error(
      `buildSessionEvent requires phase "${PHASES.COMPLETE}", got "${session.phase}"`
    );
  }
  if (session.completedAt === null) {
    throw new Error("buildSessionEvent requires completedAt to be set");
  }

  return createGameSessionEvent({
    gameId: "speech-word-finding",
    difficultyLevel: session.difficultyLevel,
    accuracy: computeAccuracy(session),
    responseLatencyMs: computeAverageResponseLatencyMs(session),
    errorType: summarizeErrorType(session),
    timestamp: session.completedAt,
  });
}

export {
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
};
