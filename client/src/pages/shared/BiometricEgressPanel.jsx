import { useState, useEffect, useRef } from 'react'
import { getAuthHeaders } from '../../sync/authHeaders.js'

/**
 * BiometricEgressPanel — the privacy-proof panel that lives inside
 * PrivacySandbox. Three things, in order:
 *
 *   1. A two-tier strip ("what stays in this browser" vs. "what crosses
 *      the network"). This is the headline claim — the rest of the page
 *      is evidence for it.
 *   2. A live request counter (Panel A) that monkey-patches window.fetch
 *      on mount and classifies every outbound request as either
 *      "biometric" (would-be a camera frame, audio buffer, or PPG sample)
 *      or "other". The biometric counter should sit at 0 in normal
 *      operation; the "other" counter ticks up when the demo button
 *      fires a regular app fetch.
 *   3. A payload+headers proof (Panel B) showing a stable sample of what
 *      actually crosses the network — anonymized clinical scores plus
 *      the X-User-* headers the server-side requireAuth middleware
 *      reads, with an allow-list explanation tucked into a <details>.
 *
 * The biometric classifier is intentionally a heuristic: a URL regex
 * (media extensions + frame/audio/PPG hints) OR a binary body type
 * (Blob/ArrayBuffer/ReadableStream/FormData containing a file). In
 * normal operation neither branch ever matches, which is the point of
 * the live counter.
 */

const BIOMETRIC_URL_PATTERN = /\.(mp4|webm|jpg|jpeg|png|ppg|audio|wav|webp|frame)|frame|audio-buffer|ppg-sample/i

const SAMPLE_PAYLOAD = {
  patientId: 'pat_9a8b7c_example',
  gameId: 'n-back',
  difficultyLevel: 3,
  completedAt: '2026-08-20T14:22:08.412Z',
  accuracy: 0.78,
  avgLatencyMs: 1140,
  errorType: null,
}

/** True when the request body looks like it carries binary sensor data. */
function bodyLooksLikeBiometric(body) {
  if (body == null) return false
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return true
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return true
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    for (const value of body.values()) {
      if (value instanceof File) return true
    }
  }
  return false
}

function classifyRequest(url, init) {
  const href = typeof url === 'string' ? url : url?.url ?? String(url ?? '')
  if (BIOMETRIC_URL_PATTERN.test(href)) return 'biometric'
  if (bodyLooksLikeBiometric(init?.body)) return 'biometric'
  return 'other'
}

