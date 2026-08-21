import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton, { backButtonStyle } from '../components/BackButton.jsx'
import CameraMicConsentModal from '../components/CameraMicConsentModal.jsx'
import NBackGame from './nback/NBackGame'
import ReactionAttentionGame from './reactionAttention/ReactionAttentionGame'
import SequenceRecallGame from './sequencerecall/SequenceRecallGame'
import SpeechWordFindingGame from './speechWordFinding/SpeechWordFindingGame'
import { syncGameEvent } from '../sync/syncLayer'
import { useSession } from '../context/SessionContext.jsx'
import { useSessionEngine } from '../context/SessionEngineContext.jsx'

/**
 * RehabSessionShell — the picker/hub screen that ties Person 1's three
 * (soon four) exercises together into one flow: pick a game, play a
 * round, land on a summary, go again or pick something else.
 *
 * ADAPTIVE DIFFICULTY (Person 2):
 * The "difficulty" tier shown here used to be a local hardcoded
 * default the patient could nudge manually. It now comes from
 * createSessionEngine(patientId), which materializes a SessionEngine
 * holding a ZPDEngine + SymptomCheckinScorer + FrustrationEngine pair
 * against the authenticated patient's actual tier (see
 * ML/sessionBootstrap.js + ML/patientSessionContext.js). Every game
 * event flows through sessionEngine.recordGameEvent() before being
 * synced, so tier changes driven by accuracy/latency/error patterns
 * show up live in the picker.
 *
 * OPTIONAL WEBCAM FOR FRUSTRATION GUARD:
 * The biometric fatigue/HR/voice guards need a <video> element. We
 * gate that behind an explicit consent button — without opt-in the
 * ZPD engine still works, just without biometric safety-block signals
 * (accuracy/latency/error-driven step adjustments continue normally).
 * No raw video/audio ever leaves the device (see webCrypto.js + the
 * Privacy Sandbox page for the network-telemetry proof).
 *
 * AUTH NOTE: SessionContext is still a dev stub — see its banner
 * comment. When real auth lands, patientId + languageSymptomsFlagged
 * should arrive from there. Until then, the bootstrap call will
 * succeed against whatever dev-patient-1 resolves to.
 */

const BASE_GAMES = [
  {
    id: 'n-back',
    label: 'N-Back',
    tagline: 'Working memory',
    description: 'Track a stream of letters and catch the repeats.',
    Component: NBackGame,
  },
  {
    id: 'reaction-attention',
    label: 'Go / No-Go',
    tagline: 'Sustained attention',
    description: 'Tap fast on go signals, hold still on stop signals.',
    Component: ReactionAttentionGame,
  },
  {
    id: 'sequence-recall',
    label: 'Sequence Recall',
    tagline: 'Visual-spatial memory',
    description: 'Watch the tiles light up, then repeat the order.',
    Component: SequenceRecallGame,
  },
]

const SPEECH_GAME = {
  id: 'speech-word-finding',
  label: 'Word Finding',
  tagline: 'Speech & communication',
  description: 'Read the cue and type the word you are searching for.',
  Component: SpeechWordFindingGame,
}

/**
 * @param {Object} [props]
 * @param {boolean} [props.languageSymptomsFlagged] — DEPRECATED pass-through.
 *   Prefer reading from SessionContext; this prop remains for backward
 *   compatibility with the original RehabSessionShell call site in App.jsx.
 */
