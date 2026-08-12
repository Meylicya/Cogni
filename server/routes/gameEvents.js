import { Router } from 'express'
import { GameEvent } from '../models/index.js'

const router = Router()

// POST /api/game-events — optional per-response detail.
// Per the project doc's data-minimization note, consider whether this
// actually needs to be persisted server-side at all, vs. kept
// client-side/ephemeral. Wired up here in case the dashboard ends up
// needing response-level granularity (e.g. an error-type breakdown chart).
router.post('/', async (req, res) => {
  try {
    const { sessionId, accuracy, responseLatencyMs, errorType, timestamp } = req.body
    const event = await GameEvent.create({
      sessionId,
      accuracy,
      responseLatencyMs,
      errorType: errorType ?? null,
      timestamp: timestamp || Date.now(),
    })
    res.status(201).json(event)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/game-events/session/:sessionId
router.get('/session/:sessionId', async (req, res) => {
  try {
    const events = await GameEvent.find({ sessionId: req.params.sessionId }).sort({
      timestamp: 1,
    })
    res.json(events)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router