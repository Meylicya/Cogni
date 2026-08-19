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
  // Plaintext clinical scores by design — gated at the route layer by
  // requireAuth({ resource: 'patient-scores' }). See server/routes/
  // gameSessions.js. The privacy boundary for biometric / sensor data
  // (webcam, PPG, audio) remains on-device; see client/src/pages/shared/
  // PrivacySandbox.jsx for the network-telemetry proof panel.
  accuracy: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
  avgLatencyMs: {
    type: Number,
    required: true,
    min: 0,
  },
  errorType: {
    type: String,
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