import { Router } from 'express'
import { Caregiver, CaregiverPatientLink } from '../models/index.js'

const router = Router()

// POST /api/caregivers — caregiver account creation
router.post('/', async (req, res) => {
  try {
    const { email, name, authCredentialHash } = req.body
    const caregiver = await Caregiver.create({ email, name, authCredentialHash })
    res.status(201).json(caregiver)
  } catch (err) {
    res.status(400).json({ error: err.message })
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