import { useState, useRef, useCallback, useEffect } from 'react'
import {
  createNBackSession,
  pressMatch,
  advanceToNextTrial,
  computeAccuracy,
  buildSessionEvent,
  PHASES,
  OUTCOMES,
} from './nbackEngine'

/**
 * N-Back UI. Thin shell over the pure, tested engine in nbackEngine.js —
 * every game-logic decision (scoring, outcome classification, session
 * completion) lives there, not here. This component only owns: timing the
 * trial window via setTimeout, translating button presses into
 * pressMatch() calls, and rendering session state.
 *
 * @param {Object} props
 * @param {number} props.difficulty - current difficulty level (1-5)
 * @param {(event: object) => void} [props.onGameEvent] - called with the
 *   GameSessionEvent once a round completes
 */
export default function NBackGame({ difficulty, onGameEvent }) {
  const [session, setSession] = useState(null)
  const [lastOutcome, setLastOutcome] = useState(null) // outcome of the trial that just resolved
  const timerRef = useRef(null)
  const sessionRef = useRef(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const scheduleAdvance = useCallback((intervalMs) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const current = sessionRef.current
      if (!current || current.phase !== PHASES.IN_PROGRESS) return
      const resolvedIndex = current.currentIndex
      const next = advanceToNextTrial(current, Date.now())
      setLastOutcome(next.outcomes[resolvedIndex])
      setSession(next)

      if (next.phase === PHASES.COMPLETE) {
        const event = buildSessionEvent(next)
        onGameEvent?.(event)
      } else {
        scheduleAdvance(next.stimulusIntervalMs)
      }
    }, intervalMs)
  }, [onGameEvent])

  const startRound = useCallback(() => {
    const now = Date.now()
    const fresh = createNBackSession(difficulty, now)
    setLastOutcome(null)
    setSession(fresh)
    scheduleAdvance(fresh.stimulusIntervalMs)
  }, [difficulty, scheduleAdvance])

  function handleMatchPress() {
    const current = sessionRef.current
    if (!current || current.phase !== PHASES.IN_PROGRESS) return
    if (current.responses[current.currentIndex] !== null) return // already pressed this trial
    setSession(pressMatch(current, Date.now()))
  }

  const isWarmup = session && session.currentIndex < session.n
  const hasPressedThisTrial = session && session.responses[session.currentIndex] !== null
  const feedbackColor =
    lastOutcome === OUTCOMES.HIT || lastOutcome === OUTCOMES.CORRECT_REJECTION
      ? 'var(--harbor-teal)'
      : lastOutcome === OUTCOMES.MISS || lastOutcome === OUTCOMES.FALSE_ALARM
      ? 'var(--harbor-orange)'
      : 'var(--harbor-navy)'

  return (
    <div style={styles.container}>
      <style>{cssVars}</style>

      <div style={styles.header}>
        <span style={styles.eyebrow}>Working memory · Level {difficulty}</span>
        <h2 style={styles.heading}>{session ? `${session.n}-Back` : 'N-Back'}</h2>
        <p style={styles.subheading}>
          {session
            ? `A new letter appears every few seconds. Press Match only when it's the SAME as the letter from ${session.n} turn${session.n > 1 ? 's' : ''} ago — shown in the trail below, marked "compare against this."`
            : 'Watch a stream of letters and press Match whenever one repeats a few steps back.'}
        </p>
      </div>

      {!session && (
        <button style={styles.primaryButton} onClick={startRound}>
          Start round
        </button>
      )}

      {session && session.phase === PHASES.IN_PROGRESS && (
        <>
          <Trail session={session} />

          <div style={{ ...styles.stimulusBox, borderColor: feedbackColor }}>
            <span style={styles.stimulusValue}>{stimulusLabel(session.stimuli[session.currentIndex])}</span>
          </div>

          {isWarmup && <p style={styles.warmupNote}>Building the memory window — no response needed yet.</p>}

          <button
            style={{
              ...styles.primaryButton,
              opacity: hasPressedThisTrial ? 0.5 : 1,
              cursor: hasPressedThisTrial ? 'default' : 'pointer',
            }}
            onClick={handleMatchPress}
            disabled={hasPressedThisTrial}
          >
            Match
          </button>

          <div style={styles.progressRow}>
            <ProgressDots total={session.stimuli.length} current={session.currentIndex} />
          </div>
        </>
      )}

      {session && session.phase === PHASES.COMPLETE && (
        <div style={styles.summary}>
          <div style={styles.summaryStatRow}>
            <div style={styles.summaryStat}>
              <span style={styles.summaryStatValue}>{Math.round(computeAccuracy(session) * 100)}%</span>
              <span style={styles.summaryStatLabel}>Accuracy</span>
            </div>
            <div style={styles.summaryStat}>
              <span style={styles.summaryStatValue}>{session.hits}</span>
              <span style={styles.summaryStatLabel}>Hits</span>
            </div>
            <div style={styles.summaryStat}>
              <span style={styles.summaryStatValue}>{session.misses + session.falseAlarms}</span>
              <span style={styles.summaryStatLabel}>Errors</span>
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

/** Maps a stimulus index to a display glyph. Purely presentational. */
function stimulusLabel(index) {
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  return LETTERS[index] ?? String(index)
}

/**
 * The n-back "trail": the last n stimuli shown, most recent first, with
 * the oldest one (the current comparison target) called out. This is the
 * page's signature element — it makes the abstract task ("compare against
 * n steps back") visible rather than asking the player to hold it in
 * their head purely from memory of the UI itself.
 */
function Trail({ session }) {
  const { stimuli, currentIndex, n } = session
  const start = Math.max(0, currentIndex - n)
  const items = stimuli.slice(start, currentIndex)

  if (items.length === 0) return <div style={styles.trailPlaceholder} />

  return (
    <div style={styles.trail}>
      {items.map((stim, i) => {
        const isTarget = i === 0 && items.length === n
        return (
          <div
            key={start + i}
            style={{
              ...styles.trailItem,
              opacity: isTarget ? 1 : 0.35 + (0.65 * (i + 1)) / items.length,
              borderColor: isTarget ? 'var(--harbor-orange)' : 'var(--harbor-teal)',
              borderWidth: isTarget ? 3 : 2,
              transform: isTarget ? 'scale(1.1)' : 'none',
            }}
          >
            {stimulusLabel(stim)}
          </div>
        )
      })}
      {items.length === n && <span style={styles.trailCaption}>↑ compare against this</span>}
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
  trail: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
    minHeight: 48,
  },
  trailPlaceholder: {
    minHeight: 48,
    marginBottom: 18,
  },
  trailItem: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--harbor-navy)',
    background: '#fff',
    border: '2px solid var(--harbor-teal)',
    borderRadius: 8,
  },
  trailCaption: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--harbor-orange)',
    marginLeft: 8,
  },
  stimulusBox: {
    width: 128,
    height: 128,
    margin: '0 auto 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    border: '3px solid var(--harbor-navy)',
    borderRadius: 16,
    transition: 'border-color 0.25s ease',
  },
  stimulusValue: {
    fontFamily: "'Newsreader', serif",
    fontSize: 52,
    fontWeight: 600,
    color: 'var(--harbor-navy)',
  },
  warmupNote: {
    fontSize: 13,
    color: '#7C8B93',
    fontStyle: 'italic',
    margin: '-8px 0 16px',
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
  progressRow: {
    marginTop: 22,
  },
  dotsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
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
