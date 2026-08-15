import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../../components/BackButton.jsx';

/**
 * DailySymptomCheckin — patient-facing, filled out once per day.
 *
 * NOT the same as IntakeForm.jsx (clinician-only, one-time, sets starting
 * difficulty tier). This is the ongoing daily signal into Person 2's ZPD
 * engine + dashboard trend lines. Still scoped to Person 2/4 originally —
 * loop them in before merging.
 *
 * ENDPOINTS (confirmed against server/routes/symptomCheckins.js):
 *   POST /api/symptom-checkins
 *     body: { patientId, cognitiveScore, physicalScore, emotionalScore,
 *             sleepScore, communicationScore, checkinDate }
 *     (camelCase — NOT the snake_case in the schema doc)
 *     409 if already submitted for that date.
 *   GET  /api/symptom-checkins/patient/:patientId
 *     -> array of check-ins, sorted by checkinDate ascending.
 *     There is NO dedicated "/today" route — "already submitted today" is
 *     determined here by fetching the full list and checking client-side
 *     whether today's date is already present.
 */
export default function DailySymptomCheckin() {
  const navigate = useNavigate();

  const [cognitive, setCognitive] = useState(0);
  const [physical, setPhysical] = useState(0);
  const [emotional, setEmotional] = useState(0);
  const [sleep, setSleep] = useState(0);
  const [communication, setCommunication] = useState(0);

  const [languageSymptomsFlagged, setLanguageSymptomsFlagged] = useState(false);
  const [alreadySubmittedToday, setAlreadySubmittedToday] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const patientId = localStorage.getItem('patientId');
    // TODO(Person 4 / auth): read from SessionContext once real patient
    // auth + intake data is wired up, not a raw localStorage flag.
    setLanguageSymptomsFlagged(localStorage.getItem('languageSymptomsFlagged') === 'true');

    if (!patientId) {
      navigate('/patient/login');
      return;
    }

    const checkTodaysStatus = async () => {
      try {
        const res = await fetch(
          `http://localhost:3001/api/symptom-checkins/patient/${patientId}`
        );
        if (res.ok) {
          const checkins = await res.json();
          const hasToday = checkins.some((c) => (c.checkinDate || '').slice(0, 10) === todayStr);
          if (hasToday) setAlreadySubmittedToday(true);
        }
      } catch (err) {
        console.error("Could not check today's check-in status:", err);
        // Fails open — patient can still fill the form; the backend's
        // 409 on duplicate is the real enforcement.
      } finally {
        setIsLoading(false);
      }
    };

    checkTodaysStatus();
  }, [navigate, todayStr]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage('Saving...');

    const patientId = localStorage.getItem('patientId');
    const payload = {
      patientId,
      cognitiveScore: Number(cognitive),
      physicalScore: Number(physical),
      emotionalScore: Number(emotional),
      sleepScore: Number(sleep),
      communicationScore: languageSymptomsFlagged ? Number(communication) : null,
      checkinDate: todayStr,
    };

    try {
      const res = await fetch('http://localhost:3001/api/symptom-checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSubmitted(true);
      } else if (res.status === 409) {
        setAlreadySubmittedToday(true);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setStatusMessage(`Couldn't save: ${errorData.error || 'please try again.'}`);
      }
    } catch (error) {
      console.error('Error connecting to backend:', error);
      setStatusMessage('Could not reach the backend, but frontend UI is ready!');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  if (isLoading) {
    return (
      <div style={styles.page}>
        <p style={{ textAlign: 'center', color: '#5B8A9A' }}>Loading...</p>
      </div>
    );
  }

  if (alreadySubmittedToday || submitted) {
    return (
      <div style={styles.page}>
        <BackButton to="/games" style={{ marginBottom: '1.25rem' }}>
          ← Back to exercises
        </BackButton>
        <div className="harbor-card harbor-fade-in" style={{ ...styles.form, textAlign: 'center' }}>
          <h2 style={styles.heading}>You're all set for today</h2>
          <p style={{ color: '#4A5A64', fontSize: 14, lineHeight: 1.5 }}>
            Thanks for checking in. Come back tomorrow for your next one.
          </p>
          <button
            className="harbor-btn harbor-btn-dark"
            onClick={() => navigate('/games')}
            style={{ width: '100%', marginTop: 12 }}
          >
            Go to my exercises →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <BackButton to="/games" style={{ marginBottom: '1.25rem' }}>
        ← Back to exercises
      </BackButton>
      <div style={styles.header}>
        <h2 style={styles.heading}>Daily Check-in</h2>
        <p style={styles.subheading}>How are you feeling today? Rate each area 0 (none) to 6 (severe).</p>
      </div>

      <form onSubmit={handleSubmit} className="harbor-card harbor-fade-in" style={styles.form}>
        {renderSlider('Cognitive — concentration, memory, fog', cognitive, setCognitive)}
        {renderSlider('Physical — headache, dizziness, fatigue', physical, setPhysical)}
        {renderSlider('Emotional — irritability, anxiety, mood', emotional, setEmotional)}
        {renderSlider('Sleep — unrested, sleeping more/less', sleep, setSleep)}

        {languageSymptomsFlagged &&
          renderSlider('Communication — word-finding, following speech', communication, setCommunication)}

        {statusMessage && <p style={styles.error}>{statusMessage}</p>}

        <button type="submit" className="harbor-btn harbor-btn-primary" style={{ marginTop: 4 }} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Submit check-in'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: {
    padding: '3rem 1.5rem',
    maxWidth: 560,
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
    fontSize: 28,
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
  error: {
    color: '#c5221f',
    fontSize: 13,
    margin: 0,
    textAlign: 'center',
  },
}
