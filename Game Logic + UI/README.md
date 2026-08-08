# Rehab App — Hack for Humanity

Brain injury rehabilitation app combining cognitive/speech games, on-device adaptive difficulty (ZPD scaling + frustration guard), and a privacy-first caregiver dashboard.

## Structure
- `/client` — React + Vite frontend: rehab games, speech engine, ML frustration guard, caregiver dashboard, Privacy Sandbox
- `/server` — Node/Express backend: receives only anonymized, client-encrypted scores


## Responsible AI Principles
- All biometric/media processing (camera, audio) runs client-side only — never transmitted
- Only anonymized numerical scores are synced, encrypted client-side before transit
- See `/client/src/privacy-sandbox` for the live network telemetry proof panel
