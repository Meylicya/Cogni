import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * AcceptInvite — where a patient lands after clicking the magic-link URL
 * from their invite email. This is the piece that was genuinely missing:
 * PatientInvite.jsx only ever requested an invite be sent; nothing existed
 * for the patient's side of that link.
 *
 * REAL LIMITATION, not solved here: this component can only render once a
 * patient already has a valid link in hand. Actually delivering that
 * email requires a real email-sending service (e.g. SendGrid, Resend, AWS
 * SES) wired into Person 3's backend — that needs server-side API keys
 * and can't be done from the frontend at all. The Express server's
 * PatientInvite endpoint should, once built, generate a token, store it
 * against the patient record, and send an email containing a link to
 * `/invite/:token` (this route). Until that exists, the only way to
 * reach this page is by typing the URL directly — that's expected during
 * development, not a bug in this component.
 */
export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [accountReady, setAccountReady] = useState(false);

  // ⚠️ Dev stub — real validation needs Person 3's backend to look up
  // `token` against a stored, unexpired invite record.
  const tokenLooksValid = Boolean(token) && token.length > 4;

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    // Person 3: this is where a real API call sets the patient's
    // credentials and marks the invite token as used.
    console.log('Setting patient credentials for invite token:', token);
    setAccountReady(true);
  }

  if (!tokenLooksValid) {
    return (
      <div style={styles.page}>
        <div className="harbor-card harbor-fade-in" style={styles.card}>
          <h2 style={styles.heading}>This invite link isn't valid</h2>
          <p style={styles.body}>
            It may have expired, or already been used. Ask your clinician to send a new one.
          </p>
        </div>
      </div>
    );
  }

  if (accountReady) {
    return (
      <div style={styles.page}>
        <div className="harbor-card harbor-fade-in" style={{ ...styles.card, textAlign: 'center' }}>
          <h2 style={styles.heading}>You're all set</h2>
          <p style={styles.body}>Your account is ready. You can start your recovery exercises now.</p>
          <button className="harbor-btn harbor-btn-dark" onClick={() => navigate('/games')} style={{ width: '100%', marginTop: 12 }}>
            Go to my exercises →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.heading}>Welcome to Harbor</h2>
        <p style={styles.subheading}>Set a password to finish creating your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="harbor-card harbor-fade-in" style={styles.form}>
        <div className="harbor-field">
          <label className="harbor-label">New Password</label>
          <input
            type="password"
            className="harbor-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <div className="harbor-field">
          <label className="harbor-label">Confirm Password</label>
          <input
            type="password"
            className="harbor-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" className="harbor-btn harbor-btn-primary" style={{ marginTop: 4 }}>
          Set password & continue
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: {
    padding: '3rem 1.5rem',
    maxWidth: 440,
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
    fontSize: 28,
    margin: '0 0 8px',
  },
  subheading: {
    color: '#5B8A9A',
    fontSize: 14,
    margin: 0,
  },
  body: {
    color: '#4A5A64',
    fontSize: 14,
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
    padding: '2rem',
  },
  card: {
    padding: '2rem',
  },
  error: {
    color: '#c5221f',
    fontSize: 13,
    margin: 0,
  },
}
