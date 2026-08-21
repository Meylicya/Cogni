import { useEffect, useRef } from 'react'

/**
 * CameraMicConsentModal — patient-facing consent dialog for the optional
 * camera + microphone fatigue/HR/voice guards on the /games picker.
 *
 * This is a standalone component — it deliberately does NOT reuse the
 * generic Modal.jsx because:
 *   - The copy is consent-specific (privacy guarantees, what is captured,
 *     what happens if you decline).
 *   - There is no backdrop-dismiss. The user must explicitly choose
 *     "Allow" or "Not now"; accidental dismissal is a privacy bug.
 *   - The visual treatment uses two semantic tint boxes (green for the
 *     privacy guarantee, muted orange for the decline fallback) that
 *     the generic Modal does not support.
 *
 * Spec'd by Item A of the privacy-first biometric consent plan. The
 * copy blocks are exactly what the verification spec checks for:
 *   - "never harder than your clinician approved" lead
 *   - "stays in this browser tab" guarantee
 *   - "If you decline" fallback panel
 *   - Face landmarks / eye-closure / PPG / voice activity captured list
 */
export default function CameraMicConsentModal({ onAllow, onDecline }) {
  const allowButtonRef = useRef(null)

  // Auto-focus the primary action so a patient navigating with the
  // keyboard lands on the affirmative choice without an extra tab.
  useEffect(() => {
    allowButtonRef.current?.focus()
  }, [])

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="consent-heading">
      <div style={styles.card}>
        <h2 id="consent-heading" style={styles.heading}>
          Before we turn on the camera
        </h2>
        <p style={styles.lead}>
          The difficulty level never goes harder than your clinician approved.
        </p>

        <p style={styles.body}>
          With your permission, your browser will capture:
        </p>
        <ul style={styles.list}>
          <li>Face landmarks (used to estimate eye-closure)</li>
          <li>Eye-closure detection (fatigue signal)</li>
          <li>Heart-rate estimate from skin (PPG)</li>
          <li>Voice activity detection (pause / hesitation signal)</li>
        </ul>

        <div style={styles.guaranteeBox}>
          <strong style={styles.guaranteeTitle}>Stays in this browser tab.</strong>
          <p style={styles.guaranteeBody}>
            Nothing here is recorded, uploaded, or sent to a server. The
            signals are read by the on-device difficulty engine in real
            time and discarded.
          </p>
        </div>

        <div style={styles.declineBox}>
          <strong style={styles.declineTitle}>If you decline</strong>
          <ul style={styles.declineList}>
            <li>Fatigue and heart-rate guards will be off</li>
            <li>Voice-pause guard will be off</li>
            <li>You can still play all four games</li>
            <li>You can change your mind later by clicking “Turn camera on”</li>
          </ul>
        </div>

        <div style={styles.actions}>
          <button
            ref={allowButtonRef}
            type="button"
            onClick={onAllow}
            style={styles.primary}
          >
            Allow camera &amp; microphone
          </button>
          <button
            type="button"
            onClick={onDecline}
            style={styles.secondary}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(30, 58, 76, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: 14,
    padding: '1.75rem 1.5rem',
    maxWidth: 460,
    width: '100%',
    boxShadow: '0 20px 60px rgba(30, 58, 76, 0.25)',
    fontFamily: "'Work Sans', sans-serif",
    color: '#1E3A4C',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  heading: {
    fontFamily: "'Newsreader', serif",
    fontSize: 24,
    color: '#1E3A4C',
    fontWeight: 600,
    margin: '0 0 10px',
  },
  lead: {
    fontSize: 14,
    color: '#5B8A9A',
    fontStyle: 'italic',
    lineHeight: 1.5,
    margin: '0 0 18px',
  },
  body: {
    fontSize: 14,
    color: '#4A5A64',
    lineHeight: 1.5,
    margin: '0 0 8px',
  },
  list: {
    fontSize: 14,
    color: '#4A5A64',
    lineHeight: 1.6,
    margin: '0 0 18px',
    paddingLeft: '1.25rem',
  },
  guaranteeBox: {
    background: '#F0F8F4',
    border: '1px solid #C9E5D6',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 14,
  },
  guaranteeTitle: {
    color: '#1F6B47',
    fontSize: 14,
    display: 'block',
    marginBottom: 4,
  },
  guaranteeBody: {
    color: '#1F6B47',
    fontSize: 13,
    lineHeight: 1.5,
    margin: 0,
  },
  declineBox: {
    background: '#FFF6EE',
    border: '1px solid #D98E5B',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 20,
  },
  declineTitle: {
    color: '#1E3A4C',
    fontSize: 14,
    display: 'block',
    marginBottom: 6,
  },
  declineList: {
    color: '#4A5A64',
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
    paddingLeft: '1.25rem',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  primary: {
    background: '#D98E5B',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '11px 14px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Work Sans', sans-serif",
  },
  secondary: {
    background: 'none',
    color: '#5B8A9A',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontFamily: "'Work Sans', sans-serif",
  },
}
