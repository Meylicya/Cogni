import { useState, useEffect } from 'react';
import BackButton from '../../components/BackButton.jsx';
import { useSession } from '../../context/SessionContext.jsx';
import { getAuthHeaders } from '../../sync/authHeaders.js';

/**
 * Two real backend calls, in sequence:
 *   1. POST /api/caregivers/invite   { email, name }
 *      -> { caregiverId } — creates a pending Caregiver + sends the
 *      magic-link email (mirrors patients.js's /invite pattern).
 *   2. POST /api/caregiver-links     { caregiverId, patientId,
 *      relationshipLabel, accessGrantedByModel: 'Clinician',
 *      accessGrantedBy: <clinicianId> }
 *      -> creates the actual link record.
 * If step 1 succeeds but step 2 fails, the caregiver account exists but
 * isn't linked to anyone yet — surfaced as a distinct error state below
 * rather than silently reported as full success.
 *
 * Auth pattern: clinicianId comes from useSession(), and the roster
 * fetch is gated via getAuthHeaders() against the clinician-roster
 * middleware (X-User-Id === :id AND X-User-Role === 'clinician').
 */
export default function CaregiverAccessGrant() {
  const { clinicianId } = useSession();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!clinicianId) return;

    const fetchPatients = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/clinicians/${clinicianId}/patients`, {
          headers: { ...getAuthHeaders() },
        });
        if (response.ok) {
          const myPatients = await response.json();
          setPatients(myPatients);
        }
      } catch (err) {
        console.error("Failed to fetch patients for caregiver link:", err);
      }
    };

    fetchPatients();
  }, [clinicianId]);

  const handleGrantAccess = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setStatusMessage('Creating caregiver invite...');

    if (!clinicianId) {
      setStatusMessage('Error: you must be logged in as a clinician to grant caregiver access.');
      setIsSending(false);
      return;
    }

    try {
      const inviteRes = await fetch('http://localhost:3001/api/caregivers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: caregiverEmail, name: caregiverName }),
      });

      if (!inviteRes.ok) {
        const errData = await inviteRes.json().catch(() => ({}));
        setStatusMessage(`Failed to invite caregiver: ${errData.message || errData.error || 'unknown error'}`);
        setIsSending(false);
        return;
      }

      const { caregiverId } = await inviteRes.json();

      setStatusMessage('Linking caregiver to patient record...');

      const linkRes = await fetch('http://localhost:3001/api/caregiver-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caregiverId,
          patientId: selectedPatientId,
          relationshipLabel: relationshipLabel || null,
          accessGrantedByModel: 'Clinician',
          accessGrantedBy: clinicianId,
        }),
      });

      if (!linkRes.ok) {
        const errData = await linkRes.json().catch(() => ({}));
        setStatusMessage(
          `Caregiver invited, but linking to the patient failed: ${errData.error || 'unknown error'}. The caregiver account exists but has no access yet — try linking again.`
        );
        setIsSending(false);
        return;
      }

      setStatusMessage(`✅ Success! An invite has been sent to ${caregiverEmail} with read-only access pending their setup.`);
      setCaregiverName('');
      setCaregiverEmail('');
      setRelationshipLabel('');
      setSelectedPatientId('');
    } catch (err) {
      console.error('Caregiver grant error:', err);
      setStatusMessage('Could not reach the backend, but frontend UI is ready!');
    } finally {
      setIsSending(false);
    }
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
          For patient privacy, caregivers cannot self-register.
          Use this portal to securely invite and link a family member to an active patient record.
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

        <div className="harbor-field">
          <label className="harbor-label">Relationship (optional)</label>
          <input
            type="text"
            className="harbor-input"
            value={relationshipLabel}
            onChange={(e) => setRelationshipLabel(e.target.value)}
            placeholder="e.g. parent, spouse"
            disabled={isSending}
          />
        </div>

        <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #D98E5B', fontSize: '13px', color: '#475569' }}>
          <strong>Security Note:</strong> This creates a pending caregiver account and a link record in <code style={{background: '#E2E8F0', padding: '2px 4px', borderRadius: '4px'}}>caregiver_patient_links</code>. The caregiver sets their own password via the emailed invite link before they can log in.
        </div>

        <button
          type="submit"
          className="harbor-btn harbor-btn-dark"
          style={{ marginTop: 8, opacity: isSending ? 0.7 : 1 }}
          disabled={isSending}
        >
          {isSending ? 'Inviting & Linking...' : 'Send Invite & Grant Access'}
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
