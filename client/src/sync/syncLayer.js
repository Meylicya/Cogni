/**
 * syncLayer.js
 *
 * The bridge between Person 1's patient-agnostic GameSessionEvent objects
 * (from eventSchema.js) and Person 3's backend. This is the ONLY place
 * that's allowed to attach a patientId to an event — eventSchema.js
 * actively rejects patientId being passed into createGameSessionEvent,
 * so this file is the deliberate seam where that boundary gets crossed.
 *
 * Current state: no auth exists yet (Person 4's login flow isn't built),
 * so getCurrentPatientId() below is a stub. Swap its implementation once
 * real auth/session state exists — nothing else in this file should need
 * to change.
 *
 * Encryption: NOT yet implemented here. Per the build order, client-side
 * AES-GCM (Web Crypto API) is the next piece — see the encryptPayload()
 * stub below for exactly where it plugs in.
 */

import { validateGameSessionEvent } from '../../../shared/eventSchema.js'
import { getOrCreatePatientKey, encryptScores } from './webCrypto.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

/**
 * STUB — replace once Person 4's auth/invite flow exists.
 * For now, reads a patientId from localStorage so the sync layer can be
 * tested end-to-end without real auth. Set it manually in the browser
 * console during dev: localStorage.setItem('patientId', '<a real _id from your DB>')
 *
 * @returns {string|null}
 */
function getCurrentPatientId() {
  // TODO(Person 4 / auth): replace with real authenticated patient ID,
  // e.g. pulled from a JWT/session context, not localStorage.
  return typeof window !== 'undefined' ? window.localStorage.getItem('patientId') : null
}

/**
 * Takes a validated GameSessionEvent (as emitted by Person 1's games via
 * eventSchema.js's createGameSessionEvent), injects the authenticated
 * patientId, and syncs it to the backend as a GameSession record.
 *
 * Fails loudly on validation errors (same philosophy as
 * createGameSessionEvent) but network/API failures are caught and
 * reported via the returned result object rather than thrown, since a
 * dropped network call mid-session shouldn't crash the patient's game.
 *
 * @param {import('../../../shared/eventSchema.js').GameSessionEvent} event
 * @returns {Promise<{ ok: boolean, session?: Object, error?: string }>}
 */
export async function syncGameEvent(event) {
  const validationErrors = validateGameSessionEvent(event)
  if (validationErrors.length > 0) {
    throw new Error(`syncGameEvent received an invalid event: ${validationErrors.join('; ')}`)
  }

  const patientId = getCurrentPatientId()
  if (!patientId) {
    return {
      ok: false,
      error: 'No authenticated patientId available — cannot sync (auth not wired up yet).',
    }
  }

  // Only the actual scores get encrypted — gameId/difficultyLevel/completedAt
  // stay as plain metadata so the dashboard can filter/sort without needing
  // to decrypt every row first.
  const key = await getOrCreatePatientKey(patientId)
  const encryptedScores = await encryptScores(key, {
    accuracy: event.accuracy,
    avgLatencyMs: event.responseLatencyMs,
    errorType: event.errorType,
  })

  const payload = {
    patientId,
    gameId: event.gameId,
    difficultyLevel: event.difficultyLevel,
    completedAt: event.timestamp,
    encryptedScores, // { ciphertext, iv } — this is literally all the network sees
  }

  try {
    const res = await fetch(`${API_BASE}/api/game-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, error: body.error || `Sync failed with status ${res.status}` }
    }

    const session = await res.json()
    return { ok: true, session }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}