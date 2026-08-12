import { Router } from 'express'
import { SymptomCheckin } from '../models/index.js'

const router = Router()

// POST /api/symptom-checkins — daily check-in (one per patient per day)
router.post('/', async (req, res) => {
  try {
    const {
      patientId,
      cognitiveScore,
      physicalScore,
      emotionalScore,
      sleepScore,
      communicationScore,
      checkinDate, // 'YYYY-MM-DD'
    } = req.body

    const checkin = await SymptomCheckin.create({
      patientId,
      cognitiveScore,
      physicalScore,
      emotionalScore,
      sleepScore,
      communicationScore: communicationScore ?? null,
      checkinDate: checkinDate || new Date().toISOString().slice(0, 10),
    })
    res.status(201).json(checkin)
  } catch (err) {
    // Duplicate key error = already checked in today
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Check-in already submitted for this date' })
    }
    res.status(400).json({ error: err.message })
  }
})

// GET /api/symptom-checkins/patient/:patientId — trend data for the dashboard
router.get('/patient/:patientId', async (req, res) => {
  try {
    const checkins = await SymptomCheckin.find({ patientId: req.params.patientId }).sort({
      checkinDate: 1,
    })
    res.json(checkins)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router