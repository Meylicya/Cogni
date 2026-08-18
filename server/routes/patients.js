import express from 'express';
import crypto from 'crypto';
import Patient from '../models/Patient.js';
import { sendPatientInviteEmail } from '../utils/mailer.js';

// router inizialization before its usage 
const router = express.Router();

// 1. ENDPOINT TO SEND THE INVITE (Triggered by Clinician)
router.post('/invite', async (req, res) => {
  try {
    const { email, name, clinicianId } = req.body;

    const inviteToken = crypto.randomBytes(16).toString('hex');

    const newPatient = new Patient({
      email,
      name: name || 'Pending Patient',
      clinicianId,
      inviteToken
    });
    
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
router.get('/:id/session-context', async (req, res) => {
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
