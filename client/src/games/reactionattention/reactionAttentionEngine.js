/**
 * reactionAttentionEngine.js
 *
 * Pure game logic for the Reaction/Attention task — a go/no-go sustained
 * attention test. A stream of stimuli appears; most are "go" stimuli (the
 * player presses a button as fast as possible), a minority are "no-go"
 * stimuli (the player must withhold the press). Attention deficits are
 * among the most consistently reported concussion symptoms, which is why
 * this task exists (see project doc Section 2, Pillar A).
 *
 * DESIGN NOTES — same discipline as nbackEngine.js / sequenceRecallEngine.js:
 * - No React/DOM/timers in here. The UI drives per-trial timing and calls
 *   this module's functions at the right moments.
 * - Every function is pure: returns a NEW session object, never mutates.
 * - No hidden Date.now() calls — timestamps are always passed in.
 * - No modification to eventSchema.js was needed: "reaction-attention" is
 *   already a valid gameId.
 * - difficultyConfig.js already carries {stimulusIntervalMsRange, noGoRatio,
 *   responseWindowMs} per level for "reaction-attention" — no changes
 *   needed here either. Two separate timing concepts, both level-driven:
 *     - stimulusIntervalMsRange: how long each trial is paced apart (ISI),
 *       randomized within the range per trial so players can't anticipate
 *       stimulus timing rhythmically.
 *     - responseWindowMs: the fixed deadline (from the moment a stimulus
 *       appears) within which a press counts as a valid "go" response.
 *       A press that lands after this window still registers as *some*
 *       kind of response for a no-go trial (still an error to press at
 *       all), but on a go trial a too-late press is scored the same as no
 *       press at all (an omission) — pragmatically, "too slow" and "never
 *       responded" both mean the trial's reaction demand wasn't met in time.
 */

import {  createGameSessionEvent  } from "../../../../shared/eventSchema.js";
import {  getDifficultyParams  } from "../../../../shared/difficultyConfig.js";

/** Total trials per round. */
const DEFAULT_TRIAL_COUNT = 24;

const TRIAL_TYPES = Object.freeze({
  GO: "go",
  NO_GO: "no-go",
});

const PHASES = Object.freeze({
  IN_PROGRESS: "in-progress",
  COMPLETE: "complete",
});

/** Per-trial outcome labels, assigned once a trial is finalized. */
const OUTCOMES = Object.freeze({
  HIT: "hit", // go trial, pressed within the response window
  OMISSION_ERROR: "omission-error", // go trial, no valid press (none, or too late)
  COMMISSION_ERROR: "commission-error", // no-go trial, pressed anyway
  CORRECT_WITHHOLD: "correct-withhold", // no-go trial, correctly did not press
});

/**
 * Generates a trial plan: for each of `length` trials, whether it's a "go"
 * or "no-go" stimulus (roughly `noGoRatio` fraction are no-go), and how
 * long the inter-stimulus interval is before this trial's stimulus appears
 * (uniformly random within `intervalRange`, to prevent players from timing
 * responses off rhythm rather than off the actual stimulus).
 *
 * randomFn is injectable for deterministic tests (defaults to Math.random).
 *
 * @param {number} length - total trial count (>= 1)
 * @param {number} noGoRatio - 0-1, target fraction of no-go trials
 * @param {[number, number]} intervalRange - [minMs, maxMs], inclusive
 * @param {() => number} [randomFn] - returns a float in [0, 1)
 * @returns {{type: string, intervalMs: number}[]}
 */
function generateTrialPlan(length, noGoRatio, intervalRange, randomFn = Math.random) {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error(`length must be a positive integer, got ${length}`);
  }
  if (
    typeof noGoRatio !== "number" ||
    noGoRatio < 0 ||
    noGoRatio > 1 ||
    Number.isNaN(noGoRatio)
  ) {
    throw new Error(`noGoRatio must be a number between 0 and 1, got ${noGoRatio}`);
  }
  if (
    !Array.isArray(intervalRange) ||
    intervalRange.length !== 2 ||
    !Number.isInteger(intervalRange[0]) ||
    !Number.isInteger(intervalRange[1]) ||
    intervalRange[0] < 0 ||
    intervalRange[1] < intervalRange[0]
  ) {
    throw new Error(
      `intervalRange must be [minMs, maxMs] with 0 <= minMs <= maxMs, got ${JSON.stringify(intervalRange)}`
    );
  }

  const [minMs, maxMs] = intervalRange;
  const width = maxMs - minMs;

  const trials = [];
  for (let i = 0; i < length; i++) {
    const type = randomFn() < noGoRatio ? TRIAL_TYPES.NO_GO : TRIAL_TYPES.GO;

    let intervalMs = minMs + Math.floor(randomFn() * (width + 1));
    if (intervalMs > maxMs) intervalMs = maxMs; // guard float-rounding edge case
    if (intervalMs < minMs) intervalMs = minMs;

    trials.push({ type, intervalMs });
  }
  return trials;
}

