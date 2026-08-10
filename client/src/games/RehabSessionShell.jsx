import { useState, useCallback, useMemo } from 'react'
import NBackGame from './nback/NBackGame'
import ReactionAttentionGame from './reactionAttention/ReactionAttentionGame'
import SequenceRecallGame from './sequencerecall/SequenceRecallGame'
import SpeechWordFindingGame from './speechWordFinding/SpeechWordFindingGame'

/**
 * RehabSessionShell — the picker/hub screen that ties Person 1's three
 * (soon four) exercises together into one flow: pick a game, play a
 * round, land on a summary, go again or pick something else.
 *
 * WHAT THIS IS STANDING IN FOR (until other pieces of the app exist):
 * - `difficulty` here is a local, hardcoded-default piece of state the
 *   patient can nudge manually. In the real app this comes from
 *   patients.difficulty_tier and gets adjusted by Person 2's ZPD engine —
 *   this shell's selector is just enough to demo different levels, not a
 *   replacement for that.
 * - `sessionLog` is a local in-memory array. In the real app, onGameEvent
 *   payloads get handed to Person 3's sync layer, which injects the
 *   authenticated patientId and persists to game_sessions/game_events.
 *   Keeping that boundary here (this shell never touches patientId) is
 *   deliberate, not an oversight — see eventSchema.js's patient-agnostic
 *   guard.
 * - `languageSymptomsFlagged` is hardcoded false. Person 4's intake flow
 *   is the real source for this signal, and isn't built yet. Once it
 *   exists, this becomes a prop threaded down from wherever patient
 *   session state lives, not a local constant.
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
 * @param {boolean} [props.languageSymptomsFlagged=false] — from Person 4's
 *   intake flow (patients.language_symptoms_flagged). When true, the
 *   Speech & Word-Finding module appears in the game picker.
 */
export default function RehabSessionShell({ languageSymptomsFlagged = false }) {
  const games = useMemo(
    () => (languageSymptomsFlagged ? [...BASE_GAMES, SPEECH_GAME] : BASE_GAMES),
    [languageSymptomsFlagged]
  )
  const [activeGameId, setActiveGameId] = useState(null)
  const [difficulty, setDifficulty] = useState(1)
  const [sessionLog, setSessionLog] = useState([]) // GameSessionEvent[], most recent first
  const [lastEvent, setLastEvent] = useState(null)

  const handleGameEvent = useCallback((event) => {
    setSessionLog((prev) => [event, ...prev])
    setLastEvent(event)
  }, [])

  const activeGame = games.find((g) => g.id === activeGameId) ?? null

  function handleBackToGames() {
    setActiveGameId(null)
    setLastEvent(null)
  }

  return (
    <div style={styles.page}>
      <style>{cssVars}</style>

      <header style={styles.pageHeader}>
        <span style={styles.eyebrow}>Today's session</span>
        <h1 style={styles.pageHeading}>Recovery, one step at a time.</h1>
        <DifficultyPicker difficulty={difficulty} onChange={setDifficulty} />
        <p style={styles.difficultyNote}>
          Manual for now — this stands in for the adaptive engine (Pillar B) until it's wired in.
        </p>
      </header>

      {!activeGame && (
        <>
          <div style={styles.cardGrid}>
            {games.map((game) => (
              <GameCard key={game.id} game={game} onSelect={() => setActiveGameId(game.id)} />
            ))}
          </div>

          {sessionLog.length > 0 && <SessionHistory sessionLog={sessionLog} games={games} />}
        </>
      )}

      {activeGame && (
        <div>
          <button style={styles.backLink} onClick={handleBackToGames}>
            ← Back to games
          </button>
          <activeGame.Component difficulty={difficulty} onGameEvent={handleGameEvent} />
          {lastEvent && lastEvent.gameId === activeGame.id && (
            <p style={styles.roundNote}>
              Last round: {Math.round(lastEvent.accuracy * 100)}% accuracy — logged locally, not yet synced.
            </p>
          )}
        </div>
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

function DifficultyPicker({ difficulty, onChange }) {
  return (
    <div style={styles.difficultyRow}>
      <span style={styles.difficultyLabel}>Level</span>
      {[1, 2, 3, 4, 5].map((level) => (
        <button
          key={level}
          onClick={() => onChange(level)}
          style={{
            ...styles.difficultyDot,
            background: level === difficulty ? 'var(--harbor-orange)' : '#fff',
            color: level === difficulty ? '#fff' : 'var(--harbor-navy)',
            borderColor: level === difficulty ? 'var(--harbor-orange)' : '#D9E1E6',
          }}
        >
          {level}
        </button>
      ))}
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
    cursor: 'pointer',
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
  backLink: {
    display: 'block',
    margin: '0 auto 1rem',
    maxWidth: 440,
    background: 'none',
    border: 'none',
    color: 'var(--harbor-teal)',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'Work Sans', sans-serif",
    cursor: 'pointer',
    padding: 0,
    textAlign: 'left',
  },
  roundNote: {
    maxWidth: 440,
    margin: '12px auto 0',
    textAlign: 'center',
    fontSize: 12,
    color: '#7C8B93',
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
  difficultyNote: {
    fontSize: 12,
    color: '#7C8B93',
    fontStyle: 'italic',
    marginTop: 10,
    marginBottom: 0,
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
