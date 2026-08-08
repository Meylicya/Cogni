import { useState } from 'react';

export default function CaregiverAccessGrant({ patientId, patientName }) {
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleGrantAccess = (e) => {
    e.preventDefault();
    
    // Clean payload ready for Person 3's backend API to consume
    const payload = {
        patientId: patientId, 
        caregiverEmail: caregiverEmail, 
        relationshipLabel: relationship
    };
    
    console.log("Sending to API:", payload);

    setStatusMessage(`Access request for ${caregiverEmail} sent to backend.`);
    
    setCaregiverEmail('');
    setRelationship('');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto', fontFamily: 'Work Sans, sans-serif' }}>
      <h2 style={{ color: '#1E3A4C', fontFamily: 'Newsreader, serif' }}>Authorize Caregiver Access</h2>
      <p style={{ color: '#5B8A9A' }}>
        Securely grant a caregiver read-only access to a patient's recovery dashboard. 
      </p>
      
      <div style={{ backgroundColor: '#fce8e6', padding: '1rem', borderRadius: '4px', border: '1px solid #fad2cf', marginBottom: '1.5rem' }}>
        <strong style={{ color: '#c5221f', fontSize: '0.9rem' }}>🔒 Security & Privacy Notice</strong>
        <p style={{ fontSize: '0.85rem', color: '#c5221f', marginTop: '0.5rem', marginBottom: 0 }}>
          Caregivers cannot request or self-assign access. This link must be explicitly granted by the patient's clinician or the patient themselves.
        </p>
      </div>

      <form onSubmit={handleGrantAccess} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#F2F5F7', padding: '2rem', borderRadius: '8px' }}>
        
        {/* Only displays if the parent component actually passed the prop */}
        {patientName && (
           <div style={{ color: '#1E3A4C', fontSize: '0.95rem' }}>
             Granting access for: <strong>{patientName}</strong>
           </div>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <strong>Caregiver Email:</strong>
          <input 
            type="email" 
            value={caregiverEmail}
            onChange={(e) => setCaregiverEmail(e.target.value)}
            required
            style={{ padding: '0.5rem' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <strong>Relationship to Patient (Optional):</strong>
          <input 
            type="text" 
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
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
          Authorize Caregiver
        </button>
      </form>

      {statusMessage && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#e6f4ea', color: '#137333', border: '1px solid #ceead6', borderRadius: '4px' }}>
          <strong>{statusMessage}</strong>
        </div>
      )}
    </div>
  );
}