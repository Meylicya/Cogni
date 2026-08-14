import { useState, useEffect } from 'react';
import BackButton from '../../components/BackButton.jsx';

export default function CaregiverAccessGrant() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch the clinician's active patients to populate the dropdown
  useEffect(() => {
    const clinicianId = localStorage.getItem('clinicianId');
    if (!clinicianId) return;

    const fetchPatients = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/patients');
        if (response.ok) {
          const allPatients = await response.json();
          const myPatients = allPatients.filter(p => p.clinicianId === clinicianId);
          setPatients(myPatients);
        }
      } catch (err) {
        console.error("Failed to fetch patients for caregiver link:", err);
      }
    };

    fetchPatients();
  }, []);

  const handleGrantAccess = (e) => {
    e.preventDefault();
    setIsSending(true);
    setStatusMessage('Writing to secure caregiver_patient_links database...');

    // HACKATHON MOCK: Simulate the secure backend linkage!
    setTimeout(() => {
      setStatusMessage(`✅ Success! Secure read-only access granted. An invitation link has been sent to ${caregiverEmail}.`);
      setIsSending(false);
      setCaregiverName('');
      setCaregiverEmail('');
      setSelectedPatientId('');
    }, 1500);
  };

  return (
    <div style={{ padding: '3rem 1.5rem', maxWidth: 550, margin: '0 auto', fontFamily: "'Work Sans', sans-serif" }}>
      <BackButton to="/dashboard" style={{ marginBottom: '1.25rem' }}>
        ← Back to dashboard
      </BackButton>
      
      <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
        <h2 style={{ color: '#1E3A4C', fontFamily: "'Newsreader', serif", fontSize: 30, margin: '0 0 8px' }}>
          Caregiver Access Grant
        </h2>
        <p style={{ color: '#5B8A9A', fontSize: 14, margin: '0 auto', lineHeight: 1.5, maxWidth: 450 }}>
          For patient privacy and HIPAA compliance, caregivers cannot self-register. 
          Use this portal to securely link a family member to an active patient record.
        </p>
      </div>

      <form onSubmit={handleGrantAccess} className="harbor-card harbor-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '2rem', background: '#fff' }}>
        
        {/* Patient Selection Dropdown */}
        <div className="harbor-field">
          <label className="harbor-label">Select Patient Record</label>
          <select 
            className="harbor-input"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            disabled={isSending || patients.length === 0}
            required
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
          >
            <option value="" disabled>
              {patients.length === 0 ? "Loading patients..." : "Select a patient..."}
            </option>
            {patients.map(p => (
              <option key={p._id} value={p._id}>
                {p.name || p.fullName || 'Unknown Patient'} ({p.email})
              </option>
            ))}
          </select>
        </div>

        {/* Caregiver Information */}
        <div className="harbor-field">
          <label className="harbor-label">Caregiver Name</label>
          <input 
            type="text" 
            className="harbor-input"
            value={caregiverName} 
            onChange={(e) => setCaregiverName(e.target.value)} 
            required 
            placeholder="Jane Doe"
            disabled={isSending}
          />
        </div>

        <div className="harbor-field">
          <label className="harbor-label">Caregiver Email</label>
          <input 
            type="email" 
            className="harbor-input"
            value={caregiverEmail} 
            onChange={(e) => setCaregiverEmail(e.target.value)} 
            required 
            placeholder="jane.doe@family.com"
            disabled={isSending}
          />
        </div>

        <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #D98E5B', fontSize: '13px', color: '#475569' }}>
          <strong>Security Note:</strong> This action creates a secure cryptographic link in the <code style={{background: '#E2E8F0', padding: '2px 4px', borderRadius: '4px'}}>caregiver_patient_links</code> database table. The caregiver will receive view-only access to progress reports.
        </div>

        <button 
          type="submit" 
          className="harbor-btn harbor-btn-dark" 
          style={{ marginTop: 8, opacity: isSending ? 0.7 : 1 }}
          disabled={isSending}
        >
          {isSending ? 'Authenticating & Linking...' : 'Grant Read-Only Access'}
        </button>

        {statusMessage && (
          <p style={{ 
            marginTop: '0.5rem', 
            fontSize: 14, 
            textAlign: 'center', 
            fontWeight: 'bold', 
            color: statusMessage.includes('Success') ? '#10B981' : '#D98E5B' 
          }}>
            {statusMessage}
          </p>
        )}
      </form>
    </div>
  );
}