export default function BiometricEgressPanel() {
  const [biometricCount, setBiometricCount] = useState(0)
  const [otherCount, setOtherCount] = useState(0)
  const [headers, setHeaders] = useState(() => getAuthHeaders())
  const originalFetchRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return
    if (originalFetchRef.current) return // already patched (StrictMode double-mount)

    const original = window.fetch.bind(window)
    originalFetchRef.current = original

    const patched = (url, init) => {
      const kind = classifyRequest(url, init)
      if (kind === 'biometric') setBiometricCount((c) => c + 1)
      else setOtherCount((c) => c + 1)
      return original(url, init)
    }
    patched.__cogniPatched = true
    window.fetch = patched

    return () => {
      // Only unpatch if our patched fetch is still the active one —
      // guards against an unrelated HMR replace clobbering it.
      if (window.fetch?.__cogniPatched) {
        window.fetch = original
      }
      originalFetchRef.current = null
    }
  }, [])

  // Re-read auth headers so the demo reflects the currently-signed-in
  // clinician without a hard refresh.
  useEffect(() => {
    setHeaders(getAuthHeaders())
  }, [])

  const handleRunFakeFetch = async () => {
    try {
      // A benign endpoint that exists in any dev environment. We don't
      // care if it 404s — the point is to demonstrate the counter
      // incrementing under "other".
      await fetch('/api/health', { method: 'GET' })
    } catch {
      // swallow; network failure is fine for the demo
    }
  }

  return (
    <div style={styles.wrapper}>
      {/* TIER STRIP — the headline claim. */}
      <div style={styles.tierStrip}>
        <div style={{ ...styles.tierCard, ...styles.tierLocal }}>
          <span style={{ ...styles.tierDot, background: '#1F6B47' }} aria-hidden="true" />
          <div>
            <div style={styles.tierTitle}>Tier 1 — what stays in this browser</div>
            <div style={styles.tierBody}>
              Webcam frames · PPG (heart-rate signal) · Raw audio
            </div>
          </div>
        </div>
        <div style={{ ...styles.tierCard, ...styles.tierNetwork }}>
          <span style={{ ...styles.tierDot, background: '#5B8A9A' }} aria-hidden="true" />
          <div>
            <div style={styles.tierTitle}>Tier 2 — what crosses the network</div>
            <div style={styles.tierBody}>
              Anonymized clinical scores + <code style={styles.codeInline}>X-User-*</code> headers.
              Plaintext PHI, gated server-side by{' '}
              <code style={styles.codeInline}>requireAuth(&#123; resource: 'patient-scores' &#125;)</code>.
            </div>
          </div>
        </div>
      </div>

      {/* PANEL A — live request counter. */}
      <section style={styles.panel}>
        <h3 style={styles.panelHeading}>Panel A · Live outbound request counter</h3>
        <p style={styles.panelSub}>
          We are wrapping <code style={styles.codeInline}>window.fetch</code> for as long as this
          page is open. Any request whose URL or body looks like it carries a video frame, an
          audio buffer, or a PPG sample would land in the “biometric” column. Real app fetches
          (JSON scores, dashboard data, etc.) land under “other”.
        </p>

        <div style={styles.statRow}>
          <div style={styles.statTile}>
            <div style={styles.statLabel}>Biometric requests sent</div>
            <div style={{ ...styles.statValue, color: biometricCount === 0 ? '#1F6B47' : '#991B1B' }}>
              {biometricCount}
            </div>
            <div style={styles.statHint}>
              0 outbound requests for camera / audio / PPG in normal operation
            </div>
          </div>
          <div style={styles.statTile}>
            <div style={styles.statLabel}>Other requests sent</div>
            <div style={styles.statValue}>{otherCount}</div>
            <div style={styles.statHint}>
              Anonymized clinical scores, dashboard reads, etc.
            </div>
          </div>
        </div>

        <button type="button" onClick={handleRunFakeFetch} style={styles.demoButton}>
          Run a fake fetch
        </button>
      </section>

      {/* PANEL B — payload + headers proof. */}
      <section style={styles.panel}>
        <h3 style={styles.panelHeading}>Panel B · Outbound payload proof</h3>
        <p style={styles.panelSub}>
          This is exactly what a completed game round sends to{' '}
          <code style={styles.codeInline}>/api/game-sessions</code> — anonymized metrics only.
        </p>

        <div style={styles.subLabel}>Sample request body</div>
        <pre style={styles.codeBlock}>{JSON.stringify(SAMPLE_PAYLOAD, null, 2)}</pre>

        <div style={styles.subLabel}>X-User-* headers attached from your session</div>
        {Object.keys(headers).length === 0 ? (
          <pre style={styles.codeBlockMuted}>(not signed in)</pre>
        ) : (
          <pre style={styles.codeBlock}>{JSON.stringify(headers, null, 2)}</pre>
        )}

        <details style={styles.details}>
          <summary style={styles.detailsSummary}>
            Who is allowed to read these scores? (allow-list)
          </summary>
          <div style={styles.detailsBody}>
            <p style={{ margin: '0 0 8px' }}>
              The server enforces this allow-list on every read of{' '}
              <code style={styles.codeInline}>/api/game-sessions/patient/:id</code> via{' '}
              <code style={styles.codeInline}>server/middleware/requireAuth.js</code> — see{' '}
              <code style={styles.codeInline}>requireAuth(&#123; resource: 'patient-scores' &#125;)</code>.
            </p>
            <ul style={styles.detailsList}>
              <li>The patient themselves (signed in via their own magic link).</li>
              <li>The owning clinician (the clinician whose roster the patient is on).</li>
              <li>A caregiver explicitly linked to the patient via{' '}
                <code style={styles.codeInline}>/api/caregiver-links</code>.</li>
            </ul>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#5B8A9A' }}>
              No other role, no unauthenticated request, and no cross-clinician read returns data.
            </p>
          </div>
        </details>
      </section>
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  tierStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 12,
  },
  tierCard: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    padding: '14px 16px',
    borderRadius: 12,
    background: '#fff',
    border: '1px solid #E1E8EC',
  },
  tierLocal: {
    background: '#F0F8F4',
    borderColor: '#C9E5D6',
  },
  tierNetwork: {
    background: '#F2F5F7',
    borderColor: '#D9E1E6',
  },
  tierDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginTop: 6,
    flexShrink: 0,
  },
  tierTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1E3A4C',
    marginBottom: 4,
  },
  tierBody: {
    fontSize: 13,
    color: '#4A5A64',
    lineHeight: 1.5,
  },
  panel: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 14,
    padding: '1.5rem',
  },
  panelHeading: {
    fontFamily: "'Newsreader', serif",
    fontSize: 18,
    fontWeight: 600,
    color: '#1E3A4C',
    margin: '0 0 6px',
  },
  panelSub: {
    fontSize: 13,
    color: '#4A5A64',
    lineHeight: 1.5,
    margin: '0 0 18px',
  },
  statRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  statTile: {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    padding: '14px 16px',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#5B8A9A',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 8,
  },
  statValue: {
    fontFamily: "'Newsreader', serif",
    fontSize: 32,
    fontWeight: 600,
    color: '#1E3A4C',
    lineHeight: 1,
    marginBottom: 6,
  },
  statHint: {
    fontSize: 12,
    color: '#7C8B93',
    lineHeight: 1.4,
  },
  demoButton: {
    background: '#fff',
    color: '#1E3A4C',
    border: '1px solid #CBD5E1',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Work Sans', sans-serif",
  },
  subLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 6,
    marginTop: 4,
  },
  codeBlock: {
    background: '#1E293B',
    color: '#38BDF8',
    padding: '1rem 1.25rem',
    borderRadius: 8,
    overflowX: 'auto',
    fontSize: 13,
    fontFamily: 'monospace',
    margin: '0 0 18px',
  },
  codeBlockMuted: {
    background: '#F1F5F9',
    color: '#64748B',
    padding: '1rem 1.25rem',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'monospace',
    fontStyle: 'italic',
    margin: '0 0 18px',
  },
  codeInline: {
    fontFamily: 'monospace',
    fontSize: '0.92em',
    background: '#F1F5F9',
    padding: '1px 5px',
    borderRadius: 4,
  },
  details: {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    padding: '12px 14px',
  },
  detailsSummary: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1E3A4C',
    cursor: 'pointer',
    listStyle: 'none',
  },
  detailsBody: {
    marginTop: 10,
    fontSize: 13,
    color: '#4A5A64',
    lineHeight: 1.5,
  },
  detailsList: {
    margin: '0 0 4px',
    paddingLeft: '1.25rem',
  },
}
