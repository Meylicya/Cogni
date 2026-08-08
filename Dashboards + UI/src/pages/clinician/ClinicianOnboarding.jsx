import { useState } from 'react';

export default function ClinicianOnboarding() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attestation, setAttestation] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // The form natively prevents submission if attestation isn't checked due to the 'required' attribute,
    // but we can add an extra safeguard here just in case.
    if (!attestation) {
      alert("You must attest to being a licensed clinician to create an account.");
      return;
    }

    console.log("Creating Clinician Account:", { name, email, password, professional_attestation: attestation });
    
    // Show a success message (Person 3 will handle the actual API call to the database later)
    setSuccessMessage(`Account created for ${name}! You can now onboard patients.`);
    
    // Clear form
    setName('');
    setEmail('');
    setPassword('');
    setAttestation(false);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto', fontFamily: 'Work Sans, sans-serif' }}>
      <h2 style={{ color: '#1E3A4C', fontFamily: 'Newsreader, serif' }}>Clinician Registration</h2>
      <p style={{ color: '#5B8A9A', marginBottom: '2rem' }}>
        Create an account to supervise patient cognitive rehabilitation.
      </p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', backgroundColor: '#F2F5F7', padding: '2rem', borderRadius: '8px' }}>
        
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <strong>Full Name:</strong>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ padding: '0.5rem' }}
            placeholder="Dr. Jane Doe"
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <strong>Professional Email:</strong>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: '0.5rem' }}
            placeholder="jane.doe@clinic.com"
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <strong>Password:</strong>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: '0.5rem' }}
          />
        </label>

        <div style={{ backgroundColor: '#e8f0fe', padding: '1rem', borderRadius: '4px', border: '1px solid #c6dafc', marginTop: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <input 
              type="checkbox" 
              checked={attestation}
              onChange={(e) => setAttestation(e.target.checked)}
              required
              style={{ marginTop: '0.25rem' }}
            />
            <span style={{ fontSize: '0.9rem', color: '#1E3A4C' }}>
              <strong>Professional Attestation:</strong> I attest that I am a licensed clinician or physical therapist. 
              <br/><br/>
              <em style={{ fontSize: '0.8rem', color: '#5B8A9A' }}>
                *Hackathon Disclaimer: Due to project scope limitations, this relies on an honor-system attestation rather than full medical identity verification.
              </em>
            </span>
          </label>
        </div>

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
          Create Clinician Account
        </button>
      </form>

      {successMessage && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#e6f4ea', color: '#137333', border: '1px solid #ceead6', borderRadius: '4px' }}>
          <strong>✅ {successMessage}</strong>
        </div>
      )}
    </div>
  );
}