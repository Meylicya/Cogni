/**
 * authHeaders.js
 *
 * Single source of truth for the hackathon-level auth headers every
 * authenticated fetch needs to send:
 *   X-User-Id:   the active userId (patientId | clinicianId | caregiverId)
 *   X-User-Role: 'patient' | 'clinician' | 'caregiver'
 *
 * Mirrors SessionContext.jsx's localStorage layout — the same keys the
 * login pages write. If a route is mounted behind requireAuth (see
 * server/middleware/requireAuth.js) and the caller forgot to attach
 * these headers, the server returns 401; this helper exists so the
 * omission happens in one place (here) rather than at every fetch site.
 *
 * Returns an empty object when called outside a browser (e.g. in tests)
 * so test fixtures can still exercise the network shape without
 * pretending to be authenticated.
 *
 * Real auth is out of scope — when JWTs land, this file becomes
 * "read the in-memory token and attach it" and every fetch site picks
 * up the change automatically.
 */

const ROLE_KEYS = {
  patient: 'patientId',
  clinician: 'clinicianId',
  caregiver: 'caregiverId',
}

export function getAuthHeaders() {
  if (typeof window === 'undefined') return {}
  for (const [role, key] of Object.entries(ROLE_KEYS)) {
    const id = window.localStorage.getItem(key)
    if (id) {
      return {
        'X-User-Id': id,
        'X-User-Role': role,
      }
    }
  }
  return {}
}

export { ROLE_KEYS }
