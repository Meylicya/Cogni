import { useState, useRef, useCallback, useEffect } from 'react'
import {
  createReactionAttentionSession,
  pressGo,
  advanceToNextTrial,
  computeAccuracy,
  computeAverageResponseLatencyMs,
  buildSessionEvent,
  PHASES,
  TRIAL_TYPES,
  OUTCOMES,
} from './reactionAttentionEngine'

/**
 * Reaction/Attention (go/no-go) UI. Thin shell over the pure, tested
 * engine in reactionAttentionEngine.js — trial classification, scoring,
 * and completion all live there. This component owns: pacing each trial
 * (inter-stimulus interval, then the response window), translating
 * presses into pressGo() calls, and rendering session state.
 *
 * Two separate timers per trial, mirroring the engine's own design notes:
 *   1. intervalMs (from the trial plan) — how long to wait before the
 *      stimulus appears at all.
 *   2. responseWindowMs (from difficultyConfig) — the deadline, from the
 *      moment the stimulus appears, within which a press counts as valid.
 * advanceToNextTrial() is always called once the response window has
 * elapsed, regardless of whether the player pressed — the engine decides
 * hit/omission/commission/correct-withhold from there.
 *
 * @param {Object} props
 * @param {number} props.difficulty - current difficulty level (1-5)
 * @param {(event: object) => void} [props.onGameEvent] - called with the
 *   GameSessionEvent once a round completes
 */
