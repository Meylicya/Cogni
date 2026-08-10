/**
 * sequenceRecallEngine.js
 *
 * Pure game logic for Sequence Recall — a visual-spatial working-memory
 * task. The player watches a sequence of positions on a grid light up one
 * at a time, then reproduces the sequence in order by selecting the same
 * positions. Complements N-Back with a different memory modality (spatial
 * order recall vs. continuous match/no-match) — see project doc Section 2,
 * Pillar A.
 *
 * DESIGN NOTES — same discipline as nbackEngine.js / reactionAttentionEngine.js:
 * - No React/DOM/timers in here. The UI drives the "showing" pacing
 *   (showIntervalMs per item, from difficultyConfig) and calls
 *   advanceShowing() at each interval; it calls submitResponse() whenever
 *   the player taps a grid cell during the input phase.
 * - Every function is pure: returns a NEW session object, never mutates.
 * - No hidden Date.now() calls — timestamps are always passed in.
 * - No modification to eventSchema.js was needed: "sequence-recall" is
 *   already a valid gameId.
 * - difficultyConfig.js already carries {sequenceLength, showIntervalMs}
 *   per level for "sequence-recall" — no changes needed here. gridSize is
 *   NOT difficulty-varying in the shared config, so it's kept as an
 *   engine-level default (overridable via options), same pattern
 *   nbackEngine.js used for stimulusSetSize.
 * - Unlike N-Back, there's no warm-up period — every position in the
 *   sequence has a well-defined correct answer once the input phase
 *   starts, so accuracy is scored across the FULL sequence length (see
 *   reaction-attention's "no warm-up" note for the same reasoning applied
 *   there).
 * - The round always collects a full sequenceLength worth of input, even
 *   after an early wrong answer, rather than ending the round on the
 *   first mistake. This keeps the round length (and therefore latency
 *   averaging and accuracy-as-a-fraction) consistent trial to trial,
 *   matching the "always complete a fixed-length round" pattern used by
 *   the other two engines. Flag to the team if a "stop on first mistake"
 *   UX is wanted instead — that would change what accuracy means here.
 */

import {  createGameSessionEvent  } from "../../../../shared/eventSchema.js";
import {  getDifficultyParams  } from "../../../../shared/difficultyConfig.js";

/** Grid size (number of selectable cells) — not difficulty-varying per difficultyConfig.js. */
const DEFAULT_GRID_SIZE = 9;

const PHASES = Object.freeze({
  SHOWING: "showing", // sequence is being played back to the player
  INPUT: "input", // player is reproducing the sequence
  COMPLETE: "complete",
});

/** Per-position outcome, assigned once the player responds to that position. */
const OUTCOMES = Object.freeze({
  CORRECT: "correct",
  INCORRECT: "incorrect",
});

/**
 * Generates a random sequence of grid positions. Positions may repeat
 * consecutively — recall difficulty comes from sequence length and order,
 * not from a match/no-match constraint like N-Back needs.
 *
 * randomFn is injectable for deterministic tests (defaults to Math.random).
 *
 * @param {number} length - sequence length (>= 1)
 * @param {number} gridSize - number of selectable cells (>= 2)
 * @param {() => number} [randomFn] - returns a float in [0, 1)
 * @returns {number[]}
 */
function generateSequence(length, gridSize, randomFn = Math.random) {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error(`length must be a positive integer, got ${length}`);
  }
  if (!Number.isInteger(gridSize) || gridSize < 2) {
    throw new Error(`gridSize must be an integer >= 2, got ${gridSize}`);
  }

  const sequence = [];
  for (let i = 0; i < length; i++) {
    let value = Math.floor(randomFn() * gridSize);
    if (value >= gridSize) value = gridSize - 1;
    if (value < 0) value = 0;
    sequence.push(value);
  }
  return sequence;
}

/**
 * Creates a new Sequence Recall session at the given difficulty level.
 * Starts in the SHOWING phase — showIndex 0's clock starts at `createdAt`.
 *
 * @param {number} difficultyLevel - 1-5
 * @param {number} createdAt - ms epoch timestamp supplied by the caller
 * @param {Object} [options]
 * @param {number} [options.gridSize] - defaults to DEFAULT_GRID_SIZE
 * @param {() => number} [options.randomFn] - injectable RNG for tests
 * @returns {Object} frozen session state
 */
function createSequenceRecallSession(difficultyLevel, createdAt, options = {}) {
  if (typeof createdAt !== "number" || Number.isNaN(createdAt)) {
    throw new Error(`createdAt must be a number (ms epoch), got ${createdAt}`);
  }

  const { sequenceLength, showIntervalMs } = getDifficultyParams("sequence-recall", difficultyLevel);
  const gridSize = options.gridSize ?? DEFAULT_GRID_SIZE;
  const randomFn = options.randomFn ?? Math.random;

  const sequence = generateSequence(sequenceLength, gridSize, randomFn);

  return Object.freeze({
    difficultyLevel,
    sequenceLength,
    showIntervalMs,
    gridSize,
    sequence: Object.freeze(sequence),
    phase: PHASES.SHOWING,
    showIndex: 0,
    inputs: Object.freeze([]), // player's selections, in order
    outcomes: Object.freeze([]), // OUTCOMES per input, in order
    responseLatencies: Object.freeze([]), // ms per input
    correctCount: 0,
    createdAt,
    showStepStartedAt: createdAt,
    inputStartedAt: null,
    lastInputAt: null,
    completedAt: null,
  });
}

