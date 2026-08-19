/**
 * requireAuthLookups.js — default model lookups used by requireAuth.
 *
 * Pulled out of requireAuth.js so the middleware can be unit-tested
 * without monkey-patching mongoose at import time. Tests pass an
 * override `lookups` object via the requireAuth({ lookups }) option.
 */

import { Patient, CaregiverPatientLink } from '../models/index.js'

export async function findPatientById(id) {
  return Patient.findById(id).select('clinicianId')
}

export async function findCaregiverLink(caregiverId, patientId) {
  return CaregiverPatientLink.findOne({ caregiverId, patientId }).select('_id')
}
