import express from 'express';
import Clinician from '../models/Clinician.js';
import Patient from '../models/Patient.js';
import Caregiver from '../models/Caregiver.js';

// HACKATHON DEMO BACKDOOR
// -----------------------
// This route is a deliberate bypass for the patient/clinician invite +
// signup + login flow when the demo clock is too tight to actually run
// it live. The root cause of "patient credentials are always wrong" was
// that an earlier version of /api/patients POST wrote to `password`
// instead of `authCredentialHash`; any Patient record created before
// that bugfix shipped has a null hash and can never log in. Rather than
// debug each existing record on stage, this endpoint seeds a brand-new
// clinician + patient + caregiver triple with a known password so the
// frontend can auto-login and the demo just works.
//
// DOUBLE-GATED so it can't ship by accident:
//   1. NODE_ENV must NOT be 'production' (so it never runs in prod)
//   2. process.env.HACKATHON_DEMO === '1' (opt-in flag)
//
// Both checks are evaluated at request time, not module load, so you
// can flip the env var and restart the server to re-enable without a
// code change. The route is mounted directly from server/index.js
// rather than from routes/index.js so it stays visibly separate from
// the real auth surface.

const router = express.Router();

function demoEnabled() {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.HACKATHON_DEMO === '1';
}

const DEMO_PASSWORD = 'demo1234';

// Fixed emails make the seed idempotent-ish: we always remove the prior
// demo record before re-inserting, so repeat clicks during one demo
// run don't trip the unique-email index.
const DEMO_CLINICIAN = {
  email: 'demo.clinician@harbor.dev',
  name: 'Dr. Demo Clinician',
};
const DEMO_PATIENT = {
  email: 'demo.patient@harbor.dev',
  name: 'Demo Patient',
};
const DEMO_CAREGIVER = {
  email: 'demo.caregiver@harbor.dev',
  name: 'Demo Caregiver',
};

// 404 message used when the gate is closed. Same shape the rest of the
// API uses (we still return 404, not 403, so a prod-only deploy doesn't
// reveal that the endpoint exists).
const GATED_OUT = { message: 'Not found' };

router.post('/bootstrap', async (req, res) => {
  if (!demoEnabled()) return res.status(404).json(GATED_OUT);

  try {
    // Drop any prior demo records so this is safe to spam during a demo.
    // findOneAndDelete is atomic per call; we run them in parallel.
    await Promise.all([
      Clinician.findOneAndDelete({ email: DEMO_CLINICIAN.email }),
      Patient.findOneAndDelete({ email: DEMO_PATIENT.email }),
      Caregiver.findOneAndDelete({ email: DEMO_CAREGIVER.email }),
    ]);

    const clinician = await Clinician.create({
      ...DEMO_CLINICIAN,
      authCredentialHash: DEMO_PASSWORD,
      professionalAttestation: true,
    });

    // Patient picks up a tier 3 + language flag so the games have
    // something interesting to show (e.g. speech module visible) without
    // the demo runner having to click through intake first.
    const patient = await Patient.create({
      ...DEMO_PATIENT,
      clinicianId: clinician._id,
      authCredentialHash: DEMO_PASSWORD,
      inviteToken: null,
      difficultyTier: 3,
      languageSymptomsFlagged: true,
      status: 'active',
    });

    const caregiver = await Caregiver.create({
      ...DEMO_CAREGIVER,
      authCredentialHash: DEMO_PASSWORD,
    });

    return res.status(200).json({
      message: 'Demo records seeded.',
      password: DEMO_PASSWORD,
      clinician: { id: clinician._id, email: clinician.email, name: clinician.name },
      patient: { id: patient._id, email: patient.email, name: patient.name },
      caregiver: { id: caregiver._id, email: caregiver.email, name: caregiver.name },
    });
  } catch (error) {
    console.error('Demo Bootstrap Error:', error);
    return res.status(500).json({ message: 'Demo bootstrap failed.' });
  }
});

// Lightweight liveness probe so the frontend can decide whether to show
// the demo panel at all (avoids surfacing a button that 404s when the
// server isn't running the demo build). Also gated, so it returns 404
// in prod just like /bootstrap.
router.get('/status', (req, res) => {
  if (!demoEnabled()) return res.status(404).json(GATED_OUT);
  return res.json({ enabled: true });
});

export default router;
