/**
 * eventSchema.js
 *
 * Shared event schema — emitted by Person 1's games, consumed by Person 2's
 * ZPD engine and Person 3's sync layer. Changes here are a team-wide
 * decision, not just Person 1's — flag before editing shape/behavior.
 *
 * IMPORTANT — patient-agnostic by design:
 * GameSessionEvent objects never carry a patientId (or any other
 * identifying field like email/name). Person 3's sync layer injects the
 * authenticated patient's ID at the point events are persisted, which is
 * what keeps these games testable/usable in isolation. createGameSessionEvent
 * actively rejects a patientId being passed in, rather than silently
 * dropping it, so a future accidental leak fails loudly instead of quietly.
 *
 * @typedef {Object} GameSessionEvent
 * @property {string} gameId - one of VALID_GAME_IDS
 * @property {number} difficultyLevel - integer 1-5, matches patients.difficulty_tier
 * @property {number} accuracy - 0-1
 * @property {number} responseLatencyMs - time to respond, in ms, >= 0
 * @property {string} errorType - free-form non-empty string (not a closed enum —
 *   different games summarize their own error taxonomy into this field)
 * @property {number} timestamp - ms epoch
 */

// Intentionally NOT frozen: shared.test.js calls VALID_GAME_IDS.sort()
// in place, and callers may reasonably want to .sort()/.map() this list.
// It's a fixed set by convention, not by object-level immutability.
const VALID_GAME_IDS = [
  "n-back",
  "sequence-recall",
  "reaction-attention",
  "speech-word-finding",
];

const VALID_DIFFICULTY_LEVELS = Object.freeze([1, 2, 3, 4, 5]);

const REQUIRED_FIELDS = Object.freeze([
  "gameId",
  "difficultyLevel",
  "accuracy",
  "responseLatencyMs",
  "errorType",
]);

/**
 * Validates a fully-formed GameSessionEvent-shaped object and returns an
 * array of human-readable error strings (empty array = valid). Never
 * throws — this is the "check, don't crash" counterpart to
 * createGameSessionEvent's "construct, and throw on bad input" behavior.
 *
 * @param {Object} event
 * @returns {string[]}
 */
function validateGameSessionEvent(event) {
  const errors = [];

  if (!event || typeof event !== "object") {
    return ["event must be an object"];
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in event)) {
      errors.push(`missing required field "${field}"`);
    }
  }

  if ("gameId" in event && !VALID_GAME_IDS.includes(event.gameId)) {
    errors.push(`gameId "${event.gameId}" is not a known game id (expected one of ${VALID_GAME_IDS.join(", ")})`);
  }

  if ("difficultyLevel" in event && !VALID_DIFFICULTY_LEVELS.includes(event.difficultyLevel)) {
    errors.push(
      `difficultyLevel must be one of ${VALID_DIFFICULTY_LEVELS.join(", ")}, got ${event.difficultyLevel}`
    );
  }

  if ("accuracy" in event) {
    const a = event.accuracy;
    if (typeof a !== "number" || Number.isNaN(a) || a < 0 || a > 1) {
      errors.push(`accuracy must be a number between 0 and 1, got ${a}`);
    }
  }

  if ("responseLatencyMs" in event) {
    const r = event.responseLatencyMs;
    if (typeof r !== "number" || Number.isNaN(r) || r < 0) {
      errors.push(`responseLatencyMs must be a non-negative number, got ${r}`);
    }
  }

  if ("errorType" in event) {
    if (typeof event.errorType !== "string" || event.errorType.length === 0) {
      errors.push(`errorType must be a non-empty string, got ${JSON.stringify(event.errorType)}`);
    }
  }

  if ("timestamp" in event) {
    if (typeof event.timestamp !== "number" || Number.isNaN(event.timestamp)) {
      errors.push(`timestamp must be a number (ms epoch), got ${event.timestamp}`);
    }
  }

  if ("patientId" in event) {
    errors.push(
      `event must remain patient-agnostic — patientId should be injected by the sync layer, not baked in here`
    );
  }

  return errors;
}

/**
 * Constructs a validated, frozen GameSessionEvent. Throws immediately on
 * any invalid/missing field (fail loud, fail at construction time) rather
 * than letting a malformed event travel downstream to Person 2's ZPD
 * engine or Person 3's sync layer.
 *
 * Deliberately rejects a `patientId` (or other identifying fields) being
 * passed in — see the patient-agnostic note above.
 *
 * @param {Object} input
 * @param {string} input.gameId
 * @param {number} input.difficultyLevel
 * @param {number} input.accuracy
 * @param {number} input.responseLatencyMs
 * @param {string} input.errorType
 * @param {number} [input.timestamp] - defaults to Date.now() if omitted
 * @returns {Readonly<GameSessionEvent>}
 */
function createGameSessionEvent(input) {
  if (!input || typeof input !== "object") {
    throw new Error("createGameSessionEvent requires an options object");
  }

  if ("patientId" in input || "email" in input || "name" in input) {
    throw new Error(
      "GameSessionEvent must stay patient-agnostic — do not pass patientId/email/name into createGameSessionEvent; the sync layer injects patientId at persistence time"
    );
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in input) || input[field] === undefined) {
      throw new Error(`missing required field "${field}"`);
    }
  }

  const { gameId, difficultyLevel, accuracy, responseLatencyMs, errorType } = input;
  const timestamp = "timestamp" in input && input.timestamp !== undefined ? input.timestamp : Date.now();

  if (!VALID_GAME_IDS.includes(gameId)) {
    throw new Error(`gameId "${gameId}" is not a known game id (expected one of ${VALID_GAME_IDS.join(", ")})`);
  }

  if (!VALID_DIFFICULTY_LEVELS.includes(difficultyLevel)) {
    throw new Error(
      `difficultyLevel must be one of ${VALID_DIFFICULTY_LEVELS.join(", ")}, got ${difficultyLevel}`
    );
  }

  if (typeof accuracy !== "number" || Number.isNaN(accuracy) || accuracy < 0 || accuracy > 1) {
    throw new Error(`accuracy must be a number between 0 and 1, got ${accuracy}`);
  }

  if (typeof responseLatencyMs !== "number" || Number.isNaN(responseLatencyMs) || responseLatencyMs < 0) {
    throw new Error(`responseLatencyMs must be a non-negative number, got ${responseLatencyMs}`);
  }

  if (typeof errorType !== "string" || errorType.length === 0) {
    throw new Error(`errorType must be a non-empty string, got ${JSON.stringify(errorType)}`);
  }

  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    throw new Error(`timestamp must be a number (ms epoch), got ${timestamp}`);
  }

  return Object.freeze({
    gameId,
    difficultyLevel,
    accuracy,
    responseLatencyMs,
    errorType,
    timestamp,
  });
}

export {
  VALID_GAME_IDS,
  VALID_DIFFICULTY_LEVELS,
  createGameSessionEvent,
  validateGameSessionEvent,
};