import { useNavigate } from 'react-router-dom'

/**
 * LandingPage — front door of the app.
 *
 * UPDATED: now offers three distinct entry points — patient login,
 * clinician login/signup, and caregiver login — instead of only a
 * clinician signup CTA.
 *
 * Note on caregivers: caregivers still cannot self-register (see
 * CaregiverAccessGrant.jsx's documented security design — access is
 * granted by a clinician or patient, never self-requested). The
 * caregiver button below is LOGIN ONLY, matching that constraint; there
 * is deliberately no "sign up as a caregiver" CTA anywhere in the app.
 */
export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={styles.page}>
      <style>{cssVars}</style>

      <div style={styles.hero}>
        <span style={styles.eyebrow}>Cogni</span>
        <h1 style={styles.heading}>Recovery, one step at a time.</h1>
        <p style={styles.subheading}>
          An active, adaptive cognitive rehabilitation tool for concussion recovery —
          clinician-supervised, privacy-first, and built for the sub-acute recovery phase.
        </p>

        <div style={styles.roleGrid}>
          <RoleCard
            label="Patient"
            description="Already have an account from your clinician's invite?"
            primaryText="Log in"
            onPrimary={() => navigate('/patient/login')}
          />
          <RoleCard
            label="Clinician"
            description="Manage patients, intake, and safety gates."
            primaryText="Log in"
            onPrimary={() => navigate('/login')}
            secondaryText="Sign up"
            onSecondary={() => navigate('/clinician/signup')}
          />
          <RoleCard
            label="Caregiver"
            description="Access is granted by a clinician or patient — not self-service."
            primaryText="Log in"
            onPrimary={() => navigate('/caregiver/login')}
          />
        </div>

        <div style={styles.ctaRow}>
          <button style={styles.secondaryButton} onClick={() => navigate('/evidence')}>
            Read the evidence & guidelines
          </button>
        </div>
      </div>

      <div style={styles.cardGrid}>
        <InfoCard
          eyebrow="For clinicians"
          title="Guided intake & safety gate"
          description="A structured intake sets each patient's starting difficulty and flags acute-phase cases automatically — exercises stay blocked until it's safe to begin."
        />
        <InfoCard
          eyebrow="For patients"
          title="Adaptive exercises"
          description="Working memory, attention, and visual-spatial recall tasks that adjust difficulty as recovery progresses, within limits a clinician sets."
        />
        <InfoCard
          eyebrow="For families"
          title="Caregiver visibility, on invitation"
          description="Clinicians or patients can grant a caregiver read-only access to recovery trends — never self-requested, always explicitly authorized."
        />
      </div>

      <div style={styles.safetyNote}>
        <strong>Not a diagnostic tool.</strong> Not a replacement for professional care, and not
        intended for use in the first 48 hours after injury. See{' '}
        <a href="/evidence" style={styles.inlineLink}>Evidence & Guidelines</a> for the full
        positioning and citations.
      </div>
    </div>
  )
}

function RoleCard({ label, description, primaryText, onPrimary, secondaryText, onSecondary }) {
  return (
    <div style={styles.roleCard}>
      <span style={styles.roleLabel}>{label}</span>
      <span style={styles.roleDescription}>{description}</span>
      <div style={styles.roleButtonRow}>
        <button style={styles.primaryButton} onClick={onPrimary}>
          {primaryText}
        </button>
        {secondaryText && (
          <button style={styles.secondaryButtonSmall} onClick={onSecondary}>
            {secondaryText}
          </button>
        )}
      </div>
    </div>
  )
}

function InfoCard({ eyebrow, title, description }) {
  return (
    <div style={styles.card}>
      <span style={styles.cardEyebrow}>{eyebrow}</span>
      <span style={styles.cardTitle}>{title}</span>
      <span style={styles.cardDescription}>{description}</span>
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
    padding: '4rem 1.5rem 3rem',
    fontFamily: "'Work Sans', sans-serif",
  },
  hero: {
    maxWidth: 760,
    margin: '0 auto 3rem',
    textAlign: 'center',
  },
  eyebrow: {
    display: 'block',
    fontSize: 12,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--harbor-teal)',
    fontWeight: 700,
    marginBottom: 10,
  },
  heading: {
    fontFamily: "'Newsreader', serif",
    color: 'var(--harbor-navy)',
    fontWeight: 600,
    fontSize: 42,
    lineHeight: 1.15,
    margin: '0 0 18px',
  },
  subheading: {
    color: '#4A5A64',
    fontSize: 16,
    lineHeight: 1.6,
    margin: '0 0 36px',
  },
  roleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 14,
    marginBottom: 28,
  },
  roleCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: '#fff',
    border: '1px solid #E1E8EC',
    borderRadius: 14,
    padding: '1.5rem 1.25rem',
    textAlign: 'left',
  },
  roleLabel: {
    fontFamily: "'Newsreader', serif",
    fontSize: 19,
    fontWeight: 600,
    color: 'var(--harbor-navy)',
  },
  roleDescription: {
    fontSize: 13,
    color: '#7C8B93',
    lineHeight: 1.5,
    minHeight: 36,
  },
  roleButtonRow: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  ctaRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryButton: {
    background: 'var(--harbor-orange)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Work Sans', sans-serif",
    cursor: 'pointer',
    flex: 1,
  },
  secondaryButtonSmall: {
    background: '#fff',
    color: 'var(--harbor-navy)',
    border: '1px solid #D9E1E6',
    borderRadius: 10,
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Work Sans', sans-serif",
    cursor: 'pointer',
    flex: 1,
  },
  secondaryButton: {
    background: '#fff',
    color: 'var(--harbor-navy)',
    border: '1px solid #D9E1E6',
    borderRadius: 10,
    padding: '13px 28px',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "'Work Sans', sans-serif",
    cursor: 'pointer',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    maxWidth: 900,
    margin: '0 auto 3rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: '#fff',
    border: '1px solid #E1E8EC',
    borderRadius: 14,
    padding: '1.5rem',
    textAlign: 'left',
  },
  cardEyebrow: {
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--harbor-teal)',
    fontWeight: 600,
  },
  cardTitle: {
    fontFamily: "'Newsreader', serif",
    fontSize: 19,
    fontWeight: 600,
    color: 'var(--harbor-navy)',
  },
  cardDescription: {
    fontSize: 13,
    color: '#7C8B93',
    lineHeight: 1.5,
  },
  safetyNote: {
    maxWidth: 640,
    margin: '0 auto',
    textAlign: 'center',
    fontSize: 13,
    color: '#7C8B93',
    lineHeight: 1.6,
  },
  inlineLink: {
    color: 'var(--harbor-teal)',
    fontWeight: 600,
  },
}
