import { Router } from 'express'
import clinicianRoutes from './clinicians.js'
import patientRoutes from './patients.js'
import intakeRecordRoutes from './intakeRecords.js'
import symptomCheckinRoutes from './symptomCheckins.js'
import gameSessionRoutes from './gameSessions.js'
import gameEventRoutes from './gameEvents.js'
import caregiverRoutes from './caregivers.js'
import caregiverPatientLinkRoutes from './caregiverPatientLinks.js'

const router = Router()

router.use('/clinicians', clinicianRoutes)
router.use('/patients', patientRoutes)
router.use('/intake-records', intakeRecordRoutes)
router.use('/symptom-checkins', symptomCheckinRoutes)
router.use('/game-sessions', gameSessionRoutes)
router.use('/game-events', gameEventRoutes)
router.use('/caregivers', caregiverRoutes)
router.use('/caregiver-links', caregiverPatientLinkRoutes)

export default router