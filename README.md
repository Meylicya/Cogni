# Cogni — Adaptive Concussion Rehabilitation Platform

> Recovery, one step at a time.

An active, adaptive cognitive rehabilitation tool for concussion recovery — clinician-supervised, privacy-first, and scoped explicitly to the **sub-acute / persistent-symptom phase**, not acute injury management.

Built for Hack for Humanity. Target tracks: Concussion Recovery, Physical Health, Best Use of AI/ML & Responsible AI, Design/Innovation.

---

## What this is (and isn't)

Most existing concussion tools (e.g. Concussion Coach) are static self-care content with no adaptive training and no clinical supervision loop. Cogni is a different category: **active, ML-adapted cognitive rehabilitation** with a built-in clinician supervision mechanism.

**Explicit safety framing:**
- Not a diagnostic tool. Not a replacement for professional care.
- Not intended for acute-phase use (first 0–48 hrs) — cognitive exercises are gated behind an intake-based safety check.
- Transfer evidence for cognitive training is represented honestly as limited beyond the trained task (Soveri et al., 2017) — not oversold as a cure.
- Camera-based fatigue detection is a conservative break-prompt safety feature, not a diagnostic or symptom-severity measurement.

---

## Architecture

Monorepo:

```
client/     React + Vite frontend
server/     Node + Express + MongoDB backend
ml/         Adaptive difficulty (ZPD) engine, biometric signal processing
```

### Responsible AI / privacy constraints (hard requirements, not suggestions)
- **100% client-side biometric processing.** Facial/PPG tracking and audio analysis run entirely in-browser (TensorFlow.js / Transformers.js / ONNX Web). Raw video, audio, and PPG signals are processed in volatile memory and never transmitted.
- **Anonymized, encrypted sync only.** Only derived numerical scores (e.g. "Memory Index: 82") leave the device, encrypted client-side via the Web Crypto API.
- **Patient-agnostic game events.** Game logic never touches `patientId`. The backend sync layer injects the authenticated patient's identity at the point events reach the server — this keeps game engines testable in isolation and enforces a clean boundary between game logic and identity/auth.

> **Status note:** the camera/audio biometric pipeline is the highest-risk, least-validated part of the system (webcam-based signal extraction is genuinely noisy). Any public-facing claim about on-device processing should be scoped to *team architecture intent*, not asserted as fully verified shipped behavior, until confirmed with the owner of that pipeline.

---

## Feature pillars

### Pillar A — Rehabilitation Exercises
Cognitive/rehab game modules, each built as a pure-logic engine (no React/DOM) with unit tests, then wrapped in a UI layer:


- 132 passing unit tests across the three completed engines (Node's built-in test runner, zero extra dependencies).
- The Speech & Word-Finding module is gated behind `isSpeechModuleAvailable()`, which fails closed and defers entirely to the intake team's `languageSymptomsFlagged` signal — the engine does not manage that flag itself.
- Shared contracts (`eventSchema.js` for `GameSessionEvent`, `difficultyConfig.js` for the 1–5 difficulty tiers) live in `client/src/shared/`. **Changes to these are team-wide decisions**, since the ZPD engine and the backend sync layer both depend on field stability.
- Game sessions and event arrays are immutable (frozen); timestamps are caller-supplied and RNG is injectable via `options.randomFn`, so every engine is fully deterministic under test.

### Pillar B — Adaptive ML & Frustration Guard
- ZPD (Zone of Proximal Development) difficulty scaling — adjusts within the tier a clinician has approved, based on accuracy/latency/error-frequency signals from Pillar A.
- Camera-based fatigue/overexertion guard — on-device PPG/HRV-adjacent signal; pauses or scales back a session and suggests a break if detected.
- Daily symptom check-in scoring — a second input signal to the adaptive engine alongside in-game performance.

### Pillar C — Clinician & Caregiver Tools
- Clinician-gated onboarding with honor-system professional attestation.
- Patient intake form → sets starting difficulty tier and the acute-phase safety gate.
- Magic-link/JWT patient invite flow.
- Caregiver dashboard (read-only, switcher view across multiple linked patients) with PDF report export.
- Privacy Sandbox — live network telemetry panel proving no raw biometric streams leave the device.

Auth flow is built: role-specific login pages for clinicians, patients, and caregivers, plus invite/accept-invite endpoints (`clinicians.js`, `patients.js`, `caregivers.js`).

---

## Daily symptom check-in
Modeled on standard post-concussion symptom scale structure (0–6 severity, matching the Amsterdam consensus convention):
- **Cognitive:** concentration, memory, mental fog
- **Physical:** headache, dizziness, fatigue, light/noise sensitivity, nausea, balance
- **Emotional:** irritability, low mood, anxiety
- **Sleep:** sleeping more/less than usual, unrested
- **Communication** *(conditional, clinician-flagged only)*: word-finding difficulty, conversation speed/following fast speech

---

## Tech stack

- **Frontend:** React, Vite (`localhost:5173`), JSX
- **Backend:** Node.js, Express, MongoDB
- **ML:** TensorFlow.js / ONNX Web (client-side only)
- **Testing:** Node's built-in test runner (`node --test`) — no added dependencies
- **Containerization:** Docker, Node 20-alpine base, volume mounts for live reload
- **Design system:** "Harbor" palette + "Deep Water" typography (see below)

---

## Design system — Harbor / Deep Water

| Role | Value |
|---|---|
| Background | `#F2F5F7` |
| Primary (navy) | `#1E3A4C` |
| Secondary (dusty teal-blue) | `#5B8A9A` |
| Accent (warm orange) | `#D98E5B` |

Typography: **Newsreader** (headings, literary serif) / **Work Sans** (body).

Rationale: deliberately avoids generic "AI product" visual cues — no purple/blue gradients, no glossy chatbot aesthetic, no floating 3D blobs. Reads as considered and human-designed.


---

## Running locally

```bash
# client
cd client && npm install && npm run dev   # http://localhost:5173

# server
cd server && npm install && npm start

# tests (game engines)
cd client && node --test
```


---

## Research grounding

Exercise design and positioning are grounded in concussion rehabilitation literature, including the Amsterdam Consensus Statement (Patricios et al., 2023) and INCOG 2.0 guidelines (Bayley et al., 2023; Velikonja et al., 2023). Transfer-of-training claims are deliberately conservative, following Soveri et al. (2017). A subset of cited sources in the team's research notes are flagged internally as **not yet independently verified** and are being spot-checked before final submission — see the in-app References page for the full, current citation list.

---

## Competitive positioning

| | Concussion Coach | Cogni |
|---|---|---|
| Core model | Static self-care & education content | Active, adaptive cognitive rehabilitation |
| Symptom tracking | Screeners, no daily trend view | Daily check-ins with trend tracking |
| Training | Suggested activities, not adaptive | ML-driven difficulty scaling (ZPD engine) |
| Clinical oversight | None built in | Clinician-gated onboarding & supervision dashboard |
| Privacy | Standard mobile app data practices | All biometrics processed on-device, zero raw media transmitted |