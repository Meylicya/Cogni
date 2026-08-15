import { useNavigate } from 'react-router-dom'

/**
 * LandingPage — front door of the app.
 *
 * Layout fix from previous pass: role cards now stretch to equal height
 * via grid + flex column with the button row pinned to the bottom
 * (marginTop: auto), instead of each card sizing to its own content and
 * misaligning. "Read the evidence" demoted from a boxed button to a
 * plain link — as a full box it was reading as an unlabeled 4th card
 * competing with the three role cards above it.
 *
 * Caregivers still cannot self-register — login only, per
 * CaregiverAccessGrant.jsx's documented access-control design.
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
      </div>

      <div style={styles.roleGrid}>
        <RoleCard
          icon={<PatientIcon />}
          label="Patient"
          description="Already have an account from your clinician's invite?"
          buttons={[{ text: 'Log in', kind: 'primary', onClick: () => navigate('/patient/login') }]}
        />
        <RoleCard
          icon={<ClinicianIcon />}
          label="Clinician"
          description="Manage patients, intake, and safety gates."
          buttons={[
            { text: 'Log in', kind: 'primary', onClick: () => navigate('/login') },
            { text: 'Sign up', kind: 'secondary', onClick: () => navigate('/clinician/signup') },
          ]}
        />
        <RoleCard
          icon={<CaregiverIcon />}
          label="Caregiver"
          description="Access is granted by a clinician or patient — not self-service."
          buttons={[{ text: 'Log in', kind: 'primary', onClick: () => navigate('/caregiver/login') }]}
        />
      </div>

      <div style={styles.evidenceRow}>
        <a href="/evidence" style={styles.evidenceLink} onClick={(e) => { e.preventDefault(); navigate('/evidence') }}>
          Read the evidence & guidelines →
        </a>
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

function RoleCard({ icon, label, description, buttons }) {
  return (
    <div style={styles.roleCard}>
      <div style={styles.roleIconWrap}>{icon}</div>
      <span style={styles.roleLabel}>{label}</span>
      <span style={styles.roleDescription}>{description}</span>
      <div style={styles.roleButtonRow}>
        {buttons.map((b) => (
          <button
            key={b.text}
            style={b.kind === 'primary' ? styles.primaryButton : styles.secondaryButtonSmall}
            onClick={b.onClick}
          >
            {b.text}
          </button>
        ))}
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

// Small nautical-adjacent line icons — restrained, matches the "Harbor" name
// without leaning on generic person/avatar glyphs for every role.
function PatientIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3z" stroke="var(--harbor-teal)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
function ClinicianIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v6M12 21v-6M4 12h6M14 12h6" stroke="var(--harbor-teal)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" stroke="var(--harbor-teal)" strokeWidth="1.2" opacity="0.4" />
    </svg>
  )
}
function CaregiverIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 18c1.5-3 4.5-4.5 8-4.5s6.5 1.5 8 4.5" stroke="var(--harbor-teal)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="3.2" stroke="var(--harbor-teal)" strokeWidth="1.6" />
    </svg>
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
    maxWidth: 640,
    margin: '0 auto 2.5rem',
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
    margin: 0,
  },
  roleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))',
    alignItems: 'stretch',
    gap: 14,
    maxWidth: 760,
    margin: '0 auto',
  },
  roleCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: '#fff',
    border: '1px solid #E1E8EC',
    borderRadius: 14,
    padding: '1.5rem 1.25rem',
    textAlign: 'left',
    height: '100%',
  },
  roleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 9,
    background: 'rgba(91, 138, 154, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
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
    flexGrow: 1,
  },
  roleButtonRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
  evidenceRow: {
    textAlign: 'center',
    margin: '2.25rem 0 3rem',
  },
  evidenceLink: {
    color: 'var(--harbor-navy)',
    fontSize: 14.5,
    fontWeight: 600,
    textDecoration: 'none',
    borderBottom: '1px solid var(--harbor-teal)',
    paddingBottom: 2,
  },
  primaryButton: {
    background: 'var(--harbor-orange)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '11px 16px',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Work Sans', sans-serif",
    cursor: 'pointer',
    flex: 1,
    whiteSpace: 'nowrap',
  },
  secondaryButtonSmall: {
    background: '#fff',
    color: 'var(--harbor-navy)',
    border: '1px solid #D9E1E6',
    borderRadius: 10,
    padding: '11px 16px',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Work Sans', sans-serif",
    cursor: 'pointer',
    flex: 1,
    whiteSpace: 'nowrap',
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
