import mongoose from 'mongoose'

const intakeRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    // Drives the acute-phase (<48hr) safety gate — Person 4's logic reads this
    injuryTimestamp: {
      type: Date,
      required: true,
    },
    // Structured Q&A answers from the intake form — kept flexible since
    // Person 4 owns the exact question set
    reportedSymptoms: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Sets patient.languageSymptomsFlagged
    languageDifficultyReported: {
      type: Boolean,
      default: false,
    },
    // Encrypted at rest per the Responsible AI architecture (Section 3) —
    // intake data is sensitive medical history, never used beyond exercises
    // without explicit consent
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

intakeRecordSchema.index({ patientId: 1, createdAt: -1 })

export default mongoose.model('IntakeRecord', intakeRecordSchema)