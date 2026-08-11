import mongoose from 'mongoose'

const caregiverSchema = new mongoose.Schema(
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
    authCredentialHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

export default mongoose.model('Caregiver', caregiverSchema)