import { BrowserRouter, Routes, Route } from 'react-router-dom'
import RehabSessionShell from './games/RehabSessionShell.jsx'

import EvidencePage from './pages/shared/EvidencePage.jsx';
import CaregiverAccessGrant from './pages/shared/CaregiverAccessGrant.jsx';
import PatientInvite from './pages/clinician/PatientInvite.jsx';
import ClinicianOnboarding from './pages/clinician/ClinicianOnboarding.jsx';
import IntakeForm from './pages/clinician/IntakeForm.jsx'

// Person 3: dashboard + privacy sandbox
// import Dashboard from './dashboard/Dashboard.jsx'
// import PrivacySandbox from './privacy-sandbox/PrivacySandbox.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The Home menu to help you navigate your components */}
        <Route path="/" element={
          <div style={{ padding: '2rem' }}>
            <h1>Rehab App — home</h1>
            <a href="/intake" style={{ display: 'block', marginTop: '1rem' }}>Go to Clinician Intake Form</a>
            <a href="/clinician-signup" style={{ display: 'block', marginTop: '1rem' }}>Go to Clinician Signup</a>
            <a href="/patient-invite" style={{ display: 'block', marginTop: '1rem' }}>Go to Patient Invite</a>
            <a href="/caregiver-access" style={{ display: 'block', marginTop: '1rem' }}>Go to Caregiver Access Grant</a>
            <a href="/evidence" style={{ display: 'block', marginTop: '1rem' }}>Go to Evidence & Guidelines</a>
          </div>
        } />
        
        {/* Your Person 4 Routes */}
        <Route path="/intake" element={<IntakeForm />} />
        <Route path="/clinician-signup" element={<ClinicianOnboarding />} />
        <Route path="/patient-invite" element={<PatientInvite />} />
        <Route path="/caregiver-access" element={<CaregiverAccessGrant />} />
        <Route path="/evidence" element={<EvidencePage />} />
        {/* Person 1's Routes */}
        <Route path="/games" element={<RehabSessionShell />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App