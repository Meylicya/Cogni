import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkSafetyGate } from '../../utils/safetyGate';

export default function IntakeForm() {
  const navigate = useNavigate();
  const resultRef = useRef(null);

  const [injuryDate, setInjuryDate] = useState('');
  const [languageDifficulty, setLanguageDifficulty] = useState(false);

  const [cognitive, setCognitive] = useState(0);
  const [physical, setPhysical] = useState(0);
  const [emotional, setEmotional] = useState(0);
  const [sleep, setSleep] = useState(0);

  const [statusMessage, setStatusMessage] = useState('');
  const [isSafe, setIsSafe] = useState(null);
  const [assignedTier, setAssignedTier] = useState(null);

  useEffect(() => {
    if (statusMessage && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [statusMessage]);

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
    setStatusMessage(gateResult.message);
    setIsSafe(gateResult.safe);

    if (gateResult.safe) {
      const totalSymptoms = parseInt(cognitive) + parseInt(physical) + parseInt(emotional) + parseInt(sleep);
      const startingTier = calculateDifficultyTier(totalSymptoms);
      setAssignedTier(startingTier);

      console.log("Intake Complete:", {
        languageSymptomsFlagged: languageDifficulty,
        difficulty_tier: startingTier,
        symptom_scores: { cognitive, physical, emotional, sleep },
      });
    } else {
      setAssignedTier(null);
    }
  };

  function handleContinueToInvite() {
    navigate('/clinician/invite-patient', {
      state: {
        languageSymptomsFlagged: languageDifficulty,
        difficultyTier: assignedTier,
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

      {statusMessage && (
        <div
          ref={resultRef}
          className="harbor-card harbor-fade-in"
          style={{
            ...styles.resultCard,
            borderLeft: `4px solid ${isSafe ? '#2E9E5B' : '#c5221f'}`,
          }}
        >
          <strong style={{ color: isSafe ? '#137333' : '#c5221f', fontSize: 15 }}>
            {statusMessage}
          </strong>

          {isSafe && assignedTier && (
            <>
              <p style={{ marginTop: 10, color: '#1E3A4C', fontSize: 14 }}>
                🎯 <strong>Calculated Starting Difficulty Tier: {assignedTier} / 5</strong>
              </p>
              <button
                onClick={handleContinueToInvite}
                className="harbor-btn harbor-btn-dark"
                style={{ marginTop: 10 }}
              >
                Continue to Patient Invite →
              </button>
            </>
          )}
        </div>
      )}
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
  resultCard: {
    marginTop: '1.5rem',
    padding: '1.25rem 1.5rem',
  },
}
