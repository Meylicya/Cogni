import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

/**
 * SessionContext — the auth layer.
 *
 * Single source of truth for "who is logged in right now". All login
 * pages call `login(role, userId)` after a successful server response;
 * every protected page (and RequireAuth) reads from `useSession()`
 * instead of touching localStorage directly. This is what makes
 * logout + cross-tab sync Just Work.
 *
 * Roles:
 *   - 'patient'   — patientId in localStorage
 *   - 'clinician' — clinicianId in localStorage
 *   - 'caregiver' — caregiverId in localStorage
 *
 * The single-user assumption: at most one role is signed in at a time.
 * login() clears every other role's ID before writing the new one.
 * If we ever add multi-role sessions (e.g. a clinician who's also a
 * patient), this becomes a Map keyed by role instead of a single
 * value — but until then, "the current user" is whichever ID is set.
 *
 * Sync across tabs: the storage event listener catches login/logout in
 * other tabs so a clinician opening two browser tabs at once doesn't
 * have to log in twice.
 *
 * Why not real JWTs: out of scope for the hackathon. The server routes
 * are plaintext-password-comparing (see Clinician/Caregiver/Patient
 * models — `authCredentialHash` is the plaintext password with a name
 * that suggests otherwise). When that gets a real auth middleware,
 * `login()` becomes "POST credentials, store JWT in httpOnly cookie or
 * in-memory, refresh via /me". The shape of this context shouldn't
 * need to change — only the implementation of resolveSession() does.
 */

const SessionContext = createContext(null)

const ROLE_KEYS = {
  patient: 'patientId',
  clinician: 'clinicianId',
  caregiver: 'caregiverId',
}

function readRole() {
  if (typeof window === 'undefined') return null
  for (const [role, key] of Object.entries(ROLE_KEYS)) {
    const id = window.localStorage.getItem(key)
    if (id) return { role, userId: id }
  }
  return null
}

async function resolveSession() {
  // Currently synchronous — localStorage read. Kept async for forward
  // compatibility with a real /me endpoint: swap this body to fetch
  // and nothing downstream needs to change.
  return readRole()
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    resolveSession().then((s) => {
      if (!cancelled) {
        setSession(s)
        setLoading(false)
      }
    })

    // Cross-tab sync: another tab logs in/out -> mirror here.
    function onStorage(e) {
      if (e.key && Object.values(ROLE_KEYS).includes(e.key)) {
        setSession(readRole())
      } else if (e.key === null) {
        // localStorage.clear() in another tab
        setSession(readRole())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      cancelled = true
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  /**
   * Records that a user just authenticated. The login page calls this
   * after a successful fetch to its role's /login endpoint, so the
   * session becomes live everywhere without a full reload.
   */
  const login = useCallback((role, userId) => {
    if (!ROLE_KEYS[role]) {
      throw new Error(`Unknown role "${role}"`)
    }
    if (!userId) {
      throw new Error('login() requires a non-empty userId')
    }
    // Clear other roles — single-user assumption.
    for (const [r, key] of Object.entries(ROLE_KEYS)) {
      if (r !== role) window.localStorage.removeItem(key)
    }
    window.localStorage.setItem(ROLE_KEYS[role], userId)
    setSession({ role, userId })
  }, [])

  /**
   * Clears the active session in this tab and storage. Other tabs pick
   * up the change via the storage event listener above.
   */
  const logout = useCallback(() => {
    for (const key of Object.values(ROLE_KEYS)) {
      window.localStorage.removeItem(key)
    }
    setSession(null)
  }, [])

  // Convenience selectors so consumers don't have to know about role
  // branching. Falls back to undefined when no session, matching the
  // old useSession() shape that RehabSessionShell already reads.
  const value = useMemo(() => {
    const role = session?.role ?? null
    const userId = session?.userId ?? null
    return {
      role,
      userId,
      loading,
      login,
      logout,
      // Role-specific conveniences — keep these on the same object so
      // existing callsites like `useSession().patientId` keep working.
      patientId: role === 'patient' ? userId : undefined,
      clinicianId: role === 'clinician' ? userId : undefined,
      caregiverId: role === 'caregiver' ? userId : undefined,
    }
  }, [session, loading, login, logout])

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

/**
 * @returns {{
 *   role: 'patient'|'clinician'|'caregiver'|null,
 *   userId: string|null,
 *   loading: boolean,
 *   login: (role: string, userId: string) => void,
 *   logout: () => void,
 *   patientId?: string,
 *   clinicianId?: string,
 *   caregiverId?: string,
 * }}
 */
export function useSession() {
  const ctx = useContext(SessionContext)
  if (ctx === null) {
    throw new Error('useSession() must be called inside a <SessionProvider>')
  }
  return ctx
}
