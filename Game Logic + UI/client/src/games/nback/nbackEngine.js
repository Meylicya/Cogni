/**
 * nbackEngine.js
 *
 * Pure game logic for N-Back — a working-memory task. The player watches a
 * stream of stimuli (letters, shapes, positions — the UI decides the visual
 * representation; this engine only deals in stimulus INDICES) and presses
 * "match" whenever the current stimulus is the same as the one shown N
 * steps earlier.
 *
 * Mirrors real fNIRS working-memory studies in concussed patients
 * (Kontos et al., 2014; Hocke et al., 2018 — see project doc Section 7,
 * both flagged "cited but not independently verified, spot-check before
 * submission").
 *
 * DESIGN NOTES:
 * - No React/DOM/timers in here on purpose, same discipline as
 *   sequenceRecallEngine.js. The UI drives a per-trial timer
 *   (stimulusIntervalMs) and calls this module's functions at the right
 *   moments; this module never reads the clock itself.
 * - Every function is pure and returns a NEW session object rather than
 *   mutating its input, for the same testability reasons as the other
 *   engines in this codebase.
 * - No modification to eventSchema.js was needed: "n-back" is already a
 *   valid gameId.
 * - No modification to difficultyConfig.js was needed for {n,
 *   stimulusIntervalMs} per level — that was already there. Trial count,
 *   stimulus-set size, and target-match probability are NOT
 *   difficulty-varying in the original config, so they're kept as
 *   engine-level defaults (overridable via options) rather than added to
 *   the shared difficulty file. Flag to the team if ZPD tuning (Person 2)
 *   wants trial count to vary by level too — that would be a real
 *   difficultyConfig.js change, not something to sneak in unilaterally.
 */

import {  createGameSessionEvent  } from "../../shared/eventSchema.js";
import {  getDifficultyParams  } from "../../shared/difficultyConfig.js";

/** How many stimulus symbols exist to choose from (e.g. 8 distinct letters/shapes). */
const DEFAULT_STIMULUS_SET_SIZE = 8;

/** Total trials per round. Must be > n for at least one scored trial to exist. */
const DEFAULT_TRIAL_COUNT = 20;

/** Fraction of scored trials that are deliberately constructed as true matches. */
const DEFAULT_MATCH_PROBABILITY = 0.3;

const PHASES = Object.freeze({
  IN_PROGRESS: "in-progress",
  COMPLETE: "complete",
});

/** Per-trial outcome labels, assigned once a trial is finalized. */
const OUTCOMES = Object.freeze({
  WARMUP: "warmup", // i < n: no n-back reference exists yet, not scored
  HIT: "hit", // was a match, player pressed
  MISS: "miss", // was a match, player did not press
  FALSE_ALARM: "false-alarm", // was not a match, player pressed anyway
  CORRECT_REJECTION: "correct-rejection", // was not a match, player correctly did not press
});

/**
 * Generates a stimulus stream of the given length where matches (a stimulus
 * equal to the one shown n steps earlier) are deliberately placed at
 * roughly `matchProbability` of scored trials (i.e. trials at index >= n).
 * Ground truth (`isMatchAt`) is derived directly from generation, not
 * recomputed after the fact, so it can never drift from the actual stream.
 *
 * randomFn is injectable for deterministic tests (defaults to Math.random).
 * Defensive against a pathological/constant randomFn when hunting for a
 * non-matching stimulus: after 100 failed attempts, forces progress by
 * advancing to the next stimulus index rather than looping forever.
 *
 * @param {number} length - total trial count (> n)
 * @param {number} n - how many steps back to compare against (>= 1)
 * @param {number} [stimulusSetSize] - size of the stimulus alphabet (>= 2)
 * @param {number} [matchProbability] - 0-1, target fraction of scored match trials
 * @param {() => number} [randomFn] - returns a float in [0, 1)
 * @returns {{stimuli: number[], isMatchAt: boolean[]}}
 */