/**
 * Creates a new Reaction/Attention session at the given difficulty level.
 * Trial 0's clock starts immediately at `createdAt`.
 *
 * @param {number} difficultyLevel - 1-5
 * @param {number} createdAt - ms epoch timestamp supplied by the caller
 * @param {Object} [options]
 * @param {number} [options.trialCount] - defaults to DEFAULT_TRIAL_COUNT
 * @param {() => number} [options.randomFn] - injectable RNG for tests
 * @returns {Object} frozen session state
 */
function createReactionAttentionSession(difficultyLevel, createdAt, options = {}) {
  if (typeof createdAt !== "number" || Number.isNaN(createdAt)) {
    throw new Error(`createdAt must be a number (ms epoch), got ${createdAt}`);
  }

  const { stimulusIntervalMsRange, noGoRatio, responseWindowMs } = getDifficultyParams(
    "reaction-attention",
    difficultyLevel
  );
  const trialCount = options.trialCount ?? DEFAULT_TRIAL_COUNT;
  const randomFn = options.randomFn ?? Math.random;

  const trials = generateTrialPlan(trialCount, noGoRatio, stimulusIntervalMsRange, randomFn);

  return Object.freeze({
    difficultyLevel,
    stimulusIntervalMsRange,
    noGoRatio,
    responseWindowMs,
    trials: Object.freeze(trials.map((t) => Object.freeze(t))),
    currentIndex: 0,
    responses: Object.freeze(new Array(trials.length).fill(null)), // null | "pressed"
    responseLatencies: Object.freeze(new Array(trials.length).fill(null)),
    outcomes: Object.freeze(new Array(trials.length).fill(null)),
    hits: 0,
    omissionErrors: 0,
    commissionErrors: 0,
    correctWithholds: 0,
    phase: PHASES.IN_PROGRESS,
    createdAt,
    trialStartedAt: createdAt,
    completedAt: null,
  });
}

/**
 * Records a button press for the CURRENT trial. Can only be called once
 * per trial. Whether the press ultimately counts as valid (within the
 * response window) is decided later, in advanceToNextTrial() — pressGo()
 * just records that a press happened and when.
 *
 * @param {Object} session
 * @param {number} timestamp - ms epoch when the press occurred
 * @returns {Object} new session state
 */
function pressGo(session, timestamp) {
  if (session.phase !== PHASES.IN_PROGRESS) {
    throw new Error(
      `pressGo called from invalid phase "${session.phase}" (expected "${PHASES.IN_PROGRESS}")`
    );
  }
  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    throw new Error(`timestamp must be a number (ms epoch), got ${timestamp}`);
  }
  if (session.responses[session.currentIndex] !== null) {
    throw new Error(
      `pressGo called twice for trial ${session.currentIndex} — one press per trial is allowed`
    );
  }
  if (timestamp < session.trialStartedAt) {
    throw new Error(
      `timestamp (${timestamp}) cannot be before trialStartedAt (${session.trialStartedAt})`
    );
  }

  const latency = timestamp - session.trialStartedAt;

  const newResponses = session.responses.slice();
  newResponses[session.currentIndex] = "pressed";
  const newLatencies = session.responseLatencies.slice();
  newLatencies[session.currentIndex] = latency;

  return Object.freeze({
    ...session,
    responses: Object.freeze(newResponses),
    responseLatencies: Object.freeze(newLatencies),
  });
}

/**
 * Finalizes scoring for the current trial and advances to the next trial,
 * or completes the session if this was the last trial.
 *
 * @param {Object} session
 * @param {number} timestamp - ms epoch when this trial's window ended
 * @returns {Object} new session state
 */
