import { useState } from 'react';
import BackButton from '../../components/BackButton.jsx';
import { useSession } from '../../context/SessionContext.jsx';

export default function PatientInvite() {
  const { clinicianId } = useSession();
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [injuryTiming, setInjuryTiming] = useState('');

  const handleInvite = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setStatusMessage('Generating magic link and sending email...');

    // HACKATHON SAFETY GATE: Block patients in the acute phase!
    if (injuryTiming === 'acute') {
      setStatusMessage('⚠️ SAFETY GATE ACTIVATED: Patient is within 48 hours of injury. Cognitive rehabilitation is strictly contraindicated during the acute phase. Please prescribe rest and re-evaluate later.');
      setIsSending(false);
      return;
    }

    if (!injuryTiming) {
      setStatusMessage('Please select the patient\'s injury timing.');
      setIsSending(false);
      return;
    }

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
        setInjuryTiming(''); // Reset the dropdown on success
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

        <div className="harbor-field">
          <label className="harbor-label">Time Since Concussion/Injury</label>
          <select 
            className="harbor-input"
            value={injuryTiming}
            onChange={(e) => setInjuryTiming(e.target.value)}
            disabled={isSending}
            required
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
          >
            <option value="" disabled>Select injury timing...</option>
            <option value="acute">Less than 48 hours (Acute Phase)</option>
            <option value="subacute">3 to 7 days</option>
            <option value="chronic">More than 1 week</option>
          </select>
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