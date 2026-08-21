import { useState, useRef, useCallback, useEffect } from 'react'
import {
  createSequenceRecallSession,
  advanceShowing,
  submitResponse,
  computeAccuracy,
  buildSessionEvent,
  PHASES,
  OUTCOMES,
} from './sequenceRecallEngine'

/**
 * Sequence Recall UI. Thin shell over the pure, tested engine in
 * sequenceRecallEngine.js — sequence generation, scoring, and phase
 * transitions all live there. This component owns: pacing the SHOWING
 * playback (one setTimeout per position, at showIntervalMs), translating
 * grid taps into submitResponse() calls during INPUT, and rendering
 * session state.
 *
 * Grid layout assumes the engine's default gridSize (9, i.e. 3x3) — if a
 * session is ever created with a different gridSize, GRID_COLUMNS should
 * become a prop rather than a hardcoded constant.
 *
 * @param {Object} props
 * @param {number} props.difficulty - current difficulty level (1-5)
 * @param {(event: object) => void} [props.onGameEvent] - called with the
 *   GameSessionEvent once a round completes
 */
const GRID_COLUMNS = 3

export default function SequenceRecallGame({ difficulty, onGameEvent }) {
  const [session, setSession] = useState(null)
  const [litCell, setLitCell] = useState(null) // cell index currently highlighted during SHOWING
  const [tappedCell, setTappedCell] = useState(null) // { index, outcome } — brief feedback flash during INPUT
  const sessionRef = useRef(null)
  const timerRef = useRef(null)
  const tapFeedbackTimerRef = useRef(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(
    () => () => {
      clearTimeout(timerRef.current)
      clearTimeout(tapFeedbackTimerRef.current)
    },
    []
  )

  const runShowingStep = useCallback((current) => {
    setLitCell(current.sequence[current.showIndex])
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const latest = sessionRef.current
      if (!latest || latest.phase !== PHASES.SHOWING) return
      const next = advanceShowing(latest, Date.now())
      setLitCell(null)
      setSession(next)
      if (next.phase === PHASES.SHOWING) {
        runShowingStep(next)
      }
    }, current.showIntervalMs)
  }, [])

  const startRound = useCallback(() => {
    const now = Date.now()
    const fresh = createSequenceRecallSession(difficulty, now)
    setTappedCell(null)
    setSession(fresh)
    runShowingStep(fresh)
  }, [difficulty, runShowingStep])

  function handleCellTap(cellIndex) {
    const current = sessionRef.current
    if (!current || current.phase !== PHASES.INPUT) return

    const positionIndex = current.inputs.length
    const next = submitResponse(current, cellIndex, Date.now())
    const outcome = next.outcomes[positionIndex]

    clearTimeout(tapFeedbackTimerRef.current)
    setTappedCell({ index: cellIndex, outcome })
    tapFeedbackTimerRef.current = setTimeout(() => setTappedCell(null), 220)

    setSession(next)

    if (next.phase === PHASES.COMPLETE) {
      const event = buildSessionEvent(next)
      onGameEvent?.(event)
    }
  }

  const phase = session?.phase
  const gridSize = session?.gridSize ?? 9

  return (
    <div style={styles.container}>
      <style>{cssVars}</style>

      <div style={styles.header}>
        <span style={styles.eyebrow}>Visual-spatial memory · Level {difficulty}</span>
        <h2 style={styles.heading}>Sequence Recall</h2>
        <p style={styles.subheading}>
          {phase === PHASES.INPUT
            ? 'Now tap the tiles in the same order they lit up.'
            : 'Watch the order the tiles light up, then repeat it back.'}
        </p>
      </div>

      {!session && (
        <button style={styles.primaryButton} onClick={startRound}>
          Start round
        </button>
      )}

      {session && phase !== PHASES.COMPLETE && (
        <>
          <div style={styles.grid}>
            {Array.from({ length: gridSize }).map((_, i) => {
              const isLit = phase === PHASES.SHOWING && litCell === i
              const tap = tappedCell?.index === i ? tappedCell : null
              const tapColor =
                tap?.outcome === OUTCOMES.CORRECT
                  ? 'var(--harbor-teal)'
                  : tap?.outcome === OUTCOMES.INCORRECT
                  ? 'var(--harbor-orange)'
                  : null

              return (
                <button
                  key={i}
                  onClick={() => handleCellTap(i)}
                  disabled={phase !== PHASES.INPUT}
                  style={{
                    ...styles.cell,
                    background: isLit ? 'var(--harbor-navy)' : tapColor ?? '#fff',
                    borderColor: isLit || tapColor ? 'transparent' : '#D9E1E6',
                    cursor: phase === PHASES.INPUT ? 'pointer' : 'default',
                  }}
                  aria-label={`Tile ${i + 1}`}
                />
              )
            })}
          </div>

          <div style={styles.progressRow}>
            <ProgressDots total={session.sequenceLength} current={session.inputs.length} phase={phase} />
          </div>
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
              <span style={styles.summaryStatValue}>{session.sequenceLength}</span>
              <span style={styles.summaryStatLabel}>Sequence length</span>
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

function ProgressDots({ total, current, phase }) {
  return (
    <div style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            ...styles.dot,
            background:
              phase === PHASES.INPUT && i < current
                ? 'var(--harbor-teal)'
                : phase === PHASES.INPUT && i === current
                ? 'var(--harbor-orange)'
                : '#D9E1E6',
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
    background: '#fff',
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
    maxWidth: 320,
    marginInline: 'auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
    gap: 10,
    width: 240,
    margin: '0 auto 20px',
  },
  cell: {
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: 10,
    border: '2px solid #D9E1E6',
    transition: 'background 0.12s ease, border-color 0.12s ease',
    padding: 0,
  },
  progressRow: {
    marginTop: 4,
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
