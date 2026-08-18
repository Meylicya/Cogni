import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../../components/BackButton.jsx';
import { useSession } from '../../context/SessionContext.jsx';

/**
 * CaregiverLogin — caregivers can't self-register (see
 * CaregiverAccessGrant.jsx), so there's no signup page here, only login.
 * A caregiver reaches a usable account via a clinician-granted invite
 * (not yet built — CaregiverAccessGrant.jsx currently mocks the grant
 * with setTimeout and sends no real email).
 *
 * ENDPOINT (verified against server/routes/caregivers.js):
 *   POST /api/caregivers/login   body: { email, password }
 *   response: { caregiver: { id, name, email } }
 *   403 if invite was never completed.
 */
export default function CaregiverLogin() {
  const navigate = useNavigate();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatusMessage('Authenticating...');

    try {
      const response = await fetch('http://localhost:3001/api/caregivers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();

        // Route through SessionContext (see patient Login.jsx for why).
        if (data.caregiver && data.caregiver.id) {
          login('caregiver', data.caregiver.id);
        }

        navigate('/dashboard');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setStatusMessage(`Login failed: ${errorData.message || 'Invalid credentials'}`);
      }
    } catch (error) {
      console.error('Error connecting to backend:', error);
      setStatusMessage('Could not reach the backend, but frontend UI is ready!');
    }
  };

  return (
    <div style={{ padding: '3rem 1.5rem', maxWidth: 480, margin: '0 auto', fontFamily: "'Work Sans', sans-serif" }}>
      <BackButton to="/" style={{ marginBottom: '1.25rem' }}>
        ← Back to home
      </BackButton>
      <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
        <h2 style={{ color: '#1E3A4C', fontFamily: "'Newsreader', serif", fontSize: 30, margin: '0 0 8px' }}>
          Caregiver Login
        </h2>
        <p style={{ color: '#5B8A9A', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
          Access is granted by a clinician or patient — you can't sign up here directly.
        </p>
      </div>

      <form onSubmit={handleLogin} className="harbor-card harbor-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', padding: '2rem' }}>
        <div className="harbor-field">
          <label className="harbor-label">Email</label>
          <input
            type="email"
            className="harbor-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="harbor-field">
          <label className="harbor-label">Password</label>
          <input
            type="password"
            className="harbor-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="harbor-btn harbor-btn-dark" style={{ marginTop: 4 }}>
          Sign In
        </button>

        {statusMessage && (
          <p style={{ marginTop: '1rem', fontSize: 14, textAlign: 'center', fontWeight: 'bold', color: '#D98E5B' }}>
            {statusMessage}
          </p>
        )}
      </form>
    </div>
  );
}
