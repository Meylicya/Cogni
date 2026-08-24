

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { checkSafetyGate } from '../../utils/safetyGate';
import Modal from '../../components/Modal.jsx';
import BackButton from '../../components/BackButton.jsx';
import { useSession } from '../../context/SessionContext.jsx';

const INTAKE_COMPLETE_KEY_PREFIX = 'clinicianIntakeComplete_';

export default function IntakeForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clinicianId } = useSession();
  // If we got here from the dashboard's "Send First Invite" gateway,
  // land on the invite form after a successful intake. Otherwise
  // (signup flow) keep the original behavior.
  const returnTo = location.state?.returnTo || '/clinician/invite-patient';

  const [injuryDate, setInjuryDate] = useState('');
  const [languageDifficulty, setLanguageDifficulty] = useState(false);

  const [cognitive, setCognitive] = useState(0);
  const [physical, setPhysical] = useState(0);
  const [emotional, setEmotional] = useState(0);
  const [sleep, setSleep] = useState(0);

  const [result, setResult] = useState(null); // { message, isSafe, assignedTier } | null

  const calculateDifficultyTier = (totalScore) => {
    if (totalScore >= 18) return 1;
    if (totalScore >= 12) return 2;
    if (totalScore >= 7) return 3;
    if (totalScore >= 3) return 4;
    return 5;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const gateResult = checkSafetyGate(injuryDate);

    if (gateResult.safe) {
      const totalSymptoms = parseInt(cognitive) + parseInt(physical) + parseInt(emotional) + parseInt(sleep);
      const startingTier = calculateDifficultyTier(totalSymptoms);

      setResult({ message: gateResult.message, isSafe: true, assignedTier: startingTier });
    } else {
      setResult({ message: gateResult.message, isSafe: false, assignedTier: null });
    }
  };

  function handleContinueToInvite() {
    if (clinicianId) {
      localStorage.setItem(`${INTAKE_COMPLETE_KEY_PREFIX}${clinicianId}`, 'true');
    }
    navigate(returnTo, {
      state: {
        languageSymptomsFlagged: languageDifficulty,
        difficultyTier: result.assignedTier,
      },
    });
  }

  const renderSlider = (label, value, setValue) => (
    <div className="harbor-field">
      <label className="harbor-label">
        {label} <span style={{ color: '#D98E5B', fontWeight: 700 }}>({value})</span>
      </label>
      <input
        type="range"
        min="0"
        max="6"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="harbor-slider"
      />
    </div>
  );

  return (
    <div style={styles.page}>
      <BackButton to="/dashboard" style={{ marginBottom: '1.25rem' }}>
        ← Back to dashboard
      </BackButton>
      <div style={styles.header}>
        <h2 style={styles.heading}>Patient Intake & Safety Gate</h2>
        <p style={styles.subheading}>Clinician use only. Please assess the patient's current status.</p>
      </div>

      <form onSubmit={handleSubmit} className="harbor-card harbor-fade-in" style={styles.form}>
        <div className="harbor-field">
          <label className="harbor-label">Date & Time of Injury</label>
          <input
            type="datetime-local"
            className="harbor-input"
            value={injuryDate}
            onChange={(e) => setInjuryDate(e.target.value)}
            required
          />
        </div>

        <hr style={styles.divider} />
        <h3 style={styles.sectionHeading}>Current Symptom Severity</h3>

        {renderSlider('Cognitive — concentration, memory, fog', cognitive, setCognitive)}
        {renderSlider('Physical — headache, dizziness, fatigue', physical, setPhysical)}
        {renderSlider('Emotional — irritability, anxiety, mood', emotional, setEmotional)}
        {renderSlider('Sleep — unrested, sleeping more/less', sleep, setSleep)}

        <hr style={styles.divider} />

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            className="harbor-checkbox"
            checked={languageDifficulty}
            onChange={(e) => setLanguageDifficulty(e.target.checked)}
          />
          <span>
            <strong style={{ color: '#1E3A4C' }}>Flag Language/Communication Symptoms</strong>
            <br />
            <span style={{ fontSize: 12.5, color: '#7C8B93' }}>
              Check this if the patient reports word-finding difficulty.
            </span>
          </span>
        </label>

        <button type="submit" className="harbor-btn harbor-btn-primary" style={{ marginTop: 4 }}>
          Save Intake & Run Safety Check
        </button>
      </form>

      {result && (
        <Modal onClose={() => setResult(null)}>
          <div style={styles.resultBody}>
            <StatusIcon isSafe={result.isSafe} />
            <h3 style={{ ...styles.resultHeading, color: result.isSafe ? '#137333' : '#c5221f' }}>
              {result.isSafe ? 'Cleared for exercises' : 'Acute phase — blocked'}
            </h3>
            <p style={styles.resultMessage}>{result.message}</p>

            {result.isSafe && (
              <>
                <div style={styles.tierRow}>
                  <span style={styles.tierLabel}>Starting difficulty tier</span>
                  <span style={styles.tierValue}>{result.assignedTier} / 5</span>
                </div>
                <button
                  onClick={handleContinueToInvite}
                  className="harbor-btn harbor-btn-dark"
                  style={{ width: '100%', marginTop: 8 }}
                >
                  Continue to Patient Invite →
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatusIcon({ isSafe }) {
  return (
    <div style={{ ...styles.iconCircle, background: isSafe ? 'rgba(46, 158, 91, 0.15)' : 'rgba(197, 34, 31, 0.12)' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        {isSafe ? (
          <path d="M5 12.5l4.5 4.5L19 7" stroke="#2E9E5B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <path d="M12 8v5" stroke="#c5221f" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M12 16.5v.01" stroke="#c5221f" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" stroke="#c5221f" strokeWidth="1.6" opacity="0.35" />
          </>
        )}
      </svg>
    </div>
  );
}

const styles = {
  page: {
    padding: '3rem 1.5rem',
    maxWidth: 620,
    margin: '0 auto',
    fontFamily: "'Work Sans', sans-serif",
  },
  header: {
    marginBottom: '1.75rem',
    textAlign: 'center',
  },
  heading: {
    color: '#1E3A4C',
    fontFamily: "'Newsreader', serif",
    fontSize: 30,
    margin: '0 0 8px',
  },
  subheading: {
    color: '#5B8A9A',
    fontSize: 14,
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
    padding: '2rem',
  },
  sectionHeading: {
    color: '#1E3A4C',
    fontFamily: "'Newsreader', serif",
    fontSize: 18,
    margin: 0,
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #E1E8EC',
    margin: '4px 0',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  resultBody: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resultHeading: {
    fontFamily: "'Newsreader', serif",
    fontSize: 21,
    margin: '0 0 8px',
  },
  resultMessage: {
    color: '#4A5A64',
    fontSize: 13.5,
    lineHeight: 1.5,
    margin: '0 0 16px',
  },
  tierRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: '#F2F5F7',
    borderRadius: 10,
    padding: '10px 16px',
  },
  tierLabel: {
    fontSize: 13,
    color: '#4A5A64',
    fontWeight: 500,
  },
  tierValue: {
    fontFamily: "'Newsreader', serif",
    fontSize: 20,
    fontWeight: 600,
    color: '#1E3A4C',
  },
}
