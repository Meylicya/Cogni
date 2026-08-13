import { createContext, useContext, useState, useEffect } from 'react'


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
