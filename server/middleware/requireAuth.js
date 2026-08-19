/**
 * requireAuth — hackathon-level server-side auth middleware.
 *
 * The client stores role + userId in localStorage and sends them on every
 * authenticated request via:
 *   - X-User-Id:   the active userId (patientId | clinicianId | caregiverId)
 *   - X-User-Role: 'patient' | 'clinician' | 'caregiver'
 *
 * Real auth is out of scope (see CLAUDE.md + SessionContext's banner
 * comment). This middleware is a deliberately weak stand-in that closes
 * the worst holes — namely, anyone with a guessed/snooped userId being
 * able to read /:id/* resources belonging to someone else. It is NOT a
 * substitute for proper session tokens, JWTs, or origin checks.
 *
 * Authorization rules (mirrors the existing route TODO comments):
 *   - GET /api/clinicians/:id/patients    → X-User-Id must equal :id
 *                                            AND X-User-Role must be 'clinician'
 *   - GET /api/caregivers/:id/patients    → X-User-Id must equal :id
 *                                            AND X-User-Role must be 'caregiver'
 *   - GET /api/patients/:id/session-context
 *                                          → one of:
 *                                             (a) X-User-Id == :id AND role == 'patient'
 *                                             (b) X-User-Id is the clinician who owns
 *                                                 that patient AND role == 'clinician'
 *                                             (c) X-User-Id is a caregiver linked to
 *                                                 that patient AND role == 'caregiver'
 *   - GET /api/game-sessions/patient/:id  → same allow-list as
 *                                            /patients/:id/session-context
 *
 * Mount with:  router.get('/:id/...', requireAuth({ resource: 'clinician-roster' }), handler)
 * The `resource` key selects the right rule table.
 *
 * The model lookups live in `lookups.js` (sibling file) so this module
 * stays testable without monkey-patching mongoose at import time. Tests
 * override `lookups` via the optional `lookups` field on the opts bag.
 */

import * as defaultLookups from './requireAuthLookups.js'

const ROLE_VALUES = new Set(['patient', 'clinician', 'caregiver'])

function deny(res, status, code, message) {
  return res.status(status).json({ error: code, message })
}

/**
 * Returns an Express middleware that gates an :id URL param against
 * the request's X-User-Id / X-User-Role headers.
 *
 * @param {Object} opts
 * @param {('clinician-roster'|'caregiver-roster'|'patient-resource'|'patient-scores')} opts.resource
 *        Which allow-list to apply. See the file header for the mapping.
 * @param {Object} [opts.lookups] Override the default model lookups for
 *        tests. Same shape as `requireAuthLookups.js`.
 */
export function requireAuth({ resource, lookups = defaultLookups }) {
  return async function requireAuthMiddleware(req, res, next) {
    const headerUserId = req.header('X-User-Id')
    const headerRole = req.header('X-User-Role')

    // Missing or malformed headers = no auth attempt at all. The login
    // pages also call /api/... routes without these headers today, so we
    // only fail-closed on routes that explicitly opted in here — the
    // caller chose to mount requireAuth, so the contract is "you must
    // present credentials."
    if (!headerUserId || !headerRole) {
      return deny(res, 401, 'unauthenticated', 'Missing X-User-Id or X-User-Role header.')
    }
    if (!ROLE_VALUES.has(headerRole)) {
      return deny(res, 401, 'unauthenticated', `Unknown X-User-Role "${headerRole}".`)
    }

    const urlId = req.params.id
    if (!urlId) {
      // Should be unreachable — every gated route has :id — but bail
      // loudly rather than silently letting through.
      return deny(res, 500, 'misconfigured', 'requireAuth mounted on a route without :id')
    }

    try {
      switch (resource) {
        case 'clinician-roster': {
          if (headerRole !== 'clinician' || headerUserId !== urlId) {
            return deny(res, 403, 'forbidden', 'Only the clinician themselves can read this roster.')
          }
          return next()
        }

        case 'caregiver-roster': {
          if (headerRole !== 'caregiver' || headerUserId !== urlId) {
            return deny(res, 403, 'forbidden', 'Only the caregiver themselves can read this roster.')
          }
          return next()
        }

        case 'patient-resource':
        case 'patient-scores': {
          // Three allowed roles for the same patient.
          // (a) the patient themselves
          if (headerRole === 'patient' && headerUserId === urlId) {
            return next()
          }

          // (b) the clinician who owns that patient
          if (headerRole === 'clinician') {
            const patient = await lookups.findPatientById(urlId)
            if (patient && patient.clinicianId?.toString() === headerUserId) {
              return next()
            }
            return deny(res, 403, 'forbidden', 'Clinician does not own this patient.')
          }

          // (c) a caregiver linked to that patient
          if (headerRole === 'caregiver') {
            const link = await lookups.findCaregiverLink(headerUserId, urlId)
            if (link) return next()
            return deny(res, 403, 'forbidden', 'Caregiver is not linked to this patient.')
          }

          return deny(res, 403, 'forbidden', 'Role not permitted on this resource.')
        }

        default:
          return deny(res, 500, 'misconfigured', `Unknown requireAuth resource "${resource}"`)
      }
    } catch (err) {
      // Don't leak DB error details to the client; log server-side.
      console.error('requireAuth error:', err)
      return deny(res, 500, 'internal', 'Authorization check failed.')
    }
  }
}

export default requireAuth
