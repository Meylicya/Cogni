import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import BackButton from '../../components/BackButton.jsx';
import { useSession } from '../../context/SessionContext.jsx';
import { getAuthHeaders } from '../../sync/authHeaders.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const GAME_LABELS = {
  'n-back': 'N-Back',
  'sequence-recall': 'Sequence Recall',
  'reaction-attention': 'Go / No-Go',
  'speech-word-finding': 'Word Finding',
};

/**
 * Format a completion date for display.
 * @param {string|number|Date|undefined} value
 */
function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Compute dashboard summary metrics from a session list sorted newest-first.
 * Returns null when no sessions exist so the card can render an empty state.
 */
function summarizeSessions(sessions) {
  if (!sessions || sessions.length === 0) return null;
  const latest = sessions[0];
  const accuracySum = sessions.reduce((acc, s) => acc + (s.accuracy ?? 0), 0);
  return {
    latestGameId: latest.gameId,
    latestGameLabel: GAME_LABELS[latest.gameId] || latest.gameId,
    latestAccuracy: latest.accuracy,
    latestLatencyMs: latest.avgLatencyMs,
    latestDifficultyLevel: latest.difficultyLevel,
    latestCompletedAt: latest.completedAt,
    sessionCount: sessions.length,
    avgAccuracy: accuracySum / sessions.length,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { clinicianId, loading: sessionLoading } = useSession();
  const [patients, setPatients] = useState([]);
  const [sessionsByPatient, setSessionsByPatient] = useState({}); // { [patientId]: GameSession[] }
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;

    if (!clinicianId) {
      navigate('/login');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        // /clinicians/:id/patients is gated by server/middleware/requireAuth.js
        // with resource='clinician-roster' — it returns only THIS clinician's
        // roster, so we no longer need the client-side filter that the old
        // /api/patients leak-and-filter approach used. The legacy
        // /api/patients route is being deleted; this is its replacement.
        const response = await fetch(`${API_BASE}/api/clinicians/${clinicianId}/patients`, {
          headers: { ...getAuthHeaders() },
        });

        if (!response.ok) throw new Error('Failed to fetch patient data');

        const myPatients = await response.json();
        setPatients(myPatients);

        // Fan out one session fetch per patient. Each
        // /api/game-sessions/patient/:id is gated by requireAuth({ resource:
        // 'patient-scores' }), so the clinician token authenticates against
        // the allow-list that checks "this patient is owned by this
        // clinician" (see server/middleware/requireAuth.js).
        const sessionResults = await Promise.all(
          myPatients.map(async (p) => {
            try {
              const r = await fetch(`${API_BASE}/api/game-sessions/patient/${p._id}`, {
                headers: { ...getAuthHeaders() },
              });
              if (!r.ok) return [p._id, []];
              const data = await r.json();
              return [p._id, Array.isArray(data) ? data : []];
            } catch {
              return [p._id, []];
            }
          })
        );
        setSessionsByPatient(Object.fromEntries(sessionResults));
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Could not load real data. Make sure the backend is running!");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [clinicianId, sessionLoading, navigate]);

  // THE PRO PDF EXPORT FUNCTION
  const exportPDF = async (patientId, patientName, patientEmail, summary) => {
    setIsExporting(true);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("Cogni Clinical Rehabilitation Report", 20, 20);

      pdf.setFontSize(16);
      pdf.setTextColor(100);
      pdf.text("Patient Information", 20, 35);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(0);
      pdf.text(`Patient Name: ${patientName}`, 20, 45);
      pdf.text(`Contact Email: ${patientEmail}`, 20, 52);
      pdf.text(`Current Status: Active / In Rehab`, 20, 59);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(100);
      pdf.text("Latest Cognitive Metrics", 20, 75);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(0);

      if (summary) {
        const accuracyPct = Math.round(summary.latestAccuracy * 100);
        const avgAccuracyPct = Math.round(summary.avgAccuracy * 100);
        const latencySec = (summary.latestLatencyMs / 1000).toFixed(2);

        pdf.text(`Most Recent Game: ${summary.latestGameLabel}`, 20, 85);
        pdf.text(`Most Recent Score: ${accuracyPct}% accuracy`, 20, 92);
        pdf.text(`Most Recent Latency: ${latencySec}s avg response`, 20, 99);
        pdf.text(`Most Recent Difficulty: Tier ${summary.latestDifficultyLevel} / 5`, 20, 106);
        pdf.text(`Total Sessions Logged: ${summary.sessionCount}`, 20, 113);
        pdf.text(`Average Accuracy: ${avgAccuracyPct}%`, 20, 120);
        pdf.text(`Last Played: ${formatDate(summary.latestCompletedAt)}`, 20, 127);
      } else {
        pdf.text(`Most Recent Game: No sessions yet`, 20, 85);
        pdf.text(`Overall Score: —`, 20, 92);
      }

      pdf.setFontSize(10);
      pdf.setTextColor(150);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 280);

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
      <BackButton to="/" style={{ marginBottom: '1.25rem' }}>
        ← Back to home
      </BackButton>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#1E3A4C', fontFamily: "'Newsreader', serif", fontSize: 32, margin: '0 0 8px' }}>
            Mission Control
          </h2>
          <p style={{ color: '#5B8A9A', fontSize: 16, margin: 0 }}>
            Overview of your active cognitive rehabilitation patients.
          </p>
          <button
            type="button"
            onClick={() => navigate('/privacy-sandbox')}
            style={{
              marginTop: 6,
              padding: 0,
              background: 'none',
              border: 'none',
              color: '#5B8A9A',
              fontSize: 13,
              fontFamily: "'Work Sans', sans-serif",
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            See how patient data is handled →
          </button>
        </div>

        {/* HACKATHON UX FIX: Added a button group for all clinician actions! */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="harbor-btn"
            style={{ background: '#fff', color: '#1E3A4C', border: '1px solid #CBD5E1', padding: '12px 24px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => navigate('/clinician/caregiver-access')}
          >
            + Grant Caregiver Access
          </button>

          <button
            className="harbor-btn harbor-btn-dark"
            onClick={() => navigate('/clinician/invite-patient')}
          >
            + Invite New Patient
          </button>
        </div>
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
            patients.map(patient => {

              const savedLocalName = localStorage.getItem(`patient_name_${patient.email}`);
              const displayName = patient.name || patient.fullName || savedLocalName || 'Registered Patient';

              // Real session data: sessions are sorted newest-first by the
              // server (see server/routes/gameSessions.js). Empty array
              // means the patient exists but hasn't logged a session yet,
              // which is a valid state — the card renders an empty-state
              // rather than faking numbers from localStorage.
              const sessions = sessionsByPatient[patient._id] || [];
              const summary = summarizeSessions(sessions);

              return (
                <div
                  id={`patient-card-${patient._id}`}
                  key={patient._id}
                  className="harbor-card harbor-fade-in"
                  style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fff' }}
                >

                  <div style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem' }}>
                    <h3 style={{ margin: '0 0 4px', color: '#1E3A4C', fontSize: '22px' }}>{displayName}</h3>
                    <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>{patient.email}</p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#475569', fontWeight: 'bold' }}>Status:</span>
                    <span style={{ color: '#10B981', fontWeight: 'bold' }}>
                      Active / In Rehab
                    </span>
                  </div>

                  {summary ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: '#475569', fontWeight: 'bold' }}>Latest Game:</span>
                        <span style={{ color: '#1E3A4C', fontWeight: 'bold' }}>
                          {summary.latestGameLabel}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: '#475569', fontWeight: 'bold' }}>Latest Score:</span>
                        <span style={{ color: '#D98E5B', fontWeight: 'bold' }}>
                          {Math.round(summary.latestAccuracy * 100)}% accuracy
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: '#475569', fontWeight: 'bold' }}>Sessions Logged:</span>
                        <span style={{ color: '#1E3A4C', fontWeight: 'bold' }}>
                          {summary.sessionCount}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: '#475569', fontWeight: 'bold' }}>Avg Accuracy:</span>
                        <span style={{ color: '#1E3A4C', fontWeight: 'bold' }}>
                          {Math.round(summary.avgAccuracy * 100)}%
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '1rem' }}>
                        <span style={{ color: '#475569', fontWeight: 'bold' }}>Last Played:</span>
                        <span style={{ color: '#64748B' }}>
                          {formatDate(summary.latestCompletedAt)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', padding: '0.5rem 0', marginBottom: '1rem' }}>
                      No sessions logged yet.
                    </div>
                  )}

                  <button
                    className="harbor-btn"
                    style={{ marginTop: 'auto', background: '#F1F5F9', color: '#1E3A4C', width: '100%', border: '1px solid #CBD5E1', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}
                    onClick={() => exportPDF(patient._id, displayName, patient.email, summary)}
                    disabled={isExporting}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    {isExporting ? 'Generating...' : 'Download Report (PDF)'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
