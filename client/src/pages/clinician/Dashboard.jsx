import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Dashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const clinicianId = localStorage.getItem('clinician_id');
    const token = localStorage.getItem('cogni_token');

    if (!clinicianId || !token) {
      navigate('/login');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/patients', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch patient data');

        const allPatients = await response.json();
        const myPatients = allPatients.filter(p => p.clinicianId === clinicianId);
        
        setPatients(myPatients);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Could not load real data. Make sure the backend is running!");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  // THE PRO PDF EXPORT FUNCTION
  const exportPDF = async (patientId, patientName) => {
    setIsExporting(true);
    const elementToCapture = document.getElementById(`patient-card-${patientId}`);

    try {
      // 1. Take a high-resolution screenshot of the HTML element
      const canvas = await html2canvas(elementToCapture, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');

      // 2. Initialize a standard A4 PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // 3. Calculate dimensions to maintain aspect ratio
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // 4. Add the image to the PDF and trigger the browser download
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${patientName.replace(/\s+/g, '_')}_Cogni_Clinical_Report.pdf`);
      
    } catch (err) {
      console.error("PDF Export failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ padding: '3rem 1.5rem', maxWidth: 1200, margin: '0 auto', fontFamily: "'Work Sans', sans-serif" }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#1E3A4C', fontFamily: "'Newsreader', serif", fontSize: 32, margin: '0 0 8px' }}>
            Mission Control
          </h2>
          <p style={{ color: '#5B8A9A', fontSize: 16, margin: 0 }}>
            Overview of your active cognitive rehabilitation patients.
          </p>
        </div>
        <button 
          className="harbor-btn harbor-btn-dark"
          onClick={() => navigate('/clinician/invite-patient')}
        >
          + Invite New Patient
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#5B8A9A' }}>
          <h3>Loading secure patient records...</h3>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          
          {patients.length === 0 && !error ? (
            <div className="harbor-card" style={{ padding: '3rem', textAlign: 'center', gridColumn: '1 / -1' }}>
              <h3 style={{ color: '#1E3A4C', marginBottom: '1rem' }}>No Active Patients</h3>
              <p style={{ color: '#5B8A9A', marginBottom: '1.5rem' }}>You haven't invited any patients yet, or they haven't accepted their magic links.</p>
              <button className="harbor-btn harbor-btn-dark" onClick={() => navigate('/clinician/invite-patient')}>
                Send First Invite
              </button>
            </div>
          ) : (
            patients.map(patient => (
              // We add a dynamic ID here so html2canvas knows exactly what to screenshot
              <div 
                id={`patient-card-${patient._id}`} 
                key={patient._id} 
                className="harbor-card harbor-fade-in" 
                style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fff' }}
              >
                
                <div style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem' }}>
                  <h3 style={{ margin: '0 0 4px', color: '#1E3A4C', fontSize: '22px' }}>{patient.name}</h3>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>{patient.email}</p>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#475569', fontWeight: 'bold' }}>Status:</span>
                  <span style={{ color: patient.inviteToken ? '#D98E5B' : '#10B981', fontWeight: 'bold' }}>
                    {patient.inviteToken ? 'Pending Setup' : 'Active / In Rehab'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '1rem' }}>
                  <span style={{ color: '#475569', fontWeight: 'bold' }}>Latest Metric:</span>
                  <span style={{ color: '#64748B' }}>
                    N-Back (Score: 88)
                  </span>
                </div>

                {/* THE EXPORT BUTTON */}
                <button 
                  className="harbor-btn" 
                  style={{ marginTop: 'auto', background: '#F1F5F9', color: '#1E3A4C', width: '100%', border: '1px solid #CBD5E1', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}
                  onClick={() => exportPDF(patient._id, patient.name)}
                  disabled={isExporting}
                >
                  {/* Small SVG Icon for visual flair */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  {isExporting ? 'Generating...' : 'Download Report (PDF)'}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}