/**
 * syncLayer.js
 *
 * The bridge between Person 1's patient-agnostic GameSessionEvent objects
 * (from eventSchema.js) and Person 3's backend. This is the ONLY place
 * that's allowed to attach a patientId to an event — eventSchema.js
 * actively rejects patientId being passed into createGameSessionEvent,
 * so this file is the deliberate seam where that boundary gets crossed.
 *
 * Auth: SessionContext (see context/SessionContext.jsx) is the source of
 * truth for the active role. It already persists the patientId to
 * localStorage under the same key we read here, so we can resolve the
 * current patientId synchronously from a non-React call site. When
 * real auth lands, this becomes "read the active session from the
 * SessionContext cache" — no other change needed here.
 *
 * Privacy boundary: clinical scores sync as plaintext PHI behind the
 * server's RBAC gate (GET /api/game-sessions/patient/:id is gated by
 * requireAuth({ resource: 'patient-scores' })). Biometric / sensor data
 * (webcam, PPG, audio) stays on-device and is not synced here — see
 * client/src/pages/shared/PrivacySandbox.jsx for the network-telemetry
 * proof panel.
 */

import { validateGameSessionEvent } from '../../../shared/eventSchema.js'
import { getAuthHeaders } from './authHeaders.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

/**
 * Reads the active patientId from SessionContext's localStorage key.
 * We can't use the React hook from this non-component call site, so we
 * read the same key SessionContext writes to. The two stay in lockstep
 * as long as login/logout go through the context (see Login.jsx pages).
 *
 * @returns {string|null}
 */
function getCurrentPatientId() {
  if (typeof window === 'undefined') return null;
  // 🚨 HACKATHON DEMO BYPASS: Check for the real patient login OR the clinician's demo active patient!
  return window.localStorage.getItem('patientId') || window.localStorage.getItem('demo_active_patient_id');
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

  const payload = {
    patientId,
    gameId: event.gameId,
    difficultyLevel: event.difficultyLevel,
    completedAt: event.timestamp,
    accuracy: event.accuracy,
    avgLatencyMs: event.responseLatencyMs,
    errorType: event.errorType,
  }

  try {
    const res = await fetch(`${API_BASE}/api/game-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Attach X-User-* headers so the server has role context for any
        // future middleware that cross-checks body patientId against the
        // authenticated session (see routes/gameSessions.js TODO).
        ...getAuthHeaders(),
      },
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