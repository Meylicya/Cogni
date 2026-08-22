import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BackButton from '../../components/BackButton.jsx';

/**
 * ENDPOINT (server/routes/caregivers.js):
 *   POST /api/caregivers/accept-invite   body: { name, password, inviteToken }
 */
export default function CaregiverAcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [accountReady, setAccountReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tokenLooksValid = Boolean(token) && token.length > 4;

  async function handleSubmit(e) {
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

    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:3001/api/caregivers/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, inviteToken: token }),
      });

      if (response.ok) {
        setAccountReady(true);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || 'This invite link is invalid or expired.');
      }
    } catch (err) {
      console.error('Error connecting to backend:', err);
      setError('Could not reach the backend. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!tokenLooksValid) {
    return (
      <div style={styles.page}>
        <BackButton to="/" style={{ marginBottom: '1.25rem' }}>
          ← Back to home
        </BackButton>
        <div className="harbor-card harbor-fade-in" style={styles.card}>
          <h2 style={styles.heading}>This invite link isn't valid</h2>
          <p style={styles.body}>
            It may have expired, or already been used. Ask the clinician or patient who invited you to send a new one.
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
          <p style={styles.body}>Your account is ready. You now have read-only access to recovery trends.</p>
          <button className="harbor-btn harbor-btn-dark" onClick={() => navigate('/caregiver/login')} style={{ width: '100%', marginTop: 12 }}>
            Go to login →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <BackButton to="/" style={{ marginBottom: '1.25rem' }}>
        ← Back to home
      </BackButton>
      <div style={styles.header}>
        <h2 style={styles.heading}>Welcome to Cogni</h2>
        <p style={styles.subheading}>Confirm your name and set a password.</p>
      </div>

      <form onSubmit={handleSubmit} className="harbor-card harbor-fade-in" style={styles.form}>
        <div className="harbor-field">
          <label className="harbor-label">Your Name</label>
          <input
            type="text"
            className="harbor-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

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

        <button type="submit" className="harbor-btn harbor-btn-primary" style={{ marginTop: 4 }} disabled={isSubmitting}>
          {isSubmitting ? 'Setting up...' : 'Set password & continue'}
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
