import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../../components/Toast.jsx';

export default function PatientInvite({ clinicianId }) {
  const navigate = useNavigate();
  const [patientEmail, setPatientEmail] = useState('');
  const [toast, setToast] = useState(null); // { message } | null
  const [sent, setSent] = useState(false); // once true, show follow-up actions

  const handleGenerateInvite = (e) => {
    e.preventDefault();

    const payload = { clinicianId, patientEmail };
    console.log("Triggering Invite API:", payload);

    setToast({ message: `Invite sent to ${patientEmail}.` });
    setSent(true);
    setPatientEmail('');
  };

  return (
    <div style={styles.page}>
      {toast && <Toast message={toast.message} onDismiss={() => setToast(null)} />}

      <div style={styles.header}>
        <h2 style={styles.heading}>Invite Patient</h2>
        <p style={styles.subheading}>
          Request a secure magic link to allow the patient to set up their own credentials.
        </p>
      </div>

      <form onSubmit={handleGenerateInvite} className="harbor-card harbor-fade-in" style={styles.form}>
        <div className="harbor-field">
          <label className="harbor-label">Patient Email</label>
          <input
            type="email"
            className="harbor-input"
            value={patientEmail}
            onChange={(e) => setPatientEmail(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="harbor-btn harbor-btn-dark" style={{ marginTop: 4 }}>
          Request Magic Link
        </button>
      </form>

      {sent && (
        <div className="harbor-card harbor-fade-in" style={styles.followUpCard}>
          <p style={styles.followUpText}>What's next for this patient?</p>
          <div style={styles.followUpActions}>
            <button
              className="harbor-btn harbor-btn-dark"
              onClick={() => navigate('/clinician/caregiver-access')}
              style={{ width: '100%' }}
            >
              Grant caregiver access →
            </button>
            <button
              className="harbor-btn harbor-btn-outline"
              onClick={() => navigate('/')}
              style={{ width: '100%' }}
            >
              Done for now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: '3rem 1.5rem',
    maxWidth: 480,
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
  followUpCard: {
    marginTop: '1.25rem',
    padding: '1.5rem',
    textAlign: 'center',
  },
  followUpText: {
    fontSize: 13,
    color: '#7C8B93',
    margin: '0 0 14px',
  },
  followUpActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
}
