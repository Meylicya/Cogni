/**
 * authHeaders.js — client-side twin of ML/authHeaders.js.
 *
 * Returns the X-User-Id / X-User-Role pair that server-side
 * requireAuth middleware expects. Reads from the same localStorage keys
 * SessionContext writes on login, so the active session is what the
 * server sees.
 *
 * Returns {} when no session is active, so callers can spread safely:
 *   fetch(url, { headers: { 'Content-Type': 'application/json', ...getAuthHeaders() } })
 *
 * Real auth is out of scope — when JWTs land, this becomes "read the
 * in-memory token and attach it" and every fetch site picks up the
 * change automatically.
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
