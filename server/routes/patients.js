import express from 'express';
import crypto from 'crypto';
import Patient from '../models/Patient.js';
import { sendPatientInviteEmail } from '../utils/mailer.js';

const router = express.Router();

// 1. ENDPOINT TO SEND THE INVITE (Triggered by Clinician)
router.post('/invite', async (req, res) => {
  try {
    const { email, name, clinicianId } = req.body;

    // Generate a secure 32-character random token for the magic link
    const inviteToken = crypto.randomBytes(16).toString('hex');

    // Create a pending patient record in the database
    const newPatient = new Patient({
      email,
      name: name || 'Pending Patient',
      clinicianId,
      inviteToken
    });
    
    await newPatient.save();

    // Fire off the email using our Nodemailer utility
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

    // Find the patient in the database using the unique token from the URL
    const patient = await Patient.findOne({ inviteToken });

    if (!patient) {
      return res.status(404).json({ message: 'Invalid or expired invite link.' });
    }

    // Update the patient's details
    patient.name = name;
    patient.password = password; // Note: In a production app, we would hash this with bcrypt!
    patient.inviteToken = null; // Clear the token so the link cannot be used twice
    
    await patient.save();

    res.status(200).json({ message: 'Account finalized successfully!' });
  } catch (error) {
    console.error('Accept Invite Error:', error);
    res.status(500).json({ message: 'Internal server error during account setup.' });
  }
});

export default router;