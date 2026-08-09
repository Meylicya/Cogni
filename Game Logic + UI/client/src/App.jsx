import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RehabSessionShell from './games/RehabSessionShell.jsx';

// Updated paths to pull from the Dashboards + UI folder
import IntakeForm from '../../../Dashboards + UI/src/pages/clinician/IntakeForm.jsx';
import ClinicianOnboarding from '../../../Dashboards + UI/src/pages/clinician/ClinicianOnboarding.jsx';
import PatientInvite from '../../../Dashboards + UI/src/pages/clinician/PatientInvite.jsx';
import CaregiverAccessGrant from '../../../Dashboards + UI/src/pages/shared/CaregiverAccessGrant.jsx';
import EvidencePage from '../../../Dashboards + UI/src/pages/shared/EvidencePage.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <div style={{ padding: '2rem' }}>
            <h1>Rehab App — home</h1>
            <a href="/intake" style={{ display: 'block', marginTop: '1rem' }}>Go to Clinician Intake Form</a>
            <a href="/clinician-signup" style={{ display: 'block', marginTop: '1rem' }}>Go to Clinician Signup</a>
            <a href="/patient-invite" style={{ display: 'block', marginTop: '1rem' }}>Go to Patient Invite</a>
            <a href="/caregiver-grant" style={{ display: 'block', marginTop: '1rem' }}>Go to Caregiver Access Grant</a>
            <a href="/evidence" style={{ display: 'block', marginTop: '1rem' }}>Go to Evidence & Guidelines</a>
          </div>
        } />
        
        <Route path="/intake" element={<IntakeForm />} />
        <Route path="/clinician-signup" element={<ClinicianOnboarding />} />
        <Route path="/patient-invite" element={<PatientInvite />} />
        <Route path="/caregiver-grant" element={<CaregiverAccessGrant />} />
        <Route path="/evidence" element={<EvidencePage />} />
        
        <Route path="/games" element={<RehabSessionShell />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;