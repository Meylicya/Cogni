import { Router } from 'express'
import { Clinician, Patient } from '../models/index.js'

const router = Router()

// POST /api/clinicians — clinician signup (honor-system attestation)
router.post('/', async (req, res) => {
  try {
    const { email, name, professionalAttestation, authCredentialHash } = req.body
    const clinician = await Clinician.create({
      email,
      name,
      professionalAttestation,
      authCredentialHash,
    })
    res.status(201).json(clinician)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/clinicians/login
// NOTE: matches the existing plaintext-comparison pattern already used in
// patients.js (authCredentialHash is NOT actually hashed anywhere yet —
// this is a known hackathon-scope limitation, not something introduced
// here). Swap for bcrypt.compare() before this goes anywhere real.
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const clinician = await Clinician.findOne({ email })

    if (!clinician || clinician.authCredentialHash !== password) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    res.status(200).json({
      clinician: { id: clinician._id, name: clinician.name, email: clinician.email },
    })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/clinicians/:id
router.get('/:id', async (req, res) => {
  try {
    const clinician = await Clinician.findById(req.params.id).select('-authCredentialHash')
    if (!clinician) return res.status(404).json({ error: 'Clinician not found' })
    res.json(clinician)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/clinicians/:id/patients — a clinician's patient roster
router.get('/:id/patients', async (req, res) => {
  try {
    // TODO: auth middleware — only the clinician themselves should hit this
    const patients = await Patient.find({ clinicianId: req.params.id })
    res.json(patients)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
