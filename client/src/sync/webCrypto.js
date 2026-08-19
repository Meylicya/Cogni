/**
 * webCrypto.js
 *
 * Reserved for on-device biometric / sensor pipelines (webcam frames,
 * PPG signals, raw audio). Those signals stay 100% in local RAM and
 * never cross the network — see client/src/pages/shared/PrivacySandbox.jsx
 * for the live network-telemetry proof panel.
 *
 * Clinical score encryption is no longer this layer's job. Game-session
 * scores sync as plaintext PHI behind the server's RBAC gate
 * (server/middleware/requireAuth.js with resource='patient-scores').
 * Biometric key custody, when it lands, should live in this module.
 */

export {}
