import { BrowserRouter, Routes, Route } from 'react-router-dom'
import RehabSessionShell from './games/RehabSessionShell.jsx'

// Person 3: dashboard + privacy sandbox
// import Dashboard from './dashboard/Dashboard.jsx'
// import PrivacySandbox from './privacy-sandbox/PrivacySandbox.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Rehab App — home</div>} />
        <Route path="/games" element={<RehabSessionShell />} />
        {/* <Route path="/dashboard" element={<Dashboard />} /> */}
        {/* <Route path="/privacy-sandbox" element={<PrivacySandbox />} /> */}
      </Routes>
    </BrowserRouter>
  )
}

export default App
