import mongoose from 'mongoose'

const patientSchema = new mongoose.Schema(
  {
    clinicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinician',
      required: true,
    },
    // HACKATHON FIX: Person 3 forgot the name field! Added it right here.
    name: {
      type: String,
      trim: true,
      default: 'Unknown Patient'
    },
    // Nullable until the patient completes the invite flow
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    // Magic-link/JWT invite token — nulled after first login
    inviteToken: {
      type: String,
      default: null,
    },
    // Set once the patient logs in with their own credentials
    authCredentialHash: {
      type: String,
      default: null,
    },
    // 1–5, set from intake, adjusted by Person 2's ZPD engine.
    difficultyTier: {
      type: Number,
      min: 1,
      max: 5,
      default: 1,
    },
    // Drives Person 1's speech/word-finding module visibility
    languageSymptomsFlagged: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['pending_invite', 'acute_phase_blocked', 'active'],
      default: 'pending_invite',
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

patientSchema.index({ clinicianId: 1 })

export default mongoose.model('Patient', patientSchema)