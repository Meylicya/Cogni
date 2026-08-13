import { useState, useEffect } from 'react';

export default function PrivacySandbox() {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptedData, setEncryptedData] = useState(null);

  // Live State tied to real user inputs
  const [patientId, setPatientId] = useState('');
  const [score, setScore] = useState(0);
  const [reactionTime, setReactionTime] = useState(0);
  const [clinicianId, setClinicianId] = useState('No active session');

  // On load, grab the REAL clinician ID from the local session we built earlier
  useEffect(() => {
    const liveClinicianId = localStorage.getItem('clinician_id');
    if (liveClinicianId) {
      setClinicianId(liveClinicianId);
    }
  }, []);

  // Dynamically generate the JSON based on whatever is typed in the UI
  const rawPayload = JSON.stringify({
    clinicianId: clinicianId,
    patientId: patientId || "Waiting for input...",
    gameId: "n_back_live_session",
    metrics: {
      score: Number(score),
      averageReactionTimeMs: Number(reactionTime),
    },
    timestamp: new Date().toISOString()
  }, null, 2);

  const handleEncryptDemo = async () => {
    if (!patientId) {
      alert("Please enter a Patient ID to encrypt real data!");
      return;
    }

    setIsEncrypting(true);
    setEncryptedData(null);
    
    try {
      const enc = new TextEncoder();
      const encodedData = enc.encode(rawPayload);
      
      const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encodedData
      );
      
      const buf2hex = (buffer) => [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
      
      setTimeout(() => {
        setEncryptedData({
          iv: buf2hex(iv),
          ciphertext: buf2hex(ciphertextBuffer),
        });
        setIsEncrypting(false);
      }, 600);

    } catch (error) {
      console.error("Encryption failed:", error);
      setIsEncrypting(false);
    }
  };

  const handleReset = () => setEncryptedData(null);

  return (
    <div style={{ padding: '3rem 1.5rem', maxWidth: 1000, margin: '0 auto', fontFamily: "'Work Sans', sans-serif" }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#1E3A4C', fontFamily: "'Newsreader', serif", fontSize: 32, margin: '0 0 8px' }}>
          Live Security Sandbox
        </h2>
        <p style={{ color: '#5B8A9A', fontSize: 16, margin: 0, maxWidth: 600, marginInline: 'auto', lineHeight: 1.5 }}>
          Type in real session data below. Watch the browser encrypt it locally using AES-GCM before it ever touches the network.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* LEFT COLUMN: Data Input & Raw JSON */}
        <div className="harbor-card" style={{ flex: '1 1 400px', padding: '2rem', background: '#F8FAFC' }}>
          <h3 style={{ marginTop: 0, color: '#1E3A4C', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.5rem' }}>
            1. Input Real Session Data
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Patient ID</label>
              <input 
                type="text" 
                className="harbor-input" 
                value={patientId} 
                onChange={(e) => setPatientId(e.target.value)} 
                placeholder="e.g. pat_9a8b7c"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Score</label>
                <input 
                  type="number" 
                  className="harbor-input" 
                  value={score} 
                  onChange={(e) => setScore(e.target.value)} 
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Reaction (ms)</label>
                <input 
                  type="number" 
                  className="harbor-input" 
                  value={reactionTime} 
                  onChange={(e) => setReactionTime(e.target.value)} 
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
            </div>
          </div>

          <pre style={{ background: '#1E293B', color: '#38BDF8', padding: '1.5rem', borderRadius: '8px', overflowX: 'auto', fontSize: '14px', fontFamily: 'monospace' }}>
            {rawPayload}
          </pre>

          {!encryptedData ? (
            <button 
              onClick={handleEncryptDemo} 
              className="harbor-btn harbor-btn-dark"
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={isEncrypting}
            >
              {isEncrypting ? 'Locking Data...' : 'Encrypt Live Data'}
            </button>
          ) : (
            <button 
              onClick={handleReset} 
              className="harbor-btn"
              style={{ width: '100%', marginTop: '1rem', background: '#E2E8F0', color: '#1E3A4C' }}
            >
              Reset Sandbox
            </button>
          )}
        </div>

        {/* RIGHT COLUMN: The Encrypted Ciphertext */}
        <div className="harbor-card harbor-fade-in" style={{ flex: '1 1 400px', padding: '2rem', background: '#F8FAFC', opacity: encryptedData ? 1 : 0.5, transition: 'opacity 0.3s' }}>
          <h3 style={{ marginTop: 0, color: '#1E3A4C', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.5rem' }}>
            2. Resulting Network Payload
          </h3>
          
          {encryptedData ? (
            <div className="harbor-fade-in">
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>Initialization Vector (IV)</strong>
                <div style={{ background: '#F1F5F9', padding: '0.75rem', borderRadius: '6px', fontSize: '13px', wordBreak: 'break-all', color: '#64748B', fontFamily: 'monospace' }}>
                  {encryptedData.iv}
                </div>
              </div>
              <div>
                <strong style={{ color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>AES-GCM Ciphertext</strong>
                <div style={{ background: '#FEE2E2', padding: '0.75rem', borderRadius: '6px', fontSize: '13px', wordBreak: 'break-all', color: '#991B1B', fontFamily: 'monospace', maxHeight: '250px', overflowY: 'auto' }}>
                  {encryptedData.ciphertext}
                </div>
              </div>
              <p style={{ marginTop: '1.5rem', fontSize: '13px', color: '#10B981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✓ Securely locked. Ready for database storage.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontStyle: 'italic', fontSize: '14px', textAlign: 'center' }}>
              Waiting for live data to be encrypted...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}