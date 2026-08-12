import { Router } from 'express'
import { Patient } from '../models/index.js'

const router = Router()

// POST /api/patients — clinician creates a patient record (pre-invite)
router.post('/', async (req, res) => {
  try {
    // TODO: auth middleware — clinician-only route
    const { clinicianId, difficultyTier, languageSymptomsFlagged } = req.body
    const patient = await Patient.create({
      clinicianId,
      difficultyTier,
      languageSymptomsFlagged,
      status: 'pending_invite',
    })
    res.status(201).json(patient)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/patients/:id
router.get('/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).select('-authCredentialHash -inviteToken')
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    res.json(patient)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// PATCH /api/patients/:id — update clinical parameters (difficultyTier, status, etc.)
// Caregivers must NEVER be able to hit this — read-only per the access-control design.
router.patch('/:id', async (req, res) => {
  try {
    // TODO: auth middleware — clinician-only, enforce here once auth exists:
    // if (req.user.role !== 'clinician') return res.status(403).json({ error: 'Forbidden' })
    const allowedFields = ['difficultyTier', 'languageSymptomsFlagged', 'status', 'email']
    const updates = {}
    for (const field of allowedFields) {
      if (field in req.body) updates[field] = req.body[field]
    }
    const patient = await Patient.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).select('-authCredentialHash -inviteToken')
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    res.json(patient)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router