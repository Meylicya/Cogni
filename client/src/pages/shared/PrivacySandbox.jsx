import BackButton from '../../components/BackButton.jsx'
import BiometricEgressPanel from './BiometricEgressPanel.jsx'

/**
 * PrivacySandbox — clinician-facing "Data Flow & Access Control" page.
 *
 * The previous incarnation of this page was an AES-GCM encryption demo
 * ("type in real session data, watch it get encrypted before it ever
 * touches the network"). That demo is gone on purpose: clinical scores
 * are NOT encrypted client-side. They are plaintext PHI behind the
 * server-side `requireAuth({ resource: 'patient-scores' })` middleware
 * (see server/middleware/requireAuth.js). Misrepresenting the wire-side
 * reality as "encrypted" was both a security fiction and a privacy
 * failure — the right story is: the *biometric* signals never leave
 * the browser, and the *scores* that do are gated server-side by role.
 *
 * This page now shows that story with evidence:
 *   1. A two-tier strip (local vs. network).
 *   2. A live request counter that wraps window.fetch for the lifetime
 *      of the page so a clinician can watch outbound traffic and
 *      confirm biometric requests never fire.
 *   3. A payload+headers proof showing exactly what a game round
 *      actually sends, plus the X-User-* headers the server reads.
 *
 * The biometric counter and the request classification logic live in
 * <BiometricEgressPanel /> to keep this page a thin shell.
 */
export default function PrivacySandbox() {
  return (
    <div style={styles.page}>
      <BackButton to="/dashboard" style={{ marginBottom: '1.25rem' }}>
        ← Back to dashboard
      </BackButton>

      <header style={styles.header}>
        <h2 style={styles.heading}>Data Flow &amp; Access Control</h2>
        <p style={styles.subtitle}>
          What stays in this browser, what crosses the network, and how
          clinical scores are gated server-side.
        </p>
      </header>

      <BiometricEgressPanel />

      <footer style={styles.footer}>
        Source of truth: <code style={styles.codeInline}>server/middleware/requireAuth.js</code> —
        <code style={styles.codeInline}> requireAuth(&#123; resource: 'patient-scores' &#125;) </code>
        enforces the allow-list for <code style={styles.codeInline}>/api/game-sessions/patient/:id</code>.
      </footer>
    </div>
  )
}

const styles = {
  page: {
    padding: '3rem 1.5rem',
    maxWidth: 1000,
    margin: '0 auto',
    fontFamily: "'Work Sans', sans-serif",
    color: '#1E3A4C',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  heading: {
    fontFamily: "'Newsreader', serif",
    fontSize: 32,
    color: '#1E3A4C',
    margin: '0 0 8px',
    fontWeight: 600,
  },
  subtitle: {
    color: '#5B8A9A',
    fontSize: 16,
    margin: 0,
    maxWidth: 640,
    marginInline: 'auto',
    lineHeight: 1.5,
  },
  footer: {
    marginTop: '2rem',
    padding: '1rem 1.25rem',
    background: '#F1F5F9',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    fontSize: 13,
    color: '#475569',
    lineHeight: 1.6,
  },
  codeInline: {
    fontFamily: 'monospace',
    fontSize: '0.92em',
    background: '#fff',
    padding: '1px 5px',
    borderRadius: 4,
    border: '1px solid #E2E8F0',
  },
}
