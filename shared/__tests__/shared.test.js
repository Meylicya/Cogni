import test from "node:test";
import assert from "node:assert/strict";

import {
  createGameSessionEvent,
  validateGameSessionEvent,
  VALID_GAME_IDS,
} from "../eventSchema.js";

import {
  getDifficultyParams,
  clampDifficulty,
  MIN_DIFFICULTY,
  MAX_DIFFICULTY,
} from "../difficultyConfig.js";

// ---- eventSchema.js ----

test("createGameSessionEvent builds a valid event with all fields", () => {
  const event = createGameSessionEvent({
    gameId: "sequence-recall",
    difficultyLevel: 3,
    accuracy: 0.8,
    responseLatencyMs: 1200,
    errorType: "none",
  });
  assert.equal(event.gameId, "sequence-recall");
  assert.equal(event.difficultyLevel, 3);
  assert.equal(event.accuracy, 0.8);
  assert.equal(event.responseLatencyMs, 1200);
  assert.equal(event.errorType, "none");
  assert.equal(typeof event.timestamp, "number");
});

test("createGameSessionEvent defaults timestamp to now if omitted", () => {
  const before = Date.now();
  const event = createGameSessionEvent({
    gameId: "n-back",
    difficultyLevel: 1,
    accuracy: 1,
    responseLatencyMs: 500,
    errorType: "none",
  });
  const after = Date.now();
  assert.ok(event.timestamp >= before && event.timestamp <= after);
});

test("createGameSessionEvent returns a frozen (immutable) object", () => {
  const event = createGameSessionEvent({
    gameId: "n-back",
    difficultyLevel: 1,
    accuracy: 1,
    responseLatencyMs: 500,
    errorType: "none",
  });
  assert.throws(() => {
    event.accuracy = 0;
  }, TypeError);
});

test("createGameSessionEvent throws on missing field", () => {
  assert.throws(() => {
    createGameSessionEvent({
      gameId: "n-back",
      difficultyLevel: 1,
      accuracy: 1,
      // responseLatencyMs missing
      errorType: "none",
    });
  }, /missing required field "responseLatencyMs"/);
});

test("createGameSessionEvent throws on unknown gameId", () => {
  assert.throws(() => {
    createGameSessionEvent({
      gameId: "not-a-real-game",
      difficultyLevel: 1,
      accuracy: 1,
      responseLatencyMs: 500,
      errorType: "none",
    });
  }, /not a known game id/);
});

test("createGameSessionEvent throws on out-of-range difficultyLevel", () => {
  assert.throws(() => {
    createGameSessionEvent({
      gameId: "n-back",
      difficultyLevel: 9,
      accuracy: 1,
      responseLatencyMs: 500,
      errorType: "none",
    });
  }, /difficultyLevel must be one of/);
});

test("createGameSessionEvent throws on accuracy outside 0-1", () => {
  assert.throws(() => {
    createGameSessionEvent({
      gameId: "n-back",
      difficultyLevel: 1,
      accuracy: 1.5,
      responseLatencyMs: 500,
      errorType: "none",
    });
  }, /accuracy must be a number between 0 and 1/);
});

test("createGameSessionEvent throws on negative responseLatencyMs", () => {
  assert.throws(() => {
    createGameSessionEvent({
      gameId: "n-back",
      difficultyLevel: 1,
      accuracy: 1,
      responseLatencyMs: -10,
      errorType: "none",
    });
  }, /responseLatencyMs must be a non-negative number/);
});

test("createGameSessionEvent rejects patientId leaking into the event (patient-agnostic guard)", () => {
  assert.throws(() => {
    createGameSessionEvent({
      gameId: "n-back",
      difficultyLevel: 1,
      accuracy: 1,
      responseLatencyMs: 500,
      errorType: "none",
      patientId: "abc-123",
    });
  }, /patient-agnostic/);
});

test("validateGameSessionEvent returns empty array for a valid event, doesn't throw", () => {
  const errors = validateGameSessionEvent({
    gameId: "reaction-attention",
    difficultyLevel: 2,
    accuracy: 0.5,
    responseLatencyMs: 300,
    errorType: "false-alarm",
    timestamp: Date.now(),
  });
  assert.deepEqual(errors, []);
});

test("VALID_GAME_IDS includes all four planned games", () => {
  assert.deepEqual(
    VALID_GAME_IDS.sort(),
    ["n-back", "reaction-attention", "sequence-recall", "speech-word-finding"].sort()
  );
});

// ---- difficultyConfig.js ----

test("getDifficultyParams returns params for a valid game/level combo", () => {
  const params = getDifficultyParams("sequence-recall", 3);
  assert.equal(params.sequenceLength, 5);
});

test("getDifficultyParams throws on unknown gameId", () => {
  assert.throws(() => {
    getDifficultyParams("not-a-game", 1);
  }, /Unknown gameId/);
});

test("getDifficultyParams throws on out-of-range level", () => {
  assert.throws(() => {
    getDifficultyParams("sequence-recall", 6);
  }, /must be an integer between/);
});

test("getDifficultyParams throws on non-integer level", () => {
  assert.throws(() => {
    getDifficultyParams("sequence-recall", 2.5);
  }, /must be an integer between/);
});

test("clampDifficulty clamps below range to MIN_DIFFICULTY", () => {
  assert.equal(clampDifficulty(0), MIN_DIFFICULTY);
});

test("clampDifficulty clamps above range to MAX_DIFFICULTY", () => {
  assert.equal(clampDifficulty(10), MAX_DIFFICULTY);
});

test("clampDifficulty leaves in-range values unchanged", () => {
  assert.equal(clampDifficulty(3), 3);
});
