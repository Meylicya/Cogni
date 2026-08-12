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