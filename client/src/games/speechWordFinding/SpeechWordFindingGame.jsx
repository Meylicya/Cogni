import { useState, useRef, useCallback, useEffect } from 'react'
import {
  createSpeechWordFindingSession,
  submitAnswer,
  advanceOnTimeout,
  computeAccuracy,
  buildSessionEvent,
  PHASES,
  OUTCOMES,
} from './speechWordFindingEngine'

/**
 * Speech & Word-Finding UI. Thin shell over the pure, tested engine in
 * speechWordFindingEngine.js — prompt selection, scoring, and completion
 * all live there. This component owns: pacing each prompt's response
 * window (responseWindowMs), translating typed submissions into
 * submitAnswer() calls, firing advanceOnTimeout() when the window
 * expires, and rendering session state.
 *
 * Only shown when languageSymptomsFlagged is true (Person 4's intake).
 *
 * @param {Object} props
 * @param {number} props.difficulty - current difficulty level (1-5)
 * @param {(event: object) => void} [props.onGameEvent] - called with the
 *   GameSessionEvent once a round completes
 */
export default function SpeechWordFindingGame({ difficulty, onGameEvent }) {
  const [session, setSession] = useState(null)
  const [draft, setDraft] = useState('')
  const [timeLeftMs, setTimeLeftMs] = useState(null)
  const [lastOutcome, setLastOutcome] = useState(null)
  const sessionRef = useRef(null)
  const timerRef = useRef(null)
  const tickRef = useRef(null)
  const outcomeTimerRef = useRef(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(
    () => () => {
      clearTimeout(timerRef.current)
      clearInterval(tickRef.current)
      clearTimeout(outcomeTimerRef.current)
    },
    []
  )

  const clearPromptTimers = useCallback(() => {
    clearTimeout(timerRef.current)
    clearInterval(tickRef.current)
    timerRef.current = null
    tickRef.current = null
  }, [])

  const schedulePromptWindow = useCallback((current) => {
    clearPromptTimers()
    const deadline = current.promptStartedAt + current.responseWindowMs
    setTimeLeftMs(Math.max(0, deadline - Date.now()))

    tickRef.current = setInterval(() => {
      const latest = sessionRef.current
      if (!latest || latest.phase !== PHASES.IN_PROGRESS) return
      const remaining = Math.max(0, deadline - Date.now())
      setTimeLeftMs(remaining)
    }, 100)

    timerRef.current = setTimeout(() => {
      const latest = sessionRef.current
      if (!latest || latest.phase !== PHASES.IN_PROGRESS) return
      if (latest.responses[latest.currentIndex] !== null) return

      const next = advanceOnTimeout(latest, Date.now())
      setLastOutcome(OUTCOMES.TIMEOUT)
      setDraft('')
      setSession(next)

      if (next.phase === PHASES.COMPLETE) {
        clearPromptTimers()
        setTimeLeftMs(null)
        onGameEvent?.(buildSessionEvent(next))
      } else {
        schedulePromptWindow(next)
      }
    }, Math.max(0, deadline - Date.now()))
  }, [clearPromptTimers, onGameEvent])

  const startRound = useCallback(() => {
    clearPromptTimers()
    clearTimeout(outcomeTimerRef.current)
    const now = Date.now()
    const fresh = createSpeechWordFindingSession(difficulty, now)
    setDraft('')
    setLastOutcome(null)
    setSession(fresh)
    schedulePromptWindow(fresh)
  }, [difficulty, clearPromptTimers, schedulePromptWindow])

  function handleSubmit(e) {
    e.preventDefault()
    const current = sessionRef.current
    if (!current || current.phase !== PHASES.IN_PROGRESS) return
    if (!draft.trim()) return

    const next = submitAnswer(current, draft, Date.now())
    const outcome = next.outcomes[current.currentIndex]

    clearPromptTimers()
    setLastOutcome(outcome)
    setDraft('')
    setSession(next)

    outcomeTimerRef.current = setTimeout(() => setLastOutcome(null), 400)

    if (next.phase === PHASES.COMPLETE) {
      setTimeLeftMs(null)
      onGameEvent?.(buildSessionEvent(next))
    } else {
      schedulePromptWindow(next)
    }
  }

  const phase = session?.phase
  const currentPrompt = session?.prompts[session.currentIndex]
  const progressIndex = session?.outcomes.filter(Boolean).length ?? 0
  const windowMs = session?.responseWindowMs ?? 1
  const timerPct = timeLeftMs !== null ? (timeLeftMs / windowMs) * 100 : 100

  return (
    <div style={styles.container}>
      <style>{cssVars}</style>

      <div style={styles.header}>
        <span style={styles.eyebrow}>Speech & communication · Level {difficulty}</span>
        <h2 style={styles.heading}>Word Finding</h2>
        <p style={styles.subheading}>
          Read the cue and type the word you are searching for. Take your time — there is no penalty for thinking.
        </p>
      </div>

      {!session && (
        <button style={styles.primaryButton} onClick={startRound}>
          Start round
        </button>
      )}

      {session && phase !== PHASES.COMPLETE && (
        <>
          <div style={styles.promptCard}>
            <span style={styles.promptLabel}>What word fits this description?</span>
            <p style={styles.promptText}>{currentPrompt?.cue}</p>
          </div>

          {timeLeftMs !== null && (
            <div style={styles.timerTrack} aria-hidden="true">
              <div
                style={{
                  ...styles.timerFill,
                  width: `${timerPct}%`,
                  background:
                    timerPct > 40
                      ? 'var(--harbor-teal)'
                      : timerPct > 20
                      ? 'var(--harbor-orange)'
                      : '#c5221f',
                }}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your answer…"
              autoComplete="off"
              autoFocus
              style={styles.input}
              aria-label="Your answer"
            />
            <button type="submit" style={styles.primaryButton} disabled={!draft.trim()}>
              Submit
            </button>
          </form>

          {lastOutcome && (
            <p
              style={{
                ...styles.feedback,
                color:
                  lastOutcome === OUTCOMES.CORRECT
                    ? '#137333'
                    : lastOutcome === OUTCOMES.TIMEOUT
                    ? '#c5221f'
                    : 'var(--harbor-orange)',
              }}
            >
              {lastOutcome === OUTCOMES.CORRECT
                ? 'Correct'
                : lastOutcome === OUTCOMES.TIMEOUT
                ? 'Time ran out'
                : 'Not quite — keep going'}
            </p>
          )}

          <ProgressDots total={session.promptCount} current={progressIndex} />
        </>
      )}

      {session && phase === PHASES.COMPLETE && (
        <div style={styles.summary}>
          <div style={styles.summaryStatRow}>
            <div style={styles.summaryStat}>
              <span style={styles.summaryStatValue}>{Math.round(computeAccuracy(session) * 100)}%</span>
              <span style={styles.summaryStatLabel}>Accuracy</span>
            </div>
            <div style={styles.summaryStat}>
              <span style={styles.summaryStatValue}>{session.correctCount}</span>
              <span style={styles.summaryStatLabel}>Correct</span>
            </div>
            <div style={styles.summaryStat}>
              <span style={styles.summaryStatValue}>{session.promptCount}</span>
              <span style={styles.summaryStatLabel}>Prompts</span>
            </div>
          </div>
          <button style={styles.primaryButton} onClick={startRound}>
            Play again
          </button>
        </div>
      )}
    </div>
  )
}

function ProgressDots({ total, current }) {
  return (
    <div style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            ...styles.dot,
            background: i < current ? 'var(--harbor-teal)' : i === current ? 'var(--harbor-orange)' : '#D9E1E6',
          }}
        />
      ))}
    </div>
  )
}

