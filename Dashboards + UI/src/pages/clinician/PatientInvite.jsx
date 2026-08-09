import { useState } from 'react';

export default function PatientInvite({ clinicianId }) {
  const [patientEmail, setPatientEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleGenerateInvite = (e) => {
    e.preventDefault();
    
    // Clean payload for Person 3's backend to process the JWT magic link
    const payload = {
        clinicianId: clinicianId,
        patientEmail: patientEmail
    };

    console.log("Triggering Invite API:", payload);
    
    setStatusMessage(`Invite request for ${patientEmail} sent to backend.`);
    setPatientEmail('');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto', fontFamily: 'Work Sans, sans-serif' }}>
      <h2 style={{ color: '#1E3A4C', fontFamily: 'Newsreader, serif' }}>Invite Patient</h2>
      <p style={{ color: '#5B8A9A' }}>
        Request a secure magic link to allow the patient to set up their own credentials.
      </p>
      
      <form onSubmit={handleGenerateInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#F2F5F7', padding: '2rem', borderRadius: '8px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <strong>Patient Email:</strong>
          <input 
            type="email" 
            value={patientEmail}
            onChange={(e) => setPatientEmail(e.target.value)}
            required
            style={{ padding: '0.5rem' }}
          />
        </label>

        <button 
          type="submit" 
          style={{ 
            backgroundColor: '#1E3A4C', 
            color: 'white', 
            border: 'none', 
            padding: '0.75rem', 
            fontWeight: 'bold', 
            cursor: 'pointer', 
            marginTop: '1rem',
            borderRadius: '4px'
          }}>
          Request Magic Link
        </button>
      </form>

      {statusMessage && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#e8f0fe', border: '1px solid #c6dafc', borderRadius: '4px', color: '#1E3A4C' }}>
          <strong>{statusMessage}</strong>
        </div>
      )}
    </div>
  );
}