import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../../components/Toast.jsx';

export default function CaregiverAccessGrant({ patientId, patientName }) {
  const navigate = useNavigate();
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [toast, setToast] = useState(null);

  const handleGrantAccess = (e) => {
    e.preventDefault();

    const payload = { patientId, caregiverEmail, relationshipLabel: relationship };
    console.log("Sending to API:", payload);

    setToast({ message: `Access granted for ${caregiverEmail}.` });
    setCaregiverEmail('');
    setRelationship('');
  };

  return (
    <div style={styles.page}>
      {toast && <Toast message={toast.message} onDismiss={() => setToast(null)} />}

      <div style={styles.header}>
        <h2 style={styles.heading}>Authorize Caregiver Access</h2>
        <p style={styles.subheading}>
          Securely grant a caregiver read-only access to a patient's recovery dashboard.
        </p>
      </div>

      <div style={styles.noticeBox}>
        <strong style={{ color: '#c5221f', fontSize: 13.5 }}>🔒 Security & Privacy Notice</strong>
        <p style={{ fontSize: 13, color: '#c5221f', margin: '6px 0 0' }}>
          Caregivers cannot request or self-assign access. This link must be explicitly granted by
          the patient's clinician or the patient themselves.
        </p>
      </div>

      <form onSubmit={handleGrantAccess} className="harbor-card harbor-fade-in" style={styles.form}>
        {patientName && (
          <div style={{ color: '#1E3A4C', fontSize: 14 }}>
            Granting access for: <strong>{patientName}</strong>
          </div>
        )}

        <div className="harbor-field">
          <label className="harbor-label">Caregiver Email</label>
          <input
            type="email"
            className="harbor-input"
            value={caregiverEmail}
            onChange={(e) => setCaregiverEmail(e.target.value)}
            required
          />
        </div>

        <div className="harbor-field">
          <label className="harbor-label">Relationship to Patient (Optional)</label>
          <input
            type="text"
            className="harbor-input"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="e.g. parent, spouse"
          />
        </div>

        <button type="submit" className="harbor-btn harbor-btn-dark" style={{ marginTop: 4 }}>
          Authorize Caregiver
        </button>
      </form>

      <div style={styles.backRow}>
        {/* No clinician dashboard exists yet (Person 3's territory) —
            linking home for now. Swap this for a real dashboard route
            once one exists. */}
        <button className="harbor-btn harbor-btn-outline" onClick={() => navigate('/')}>
          ← Back to home
        </button>
      </div>
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
    marginBottom: '1.5rem',
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
  noticeBox: {
    background: '#fce8e6',
    padding: '1rem',
    borderRadius: 12,
    border: '1px solid #fad2cf',
    marginBottom: '1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
    padding: '2rem',
  },
  backRow: {
    marginTop: '1.25rem',
    textAlign: 'center',
  },
}
