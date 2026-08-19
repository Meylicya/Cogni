/**
 * requireAuth.test.js
 *
 * Plain node test next to the middleware (matches the project convention
 * used by nbackEngine.test.js). We exercise the middleware against a
 * hand-built req/res pair rather than spinning up a real Express app —
 * that keeps the test focused on the auth rules, not on Express
 * plumbing. The model lookups are stubbed via the `lookups` injection
 * point on requireAuth (see requireAuth.js for rationale).
 *
 * Coverage:
 *   - clinician-roster:  match, mismatch (id), role mismatch, missing headers
 *   - caregiver-roster:  match, mismatch (id), role mismatch
 *   - patient-resource:  patient-self, owning clinician, linked caregiver,
 *                        unlinked caregiver, wrong-role patient, missing patient
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { requireAuth } from './requireAuth.js'

function makeLookupsStub({ patient = null, link = null, calls } = {}) {
  return {
    findPatientById: async (id) => {
      calls?.findPatientById.push(id)
      return patient && String(patient._id) === String(id) ? patient : null
    },
    findCaregiverLink: async (caregiverId, patientId) => {
      calls?.findCaregiverLink.push({ caregiverId, patientId })
      return link &&
        String(link.caregiverId) === String(caregiverId) &&
        String(link.patientId) === String(patientId)
        ? link
        : null
    },
  }
}

function makeReq({ id, userId, userRole }) {
  const headers = {}
  if (userId !== undefined) headers['x-user-id'] = userId
  if (userRole !== undefined) headers['x-user-role'] = userRole
  return {
    params: { id },
    header(name) {
      // Express lowercases incoming header names; mirror that.
      return headers[name.toLowerCase()]
    },
  }
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
}

// ----------------- clinician-roster -----------------

test('clinician-roster: matching X-User-Id + clinician role passes through', async () => {
  const mw = requireAuth({ resource: 'clinician-roster' })
  const req = makeReq({ id: 'clin-1', userId: 'clin-1', userRole: 'clinician' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 1)
  assert.equal(res.statusCode, 200)
})

test('clinician-roster: wrong userId is forbidden', async () => {
  const mw = requireAuth({ resource: 'clinician-roster' })
  const req = makeReq({ id: 'clin-1', userId: 'clin-2', userRole: 'clinician' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 0)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error, 'forbidden')
})

test('clinician-roster: wrong role is forbidden', async () => {
  const mw = requireAuth({ resource: 'clinician-roster' })
  const req = makeReq({ id: 'pat-1', userId: 'pat-1', userRole: 'patient' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 0)
  assert.equal(res.statusCode, 403)
})

test('clinician-roster: missing headers is 401', async () => {
  const mw = requireAuth({ resource: 'clinician-roster' })
  const req = makeReq({ id: 'clin-1' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 0)
  assert.equal(res.statusCode, 401)
})

// ----------------- caregiver-roster -----------------

test('caregiver-roster: matching caregiver passes through', async () => {
  const mw = requireAuth({ resource: 'caregiver-roster' })
  const req = makeReq({ id: 'cg-1', userId: 'cg-1', userRole: 'caregiver' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 1)
})

test('caregiver-roster: clinician trying to read it is forbidden', async () => {
  const mw = requireAuth({ resource: 'caregiver-roster' })
  const req = makeReq({ id: 'clin-1', userId: 'clin-1', userRole: 'clinician' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 0)
  assert.equal(res.statusCode, 403)
})

// ----------------- patient-resource -----------------

test('patient-resource: patient-self passes through', async () => {
  const mw = requireAuth({ resource: 'patient-resource' })
  const req = makeReq({ id: 'pat-1', userId: 'pat-1', userRole: 'patient' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 1)
})

test('patient-resource: owning clinician passes through', async () => {
  const calls = { findPatientById: [], findCaregiverLink: [] }
  const lookups = makeLookupsStub({ patient: { _id: 'pat-1', clinicianId: 'clin-1' }, calls })
  const mw = requireAuth({ resource: 'patient-resource', lookups })
  const req = makeReq({ id: 'pat-1', userId: 'clin-1', userRole: 'clinician' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 1)
  assert.deepEqual(calls.findPatientById, ['pat-1'])
})

test('patient-resource: non-owning clinician is forbidden', async () => {
  const calls = { findPatientById: [], findCaregiverLink: [] }
  const lookups = makeLookupsStub({ patient: { _id: 'pat-1', clinicianId: 'clin-1' }, calls })
  const mw = requireAuth({ resource: 'patient-resource', lookups })
  const req = makeReq({ id: 'pat-1', userId: 'clin-99', userRole: 'clinician' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 0)
  assert.equal(res.statusCode, 403)
})

test('patient-resource: linked caregiver passes through', async () => {
  const calls = { findPatientById: [], findCaregiverLink: [] }
  const lookups = makeLookupsStub({ link: { _id: 'link-1', caregiverId: 'cg-1', patientId: 'pat-1' }, calls })
  const mw = requireAuth({ resource: 'patient-resource', lookups })
  const req = makeReq({ id: 'pat-1', userId: 'cg-1', userRole: 'caregiver' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 1)
  assert.equal(calls.findCaregiverLink.length, 1)
  assert.equal(calls.findCaregiverLink[0].caregiverId, 'cg-1')
  assert.equal(calls.findCaregiverLink[0].patientId, 'pat-1')
})

test('patient-resource: unlinked caregiver is forbidden', async () => {
  const calls = { findPatientById: [], findCaregiverLink: [] }
  const lookups = makeLookupsStub({ calls })
  const mw = requireAuth({ resource: 'patient-resource', lookups })
  const req = makeReq({ id: 'pat-1', userId: 'cg-99', userRole: 'caregiver' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 0)
  assert.equal(res.statusCode, 403)
})

test('patient-resource: missing patient does not allow clinician through', async () => {
  // When findPatientById returns null, owning-clinician rule should fail-closed.
  const calls = { findPatientById: [], findCaregiverLink: [] }
  const lookups = makeLookupsStub({ calls })
  const mw = requireAuth({ resource: 'patient-resource', lookups })
  const req = makeReq({ id: 'pat-missing', userId: 'clin-1', userRole: 'clinician' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 0)
  assert.equal(res.statusCode, 403)
})

test('patient-resource: caregiver without role-specific arg passes through with patient-self', async () => {
  // patient-self path should not touch the caregiver link lookup at all.
  const calls = { findPatientById: [], findCaregiverLink: [] }
  const lookups = makeLookupsStub({ calls })
  const mw = requireAuth({ resource: 'patient-resource', lookups })
  const req = makeReq({ id: 'pat-1', userId: 'pat-1', userRole: 'patient' })
  const res = makeRes()
  let nextCalled = 0
  await mw(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 1)
  assert.equal(calls.findPatientById.length, 0)
  assert.equal(calls.findCaregiverLink.length, 0)
})

// ----------------- misc -----------------

test('unknown resource string yields 500 misconfigured', async () => {
  const mw = requireAuth({ resource: 'whatever' })
  const req = makeReq({ id: 'x', userId: 'x', userRole: 'patient' })
  const res = makeRes()
  await mw(req, res, () => {})
  assert.equal(res.statusCode, 500)
  assert.equal(res.body.error, 'misconfigured')
})

test('unknown role string yields 401', async () => {
  const mw = requireAuth({ resource: 'clinician-roster' })
  const req = makeReq({ id: 'clin-1', userId: 'clin-1', userRole: 'admin' })
  const res = makeRes()
  await mw(req, res, () => {})
  assert.equal(res.statusCode, 401)
})
