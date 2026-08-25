import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext.jsx'
import cogniLogo from './congiLogo.png'

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
 *
 * The "Hackathon Demo" panel below is a deliberate bypass for the
 * full invite + signup + login chain. The patient login bug (writing
 * to `password` instead of `authCredentialHash`) leaves any patient
 * record created before the fix with a null credential hash, which
 * is unrecoverable without re-seeding. The demo panel hits a
 * double-gated /api/demo/bootstrap endpoint that wipes the demo
 * records and creates fresh ones with a known password, then logs
 * the user straight in. See server/routes/demoBootstrap.js for the
 * gate. The panel self-hides when the server is not in demo mode.
 */
export default function LandingPage() {
  const navigate = useNavigate()
  const { login } = useSession()
  const [demoAvailable, setDemoAvailable] = useState(false)
  const [demoStatus, setDemoStatus] = useState('')
  const [demoBusy, setDemoBusy] = useState(false)

  // Probe the demo endpoint once on mount. If the server is not in
  // demo mode (or is unreachable), /api/demo/status returns 404 and
  // we hide the whole panel so it doesn't look like a broken button.
  useEffect(() => {
    let cancelled = false
    fetch('http://localhost:3001/api/demo/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data && data.enabled) setDemoAvailable(true)
      })
      .catch(() => {
        // Network error or server not in demo mode — leave hidden.
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function runDemo(role) {
    setDemoBusy(true)
    setDemoStatus('Seeding demo records...')
    try {
      const res = await fetch('http://localhost:3001/api/demo/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        setDemoStatus('Demo unavailable — server is not in demo mode.')
        setDemoBusy(false)
        return
      }
      const data = await res.json()
      const target = data[role]
      if (!target || !target.id) {
        setDemoStatus('Demo seed returned no user — check server logs.')
        setDemoBusy(false)
        return
      }
      login(role, target.id)
      setDemoStatus(`Logged in as ${target.name}.`)
      navigate(role === 'patient' ? '/games' : '/dashboard')
    } catch (err) {
      console.error('Demo bootstrap error:', err)
      setDemoStatus('Could not reach the backend.')
      setDemoBusy(false)
    }
  }

  return (
    <div style={styles.pageOuter}>
      <style>{cssVars}</style>

      {/* ── Hero band: soft teal-tinted full-bleed section ── */}
      <div style={styles.heroBand}>
        <FloatingIcons variant="light" />
        <div style={{ ...styles.heroInner, position: 'relative', zIndex: 1 }} className="harbor-landing-anim">
          <div style={styles.logoSlot} aria-label="Cogni logo placeholder">
            <CogniLogoPlaceholder />
          </div>
          <span style={styles.eyebrow}>Cogni</span>
          <h1 style={styles.heading}>Recovery, one step at a time.</h1>
          <p style={styles.subheading}>
            An active, adaptive cognitive rehabilitation tool for concussion recovery —
            clinician-supervised, privacy-first, and built for the sub-acute recovery phase.
          </p>
        </div>
      </div>
      <WaveDivider fill="#FFFFFF" bgBefore="#D9E9EE" accent="var(--harbor-orange)" direction="down" shape="arc" />

      {/* ── Role selection: white band ── */}
      <div style={styles.whiteBand}>
        <div style={{ ...styles.roleGrid, animationDelay: '0.1s' }} className="harbor-landing-anim">
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

        {demoAvailable && (
          <div style={styles.demoPanel} className="harbor-landing-anim">
            <div style={styles.demoHeader}>
              <span style={styles.demoEyebrow}>Hackathon Demo</span>
              <span style={styles.demoSubtitle}>
                Skips invite/signup/login. Seeds a fresh demo patient and clinician, then logs you in.
              </span>
            </div>
            <div style={styles.demoButtonRow}>
              <button
                type="button"
                style={styles.demoButton}
                className="harbor-demo-btn-anim"
                onClick={() => runDemo('patient')}
                disabled={demoBusy}
              >
                {demoBusy ? 'Working...' : 'Demo as Patient'}
              </button>
              <button
                type="button"
                style={styles.demoButton}
                className="harbor-demo-btn-anim"
                onClick={() => runDemo('clinician')}
                disabled={demoBusy}
              >
                {demoBusy ? 'Working...' : 'Demo as Clinician'}
              </button>
            </div>
            {demoStatus && (
              <p style={styles.demoStatus}>{demoStatus}</p>
            )}
          </div>
        )}
      </div>

      {/* ── "How it works" band: navy full-bleed, curved on both edges ── */}
      <WaveDivider fill="#1E3A4C" bgBefore="#FFFFFF" accent="var(--harbor-orange)" direction="down" shape="wave" />
      <div style={styles.navyBand}>
        <FloatingIcons variant="dark" />
        <div style={{ ...styles.cardGrid, animationDelay: '0.15s', position: 'relative', zIndex: 1 }} className="harbor-landing-anim">
          <span style={styles.navyBandEyebrow}>How Cogni works</span>
          <div style={styles.cardGridInner}>
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
        </div>
      </div>
      <WaveDivider fill="#FFFFFF" bgBefore="#1E3A4C" accent="var(--harbor-teal)" direction="up" shape="arc" />

      {/* ── Closing band: white, evidence link + safety note ── */}
      <div style={styles.whiteBand}>
        <div style={styles.evidenceRow}>
          <a href="/evidence" style={styles.evidenceLink} className="harbor-evidence-link" onClick={(e) => { e.preventDefault(); navigate('/evidence') }}>
            Read the evidence & guidelines →
          </a>
        </div>

        <div style={styles.safetyNote}>
          <strong>Not a diagnostic tool.</strong> Not a replacement for professional care, and not
          intended for use in the first 48 hours after injury. See{' '}
          <a href="/evidence" style={styles.inlineLink}>Evidence & Guidelines</a> for the full
          positioning and citations.
        </div>
      </div>
    </div>
  )
}

/**
 * WaveDivider — full-bleed curved section transition, built as an SVG
 * path instead of border-radius/clip-path tricks.
 *
 * Why SVG: border-radius corner curves get clamped and re-scaled by the
 * browser once two radii on the same edge overlap, and that clamping
 * math behaves differently depending on box height and direction. At
 * this divider's height it broke down for the "bulge downward" case —
 * the curve collapsed to almost nothing, leaving a big flat slab of the
 * wrong color instead of a smooth handoff. An SVG path has no such
 * hidden math: the curve is exactly the coordinates we give it, in
 * either direction, at any height.
 *
 * `direction="down"` = curve bulges UP into the band above (fill fills
 * the lower majority of the box). `direction="up"` = curve bulges DOWN
 * into the band below (fill fills the upper majority). `shape="wave"`
 * draws two humps instead of one, so consecutive dividers don't repeat
 * the same silhouette.
 *
 * The wrapper div is painted `bgBefore` (the band above) so anti-aliasing
 * at the path edge blends into the right color instead of the page's
 * base background, and carries `marginTop/marginBottom: -1` to stay
 * flush against the bands and avoid a hairline seam.
 */
function WaveDivider({ fill, bgBefore, accent, direction = 'down', shape = 'arc', height = 110 }) {
  const strokeWidth = 5
  const W = 1000
  // Fill always closes against the BOTTOM edge — it's the color of the
  // section that follows, so it must own the full box height wherever
  // the curve doesn't carve bgBefore out of it. `direction` only flips
  // whether the curve's peak (closest to y=0) sits at the CENTER
  // ("down" — a hump of `fill` rising into the band above) or at the
  // EDGES ("up" — `bgBefore` pokes down as a notch at the center,
  // `fill` dominates the sides). Baseline never moves to 0; that was
  // the bug — it let `fill` claim the whole top edge outright instead
  // of just where the curve actually reaches it.
  const baseline = height

  let curve
  if (shape === 'wave') {
    const edgeY = height * 0.6
    const apexY = height * 0.15
    const midY = apexY + (edgeY - apexY) * 0.35 // shallow dip between humps, not a full V back to edgeY
    curve = `M0,${edgeY} Q250,${apexY} 500,${midY} Q750,${apexY} 1000,${edgeY}`
  } else if (direction === 'down') {
    const edgeY = height * 0.6
    const controlY = -0.6 * height // pulled above the box: apex lands at y=0 at the center
    curve = `M0,${edgeY} Q500,${controlY} 1000,${edgeY}`
  } else {
    const edgeY = height * 0.15
    const controlY = 0.85 * height // pulled down: apex lands around mid-height at the center
    curve = `M0,${edgeY} Q500,${controlY} 1000,${edgeY}`
  }
  const fillPath = `${curve} L1000,${baseline} L0,${baseline} Z`

  return (
    <div style={{ width: '100%', height, marginTop: -1, marginBottom: -1, background: bgBefore, overflow: 'hidden' }} aria-hidden="true">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        {/* fill only — no stroke, so it never outlines the straight closing edges */}
        <path d={fillPath} fill={fill} stroke="none" />
        {/* accent traces ONLY the curved line itself, as an open path */}
        {accent && <path d={curve} fill="none" stroke={accent} strokeWidth={strokeWidth} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  )
}

/**
 * FloatingIcons — ambient, blurred, slowly-drifting on-theme shapes
 * (brain outline, hexagon, circle) layered behind hero/section content.
 * Purely decorative: aria-hidden, pointer-events disabled, and respects
 * prefers-reduced-motion (animation stripped in cssVars media query).
 * `variant="light"` uses teal-on-light-bg opacity, `"dark"` uses
 * translucent white for the navy band.
 */
function FloatingIcons({ variant = 'light' }) {
  const color = variant === 'light' ? 'var(--harbor-teal)' : '#FFFFFF'
  const opacity = variant === 'light' ? 0.28 : 0.14
  const shapes = [
    { Shape: BrainBlob, top: '4%', left: '4%', size: 150, duration: 15, delay: '0s' },
    { Shape: HexBlob, top: '58%', left: '86%', size: 110, duration: 19, delay: '2s' },
    { Shape: BrainBlob, top: '68%', left: '10%', size: 90, duration: 17, delay: '4s' },
    { Shape: CircleBlob, top: '10%', left: '80%', size: 70, duration: 13, delay: '1s' },
    { Shape: HexBlob, top: '84%', left: '46%', size: 60, duration: 21, delay: '3s' },
  ]
  return (
    <div style={styles.floatingLayer} aria-hidden="true">
      {shapes.map((s, i) => (
        <div
          key={i}
          className="harbor-float-icon"
          style={{
            position: 'absolute',
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            animationDuration: `${s.duration}s`,
            animationDelay: s.delay,
          }}
        >
          <s.Shape color={color} opacity={opacity} />
        </div>
      ))}
    </div>
  )
}

function BrainBlob({ color, opacity }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ filter: 'blur(7px)' }}>
      <path
        d="M50 14c-9 0-16 5.5-18.5 13.5-8 1.2-14 8-14 16.3 0 6.2 3.2 11.6 8.2 14.7-1 3-1 6.2.1 9.2 2.2 7.8 9.3 12.8 17.2 12.8 3 0 6-.9 8-2.8 2 1.9 5 2.8 8 2.8 7.9 0 15-5 17.2-12.8 1.1-3 1.1-6.2.1-9.2 5-3.1 8.2-8.5 8.2-14.7 0-8.3-6-15.1-14-16.3C68 19.5 61 14 52 14z"
        fill={color}
        opacity={opacity}
      />
    </svg>
  )
}
function HexBlob({ color, opacity }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ filter: 'blur(7px)' }}>
      <polygon points="50,4 91,27 91,73 50,96 9,73 9,27" fill={color} opacity={opacity} />
    </svg>
  )
}
function CircleBlob({ color, opacity }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ filter: 'blur(9px)' }}>
      <circle cx="50" cy="50" r="44" fill={color} opacity={opacity} />
    </svg>
  )
}

