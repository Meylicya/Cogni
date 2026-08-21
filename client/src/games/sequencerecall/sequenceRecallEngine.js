/**
 * sequenceRecallEngine.js
 *
 * Pure game logic for Sequence Recall — a visual-spatial working-memory
 * task. The player watches a sequence of positions on a grid light up one
 * at a time, then reproduces the sequence in order by selecting the same
 * positions. Complements N-Back with a different memory modality (spatial
 * order recall vs. continuous match/no-match) — see project doc Section 2,
 * Pillar A.
 *
 * DESIGN NOTES — same discipline as nbackEngine.js / reactionAttentionEngine.js:
 * - No React/DOM/timers in here. The UI drives the "showing" pacing
 *   (showIntervalMs per item, from difficultyConfig) and calls
 *   advanceShowing() at each interval; it calls submitResponse() whenever
 *   the player taps a grid cell during the input phase.
 * - Every function is pure: returns a NEW session object, never mutates.
 * - No hidden Date.now() calls — timestamps are always passed in.
 * - No modification to eventSchema.js was needed: "sequence-recall" is
 *   already a valid gameId.
 * - difficultyConfig.js already carries {sequenceLength, showIntervalMs}
 *   per level for "sequence-recall" — no changes needed here. gridSize is
 *   NOT difficulty-varying in the shared config, so it's kept as an
 *   engine-level default (overridable via options), same pattern
 *   nbackEngine.js used for stimulusSetSize.
 * - Unlike N-Back, there's no warm-up period — every position in the
 *   sequence has a well-defined correct answer once the input phase
 *   starts, so accuracy is scored across the FULL sequence length (see
 *   reaction-attention's "no warm-up" note for the same reasoning applied
 *   there).
 * - The round always collects a full sequenceLength worth of input, even
 *   after an early wrong answer, rather than ending the round on the
 *   first mistake. This keeps the round length (and therefore latency
 *   averaging and accuracy-as-a-fraction) consistent trial to trial,
 *   matching the "always complete a fixed-length round" pattern used by
 *   the other two engines. Flag to the team if a "stop on first mistake"
 *   UX is wanted instead — that would change what accuracy means here.
 */

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

 

