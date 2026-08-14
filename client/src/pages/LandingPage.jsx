import { useNavigate } from 'react-router-dom'

/**
 * LandingPage — the actual front door of the app. Replaces the old
 * placeholder `<div>Rehab App — home</div>` in App.jsx.
 *
 * Scope: positioning + credibility + a single clear next step for a
 * clinician. Deliberately does NOT offer a caregiver signup/access CTA
 * here — per CaregiverAccessGrant.jsx's own documented security design,
 * caregivers can't self-request access; only a clinician or patient can
 * grant it, from inside the clinician flow. Putting a caregiver button on
 * a public landing page would contradict that.
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

        <div style={styles.ctaRow}>
          <button style={styles.primaryButton} onClick={() => navigate('/clinician/signup')}>
            Get started as a clinician
          </button>
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
    maxWidth: 640,
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
    margin: '0 0 32px',
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
    padding: '13px 28px',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "'Work Sans', sans-serif",
    cursor: 'pointer',
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
