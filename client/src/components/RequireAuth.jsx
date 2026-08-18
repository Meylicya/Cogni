import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '../context/SessionContext.jsx'

/**
 * RequireAuth — wraps a route so it only renders for the right role(s).
 *
 * Until this existed, every protected page (Dashboard, RehabSessionShell,
 * DailySymptomCheckin, ...) had to re-implement the "if no roleId, go to
 * /login" check in a useEffect, AND each one could silently render broken
 * UI when the *wrong* role was active (e.g. a clinician hitting /games
 * would just see an empty game picker because no patientId was set).
 *
 * Two redirects this does that the old per-page checks didn't:
 *   1. While SessionContext is still resolving the localStorage read
 *      (loading=true on first render), shows a tiny placeholder instead
 *      of flickering to the login page.
 *   2. When the wrong role is active, redirects to THAT role's home
 *      rather than always /login — e.g. a caregiver hitting /dashboard
 *      lands back on /dashboard, a patient hitting /dashboard lands on
 *      /games, instead of getting a generic login bounce.
 *
 * Usage:
 *   <Route path="/games" element={
 *     <RequireAuth role="patient"><GamesRoute /></RequireAuth>
 *   } />
 *   <Route path="/dashboard" element={
 *     <RequireAuth role={['clinician', 'caregiver']}><Dashboard /></RequireAuth>
 *   } />
 *
 * The role argument matches the role names SessionContext uses:
 *   'patient' | 'clinician' | 'caregiver'. A single string or an array
 *   is accepted.
 */
const ROLE_HOME = {
  patient: '/games',
  clinician: '/dashboard',
  caregiver: '/dashboard',
}

const ROLE_LOGIN = {
  patient: '/patient/login',
  clinician: '/login',
  caregiver: '/caregiver/login',
}

function isAllowed(role, required) {
  if (!role) return false
  if (Array.isArray(required)) return required.includes(role)
  return role === required
}

export default function RequireAuth({ role, children }) {
  const { role: activeRole, loading } = useSession()
  const location = useLocation()

  if (loading) {
    // SessionContext hasn't finished its first localStorage read yet.
    // Render nothing rather than the protected children or a redirect —
    // a one-frame flash of "wrong" UI is worse than a brief blank.
    return null
  }

  if (!isAllowed(activeRole, role)) {
    if (!activeRole) {
      // Not logged in at all — bounce to the appropriate login. Preserve
      // where the user was trying to go so we can return them after auth.
      const target = ROLE_LOGIN[Array.isArray(role) ? role[0] : role] || '/login'
      return <Navigate to={target} replace state={{ from: location.pathname }} />
    }
    // Logged in as a DIFFERENT role — send them to their own home rather
    // than a login screen they'd be auto-rejected from. (E.g. a clinician
    // typing /games by mistake lands on /dashboard, not /login, where
    // they'd have to log out and back in as a patient to proceed.)
    const home = ROLE_HOME[activeRole] || '/'
    return <Navigate to={home} replace />
  }

  return children
}
