import mongoose from 'mongoose'

const clinicianSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Honor-system checkbox — hackathon scope, no real identity verification
    professionalAttestation: {
      type: Boolean,
      required: true,
      default: false,
    },
    authCredentialHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

export default mongoose.model('Clinician', clinicianSchema)