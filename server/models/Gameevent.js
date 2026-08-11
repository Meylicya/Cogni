import mongoose from 'mongoose'

// Optional, per-response granularity. The project doc flags this as a
// candidate to keep client-side/ephemeral only for data minimization —
// persist server-side only if the dashboard actually needs response-level
// detail beyond the GameSession round summary.
const gameEventSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameSession',
    required: true,
  },
  accuracy: {
    type: Number, // 0 or 1
    required: true,
    min: 0,
    max: 1,
  },
  responseLatencyMs: {
    type: Number,
    required: true,
  },
  errorType: {
    type: String,
    default: null,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
})

gameEventSchema.index({ sessionId: 1, timestamp: 1 })

export default mongoose.model('GameEvent', gameEventSchema)