function generateStimulusSequence(
  length,
  n,
  stimulusSetSize = DEFAULT_STIMULUS_SET_SIZE,
  matchProbability = DEFAULT_MATCH_PROBABILITY,
  randomFn = Math.random
) {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error(`length must be a positive integer, got ${length}`);
  }
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`n must be a positive integer, got ${n}`);
  }
  if (length <= n) {
    throw new Error(
      `length (${length}) must be greater than n (${n}) — otherwise there are zero scored trials`
    );
  }
  if (!Number.isInteger(stimulusSetSize) || stimulusSetSize < 2) {
    throw new Error(
      `stimulusSetSize must be an integer >= 2 (need at least 2 distinct stimuli to distinguish match from non-match), got ${stimulusSetSize}`
    );
  }
  if (
    typeof matchProbability !== "number" ||
    matchProbability < 0 ||
    matchProbability > 1 ||
    Number.isNaN(matchProbability)
  ) {
    throw new Error(`matchProbability must be a number between 0 and 1, got ${matchProbability}`);
  }

  const MAX_ATTEMPTS = 100;
  const stimuli = [];
  const isMatchAt = [];

  function randomStimulus() {
    let value = Math.floor(randomFn() * stimulusSetSize);
    if (value >= stimulusSetSize) value = stimulusSetSize - 1;
    if (value < 0) value = 0;
    return value;
  }

  for (let i = 0; i < length; i++) {
    if (i < n) {
      // Warm-up trial: no n-back reference exists yet, pick freely.
      stimuli.push(randomStimulus());
      isMatchAt.push(false);
      continue;
    }

    const target = stimuli[i - n];
    const wantsMatch = randomFn() < matchProbability;

    if (wantsMatch) {
      stimuli.push(target);
      isMatchAt.push(true);
      continue;
    }

    // Deliberately pick a stimulus that differs from `target`.
    let candidate;
    let attempts = 0;
    do {
      candidate = randomStimulus();
      attempts++;
    } while (candidate === target && attempts < MAX_ATTEMPTS);

    if (candidate === target) {
      // Pathological randomFn kept matching; force a different value.
      candidate = (target + 1) % stimulusSetSize;
    }

    stimuli.push(candidate);
    isMatchAt.push(false);
  }

  return { stimuli, isMatchAt };
}

/**
 * Creates a new N-Back session at the given difficulty level. Trial 0's
 * clock starts immediately at `createdAt` (n-back streams start right
 * away, unlike Sequence Recall's separate "showing" phase).
 *
 * @param {number} difficultyLevel - 1-5
 * @param {number} createdAt - ms epoch timestamp supplied by the caller
 * @param {Object} [options]
 * @param {number} [options.trialCount] - defaults to DEFAULT_TRIAL_COUNT
 * @param {number} [options.stimulusSetSize] - defaults to DEFAULT_STIMULUS_SET_SIZE
 * @param {number} [options.matchProbability] - defaults to DEFAULT_MATCH_PROBABILITY
 * @param {() => number} [options.randomFn] - injectable RNG for tests
 * @returns {Object} frozen session state
 */
function createNBackSession(difficultyLevel, createdAt, options = {}) {
  if (typeof createdAt !== "number" || Number.isNaN(createdAt)) {
    throw new Error(`createdAt must be a number (ms epoch), got ${createdAt}`);
  }

  const { n, stimulusIntervalMs } = getDifficultyParams("n-back", difficultyLevel);
  const trialCount = options.trialCount ?? DEFAULT_TRIAL_COUNT;
  const stimulusSetSize = options.stimulusSetSize ?? DEFAULT_STIMULUS_SET_SIZE;
  const matchProbability = options.matchProbability ?? DEFAULT_MATCH_PROBABILITY;
  const randomFn = options.randomFn ?? Math.random;

  const { stimuli, isMatchAt } = generateStimulusSequence(
    trialCount,
    n,
    stimulusSetSize,
    matchProbability,
    randomFn
  );

  return Object.freeze({
    difficultyLevel,
    n,
    stimulusSetSize,
    stimulusIntervalMs,
    stimuli: Object.freeze(stimuli),
    isMatchAt: Object.freeze(isMatchAt),
    currentIndex: 0,
    responses: Object.freeze(new Array(stimuli.length).fill(null)), // null | "pressed"
    responseLatencies: Object.freeze(new Array(stimuli.length).fill(null)),
    outcomes: Object.freeze(new Array(stimuli.length).fill(null)),
    hits: 0,
    misses: 0,
    falseAlarms: 0,
    correctRejections: 0,
    warmupCount: 0,
    phase: PHASES.IN_PROGRESS,
    createdAt,
    trialStartedAt: createdAt,
    completedAt: null,
  });
}

/**
 * Records a "match" button press for the CURRENT trial. Can only be called
 * once per trial — a second press before advanceToNextTrial() throws,
 * since real n-back UIs debounce/ignore repeat presses within one trial.
 *
 * @param {Object} session
 * @param {number} timestamp - ms epoch when the press occurred
 * @returns {Object} new session state
 */
