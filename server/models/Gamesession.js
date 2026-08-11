import mongoose from 'mongoose'

const gameSessionSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
  },
  // 'n-back' / 'sequence-recall' / 'reaction-attention' / 'speech-word-finding'
  gameId: {
    type: String,
    required: true,
  },
  difficultyLevel: {
    type: Number,
    required: true,
  },
  accuracy: {
    type: Number, // round summary, 0–1
    required: true,
  },
  avgLatencyMs: {
    type: Number,
    required: true,
  },
  completedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
})

gameSessionSchema.index({ patientId: 1, completedAt: -1 })
gameSessionSchema.index({ patientId: 1, gameId: 1, completedAt: -1 })

export default mongoose.model('GameSession', gameSessionSchema)