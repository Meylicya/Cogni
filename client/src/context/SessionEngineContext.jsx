import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSession } from './SessionContext.jsx'
import { createSessionEngine } from '../../../ML/ENGINE/Sessionengine.js'

/**
 * SessionEngineContext — exposes the on-device SessionEngine (ZPD +
 * symptom scorer + biometric guards) to any page in the patient app,
 * not just RehabSessionShell.
 *
 * Why a context, not a prop:
 *   The engine is a long-lived, patient-scoped object that multiple
 *   pages need to push signals into. RehabSessionShell pushes game
 *   events; DailySymptomCheckin pushes today's symptom severity; future
 *   pages might push caregiver observations or manual tier overrides.
 *   Threading the engine as a prop through React Router would require
 *   lifting state out of the routes, which the current route surface
 *   isn't built for. A context gives each page the same instance
 *   without restructuring routes.
 *
 * Lifecycle: one engine per patientId. The engine is bootstrapped lazily
 * — pages that don't need it (clinician/caregiver dashboards, login)
 * never trigger the bootstrap. When patientId changes (logout/login as
 * a different patient), the old engine is disposed and a fresh one is
 * created.
 *
 * NOTE: this context lives NEXT TO SessionContext, not inside it.
 * SessionContext is the auth layer (who is the patient); this context
 * is the adaptive-difficulty layer (what does the engine know about
 * this patient right now). Keeping them separate means auth changes
 * don't force the engine to rebuild, and engine rebuilds don't churn
 * auth.
 */

const SessionEngineContext = createContext(null)

export function SessionEngineProvider({ children }) {
  const { patientId, loading } = useSession()
  const engineRef = useRef(null)
  const [engine, setEngine] = useState(null)
  const [engineReady, setEngineReady] = useState(false)
  const [engineError, setEngineError] = useState(null)

  useEffect(() => {
    if (loading || !patientId) {
      // No patient yet — clear any prior engine so we don't leak.
      if (engineRef.current) {
        engineRef.current.dispose()
        engineRef.current = null
        setEngine(null)
        setEngineReady(false)
      }
      return
    }

    let cancelled = false
    setEngineError(null)
    setEngineReady(false)

    ;(async () => {
      try {
        const newEngine = await createSessionEngine(patientId)
        if (cancelled) {
          newEngine.dispose()
          return
        }
        engineRef.current = newEngine
        setEngine(newEngine)
        setEngineReady(true)
      } catch (err) {
        console.error('SessionEngine bootstrap failed:', err)
        if (!cancelled) setEngineError(err.message || 'Could not load session engine.')
      }
    })()

    return () => {
      cancelled = true
      if (engineRef.current) {
        engineRef.current.dispose()
        engineRef.current = null
      }
      setEngine(null)
      setEngineReady(false)
    }
  }, [patientId, loading])

  /**
   * Wraps createSessionEngine's bootstrap so consumers don't have to
   * know whether the engine exists yet. Returns the engine (now
   * guaranteed non-null) or throws if bootstrap failed.
   */
  const requireEngine = useCallback(() => {
    if (!engineRef.current) {
      throw new Error(engineError || 'Session engine not ready')
    }
    return engineRef.current
  }, [engineError])

  // The engine already fetched languageSymptomsFlagged from the server's
  // session-context endpoint during bootstrap — surface it here so pages
  // that just need the flag (e.g. DailySymptomCheckin deciding whether
  // to show the communication slider) don't have to re-fetch or read
  // localStorage. Stays false until the engine is ready.
  const languageSymptomsFlagged = engine?.languageSymptomsFlagged ?? false

  const value = useMemo(
    () => ({ engine, engineReady, engineError, requireEngine, languageSymptomsFlagged }),
    [engine, engineReady, engineError, requireEngine, languageSymptomsFlagged]
  )

  return (
    <SessionEngineContext.Provider value={value}>
      {children}
    </SessionEngineContext.Provider>
  )
}

/**
 * @returns {{
 *   engine: Object|null,
 *   engineReady: boolean,
 *   engineError: string|null,
 *   requireEngine: () => Object,
 *   languageSymptomsFlagged: boolean
 * }}
 */
export function useSessionEngine() {
  const ctx = useContext(SessionEngineContext)
  if (ctx === null) {
    throw new Error('useSessionEngine() must be called inside a <SessionEngineProvider>')
  }
  return ctx
}