function advanceToNextTrial(session, timestamp) {
  if (session.phase !== PHASES.IN_PROGRESS) {
    throw new Error(
      `advanceToNextTrial called from invalid phase "${session.phase}" (expected "${PHASES.IN_PROGRESS}")`
    );
  }
  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    throw new Error(`timestamp must be a number (ms epoch), got ${timestamp}`);
  }

  const i = session.currentIndex;
  const trial = session.trials[i];
  const latency = session.responseLatencies[i];
  const wasPressed = session.responses[i] === "pressed";
  const isValidGoResponse = wasPressed && latency <= session.responseWindowMs;

  let outcome;
  let hits = session.hits;
  let omissionErrors = session.omissionErrors;
  let commissionErrors = session.commissionErrors;
  let correctWithholds = session.correctWithholds;

  if (trial.type === TRIAL_TYPES.GO) {
    if (isValidGoResponse) {
      outcome = OUTCOMES.HIT;
      hits += 1;
    } else {
      // No press, or pressed too late — both fail to meet the reaction demand.
      outcome = OUTCOMES.OMISSION_ERROR;
      omissionErrors += 1;
    }
  } else {
    // no-go trial: ANY press is an error, regardless of timing.
    if (wasPressed) {
      outcome = OUTCOMES.COMMISSION_ERROR;
      commissionErrors += 1;
    } else {
      outcome = OUTCOMES.CORRECT_WITHHOLD;
      correctWithholds += 1;
    }
  }

  const newOutcomes = session.outcomes.slice();
  newOutcomes[i] = outcome;

  const nextIndex = i + 1;
  const isSessionComplete = nextIndex >= session.trials.length;

  return Object.freeze({
    ...session,
    outcomes: Object.freeze(newOutcomes),
    hits,
    omissionErrors,
    commissionErrors,
    correctWithholds,
    currentIndex: isSessionComplete ? session.currentIndex : nextIndex,
    trialStartedAt: isSessionComplete ? session.trialStartedAt : timestamp,
    phase: isSessionComplete ? PHASES.COMPLETE : PHASES.IN_PROGRESS,
    completedAt: isSessionComplete ? timestamp : null,
  });
}

/**
 * Accuracy across ALL trials (every trial has a well-defined correct
 * answer from trial 0 onward, unlike N-Back — there's no warm-up period
 * here since go/no-go doesn't need a lookback window).
 * accuracy = (hits + correctWithholds) / total trials
 *
 * @param {Object} session
 * @returns {number} 0-1
 */
function computeAccuracy(session) {
  const total = session.trials.length;
  if (total === 0) return 0;
  return (session.hits + session.correctWithholds) / total;
}

/**
 * Average response latency across HIT trials only (valid, in-window go
 * responses) — the standard way reaction time is reported in go/no-go
 * tasks; error trials don't represent a "clean" reaction time measurement.
 * Returns 0 if there were no hits at all.
 *
 * @param {Object} session
 * @returns {number} ms, >= 0
 */
function computeAverageResponseLatencyMs(session) {
  const hitLatencies = [];
  for (let i = 0; i < session.outcomes.length; i++) {
    if (session.outcomes[i] === OUTCOMES.HIT) {
      hitLatencies.push(session.responseLatencies[i]);
    }
  }
  if (hitLatencies.length === 0) return 0;
  const sum = hitLatencies.reduce((acc, v) => acc + v, 0);
  return sum / hitLatencies.length;
}

/**
 * Summarizes the round's error pattern into a single free-form string, per
 * eventSchema.js's errorType convention — same "none" / single-type /
 * "mixed-errors" pattern used in nbackEngine.js's summarizeErrorType, kept
 * consistent across games for anyone reading both.
 *
 * @param {Object} session
 * @returns {string}
 */
function summarizeErrorType(session) {
  const hadOmissions = session.omissionErrors > 0;
  const hadCommissions = session.commissionErrors > 0;
  if (!hadOmissions && !hadCommissions) return "none";
  if (hadOmissions && hadCommissions) return "mixed-errors";
  if (hadOmissions) return "omission-error";
  return "commission-error";
}

/**
 * Builds a validated, patient-agnostic GameSessionEvent summarizing a
 * completed Reaction/Attention round. Throws if the session isn't complete.
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
    gameId: "reaction-attention",
    difficultyLevel: session.difficultyLevel,
    accuracy: computeAccuracy(session),
    responseLatencyMs: computeAverageResponseLatencyMs(session),
    errorType: summarizeErrorType(session),
    timestamp: session.completedAt,
  });
}

export {
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
};