import { Router } from 'express'
import { CaregiverPatientLink } from '../models/index.js'

const router = Router()

// POST /api/caregiver-links — grant a caregiver access to a patient.
//
// IMPORTANT: this must only ever be reachable from a clinician- or
// patient-approved flow (Person 4's access-grant UI). There should be NO
// route anywhere that lets a caregiver create a link to themselves — that
// was called out explicitly as a deliberate access-control decision in the
// project doc. TODO: auth middleware should verify req.user is either the
// clinician on the patient's record or the patient themselves before this
// runs, and that accessGrantedBy actually matches the authenticated user.
router.post('/', async (req, res) => {
  try {
    const { caregiverId, patientId, relationshipLabel, accessGrantedByModel, accessGrantedBy } =
      req.body

    if (!['Clinician', 'Patient'].includes(accessGrantedByModel)) {
      return res.status(400).json({ error: 'accessGrantedByModel must be Clinician or Patient' })
    }

    const link = await CaregiverPatientLink.create({
      caregiverId,
      patientId,
      relationshipLabel: relationshipLabel ?? null,
      accessGrantedByModel,
      accessGrantedBy,
    })
    res.status(201).json(link)
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'This caregiver is already linked to this patient' })
    }
    res.status(400).json({ error: err.message })
  }
})

// DELETE /api/caregiver-links/:id — revoke access
router.delete('/:id', async (req, res) => {
  try {
    // TODO: auth middleware — clinician or patient only, same rule as above
    const link = await CaregiverPatientLink.findByIdAndDelete(req.params.id)
    if (!link) return res.status(404).json({ error: 'Link not found' })
    res.status(204).send()
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router