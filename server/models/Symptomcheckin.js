import mongoose from 'mongoose'

const scoreField = {
  type: Number,
  min: 0,
  max: 6,
}

const symptomCheckinSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
  },
  cognitiveScore: { ...scoreField, required: true },
  physicalScore: { ...scoreField, required: true },
  emotionalScore: { ...scoreField, required: true },
  sleepScore: { ...scoreField, required: true },
  // Only present if languageSymptomsFlagged is true
  communicationScore: { ...scoreField, default: null },
  // One check-in per patient per day
  checkinDate: {
    type: String, // store as 'YYYY-MM-DD' for simple uniqueness + querying
    required: true,
  },
})

symptomCheckinSchema.index({ patientId: 1, checkinDate: 1 }, { unique: true })

export default mongoose.model('SymptomCheckin', symptomCheckinSchema)