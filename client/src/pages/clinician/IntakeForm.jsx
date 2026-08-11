import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkSafetyGate } from '../../utils/safetyGate';

export default function IntakeForm() {
  const navigate = useNavigate();
  const [injuryDate, setInjuryDate] = useState('');
  const [languageDifficulty, setLanguageDifficulty] = useState(false);
  
  // 0-6 symptom scales (0 = none, 6 = severe)
  const [cognitive, setCognitive] = useState(0);
  const [physical, setPhysical] = useState(0);
  const [emotional, setEmotional] = useState(0);
  const [sleep, setSleep] = useState(0);
  
  const [statusMessage, setStatusMessage] = useState('');
  const [isSafe, setIsSafe] = useState(null);
  const [assignedTier, setAssignedTier] = useState(null);

  const calculateDifficultyTier = (totalScore) => {
    // Max possible score is 24 (4 categories * 6). 
    // Higher symptoms = lower starting difficulty tier (1-5).
    if (totalScore >= 18) return 1; // Tier 1: Easiest
    if (totalScore >= 12) return 2; // Tier 2
    if (totalScore >= 7) return 3;  // Tier 3: Moderate
    if (totalScore >= 3) return 4;  // Tier 4
    return 5;                       // Tier 5: Hardest (Very few symptoms)
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const gateResult = checkSafetyGate(injuryDate);
    setStatusMessage(gateResult.message);
    setIsSafe(gateResult.safe);

    if (gateResult.safe) {
      const totalSymptoms = parseInt(cognitive) + parseInt(physical) + parseInt(emotional) + parseInt(sleep);
      const startingTier = calculateDifficultyTier(totalSymptoms);
      setAssignedTier(startingTier);
      
      console.log("Intake Complete:", {
          languageSymptomsFlagged: languageDifficulty,
          difficulty_tier: startingTier,
          symptom_scores: { cognitive, physical, emotional, sleep }
      });
    } else {
      setAssignedTier(null); // Clear tier if unsafe
    }
  };

  function handleContinueToInvite() {
    // Carries the intake outcome forward so PatientInvite (and eventually
    // Person 3's backend) has it without re-asking the clinician.
    // NOTE: this is route-state, not persisted anywhere yet — once a real
    // patient record API exists, this payload is what should be sent to
    // it instead of just being handed to the next screen in memory.
    navigate('/clinician/invite-patient', {
      state: {
        languageSymptomsFlagged: languageDifficulty,
        difficultyTier: assignedTier,
      },
    });
  }

  // Helper for rendering sliders
  const renderSlider = (label, value, setValue) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <strong>{label} (0-6): <span style={{ color: '#D98E5B' }}>{value}</span></strong>
      <input 
        type="range" 
        min="0" max="6" 
        value={value} 
        onChange={(e) => setValue(e.target.value)} 
      />
    </label>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', fontFamily: 'Work Sans, sans-serif' }}>
      <h2 style={{ color: '#1E3A4C', fontFamily: 'Newsreader, serif' }}>Patient Intake & Safety Gate</h2>
      <p style={{ color: '#5B8A9A' }}>Clinician use only. Please assess the patient's current status.</p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#F2F5F7', padding: '1.5rem', borderRadius: '8px' }}>
        
        <label>
          <strong>Date & Time of Injury:</strong><br/>
          <input 
            type="datetime-local" 
            value={injuryDate}
            onChange={(e) => setInjuryDate(e.target.value)}
            required
            style={{ padding: '0.5rem', width: '100%', marginTop: '0.5rem' }}
          />
        </label>

        <hr style={{ borderTop: '1px solid #ccc', margin: '1rem 0' }} />
        <h3 style={{ color: '#1E3A4C', marginTop: 0 }}>Current Symptom Severity</h3>
        
        {renderSlider("Cognitive (concentration, memory, fog)", cognitive, setCognitive)}
        {renderSlider("Physical (headache, dizziness, fatigue)", physical, setPhysical)}
        {renderSlider("Emotional (irritability, anxiety, mood)", emotional, setEmotional)}
        {renderSlider("Sleep (unrested, sleeping more/less)", sleep, setSleep)}

        <hr style={{ borderTop: '1px solid #ccc', margin: '1rem 0' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input 
            type="checkbox" 
            checked={languageDifficulty}
            onChange={(e) => setLanguageDifficulty(e.target.checked)}
          />
          <strong>Flag Language/Communication Symptoms</strong>
        </label>
        <p style={{ margin: '0 0 0 1.5rem', fontSize: '0.85rem', color: '#666' }}>
          Check this if the patient reports word-finding difficulty.
        </p>

        <button 
          type="submit" 
          style={{ 
            backgroundColor: '#D98E5B', 
            color: 'white', border: 'none', padding: '0.75rem', 
            fontWeight: 'bold', cursor: 'pointer', marginTop: '1rem', borderRadius: '4px'
          }}>
          Save Intake & Run Safety Check
        </button>
      </form>

      {statusMessage && (
        <div style={{ 
          marginTop: '2rem', padding: '1rem', 
          backgroundColor: isSafe ? '#e6f4ea' : '#fce8e6',
          color: isSafe ? '#137333' : '#c5221f',
          border: `1px solid ${isSafe ? '#ceead6' : '#fad2cf'}`,
          borderRadius: '4px'
        }}>
          <strong>{statusMessage}</strong>
          {isSafe && assignedTier && (
            <>
              <p style={{ marginTop: '0.5rem', color: '#1E3A4C' }}>
                🎯 <strong>Calculated Starting Difficulty Tier: {assignedTier} / 5</strong>
              </p>
              <button
                onClick={handleContinueToInvite}
                style={{
                  backgroundColor: '#1E3A4C',
                  color: 'white',
                  border: 'none',
                  padding: '0.65rem 1.25rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  marginTop: '0.75rem',
                  borderRadius: '4px',
                }}
              >
                Continue to Patient Invite →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