export default function ReactionAttentionGame({ difficulty, onGameEvent }) {
  const [session, setSession] = useState(null)
  const [stimulusVisible, setStimulusVisible] = useState(false)
  const [lastOutcome, setLastOutcome] = useState(null)
  const sessionRef = useRef(null)
  const preStimulusTimerRef = useRef(null)
  const responseWindowTimerRef = useRef(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(
    () => () => {
      clearTimeout(preStimulusTimerRef.current)
      clearTimeout(responseWindowTimerRef.current)
    },
    []
  )

  /**
   * Reveals the CURRENT trial's stimulus immediately and starts its
   * response-window timer right away.
   *
   * IMPORTANT: the engine's own trialStartedAt (set either by
   * createReactionAttentionSession's createdAt, or by the timestamp
   * passed into the previous advanceToNextTrial call) is treated as the
   * moment the stimulus appears — pressGo() measures latency from it, and
   * advanceToNextTrial() compares that latency directly against
   * responseWindowMs. So trialStartedAt must always line up with the
   * actual on-screen reveal, or every latency reading (and therefore
   * every hit/omission classification) is wrong. That's why the
   * inter-stimulus wait (trial.intervalMs) happens BEFORE we ever call
   * advanceToNextTrial for a given trial — see scheduleNextReveal below —
   * rather than after revealing, which was the original (buggy) version
   * of this component.
   */
  const runTrial = useCallback(
    (current) => {
      setStimulusVisible(true)

      clearTimeout(responseWindowTimerRef.current)
      responseWindowTimerRef.current = setTimeout(() => {
        const latest = sessionRef.current
        if (!latest || latest.phase !== PHASES.IN_PROGRESS) return

        setStimulusVisible(false)
        const isLastTrial = latest.currentIndex + 1 >= latest.trials.length

        if (isLastTrial) {
          const resolvedIndex = latest.currentIndex
          const next = advanceToNextTrial(latest, Date.now())
          setLastOutcome(next.outcomes[resolvedIndex])
          setSession(next)
          const event = buildSessionEvent(next)
          onGameEvent?.(event)
          return
        }

        // Wait the UPCOMING trial's own inter-stimulus interval with the
        // screen blank, THEN call advanceToNextTrial right at the moment
        // we're about to reveal it — that call both finalizes this
        // trial's outcome bookkeeping and sets trialStartedAt for the
        // next trial to "now", keeping it aligned with the real reveal.
        const nextTrial = latest.trials[latest.currentIndex + 1]
        clearTimeout(preStimulusTimerRef.current)
        preStimulusTimerRef.current = setTimeout(() => {
          const stillLatest = sessionRef.current
          if (!stillLatest || stillLatest.phase !== PHASES.IN_PROGRESS) return
          const resolvedIndex = stillLatest.currentIndex
          const next = advanceToNextTrial(stillLatest, Date.now())
          setLastOutcome(next.outcomes[resolvedIndex])
          setSession(next)
          runTrial(next)
        }, nextTrial.intervalMs)
      }, current.responseWindowMs)
    },
    [onGameEvent]
  )

  const startRound = useCallback(() => {
    const now = Date.now()
    const fresh = createReactionAttentionSession(difficulty, now)
    setLastOutcome(null)
    setSession(fresh)
    runTrial(fresh)
  }, [difficulty, runTrial])

  function handlePress() {
    const current = sessionRef.current
    if (!current || current.phase !== PHASES.IN_PROGRESS) return
    if (!stimulusVisible) return // ignore presses before the stimulus appears
    if (current.responses[current.currentIndex] !== null) return // already pressed this trial
    setSession(pressGo(current, Date.now()))
  }

  const currentTrial = session && session.phase === PHASES.IN_PROGRESS ? session.trials[session.currentIndex] : null
  const isNoGo = currentTrial?.type === TRIAL_TYPES.NO_GO

  const feedbackColor =
    lastOutcome === OUTCOMES.HIT || lastOutcome === OUTCOMES.CORRECT_WITHHOLD
      ? 'var(--harbor-teal)'
      : lastOutcome === OUTCOMES.OMISSION_ERROR || lastOutcome === OUTCOMES.COMMISSION_ERROR
      ? 'var(--harbor-orange)'
      : 'var(--harbor-navy)'

  return (
    <div style={styles.container}>
      <style>{cssVars}</style>

      <div style={styles.header}>
        <span style={styles.eyebrow}>Sustained attention · Level {difficulty}</span>
        <h2 style={styles.heading}>Go / No-Go</h2>
        <p style={styles.subheading}>
          The circle starts white and waiting. Watch for it to change color.
        </p>
        <div style={styles.legendRow}>
          <span style={styles.legendItem}>
            <span style={{ ...styles.legendSwatch, background: 'var(--harbor-teal)' }} />
            Turns teal → click it right away
          </span>
          <span style={styles.legendItem}>
            <span style={{ ...styles.legendSwatch, background: 'var(--harbor-orange)' }} />
            Turns orange → don't click at all
          </span>
        </div>
      </div>

      {!session && (
        <button style={styles.primaryButton} onClick={startRound}>
          Start round
        </button>
      )}

      {session && session.phase === PHASES.IN_PROGRESS && (
        <>
          <button
            style={{
              ...styles.stimulusCircle,
              background: !stimulusVisible ? '#fff' : isNoGo ? 'var(--harbor-orange)' : 'var(--harbor-teal)',
              borderColor: !stimulusVisible ? feedbackColor : 'transparent',
              cursor: stimulusVisible ? 'pointer' : 'default',
            }}
            onClick={handlePress}
            aria-label={stimulusVisible ? (isNoGo ? 'Hold still' : 'Tap now') : 'Waiting for next signal'}
          />

          <p style={styles.instructionNote}>
            {!stimulusVisible ? 'Watch closely…' : isNoGo ? 'Hold still' : 'Tap now'}
          </p>

          <div style={styles.progressRow}>
            <ProgressDots total={session.trials.length} current={session.currentIndex} />
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
              <span style={styles.summaryStatValue}>{Math.round(computeAverageResponseLatencyMs(session))}</span>
              <span style={styles.summaryStatLabel}>Avg. ms</span>
            </div>
            <div style={styles.summaryStat}>
              <span style={styles.summaryStatValue}>{session.omissionErrors + session.commissionErrors}</span>
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
    margin: '0 0 14px',
    maxWidth: 320,
    marginInline: 'auto',
  },
  legendRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#4A5A64',
    fontWeight: 500,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
  },
  stimulusCircle: {
    width: 140,
    height: 140,
    margin: '0 auto 16px',
    borderRadius: '50%',
    border: '3px solid var(--harbor-navy)',
    transition: 'background 0.12s ease, border-color 0.2s ease',
    padding: 0,
  },
  instructionNote: {
    fontSize: 13,
    color: '#7C8B93',
    fontStyle: 'italic',
    margin: '0 0 20px',
    minHeight: 18,
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
    marginTop: 6,
  },
  dotsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 5,
    flexWrap: 'wrap',
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
