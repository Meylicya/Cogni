import PrivacySandbox from './pages/shared/PrivacySandbox.jsx';
import Dashboard from './pages/clinician/Dashboard.jsx';
import Login from './pages/clinician/Login.jsx';
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SessionProvider, useSession } from './context/SessionContext.jsx'
import LandingPage from './pages/LandingPage.jsx'
import ClinicianOnboarding from './pages/clinician/ClinicianOnboarding.jsx'
import IntakeForm from './pages/clinician/IntakeForm.jsx'
import PatientInvite from './pages/clinician/PatientInvite.jsx'
import CaregiverAccessGrant from './pages/shared/CaregiverAccessGrant.jsx'
import EvidencePage from './pages/shared/EvidencePage.jsx'
import AcceptInvite from './pages/patient/AcceptInvite.jsx'
import RehabSessionShell from './games/RehabSessionShell.jsx'
import Dashboard from './pages/clinician/Dashboard.jsx'
import PrivacySandbox from './pages/clinician/PrivacySandbox.jsx'

/**
 * languageSymptomsFlagged used to arrive as a ?language=1 URL param on
 * this route — that's gone now. RehabSessionShell resolves it internally
 * via startPatientSession(patientId), same call that sets up the ZPD
 * engine. All this route needs to provide is patientId, from
 * SessionContext (see context/SessionContext.jsx — still a dev stub
 * until Person 3 has real auth).
 */
function GamesRoute() {
  const { patientId } = useSession()
  return <RehabSessionShell patientId={patientId} />
}

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          <Route path="/login" element={<Login />} />
          <Route path="/clinician/signup" element={<ClinicianOnboarding />} />
          <Route path="/clinician/intake" element={<IntakeForm />} />
          <Route path="/clinician/invite-patient" element={<PatientInvite />} />
          <Route path="/clinician/caregiver-access" element={<CaregiverAccessGrant />} />

          <Route path="/evidence" element={<EvidencePage />} />
          <Route path="/games" element={<GamesRoute />} />
          <Route path="/invite/:token" element={<AcceptInvite />} />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/privacy-sandbox" element={<PrivacySandbox />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}

export default App
