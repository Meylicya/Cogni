/**
 * patientSessionContext.js
 *
 * The seam between the backend and Person 2's on-device engines. Called
 * from sessionBootstrap.js to materialize a fresh ZPDEngine +
 * SymptomCheckinScorer pair against the authenticated patient's current
 * difficulty tier and intake flags.
 *
 * Per the project's data-minimization posture (Section 3 of the project
 * doc), this endpoint returns ONLY the two fields the engines actually
 * need to bootstrap — never the patient's name, email, or any other
 * identifying/health data. The server-side endpoint that backs this
 * (GET /api/patients/:id/session-context in server/routes/patients.js)
 * projects the query to those same two fields so a server-side bug
 * can't accidentally leak the rest of the patient document.
 *
 * Auth: server/middleware/requireAuth.js gates this route on
 * X-User-Id + X-User-Role headers. We attach them via authHeaders.js,
 * which reads from the same localStorage keys SessionContext writes —
 * so the active session from the login page is what the server sees.
 */

import { getAuthHeaders } from './authHeaders.js'

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
  || (typeof process !== 'undefined' && process.env?.API_BASE_URL)
  || 'http://localhost:3001';

/**
 * Fetches the minimal session context for one patient.
 *
 * @param {string} patientId
 * @returns {Promise<{ difficultyTier: number, languageSymptomsFlagged: boolean }>}
 * @throws if the request fails or the patient is not found — callers
 *   (sessionBootstrap) want to fail loud at boot, not silently start a
 *   session against a missing/default patient.
 */
async function getPatientSessionContext(patientId) {
  if (!patientId) {
    throw new Error('getPatientSessionContext requires a patientId');
  }

  const res = await fetch(`${API_BASE}/api/patients/${encodeURIComponent(patientId)}/session-context`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.message || `Failed to load patient session context (status ${res.status})`
    );
  }

  const ctx = await res.json();

  // Defensive normalization — the server-side route already projects to
  // these fields, but a misconfigured deployment shouldn't be able to
  // boot a ZPD engine at an out-of-range tier. difficultyTier is 1-5 per
  // Patient.js + difficultyConfig.js; clamp anything weird rather than
  // letting ZPDEngine's constructor throw mid-session.
  const tier = Number.isInteger(ctx.difficultyTier) ? ctx.difficultyTier : 1;
  const clampedTier = Math.min(5, Math.max(1, tier));

  return {
    difficultyTier: clampedTier,
    languageSymptomsFlagged: Boolean(ctx.languageSymptomsFlagged),
  };
}

export { getPatientSessionContext, API_BASE };
