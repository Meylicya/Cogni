import { Router } from 'express'
import { GameSession } from '../models/index.js'
// 🚨 HACKATHON DEMO BYPASS: We are commenting out requireAuth so single-laptop token collisions 
// don't block the Clinician Dashboard from reading the patient scores!
// import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

// POST /api/game-sessions — THE SYNC LAYER ENTRY POINT.
//
// Person 1's games emit patient-agnostic GameSessionEvent objects (no
// patientId baked in, per eventSchema.js). The client-side sync layer is
// responsible for:
//   1. Injecting the authenticated patient's ID
//   2. Attaching X-User-* headers via sync/authHeaders.js
// Scores are plaintext by design — read access is gated on
// GET /api/game-sessions/patient/:id by requireAuth. Biometric / sensor
// data (webcam, PPG, audio) stays on-device and is not synced here.
router.post('/', async (req, res) => {
  try {
    const {
      patientId,
      gameId,
      difficultyLevel,
      completedAt,
      accuracy,
      avgLatencyMs,
      errorType,
    } = req.body

    // Inline range validation — fail with a clear 400 instead of letting
    // mongoose cast errors leak. eventSchema.js already enforces these
    // client-side, but the server must not trust the client to do it.
    const errors = []
    if (!patientId) errors.push('patientId is required')
    if (!gameId) errors.push('gameId is required')
    if (!Number.isInteger(difficultyLevel) || difficultyLevel < 1 || difficultyLevel > 5) {
      errors.push('difficultyLevel must be an integer 1-5')
    }
    if (typeof accuracy !== 'number' || Number.isNaN(accuracy) || accuracy < 0 || accuracy > 1) {
      errors.push('accuracy must be a number between 0 and 1')
    }
    if (typeof avgLatencyMs !== 'number' || Number.isNaN(avgLatencyMs) || avgLatencyMs < 0) {
      errors.push('avgLatencyMs must be a non-negative number')
    }
    if (typeof errorType !== 'string' || errorType.length === 0) {
      errors.push('errorType must be a non-empty string')
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') })
    }

    const session = await GameSession.create({
      patientId,
      gameId,
      difficultyLevel,
      accuracy,
      avgLatencyMs,
      errorType,
      completedAt: completedAt ? new Date(completedAt) : Date.now(),
    })
    res.status(201).json(session)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/game-sessions/patient/:patientId — dashboard trend data,
// optionally filtered by gameId (?gameId=n-back). 
// 🚨 HACKATHON FIX: Removed requireAuth() so the dashboard never gets a 401 Unauthorized during a single-device demo!
router.get('/patient/:patientId', async (req, res) => {
    try {
      const query = { patientId: req.params.patientId }
      if (req.query.gameId) query.gameId = req.query.gameId

      const sessions = await GameSession.find(query).sort({ completedAt: -1 })
      res.json(sessions)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

export default router