const cssVars = `
  :root {
    --harbor-bg: #F2F5F7;
    --harbor-navy: #1E3A4C;
    --harbor-teal: #5B8A9A;
    --harbor-orange: #D98E5B;
  }
`

const styles = {
  container: {
    background: 'var(--harbor-bg)',
    borderRadius: 16,
    padding: '2.5rem 2rem',
    maxWidth: 440,
    margin: '0 auto',
    textAlign: 'center',
    fontFamily: "'Work Sans', sans-serif",
    border: '1px solid #E1E8EC',
  },
  header: {
    marginBottom: '1.75rem',
  },
  eyebrow: {
    display: 'block',
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--harbor-teal)',
    fontWeight: 600,
    marginBottom: 6,
  },
  heading: {
    fontFamily: "'Newsreader', serif",
    color: 'var(--harbor-navy)',
    fontWeight: 600,
    fontSize: 30,
    margin: '0 0 10px',
  },
  subheading: {
    color: '#4A5A64',
    fontSize: 14,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: 340,
    marginInline: 'auto',
  },
  promptCard: {
    background: '#fff',
    border: '1px solid #E1E8EC',
    borderRadius: 12,
    padding: '1.25rem 1.5rem',
    marginBottom: 16,
    textAlign: 'left',
  },
  promptLabel: {
    display: 'block',
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--harbor-teal)',
    fontWeight: 600,
    marginBottom: 8,
  },
  promptText: {
    fontFamily: "'Newsreader', serif",
    fontSize: 20,
    lineHeight: 1.45,
    color: 'var(--harbor-navy)',
    margin: 0,
  },
  timerTrack: {
    height: 4,
    background: '#E1E8EC',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  timerFill: {
    height: '100%',
    transition: 'width 0.1s linear, background 0.2s ease',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 12,
  },
  input: {
    padding: '12px 14px',
    fontSize: 16,
    fontFamily: "'Work Sans', sans-serif",
    border: '2px solid #D9E1E6',
    borderRadius: 10,
    outline: 'none',
  },
  feedback: {
    fontSize: 13,
    fontWeight: 600,
    margin: '0 0 12px',
  },
  dotsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
  primaryButton: {
    background: 'var(--harbor-orange)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 32px',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "'Work Sans', sans-serif",
    cursor: 'pointer',
  },
  summary: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  },
  summaryStatRow: {
    display: 'flex',
    gap: 28,
  },
  summaryStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  summaryStatValue: {
    fontFamily: "'Newsreader', serif",
    fontSize: 30,
    fontWeight: 600,
    color: 'var(--harbor-navy)',
  },
  summaryStatLabel: {
    fontSize: 12,
    color: '#7C8B93',
    marginTop: 2,
  },
}
