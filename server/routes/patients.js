import express from 'express';
import crypto from 'crypto';
import Patient from '../models/Patient.js';
import { sendPatientInviteEmail } from '../utils/mailer.js';
import { requireAuth } from '../middleware/requireAuth.js';

// router inizialization before its usage 
const router = express.Router();

// 1. ENDPOINT TO SEND THE INVITE (Triggered by Clinician)
//
// IntakeForm.jsx computes a starting difficultyTier and languageSymptomsFlagged
// BEFORE the patient exists. The clinician's PatientInvite form forwards
// them as optional fields here; if present, we stamp them onto the new
// Patient record on creation so the patient's first /session-context
// fetch already reflects the clinician's assessment. Missing fields are
// fine — the Patient schema's defaults (tier 1, languageSymptomsFlagged
// false) kick in. This is the seam that closes the bug where intake
// values were computed, console.log'd, and silently dropped.
router.post('/invite', async (req, res) => {
  try {
    const { email, name, clinicianId, difficultyTier, languageSymptomsFlagged } = req.body;

    const inviteToken = crypto.randomBytes(16).toString('hex');

    const patientFields = {
      email,
      name: name || 'Pending Patient',
      clinicianId,
      inviteToken,
    };

    // Only override the schema defaults when the client actually sent a
    // value — avoids accidental write of `undefined` over a meaningful
    // existing field if this route ever gets reused to update existing
    // records (it doesn't today, but defensive).
    if (Number.isInteger(difficultyTier) && difficultyTier >= 1 && difficultyTier <= 5) {
      patientFields.difficultyTier = difficultyTier;
    }
    if (typeof languageSymptomsFlagged === 'boolean') {
      patientFields.languageSymptomsFlagged = languageSymptomsFlagged;
    }

    const newPatient = new Patient(patientFields);

    await newPatient.save();

    const emailSent = await sendPatientInviteEmail(email, name, inviteToken);

    if (!emailSent) {
      return res.status(500).json({ message: 'Patient saved, but email failed to send.' });
    }

    res.status(200).json({ message: 'Invite sent successfully!' });
  } catch (error) {
    console.error('Invite Error:', error);
    res.status(500).json({ message: 'Internal server error during invite.' });
  }
});

// 2. ENDPOINT TO ACCEPT THE INVITE (Triggered by Patient clicking the link)
router.post('/', async (req, res) => {
  try {
    const { name, password, inviteToken } = req.body;

    const patient = await Patient.findOne({ inviteToken });

    if (!patient) {
      return res.status(404).json({ message: 'Invalid or expired invite link.' });
    }

    patient.name = name;
    patient.password = password; // Note: In a production app, we would hash this with bcrypt!
    patient.inviteToken = null;
    
    await patient.save();

    res.status(200).json({ message: 'Account finalized successfully!' });
  } catch (error) {
    console.error('Accept Invite Error:', error);
    res.status(500).json({ message: 'Internal server error during account setup.' });
  }
});

// 3. ENDPOINT TO LOG IN (returning patient, after accept-invite has set a password)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const patient = await Patient.findOne({ email });

    if (!patient || !patient.password || patient.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (patient.inviteToken) {
      return res.status(403).json({ message: 'Please finish setting up your account first.' });
    }

    res.status(200).json({
      patient: { id: patient._id, name: patient.name, email: patient.email },
    });
  } catch (error) {
    console.error('Patient Login Error:', error);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});

// 4. MINIMAL SESSION CONTEXT
//
// requireAuth allows the patient themselves, the owning clinician, or any
// caregiver linked to this patient. See middleware/requireAuth.js for the
// rule table. Without this gate the ZPD-tier signal leaks to anyone who
// can guess/observe a patientId — see CLAUDE.md privacy boundary notes.
router.get('/:id/session-context', requireAuth({ resource: 'patient-resource' }), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id, 'difficultyTier languageSymptomsFlagged');
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json({
      difficultyTier: patient.difficultyTier,
      languageSymptomsFlagged: patient.languageSymptomsFlagged,
    });
  } catch (error) {
    console.error('Session Context Error:', error);
    res.status(500).json({ message: 'Internal server error fetching session context.' });
  }
});

export default router;