export default function RehabSessionShell({ languageSymptomsFlagged: languageSymptomsFlaggedProp }) {
  const navigate = useNavigate()
  const session = useSession()
  const patientId = session?.patientId
  const { logout } = session
  const { engine, engineReady, engineError, languageSymptomsFlagged: engineLanguageFlag } = useSessionEngine()

  // Source of truth for the speech-game visibility flag is the server's
  // session-context endpoint (Patient.languageSymptomsFlagged, set by
  // the clinician's intake). The engine already fetched it during
  // bootstrap. Fall back to the legacy prop so old call sites work.
  const languageSymptomsFlagged = engineLanguageFlag ?? languageSymptomsFlaggedProp ?? false

  const games = useMemo(
    () => (languageSymptomsFlagged ? [...BASE_GAMES, SPEECH_GAME] : BASE_GAMES),
    [languageSymptomsFlagged]
  )

  const [activeGameId, setActiveGameId] = useState(null)
  const [sessionLog, setSessionLog] = useState([]) // GameSessionEvent[], most recent first
  const [lastEvent, setLastEvent] = useState(null)
  const [tier, setTier] = useState(1)
  const [tierNote, setTierNote] = useState(null)
  const [breakSuggested, setBreakSuggested] = useState(false)
  // Biometric monitoring state machine — see Item A in
  // plans/transient-whistling-fountain.md. 'off' is the default;
  // 'awaiting-consent' shows CameraMicConsentModal; 'requesting-permissions'
  // is the brief window while the OS prompt is up; 'live' means both video
  // and audio tracks were granted; 'partial-grant' means only the camera
  // was granted (or audio was later turned off).
  const [monitorState, setMonitorState] = useState('off')
  const [monitorError, setMonitorError] = useState(null)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Wire engine callbacks whenever a new engine arrives. These are the
  // only side-effects the shell cares about — tier/break signals
  // surface here; everything else (game events, symptom check-ins) is
  // pushed by other pages into the same engine via the context.
  useEffect(() => {
    if (!engine) return
    setTier(engine.getCurrentTier())
    engine.onDifficultyChange = (newTier, meta) => {
      setTier(newTier)
      setTierNote(meta?.reason ?? `Adjusted to level ${newTier}.`)
    }
    engine.onBreakSuggested = () => {
      setBreakSuggested(true)
    }
    // Note: we deliberately don't clear `tierNote` when engine swaps —
    // a brief "why this changed" note is helpful across bootstraps.
    return () => {
      // The provider owns disposal; just clear our local callbacks so
      // a stale closure doesn't fire into the next mount's setters.
      engine.onDifficultyChange = null
      engine.onBreakSuggested = null
    }
  }, [engine])

  const handleGameEvent = useCallback((event) => {
    setSessionLog((prev) => [event, ...prev])
    setLastEvent(event)

    // Hand the event to the ZPD engine first — it runs entirely
    // on-device, so this stays synchronous-ish even when sync is slow.
    // Failure here should not block the wire-side sync.
    try {
      engine?.recordGameEvent(event)
    } catch (err) {
      console.warn('ZPD engine rejected event:', err)
    }

    syncGameEvent(event).then((result) => {
      if (!result.ok) {
        console.warn('Game session sync failed:', result.error)
      }
    })
  }, [engine])

  const activeGame = games.find((g) => g.id === activeGameId) ?? null

  function handleBackToGames() {
    setActiveGameId(null)
    setLastEvent(null)
  }

  async function handleEnableMonitoring() {
    // First click opens the consent modal; the actual getUserMedia call
    // happens once the patient explicitly taps "Allow".
    setMonitorError(null)
    setMonitorState('awaiting-consent')
  }

  function handleConsentDecline() {
    setMonitorState('off')
  }

  async function handleConsentAllow() {
    if (!engine) {
      setMonitorError('Session not ready yet.')
      setMonitorState('off')
      return
    }
    setMonitorError(null)
    setMonitorState('requesting-permissions')

    // Attempt both tracks in one call. Chrome rejects the whole call
    // when any constraint is denied, so the NotAllowedError /
    // NotReadableError branch falls back to two sequential single-track
    // requests and merges the survivors — which is what Firefox and
    // Safari do natively.
    let stream = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    } catch (err) {
      const isAllOrNothing = err && (err.name === 'NotAllowedError' || err.name === 'NotReadableError')
      if (!isAllOrNothing) {
        console.warn('Monitoring opt-in failed:', err)
        setMonitorError(err.message || 'Could not access camera or microphone.')
        setMonitorState('off')
        return
      }
      // Fallback: ask for each independently, merge what comes back.
      const tracks = []
      let partialError = null
      try {
        const v = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        tracks.push(...v.getTracks())
      } catch (vErr) {
        partialError = vErr
      }
      try {
        const a = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
        tracks.push(...a.getTracks())
      } catch (aErr) {
        partialError = aErr
      }
      if (tracks.length === 0) {
        console.warn('Monitoring opt-in failed:', partialError)
        setMonitorError(partialError?.message || 'Could not access camera or microphone.')
        setMonitorState('off')
        return
      }
      stream = new MediaStream(tracks)
    }

    const video = videoRef.current
    if (!video) {
      stream.getTracks().forEach((t) => t.stop())
      setMonitorError('Camera tile not ready.')
      setMonitorState('off')
      return
    }

    const videoTracks = stream.getVideoTracks()
    const audioTracks = stream.getAudioTracks()
    const videoOk = videoTracks.length > 0
    const audioOk = audioTracks.length > 0

    if (!videoOk) {
      // We asked for the camera and got nothing — treat as a hard
      // failure rather than a partial grant, since the picker here is
      // explicitly opt-in for the fatigue guard.
      stream.getTracks().forEach((t) => t.stop())
      setMonitorError('Camera access was denied. Fatigue guard needs the camera.')
      setMonitorState('off')
      return
    }

    streamRef.current = stream
    video.srcObject = stream
    await video.play().catch(() => {})

    try {
      await engine.startMonitoring(video, { audioGranted: audioOk })
    } catch (err) {
      console.warn('startMonitoring failed:', err)
      setMonitorError(err.message || 'Could not start monitoring.')
      stream.getTracks().forEach((t) => t.stop())
      video.srcObject = null
      streamRef.current = null
      setMonitorState('off')
      return
    }

    setMonitorState(audioOk ? 'live' : 'partial-grant')
  }

  function handleDisableMonitoring() {
    engine?.stopMonitoring()
    const video = videoRef.current
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach((t) => t.stop())
      video.srcObject = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setMonitorState('off')
  }

  return (
    <div style={styles.page}>
      <style>{cssVars}</style>

      {!activeGame && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <BackButton to="/" style={styles.pageBackLink}>
            ← Back to home
          </BackButton>
          <BackButton onClick={() => { logout(); navigate('/'); }} style={styles.pageBackLink}>
            Log out
          </BackButton>
        </div>
      )}

      <header style={styles.pageHeader}>
        <span style={styles.eyebrow}>Today's session</span>
        <h1 style={styles.pageHeading}>Recovery, one step at a time.</h1>
        <DifficultyPicker tier={tier} />
        <p style={styles.difficultyNote}>
          Level adjusts automatically based on your last rounds
          {monitorState === 'live' || monitorState === 'partial-grant'
            ? ' and your fatigue/heart-rate signals.'
            : '.'}
          {' '}
          <MonitorControl
            monitorState={monitorState}
            monitorError={monitorError}
            onEnable={handleEnableMonitoring}
            onDisable={handleDisableMonitoring}
          />
        </p>
        {tierNote && (
          <p style={styles.tierNote}>
            {tierNote}{' '}
            <button type="button" onClick={() => setTierNote(null)} style={styles.dismissNote}>
              dismiss
            </button>
          </p>
        )}
        {engineError && (
          <p style={styles.errorNote}>
            Couldn't load your adaptive settings: {engineError}. Difficulty is locked at level 1.
          </p>
        )}
      </header>

      {!activeGame && (
        <>
          <div style={styles.cardGrid}>
            {games.map((game) => (
              <GameCard key={game.id} game={game} onSelect={() => setActiveGameId(game.id)} />
            ))}
          </div>

          {/* Hidden video element — exists once monitoring is enabled. Lives
              off-screen so it's not a distraction; the WebRTC stream never
              leaves the browser. */}
          <video ref={videoRef} style={styles.hiddenVideo} playsInline muted />

          {sessionLog.length > 0 && <SessionHistory sessionLog={sessionLog} games={games} />}
        </>
      )}

      {activeGame && (
        <div>
          <BackButton onClick={handleBackToGames} style={styles.backLink}>
            ← Back to games
          </BackButton>
          <activeGame.Component difficulty={tier} onGameEvent={handleGameEvent} />
          {lastEvent && lastEvent.gameId === activeGame.id && (
            <p style={styles.roundNote}>
              Last round: {Math.round(lastEvent.accuracy * 100)}% accuracy — logged locally, not yet synced.
            </p>
          )}
        </div>
      )}

      {breakSuggested && (
        <BreakModal
          onResume={() => setBreakSuggested(false)}
          onDisable={() => {
            handleDisableMonitoring()
            setBreakSuggested(false)
          }}
        />
      )}

      {monitorState === 'awaiting-consent' && (
        <CameraMicConsentModal
          onAllow={handleConsentAllow}
          onDecline={handleConsentDecline}
        />
      )}
    </div>
  )
}

