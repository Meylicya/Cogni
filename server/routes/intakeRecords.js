import { Router } from 'express'
import { IntakeRecord, Patient } from '../models/index.js'

const router = Router()

// POST /api/intake-records — Person 4's intake form submits here.
// Also updates the patient's languageSymptomsFlagged + safety-gate status.
router.post('/', async (req, res) => {
  try {
    // TODO: auth middleware — clinician-only route
    const { patientId, injuryTimestamp, reportedSymptoms, languageDifficultyReported } = req.body

    const intake = await IntakeRecord.create({
      patientId,
      injuryTimestamp,
      reportedSymptoms,
      languageDifficultyReported,
    })

    // Safety gate: block cognitive exercises if within 48hrs of injury
    const hoursSinceInjury = (Date.now() - new Date(injuryTimestamp).getTime()) / 36e5
    const isAcutePhase = hoursSinceInjury < 48

    await Patient.findByIdAndUpdate(patientId, {
      languageSymptomsFlagged: !!languageDifficultyReported,
      status: isAcutePhase ? 'acute_phase_blocked' : 'active',
    })

    res.status(201).json(intake)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/intake-records/patient/:patientId — history for one patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const records = await IntakeRecord.find({ patientId: req.params.patientId }).sort({
      createdAt: -1,
    })
    res.json(records)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router