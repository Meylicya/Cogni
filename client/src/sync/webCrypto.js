/**
 * webCrypto.js
 *
 * AES-GCM encryption utilities via the browser's native Web Crypto API.
 * Nothing here ever touches the network — key generation, encryption, and
 * decryption all happen in-browser, which is the core Responsible AI
 * claim (Section 3 of the project doc): only ciphertext leaves the device.
 *
 * ── HACKATHON-SCOPE LIMITATION (be upfront about this in your writeup) ──
 * Real key management (secure key exchange with the backend, per-patient
 * key rotation, non-extractable keys, clinician/caregiver key access
 * control) is out of scope for the time available. What's implemented
 * here:
 *   - One AES-GCM 256-bit key per patient, generated on first use
 *   - The key is exported and stored in localStorage, keyed by patientId
 *   - Anyone with access to that browser's localStorage can decrypt that
 *     patient's data. This is NOT production-grade key custody.
 * A real version would derive/store the key via a proper key-wrapping
 * scheme (e.g. wrapped with a key derived from the patient's auth
 * credential, or held server-side behind clinician-authenticated access)
 * rather than raw in localStorage. Flag this explicitly as a known
 * limitation if judges ask about it — that honesty is worth more than
 * pretending this is a finished security model.
 */

const KEY_STORAGE_PREFIX = 'encKey:'

/**
 * Gets this patient's AES-GCM key, generating and persisting one on first
 * use. Returns a CryptoKey ready to pass into encryptScores/decryptScores.
 *
 * @param {string} patientId
 * @returns {Promise<CryptoKey>}
 */
export async function getOrCreatePatientKey(patientId) {
  if (!patientId) throw new Error('getOrCreatePatientKey requires a patientId')

  const storageKey = KEY_STORAGE_PREFIX + patientId
  const existing = window.localStorage.getItem(storageKey)

  if (existing) {
    return importKeyFromBase64(existing)
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
  const exported = await exportKeyToBase64(key)
  window.localStorage.setItem(storageKey, exported)
  return key
}

/**
 * Encrypts a plain object (e.g. { accuracy, avgLatencyMs, errorType }) into
 * a ciphertext + iv pair, both base64-encoded so they're safe to JSON.stringify
 * and POST as-is.
 *
 * @param {CryptoKey} key
 * @param {Object} scores
 * @returns {Promise<{ ciphertext: string, iv: string }>}
 */
export async function encryptScores(key, scores) {
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV, standard for AES-GCM
  const plaintext = new TextEncoder().encode(JSON.stringify(scores))

  const ciphertextBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv.buffer),
  }
}

/**
 * Reverses encryptScores — used by the caregiver/clinician dashboard
 * (once built) to decrypt scores for display.
 *
 * @param {CryptoKey} key
 * @param {{ ciphertext: string, iv: string }} encrypted
 * @returns {Promise<Object>} the original scores object
 */
export async function decryptScores(key, encrypted) {
  const ciphertextBuffer = base64ToBuffer(encrypted.ciphertext)
  const iv = base64ToBuffer(encrypted.iv)

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    ciphertextBuffer
  )

  return JSON.parse(new TextDecoder().decode(plaintextBuffer))
}

// ── internal helpers ──

async function exportKeyToBase64(key) {
  const raw = await crypto.subtle.exportKey('raw', key)
  return bufferToBase64(raw)
}

async function importKeyFromBase64(base64) {
  const raw = base64ToBuffer(base64)
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

function bufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return window.btoa(binary)
}

function base64ToBuffer(base64) {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}