function RoleCard({ icon, label, description, buttons }) {
  return (
    <div style={styles.roleCard} className="harbor-role-card">
      <div style={styles.roleIconWrap}>{icon}</div>
      <span style={styles.roleLabel}>{label}</span>
      <span style={styles.roleDescription}>{description}</span>
      <div style={styles.roleButtonRow}>
        {buttons.map((b) => (
          <button
            key={b.text}
            style={b.kind === 'primary' ? styles.primaryButton : styles.secondaryButtonSmall}
            className={b.kind === 'primary' ? 'harbor-btn-primary-anim' : 'harbor-btn-secondary-anim'}
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
    <div style={styles.navyCard} className="harbor-navy-card">
      <span style={styles.navyCardEyebrow}>{eyebrow}</span>
      <span style={styles.navyCardTitle}>{title}</span>
      <span style={styles.navyCardDescription}>{description}</span>
    </div>
  )
}

function CogniLogoPlaceholder() {
  return (
    <img
      src={cogniLogo}
      alt="Cogni logo"
      width="200"
      height="100"
      style={{ display: 'block' }}
    />
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

  @keyframes harbor-fade-up {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes harbor-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes harbor-float {
    0%   { transform: translate(0, 0) rotate(0deg); }
    50%  { transform: translate(14px, -20px) rotate(6deg); }
    100% { transform: translate(0, 0) rotate(0deg); }
  }

  .harbor-float-icon {
    animation-name: harbor-float;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
    pointer-events: none;
    will-change: transform;
  }

  .harbor-landing-anim {
    animation: harbor-fade-up 0.6s ease-out both;
  }

  .harbor-role-card {
    transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
  }
  .harbor-role-card:hover {
    border-color: var(--harbor-teal);
    box-shadow: 0 8px 24px rgba(30, 58, 76, 0.08);
    transform: translateY(-2px);
  }

  .harbor-info-card {
    transition: border-color 0.25s ease, box-shadow 0.25s ease;
  }
  .harbor-info-card:hover {
    border-color: var(--harbor-teal);
    box-shadow: 0 6px 18px rgba(30, 58, 76, 0.06);
  }

  .harbor-navy-card {
    transition: background 0.25s ease, transform 0.25s ease;
  }
  .harbor-navy-card:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }

  .harbor-btn-primary-anim {
    transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  }
  .harbor-btn-primary-anim:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(217, 142, 91, 0.35);
  }
  .harbor-btn-primary-anim:active {
    transform: translateY(0);
  }

  .harbor-btn-secondary-anim {
    transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  }
  .harbor-btn-secondary-anim:hover {
    border-color: var(--harbor-teal);
    background: #F8FBFC;
    transform: translateY(-1px);
  }

  .harbor-evidence-link {
    transition: opacity 0.2s ease, border-color 0.2s ease;
  }
  .harbor-evidence-link:hover {
    opacity: 0.75;
  }

  .harbor-demo-btn-anim {
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .harbor-demo-btn-anim:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(217, 142, 91, 0.3);
  }

  @media (prefers-reduced-motion: reduce) {
    .harbor-landing-anim {
      animation: none !important;
    }
    .harbor-role-card, .harbor-info-card, .harbor-navy-card, .harbor-btn-primary-anim,
    .harbor-btn-secondary-anim, .harbor-evidence-link, .harbor-demo-btn-anim {
      transition: none !important;
      transform: none !important;
    }
    .harbor-float-icon {
      animation: none !important;
    }
  }
`

const styles = {
  pageOuter: {
    minHeight: '100%',
    background: '#FFFFFF',
    fontFamily: "'Work Sans', sans-serif",
    overflowX: 'hidden',
  },
  heroBand: {
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(180deg, #E4EEF2 0%, #D9E9EE 100%)',
    padding: '4.5rem 1.5rem 0',
  },
  floatingLayer: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 0,
  },
  heroInner: {
    maxWidth: 640,
    margin: '0 auto 4.25rem',
    textAlign: 'center',
  },
  whiteBand: {
    background: '#fff',
    padding: '1.25rem 1.5rem 2.75rem',
  },
  navyBand: {
    position: 'relative',
    overflow: 'hidden',
    background: 'var(--harbor-navy)',
    padding: 0,
  },
  navyBandEyebrow: {
    display: 'block',
    textAlign: 'center',
    fontSize: 12,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#9BC0CC',
    fontWeight: 700,
    marginBottom: 24,
  },
  // Fixed-size slot reserved for the Cogni logo. Drop the real <img>
  // (or your own SVG) into the <div style={styles.logoSlot}> block
  // in the hero — the size is locked so the eyebrow/heading below
  // don't reflow when the asset is swapped in.
  logoSlot: {
    width: 96,
    height: 96,
    margin: '0 auto 1.25rem',
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 4px 18px rgba(30, 58, 76, 0.10)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
    color: '#3E5361',
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
    marginBottom: '2rem',
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
    padding: '0.5rem 1.5rem 4rem',
  },
  cardGridInner: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    maxWidth: 900,
    margin: '0 auto',
  },
  navyCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    padding: '1.5rem',
    textAlign: 'left',
  },
  navyCardEyebrow: {
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--harbor-orange)',
    fontWeight: 600,
  },
  navyCardTitle: {
    fontFamily: "'Newsreader', serif",
    fontSize: 19,
    fontWeight: 600,
    color: '#fff',
  },
  navyCardDescription: {
    fontSize: 13,
    color: '#C7D6DC',
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
  // Hackathon demo panel — sits between the role grid and the
  // evidence link. Self-hides when /api/demo/status 404s. The border
  // color and label are intentionally louder than the role cards so
  // it's obvious this is a backdoor, not a real auth path.
  // margin-top is generous so the panel reads as a clearly separate
  // section rather than another card on the same row.
  demoPanel: {
    maxWidth: 640,
    margin: '2.5rem auto 0',
    background: '#FFF7EE',
    border: '1px dashed #D98E5B',
    borderRadius: 14,
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  demoHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  demoEyebrow: {
    fontSize: 11,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#D98E5B',
    fontWeight: 700,
  },
  demoSubtitle: {
    fontSize: 13,
    color: '#4A5A64',
    lineHeight: 1.5,
  },
  demoButtonRow: {
    display: 'flex',
    gap: 10,
  },
  demoButton: {
    flex: 1,
    background: '#D98E5B',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '11px 16px',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Work Sans', sans-serif",
    cursor: 'pointer',
  },
  demoStatus: {
    margin: 0,
    fontSize: 13,
    textAlign: 'center',
    color: '#1E3A4C',
  },
}