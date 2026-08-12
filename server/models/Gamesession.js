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
  // Client-side AES-GCM ciphertext of { accuracy, avgLatencyMs, errorType }.
  // The server never sees these values in plaintext — decryption only
  // happens client-side (patient app or, later, an authorized caregiver/
  // clinician dashboard holding the matching key). See client/src/sync/
  // webCrypto.js for the encrypt/decrypt implementation and its
  // documented key-management limitations.
  encryptedScores: {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
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