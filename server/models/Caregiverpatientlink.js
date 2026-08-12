import mongoose from 'mongoose'

// Join table for the many-to-many Caregiver <-> Patient relationship.
// IMPORTANT (Responsible AI / access control): links must be GRANTED, not
// self-assigned. Only create these documents from a clinician- or
// patient-approved flow (Person 4's access-grant endpoint) — never expose
// a route that lets a caregiver link themselves to a patient.
const caregiverPatientLinkSchema = new mongoose.Schema(
  {
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver',
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    // e.g. 'parent', 'spouse' — for dashboard display only
    relationshipLabel: {
      type: String,
      default: null,
    },
    // Who approved this link — a Clinician or the Patient themselves
    accessGrantedByModel: {
      type: String,
      required: true,
      enum: ['Clinician', 'Patient'],
    },
    accessGrantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'accessGrantedByModel',
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

// A given caregiver should only be linked once to a given patient
caregiverPatientLinkSchema.index({ caregiverId: 1, patientId: 1 }, { unique: true })
caregiverPatientLinkSchema.index({ patientId: 1 })

export default mongoose.model('CaregiverPatientLink', caregiverPatientLinkSchema)