function GameCard({ game, onSelect, disabled }) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      style={{
        ...styles.card,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span style={styles.cardTagline}>{game.tagline}</span>
      <span style={styles.cardLabel}>{game.label}</span>
      <span style={styles.cardDescription}>{game.description}</span>
    </button>
  )
}

function DifficultyPicker({ tier }) {
  return (
    <div style={styles.difficultyRow}>
      <span style={styles.difficultyLabel}>Level</span>
      {[1, 2, 3, 4, 5].map((level) => (
        <button
          key={level}
          disabled
          aria-pressed={level === tier}
          style={{
            ...styles.difficultyDot,
            background: level === tier ? 'var(--harbor-orange)' : '#fff',
            color: level === tier ? '#fff' : 'var(--harbor-navy)',
            borderColor: level === tier ? 'var(--harbor-orange)' : '#D9E1E6',
            cursor: 'default',
            opacity: level <= tier ? 1 : 0.5,
          }}
        >
          {level}
        </button>
      ))}
    </div>
  )
}

function MonitorControl({ monitorState, monitorError, onEnable, onDisable }) {
  if (monitorState === 'live' || monitorState === 'partial-grant') {
    return (
      <>
        <button type="button" onClick={onDisable} style={styles.monitorLink}>
          Turn camera off
        </button>
        {monitorState === 'partial-grant' && (
          <span style={styles.monitorNote}>
            {' '}· Microphone is off — voice-pause guard inactive.
          </span>
        )}
      </>
    )
  }
  if (monitorState === 'requesting-permissions') {
    return (
      <span style={styles.monitorError}>Waiting for camera &amp; microphone permission…</span>
    )
  }
  // 'off' and 'awaiting-consent' both present the same enable link.
  // The modal handles 'awaiting-consent'.
  return (
    <>
      <button
        type="button"
        onClick={onEnable}
        style={styles.monitorLink}
        disabled={monitorState === 'awaiting-consent'}
      >
        Turn camera on to enable fatigue guard
      </button>
      {monitorError && <span style={styles.monitorError}> · {monitorError}</span>}
    </>
  )
}

