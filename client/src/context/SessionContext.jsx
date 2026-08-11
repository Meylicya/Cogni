import { createContext, useContext, useState, useEffect } from 'react'

/**
 * SessionContext — the ONE place patientId/clinicianId should live once
 * real auth exists. Every component that currently has to guess where
 * these come from (RehabSessionShell's patientId prop, PatientInvite's
 * clinicianId prop, etc.) should eventually read from here via
 * useSession() instead of receiving it as a prop passed down from a
 * route param.
 *
 * WHO OWNS THIS: Person 3 (backend/auth) should replace the body of
 * resolveSession() below with a real call — verifying a stored JWT
 * against the Express API, or reading a magic-link token from the URL on
 * first patient login. Nothing else in this file needs to change once
 * that's wired in; every consumer only ever calls useSession().
 *
 * CURRENT STATE: resolveSession() below is a hardcoded dev stub so
 * Person 1 and Person 2 aren't blocked waiting on real auth. Swap it out
 * — don't build around it further.
 */

const SessionContext = createContext(null)

// ⚠️ DEV STUB — replace with a real auth check against the backend.
async function resolveSession() {
  return {
    patientId: 'dev-patient-1',
    clinicianId: 'dev-clinician-1',
  }
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    resolveSession().then((s) => {
      setSession(s)
      setLoading(false)
    })
  }, [])

  return (
    <SessionContext.Provider value={{ ...session, loading }}>
      {children}
    </SessionContext.Provider>
  )
}

/**
 * @returns {{ patientId: string|undefined, clinicianId: string|undefined, loading: boolean }}
 */
export function useSession() {
  const ctx = useContext(SessionContext)
  if (ctx === null) {
    throw new Error('useSession() must be called inside a <SessionProvider>')
  }
  return ctx
}