/**
 * Advances playback to the next position in the sequence, or transitions
 * to the INPUT phase if the sequence has finished showing.
 *
 * @param {Object} session
 * @param {number} timestamp - ms epoch when this show-step's window ended
 * @returns {Object} new session state
 */
function advanceShowing(session, timestamp) {
  if (session.phase !== PHASES.SHOWING) {
    throw new Error(
      `advanceShowing called from invalid phase "${session.phase}" (expected "${PHASES.SHOWING}")`
    );
  }
  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    throw new Error(`timestamp must be a number (ms epoch), got ${timestamp}`);
  }

  const nextShowIndex = session.showIndex + 1;
  const finishedShowing = nextShowIndex >= session.sequence.length;

  return Object.freeze({
    ...session,
    showIndex: finishedShowing ? session.showIndex : nextShowIndex,
    showStepStartedAt: finishedShowing ? session.showStepStartedAt : timestamp,
    phase: finishedShowing ? PHASES.INPUT : PHASES.SHOWING,
    inputStartedAt: finishedShowing ? timestamp : session.inputStartedAt,
    lastInputAt: finishedShowing ? timestamp : session.lastInputAt,
  });
}

/**
 * Records one player selection during the INPUT phase, scores it
 * immediately against the corresponding sequence position, and advances
 * to the next input slot — or completes the session if this was the last
 * expected input.
 *
 * @param {Object} session
 * @param {number} position - grid index the player selected (0 to gridSize-1)
 * @param {number} timestamp - ms epoch when the selection occurred
 * @returns {Object} new session state
 */
function submitResponse(session, position, timestamp) {
  if (session.phase !== PHASES.INPUT) {
    throw new Error(
      `submitResponse called from invalid phase "${session.phase}" (expected "${PHASES.INPUT}")`
    );
  }
  if (!Number.isInteger(position) || position < 0 || position >= session.gridSize) {
    throw new Error(`position must be an integer between 0 and ${session.gridSize - 1}, got ${position}`);
  }
  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    throw new Error(`timestamp must be a number (ms epoch), got ${timestamp}`);
  }
  if (timestamp < session.lastInputAt) {
    throw new Error(`timestamp (${timestamp}) cannot be before lastInputAt (${session.lastInputAt})`);
  }

  const expectedIndex = session.inputs.length;
  const isCorrect = session.sequence[expectedIndex] === position;
  const outcome = isCorrect ? OUTCOMES.CORRECT : OUTCOMES.INCORRECT;
  const latency = timestamp - session.lastInputAt;

  const newInputs = session.inputs.concat([position]);
  const newOutcomes = session.outcomes.concat([outcome]);
  const newLatencies = session.responseLatencies.concat([latency]);
  const correctCount = session.correctCount + (isCorrect ? 1 : 0);

  const isSessionComplete = newInputs.length >= session.sequenceLength;

  return Object.freeze({
    ...session,
    inputs: Object.freeze(newInputs),
    outcomes: Object.freeze(newOutcomes),
    responseLatencies: Object.freeze(newLatencies),
    correctCount,
    lastInputAt: timestamp,
    phase: isSessionComplete ? PHASES.COMPLETE : PHASES.INPUT,
    completedAt: isSessionComplete ? timestamp : null,
  });
}

/**
 * Accuracy over the full sequence: correctCount / sequenceLength.
 *
 * @param {Object} session
 * @returns {number} 0-1
 */
function computeAccuracy(session) {
  if (session.sequenceLength === 0) return 0;
  return session.correctCount / session.sequenceLength;
}

/**
 * Average response latency across all recorded inputs (time between
 * consecutive selections, or from input-phase start for the first one).
 * Returns 0 if no inputs were recorded yet.
 *
 * @param {Object} session
 * @returns {number} ms, >= 0
 */
function computeAverageResponseLatencyMs(session) {
  if (session.responseLatencies.length === 0) return 0;
  const sum = session.responseLatencies.reduce((acc, v) => acc + v, 0);
  return sum / session.responseLatencies.length;
}

/**
 * Summarizes the round's error pattern into a single free-form string, per
 * eventSchema.js's errorType convention. Sequence Recall only has one
 * error category (a wrong position), so unlike N-Back/Reaction-Attention's
 * "mixed-errors" case, there's just "none" or "position-error".
 *
 * @param {Object} session
 * @returns {string}
 */
function summarizeErrorType(session) {
  const hadErrors = session.outcomes.some((o) => o === OUTCOMES.INCORRECT);
  return hadErrors ? "position-error" : "none";
}

/**
 * Builds a validated, patient-agnostic GameSessionEvent summarizing a
 * completed Sequence Recall round. Throws if the session isn't complete.
 *
 * @param {Object} session - a session with phase === "complete"
 * @returns {Object} frozen GameSessionEvent (see eventSchema.js)
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
    gameId: "sequence-recall",
    difficultyLevel: session.difficultyLevel,
    accuracy: computeAccuracy(session),
    responseLatencyMs: computeAverageResponseLatencyMs(session),
    errorType: summarizeErrorType(session),
    timestamp: session.completedAt,
  });
}

export {
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
};