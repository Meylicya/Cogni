import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import BackButton from '../../components/BackButton.jsx';
import { useSession } from '../../context/SessionContext.jsx';

/**
 * PatientInvite — clinician sends a magic-link invite to a new patient.
 *
 * The intake form (IntakeForm.jsx) computes a starting difficultyTier and
 * languageSymptomsFlagged BEFORE the patient exists in the DB. Those values
 * flow into this page via useLocation().state (see IntakeForm's
 * handleContinueToInvite). When the invite POST succeeds, the server's
 * /api/patients/invite route stamps them onto the new Patient record so
 * the patient's first /session-context fetch already reflects the
 * clinician's assessment instead of defaulting to tier 1 / no language
 * flag. Missing state (clinician navigated here directly without doing
 * the intake first) is treated the same as before — server defaults
 * kick in and the clinician can re-run intake later.
 *
 * The injury date and per-invite safety-gate check used to live here.
 * They've been removed: intake is the single source of truth for injury
 * timing, and the safety gate runs once in IntakeForm via
 * utils/safetyGate.js. A clinician who skips intake (or runs the dashboard
 * gateway for a second patient without re-doing intake) bypasses the gate
 * by design — that's a tradeoff the team accepted when moving the field.
 */
export default function PatientInvite() {
  const { clinicianId } = useSession();
  const location = useLocation();
  const intakePrefill = location.state ?? {};
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleInvite = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setStatusMessage('Generating magic link and sending email...');

    // Pull the active clinicianId from SessionContext — the same value
    // the clinician login wrote. If it's missing, the route guard on
    // /clinician/* should have already bounced them to /login; this
    // belt-and-suspenders message is the friendly fallback.
    if (!clinicianId) {
      setStatusMessage('Error: You must be logged in to invite a patient. Please log out and back in.');
      setIsSending(false);
      return;
    }

    const payload = {
      name: patientName,
      email: patientEmail,
      clinicianId,
      // Optional pre-fill from IntakeForm via useNavigate({ state }).
      // Server applies these to the new Patient record on creation so
      // the session-context endpoint doesn't have to default to tier 1
      // + no-language-flag for the freshly-invited patient.
      difficultyTier: intakePrefill.difficultyTier,
      languageSymptomsFlagged: intakePrefill.languageSymptomsFlagged,
    };

    try {
      // Hitting the new Node/Express invite route we just wrote!
      const response = await fetch('http://localhost:3001/api/patients/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // FIXED: Passing the payload object we safely constructed above
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setStatusMessage(`Success! An invite email has been sent to ${patientEmail}.`);
        setPatientName('');
        setPatientEmail('');
      } else {
        const errorData = await response.json();
        setStatusMessage(`Failed to send invite: ${errorData.message}`);
      }
    } catch (error) {
      console.error("Error connecting to backend:", error);
      setStatusMessage("Network error: The UI is ready, but the backend is currently unreachable.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ padding: '3rem 1.5rem', maxWidth: 480, margin: '0 auto', fontFamily: "'Work Sans', sans-serif" }}>
      <BackButton to="/dashboard" style={{ marginBottom: '1.25rem' }}>
        ← Back to dashboard
      </BackButton>
      <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
        <h2 style={{ color: '#1E3A4C', fontFamily: "'Newsreader', serif", fontSize: 30, margin: '0 0 8px' }}>
          Invite a Patient
        </h2>
        <p style={{ color: '#5B8A9A', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
          Send a secure magic link to onboard a new patient to your dashboard.
        </p>
      </div>

      <form onSubmit={handleInvite} className="harbor-card harbor-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', padding: '2rem' }}>

        <div className="harbor-field">
          <label className="harbor-label">Patient Name</label>
          <input
            type="text"
            className="harbor-input"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            required
            placeholder="John Doe"
            disabled={isSending}
          />
        </div>

        <div className="harbor-field">
          <label className="harbor-label">Patient Email</label>
          <input
            type="email"
            className="harbor-input"
            value={patientEmail}
            onChange={(e) => setPatientEmail(e.target.value)}
            required
            placeholder="john.doe@example.com"
            disabled={isSending}
          />
        </div>

        <button
          type="submit"
          className="harbor-btn harbor-btn-dark"
          style={{ marginTop: 4, opacity: isSending ? 0.7 : 1 }}
          disabled={isSending}
        >
          {isSending ? 'Sending...' : 'Send Invite Link'}
        </button>

        {statusMessage && (
          <p style={{
            marginTop: '1rem',
            fontSize: 14,
            textAlign: 'center',
            fontWeight: 'bold',
            color: statusMessage.includes('Success') ? 'green' : '#D98E5B'
          }}>
            {statusMessage}
          </p>
        )}
      </form>
    </div>
  );
}