function BreakModal({ onResume, onDisable }) {
  return (
    <div style={styles.modalBackdrop} role="dialog" aria-modal="true">
      <div style={styles.modalCard}>
        <h3 style={styles.modalHeading}>Time for a breather?</h3>
        <p style={styles.modalBody}>
          The fatigue guard noticed a few signals worth pausing on. A short
          break — a glass of water, a few slow breaths — usually helps more
          than pushing through.
        </p>
        <div style={styles.modalActions}>
          <button type="button" onClick={onResume} style={styles.modalPrimary}>
            Take a break
          </button>
          <button type="button" onClick={onDisable} style={styles.modalSecondary}>
            Turn camera off and keep going
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Session history. Two things keep this from turning into an
 * ever-growing, unscrollable page over a long session:
 *   1. A per-game summary strip (rounds played + average accuracy) up
 *      top, so the headline numbers are visible without scrolling at all.
 *   2. The full round-by-round list lives in a fixed-height, scrollable
 *      panel underneath, most recent first — it can hold as many rounds
 *      as the patient plays without pushing the rest of the page down.
 */
function SessionHistory({ sessionLog, games }) {
  const gameLabels = Object.fromEntries(games.map((g) => [g.id, g.label]))

  const summaryByGame = games.map((game) => {
    const rounds = sessionLog.filter((e) => e.gameId === game.id)
    if (rounds.length === 0) return null
    const avgAccuracy = rounds.reduce((sum, e) => sum + e.accuracy, 0) / rounds.length
    return { id: game.id, label: game.label, count: rounds.length, avgAccuracy }
  }).filter(Boolean)

  return (
    <div style={styles.historyBlock}>
      <h3 style={styles.historyHeading}>This session</h3>

      <div style={styles.summaryChipRow}>
        {summaryByGame.map((s) => (
          <div key={s.id} style={styles.summaryChip}>
            <span style={styles.summaryChipLabel}>{s.label}</span>
            <span style={styles.summaryChipValue}>
              {s.count} round{s.count > 1 ? 's' : ''} · {Math.round(s.avgAccuracy * 100)}% avg
            </span>
          </div>
        ))}
      </div>

      <ul style={styles.historyList}>
        {sessionLog.map((event, i) => (
          <li key={i} style={styles.historyRow}>
            <span style={styles.historyGame}>{gameLabels[event.gameId] ?? event.gameId}</span>
            <span style={styles.historyStat}>{Math.round(event.accuracy * 100)}% accuracy</span>
            <span style={styles.historyStat}>{Math.round(event.responseLatencyMs)}ms avg</span>
          </li>
        ))}
      </ul>
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
  page: {
    background: 'var(--harbor-bg)',
    minHeight: '100%',
    padding: '3rem 1.5rem',
    fontFamily: "'Work Sans', sans-serif",
  },
  pageHeader: {
    maxWidth: 720,
    margin: '0 auto 2.5rem',
    textAlign: 'center',
  },
  eyebrow: {
    display: 'block',
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--harbor-teal)',
    fontWeight: 600,
    marginBottom: 8,
  },
  pageHeading: {
    fontFamily: "'Newsreader', serif",
    color: 'var(--harbor-navy)',
    fontWeight: 600,
    fontSize: 36,
    margin: '0 0 20px',
  },
  difficultyRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  difficultyLabel: {
    fontSize: 13,
    color: '#7C8B93',
    marginRight: 4,
  },
  difficultyDot: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '2px solid #D9E1E6',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'Work Sans', sans-serif",
    transition: 'background 0.15s ease, border-color 0.15s ease',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    maxWidth: 720,
    margin: '0 auto',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    background: '#fff',
    border: '1px solid #E1E8EC',
    borderRadius: 14,
    padding: '1.5rem',
    textAlign: 'left',
    fontFamily: "'Work Sans', sans-serif",
  },
  cardTagline: {
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--harbor-teal)',
    fontWeight: 600,
  },
  cardLabel: {
    fontFamily: "'Newsreader', serif",
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--harbor-navy)',
  },
  cardDescription: {
    fontSize: 13,
    color: '#7C8B93',
    lineHeight: 1.4,
  },
  pageBackLink: {
    ...backButtonStyle,
    maxWidth: 720,
    margin: '0 auto',
  },
  backLink: {
    ...backButtonStyle,
    margin: '0 auto 1rem',
    maxWidth: 440,
  },
  roundNote: {
    maxWidth: 440,
    margin: '12px auto 0',
    textAlign: 'center',
    fontSize: 12,
    color: '#7C8B93',
  },
  difficultyNote: {
    fontSize: 12,
    color: '#7C8B93',
    fontStyle: 'italic',
    marginTop: 10,
    marginBottom: 0,
  },
  tierNote: {
    marginTop: 8,
    fontSize: 13,
    color: 'var(--harbor-navy)',
    background: '#fff',
    border: '1px solid var(--harbor-orange)',
    borderRadius: 8,
    padding: '6px 10px',
    display: 'inline-block',
  },
  dismissNote: {
    background: 'none',
    border: 'none',
    color: 'var(--harbor-teal)',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
    marginLeft: 4,
    textDecoration: 'underline',
  },
  errorNote: {
    marginTop: 8,
    fontSize: 12,
    color: '#8B3A3A',
    background: '#FFF5F5',
    border: '1px solid #E8C5C5',
    borderRadius: 8,
    padding: '6px 10px',
    display: 'inline-block',
  },
  monitorLink: {
    background: 'none',
    border: 'none',
    color: 'var(--harbor-teal)',
    fontSize: 12,
    fontStyle: 'italic',
    cursor: 'pointer',
    padding: 0,
    marginLeft: 4,
    textDecoration: 'underline',
    fontFamily: "'Work Sans', sans-serif",
  },
  monitorError: {
    fontSize: 12,
    color: '#8B3A3A',
    fontStyle: 'italic',
  },
  monitorNote: {
    fontSize: 12,
    color: '#7C8B93',
    fontStyle: 'italic',
  },
  hiddenVideo: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: 'none',
    left: -9999,
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(30, 58, 76, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modalCard: {
    background: '#fff',
    borderRadius: 14,
    padding: '1.75rem 1.5rem',
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 20px 60px rgba(30, 58, 76, 0.25)',
  },
  modalHeading: {
    fontFamily: "'Newsreader', serif",
    fontSize: 22,
    color: 'var(--harbor-navy)',
    margin: '0 0 10px',
  },
  modalBody: {
    fontSize: 14,
    color: '#4A5A64',
    lineHeight: 1.5,
    margin: '0 0 18px',
  },
  modalActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  modalPrimary: {
    background: 'var(--harbor-orange)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Work Sans', sans-serif",
  },
  modalSecondary: {
    background: 'none',
    color: 'var(--harbor-teal)',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontFamily: "'Work Sans', sans-serif",
  },
  historyBlock: {
    maxWidth: 720,
    margin: '2rem auto 0',
    background: '#fff',
    border: '1px solid #E1E8EC',
    borderRadius: 14,
    padding: '1.25rem 1.5rem',
  },
  historyHeading: {
    fontFamily: "'Newsreader', serif",
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--harbor-navy)',
    margin: '0 0 10px',
  },
  summaryChipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  summaryChip: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    background: 'var(--harbor-bg)',
    borderRadius: 10,
    padding: '8px 12px',
  },
  summaryChipLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--harbor-navy)',
  },
  summaryChipValue: {
    fontSize: 11,
    color: '#7C8B93',
  },
  historyList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 260,
    overflowY: 'auto',
  },
  historyRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: '#4A5A64',
    borderBottom: '1px solid #F0F3F5',
    paddingBottom: 8,
  },
  historyGame: {
    fontWeight: 600,
    color: 'var(--harbor-navy)',
  },
  historyStat: {
    color: '#7C8B93',
  },
}