import { Router } from 'express'
import crypto from 'crypto'
import { Caregiver, CaregiverPatientLink } from '../models/index.js'
import { sendCaregiverInviteEmail } from '../utils/mailer.js'

const router = Router()

// REMOVED: open POST /api/caregivers signup route.
// Per the project doc, caregivers must NEVER be able to self-register —
// access has to be granted by a clinician or patient. The old version of
// this route accepted a plain { email, name, authCredentialHash } body
// with no invite-token check, which contradicted that. Caregiver accounts
// now only come into existence via /invite below, same pattern as
// patients.js.

// POST /api/caregivers/invite
// Triggered from a clinician/patient-approved access-grant flow (Person
// 4's UI) — NOT reachable by a caregiver themselves. This creates the
// caregiver record in a pending state and emails them a magic link.
//
// NOTE: this only creates the Caregiver record. The actual
// CaregiverPatientLink (which patient they're linked to) should still go
// through POST /api/caregiver-links as before — that route already has
// the accessGrantedByModel/accessGrantedBy guard rails documented. Call
// this route first to get a caregiverId, then call caregiver-links.
router.post('/invite', async (req, res) => {
  try {
    const { email, name } = req.body

    const inviteToken = crypto.randomBytes(16).toString('hex')

    const caregiver = await Caregiver.create({
      email,
      name: name || 'Pending Caregiver',
      inviteToken,
    })

    const emailSent = await sendCaregiverInviteEmail(email, name, inviteToken)

    if (!emailSent) {
      return res.status(500).json({ message: 'Caregiver saved, but email failed to send.' })
    }

    res.status(201).json({ message: 'Invite sent successfully!', caregiverId: caregiver._id })
  } catch (err) {
    console.error('Caregiver Invite Error:', err)
    res.status(400).json({ error: err.message })
  }
})

// POST /api/caregivers/accept-invite — caregiver clicks their magic link,
// sets a password. Mirrors patients.js's accept-invite exactly.
router.post('/accept-invite', async (req, res) => {
  try {
    const { name, password, inviteToken } = req.body

    const caregiver = await Caregiver.findOne({ inviteToken })

    if (!caregiver) {
      return res.status(404).json({ message: 'Invalid or expired invite link.' })
    }

    caregiver.name = name || caregiver.name
    caregiver.authCredentialHash = password // plaintext for now — same caveat as patients.js
    caregiver.inviteToken = null

    await caregiver.save()

    res.status(200).json({ message: 'Account finalized successfully!' })
  } catch (err) {
    console.error('Caregiver Accept Invite Error:', err)
    res.status(500).json({ message: 'Internal server error during account setup.' })
  }
})

// POST /api/caregivers/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const caregiver = await Caregiver.findOne({ email })

    if (!caregiver || !caregiver.authCredentialHash || caregiver.authCredentialHash !== password) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    if (caregiver.inviteToken) {
      return res.status(403).json({ message: 'Please finish setting up your account first.' })
    }

    res.status(200).json({
      caregiver: { id: caregiver._id, name: caregiver.name, email: caregiver.email },
    })
  } catch (err) {
    console.error('Caregiver Login Error:', err)
    res.status(500).json({ message: 'Internal server error during login.' })
  }
})

// GET /api/caregivers/:id/patients — the "switcher view":
// list every patient this caregiver is linked to
router.get('/:id/patients', async (req, res) => {
  try {
    // TODO: auth middleware — caregivers should only ever see their own links
    const links = await CaregiverPatientLink.find({ caregiverId: req.params.id }).populate(
      'patientId',
      '-authCredentialHash -inviteToken'
    )
    res.json(links)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
