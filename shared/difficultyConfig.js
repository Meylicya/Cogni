/**
 * difficultyConfig.js
 *
 * Owned by Person 1. Team contract, same caveat as eventSchema.js:
 * Person 2's ZPD engine adjusts patients within the tier a clinician has
 * approved (see Person 4's intake -> patients.difficulty_tier), and reads
 * this file to know what "level 3" actually means per game. Don't change
 * the level range or meaning without flagging the team.
 *
 * Levels are always an integer 1-5, matching patients.difficulty_tier
 * in the shared DB schema (Section 6 of the project doc).
 */

const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 5;

/**
 * Per-game tuning tables. Each game maps difficulty level -> its own
 * parameters. Keep games free to define whatever params make sense for
 * their mechanic — the only shared invariant is the 1-5 level range.
 */
const DIFFICULTY_CONFIG = {
  "n-back": {
    1: { n: 1, stimulusIntervalMs: 3000 },
    2: { n: 1, stimulusIntervalMs: 2500 },
    3: { n: 2, stimulusIntervalMs: 2500 },
    4: { n: 2, stimulusIntervalMs: 2000 },
    5: { n: 3, stimulusIntervalMs: 2000 },
  },
  "sequence-recall": {
    1: { sequenceLength: 3, showIntervalMs: 900 },
    2: { sequenceLength: 4, showIntervalMs: 800 },
    3: { sequenceLength: 5, showIntervalMs: 700 },
    4: { sequenceLength: 6, showIntervalMs: 600 },
    5: { sequenceLength: 7, showIntervalMs: 500 },
  },
  "reaction-attention": {
    1: { stimulusIntervalMsRange: [1500, 2500], noGoRatio: 0.15, responseWindowMs: 1200 },
    2: { stimulusIntervalMsRange: [1200, 2200], noGoRatio: 0.2, responseWindowMs: 1000 },
    3: { stimulusIntervalMsRange: [1000, 1800], noGoRatio: 0.25, responseWindowMs: 900 },
    4: { stimulusIntervalMsRange: [800, 1500], noGoRatio: 0.3, responseWindowMs: 750 },
    5: { stimulusIntervalMsRange: [600, 1200], noGoRatio: 0.35, responseWindowMs: 600 },
  },
  "speech-word-finding": {
    1: { promptCount: 6, responseWindowMs: 8000 },
    2: { promptCount: 8, responseWindowMs: 7000 },
    3: { promptCount: 10, responseWindowMs: 6000 },
    4: { promptCount: 10, responseWindowMs: 5000 },
    5: { promptCount: 12, responseWindowMs: 4000 },
  },
};

/**
 * Returns the tuning params for a given game at a given difficulty level.
 * Throws on an unknown game or out-of-range level, so misconfiguration
 * fails immediately rather than producing a silently-undefined session.
 */
function getDifficultyParams(gameId, level) {
  if (!(gameId in DIFFICULTY_CONFIG)) {
    throw new Error(`Unknown gameId "${gameId}" in difficultyConfig`);
  }
  if (!Number.isInteger(level) || level < MIN_DIFFICULTY || level > MAX_DIFFICULTY) {
    throw new Error(
      `difficultyLevel must be an integer between ${MIN_DIFFICULTY} and ${MAX_DIFFICULTY}, got ${level}`
    );
  }
  return DIFFICULTY_CONFIG[gameId][level];
}

/** Clamps a level to the valid 1-5 range — useful when Person 2's engine proposes a step up/down. */
function clampDifficulty(level) {
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, level));
}

export {
  MIN_DIFFICULTY,
  MAX_DIFFICULTY,
  DIFFICULTY_CONFIG,
  getDifficultyParams,
  clampDifficulty,
};