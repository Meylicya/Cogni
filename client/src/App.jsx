import PrivacySandbox from './pages/shared/PrivacySandbox.jsx';
import Dashboard from './pages/clinician/Dashboard.jsx';
import Login from './pages/clinician/Login.jsx';
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SessionProvider, useSession } from './context/SessionContext.jsx'
import { SessionEngineProvider } from './context/SessionEngineContext.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import LandingPage from './pages/LandingPage.jsx'
import ClinicianOnboarding from './pages/clinician/ClinicianOnboarding.jsx'
import IntakeForm from './pages/clinician/IntakeForm.jsx'
import PatientInvite from './pages/clinician/PatientInvite.jsx'
import CaregiverAccessGrant from './pages/shared/CaregiverAccessGrant.jsx'
import EvidencePage from './pages/shared/EvidencePage.jsx'
import AcceptInvite from './pages/patient/AcceptInvite.jsx'
import PatientLogin from './pages/patient/PatientLogin.jsx'
import DailySymptomCheckin from './pages/patient/DailySymptomCheckin.jsx'
import CaregiverLogin from './pages/caregiver/CaregiverLogin.jsx'
import CaregiverAcceptInvite from './pages/caregiver/CaregiverAcceptInvite.jsx'
import RehabSessionShell from './games/RehabSessionShell.jsx'

/**
 * GamesRoute — thin wrapper that hands the authenticated patientId to
 * RehabSessionShell. The shell itself reads it from SessionContext
 * (useSessionEngine bootstraps against it), so passing it as a prop is
 * kept for backward compatibility with old call sites.
 */
function GamesRoute() {
  const { patientId } = useSession()
  return <RehabSessionShell patientId={patientId} />
}

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <SessionEngineProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route path="/login" element={<Login />} />
            <Route path="/clinician/signup" element={<ClinicianOnboarding />} />
            <Route
              path="/clinician/intake"
              element={<RequireAuth role="clinician"><IntakeForm /></RequireAuth>}
            />
            <Route
              path="/clinician/invite-patient"
              element={<RequireAuth role="clinician"><PatientInvite /></RequireAuth>}
            />
            <Route
              path="/clinician/caregiver-access"
              element={<RequireAuth role="clinician"><CaregiverAccessGrant /></RequireAuth>}
            />

            <Route path="/patient/login" element={<PatientLogin />} />
            <Route
              path="/patient/checkin"
              element={<RequireAuth role="patient"><DailySymptomCheckin /></RequireAuth>}
            />

            <Route path="/caregiver/login" element={<CaregiverLogin />} />
            <Route path="/caregiver-invite/:token" element={<CaregiverAcceptInvite />} />

            <Route path="/evidence" element={<EvidencePage />} />
            <Route
              path="/games"
              element={<RequireAuth role="patient"><GamesRoute /></RequireAuth>}
            />
            <Route path="/invite/:token" element={<AcceptInvite />} />

            <Route
              path="/dashboard"
              element={<RequireAuth role={['clinician', 'caregiver']}><Dashboard /></RequireAuth>}
            />
            <Route
              path="/privacy-sandbox"
              element={<RequireAuth role="clinician"><PrivacySandbox /></RequireAuth>}
            />
          </Routes>
        </SessionEngineProvider>
      </BrowserRouter>
    </SessionProvider>
  )
}

export default App