function pressMatch(session, timestamp) {
  if (session.phase !== PHASES.IN_PROGRESS) {
    throw new Error(
      `pressMatch called from invalid phase "${session.phase}" (expected "${PHASES.IN_PROGRESS}")`
    );
  }
  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    throw new Error(`timestamp must be a number (ms epoch), got ${timestamp}`);
  }
  if (session.responses[session.currentIndex] !== null) {
    throw new Error(
      `pressMatch called twice for trial ${session.currentIndex} — one press per trial is allowed`
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
 * Finalizes scoring for the current trial (based on whether pressMatch()
 * was called during it) and advances to the next trial, or completes the
 * session if this was the last trial.
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
  const wasPressed = session.responses[i] === "pressed";
  const isMatch = session.isMatchAt[i];

  let outcome;
  let hits = session.hits;
  let misses = session.misses;
  let falseAlarms = session.falseAlarms;
  let correctRejections = session.correctRejections;
  let warmupCount = session.warmupCount;

  if (i < session.n) {
    outcome = OUTCOMES.WARMUP;
    warmupCount += 1;
  } else if (isMatch && wasPressed) {
    outcome = OUTCOMES.HIT;
    hits += 1;
  } else if (isMatch && !wasPressed) {
    outcome = OUTCOMES.MISS;
    misses += 1;
  } else if (!isMatch && wasPressed) {
    outcome = OUTCOMES.FALSE_ALARM;
    falseAlarms += 1;
  } else {
    outcome = OUTCOMES.CORRECT_REJECTION;
    correctRejections += 1;
  }

  const newOutcomes = session.outcomes.slice();
  newOutcomes[i] = outcome;

  const nextIndex = i + 1;
  const isSessionComplete = nextIndex >= session.stimuli.length;

  return Object.freeze({
    ...session,
    outcomes: Object.freeze(newOutcomes),
    hits,
    misses,
    falseAlarms,
    correctRejections,
    warmupCount,
    currentIndex: isSessionComplete ? session.currentIndex : nextIndex,
    trialStartedAt: isSessionComplete ? session.trialStartedAt : timestamp,
    phase: isSessionComplete ? PHASES.COMPLETE : PHASES.IN_PROGRESS,
    completedAt: isSessionComplete ? timestamp : null,
  });
}

/**
 * Accuracy over SCORED trials only (excludes warm-up trials, since there's
 * no correct answer possible before n stimuli have been shown).
 * accuracy = (hits + correctRejections) / total scored trials
 *
 * @param {Object} session
 * @returns {number} 0-1
 */
function computeAccuracy(session) {
  const scoredTotal =
    session.hits + session.misses + session.falseAlarms + session.correctRejections;
  if (scoredTotal === 0) return 0;
  return (session.hits + session.correctRejections) / scoredTotal;
}

/**
 * Average response latency across trials where the player actually
 * pressed (hits + false alarms) — trials with no response contribute no
 * latency data point. Returns 0 if the player never pressed at all, which
 * is a legitimate (if concerning) outcome worth flagging to Person 2's
 * adaptive engine via a 0 rather than a fabricated number.
 *
 * @param {Object} session
 * @returns {number} ms, >= 0
 */
function computeAverageResponseLatencyMs(session) {
  const recorded = session.responseLatencies.filter((v) => v !== null);
  if (recorded.length === 0) return 0;
  const sum = recorded.reduce((acc, v) => acc + v, 0);
  return sum / recorded.length;
}

/**
 * Summarizes the whole round's error pattern into a single free-form
 * string, per eventSchema.js's errorType convention (non-empty string,
 * not a closed enum — see Meyx's team decision). N-back naturally
 * produces two DIFFERENT kinds of errors (misses vs. false alarms) in the
 * same round, which a single-string field can't fully capture — this is a
 * deliberate simplification for the session-summary event; per-trial
 * detail (outcomes array) stays available on the session object itself
 * for anyone who needs it before it's discarded.
 *
 * @param {Object} session
 * @returns {string}
 */
function summarizeErrorType(session) {
  const hadMisses = session.misses > 0;
  const hadFalseAlarms = session.falseAlarms > 0;
  if (!hadMisses && !hadFalseAlarms) return "none";
  if (hadMisses && hadFalseAlarms) return "mixed-errors";
  if (hadMisses) return "miss";
  return "false-alarm";
}

/**
 * Builds a validated, patient-agnostic GameSessionEvent summarizing a
 * completed N-Back round. Throws if the session isn't complete.
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
    gameId: "n-back",
    difficultyLevel: session.difficultyLevel,
    accuracy: computeAccuracy(session),
    responseLatencyMs: computeAverageResponseLatencyMs(session),
    errorType: summarizeErrorType(session),
    timestamp: session.completedAt,
  });
}

export {
  DEFAULT_STIMULUS_SET_SIZE,
  DEFAULT_TRIAL_COUNT,
  DEFAULT_MATCH_PROBABILITY,
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
};