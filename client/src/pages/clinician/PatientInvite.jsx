import { useState } from 'react';

export default function PatientInvite() {
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleInvite = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setStatusMessage('Generating magic link and sending email...');

    // Grab the logged-in clinician's ID that we saved during the Login phase
    const clinicianId = localStorage.getItem('clinician_id');

    if (!clinicianId) {
      setStatusMessage('Error: You must be logged in to invite a patient.');
      setIsSending(false);
      return;
    }

    try {
      // Hitting the new Node/Express invite route we just wrote!
      const response = await fetch('http://localhost:3001/api/patients/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: patientName, 
          email: patientEmail, 
          clinicianId 
        }),
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