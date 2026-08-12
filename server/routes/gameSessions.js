import { Router } from 'express'
import { GameSession } from '../models/index.js'

const router = Router()

// POST /api/game-sessions — THE SYNC LAYER ENTRY POINT.
//
// Person 1's games emit patient-agnostic GameSessionEvent objects (no
// patientId baked in, per eventSchema.js). The client-side sync layer is
// responsible for:
//   1. Injecting the authenticated patient's ID
//   2. Encrypting the score payload client-side (Web Crypto / AES-GCM)
//      before it ever hits this endpoint
// This route just persists whatever arrives — it should NOT be doing the
// patientId injection itself, that happens client-side per the design notes.
// TODO: once auth exists, cross-check req.body.patientId against the
// authenticated session instead of trusting the body outright.
router.post('/', async (req, res) => {
  try {
    const { patientId, gameId, difficultyLevel, completedAt, encryptedScores } = req.body

    if (!encryptedScores || !encryptedScores.ciphertext || !encryptedScores.iv) {
      return res.status(400).json({
        error: 'encryptedScores.ciphertext and encryptedScores.iv are required — this endpoint no longer accepts plaintext scores',
      })
    }

    const session = await GameSession.create({
      patientId,
      gameId,
      difficultyLevel,
      encryptedScores,
      completedAt: completedAt || Date.now(),
    })
    res.status(201).json(session)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/game-sessions/patient/:patientId — dashboard trend data,
// optionally filtered by gameId (?gameId=n-back)
router.get('/patient/:patientId', async (req, res) => {
  try {
    const query = { patientId: req.params.patientId }
    if (req.query.gameId) query.gameId = req.query.gameId

    const sessions = await GameSession.find(query).sort({ completedAt: 1 })
    res.json(sessions)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router