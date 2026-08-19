# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cogni** — a brain-injury rehabilitation app. It combines four cognitive/speech games, an on-device adaptive difficulty engine (ZPD scaling + frustration/safety guards), and a privacy-first caregiver/clinician dashboard. The Responsible AI backbone is that all biometric and media processing (camera, audio, fatigue/HR signals) runs **client-side only**; only anonymized, client-encrypted score records ever cross the network. See `client/src/pages/shared/PrivacySandbox.jsx` for the live network telemetry proof panel.

This repo is a hackathon build with three sub-projects under one monorepo:

- `/client` — React + Vite SPA
- `/server` — Node/Express + MongoDB API
- `/ML` — adaptive-difficulty engine (ZPD) and biometric/fatigue guards. Pure JS, no server.
- `/shared` — schemas (eventSchema, difficultyConfig) imported by both client and ML.

## Commands

There is no top-level npm script. Each subproject runs independently.

### Client (`/client`)
```
npm install
npm run dev      # vite dev server
npm run build    # vite build
npm run preview  # preview production build
npm run lint     # eslint .
```

### Server (`/server`)
```
npm install
npm run dev      # node --watch index.js  (requires MONGO_URI in server/.env)
npm start        # node index.js
```
The server listens on **port 3001**. MongoDB connection is read from `server/.env` (`MONGO_URI`).

### Tests
There is no single test runner configured. Tests are colocated next to engine files:
- Game engines: `client/src/games/<game>/*.test.js` — plain node-style tests (see existing examples in `nback/` and `reactionattention/`).
- Shared schemas: `shared/__tests__/shared.test.js`.

Run them directly with `node`, e.g. `node client/src/games/nback/nbackEngine.test.js`. Pick the convention used by the file you're touching.

## High-Level Architecture

### Three-team contract — `shared/`
Two files are **team-wide contracts**. Changes here require coordination across teams, not a unilateral edit:
- `shared/eventSchema.js` — defines the `GameSessionEvent` shape emitted by games and consumed by ZPD/sync. **Patient-agnostic by design**: `createGameSessionEvent` throws if you pass `patientId`/`email`/`name`. The authenticated patient ID is injected later, at the sync boundary.
- `shared/difficultyConfig.js` — per-game tuning tables for difficulty levels 1–5 (matches `patients.difficultyTier` 1–5 in the DB). Games read this to know what "level 3" means for their mechanic.

### Client (`/client/src/`)
- `App.jsx` + `main.jsx` — React Router routes. Route surface in App.jsx is the source of truth for which page lives where.
- `pages/{clinician,patient,caregiver,shared}/` — onboarding, login, intake, dashboard, privacy sandbox, evidence page. Per recent commits, clinician/caregiver/patient login flows are wired up; intake is split off as its own page.
- `games/RehabSessionShell.jsx` — the picker/hub that hosts all four games. **Note its current limitations**: it uses a hardcoded local difficulty level (stands in for `patient.difficultyTier`), `languageSymptomsFlagged` is a hardcoded prop, and `sessionLog` is local-only. These are deliberate stubs documented in the file's header — replace them when wiring up real session state from `context/SessionContext.jsx` and `ML/sessionBootstrap.js`.
- `games/{nback,reactionattention,sequencerecall,speechWordFinding}/` — one folder per game, each with `*Engine.js` (pure logic), `*Game.jsx` (UI), and usually an `*.test.js`.
- `sync/syncLayer.js` — **the boundary that attaches a patientId to events**. The only file allowed to cross that boundary. POSTs clinical scores as plaintext PHI to `/api/game-sessions` and attaches `X-User-*` headers via `sync/authHeaders.js`.
- `sync/webCrypto.js` — reserved for future on-device biometric / sensor pipelines (webcam frames, PPG signals, raw audio). Those signals stay 100% in local RAM and never cross the network. Currently a stub — clinical score encryption was removed from this layer; scores are now plaintext PHI behind `requireAuth({ resource: 'patient-scores' })`.
- `context/SessionContext.jsx` — currently a **dev stub** returning hardcoded IDs. This is the next swap-in target for real auth.
- `components/` — small shared UI primitives (`BackButton`, `Modal`, `Toast`).

### ML (`/ML/`)
Pure JS, runs in the browser. Three top-level entry points and a `ENGINE/` subfolder:
- `zpdEngine.js` — `ZPDEngine` class. Consumes validated `GameSessionEvent`s via `recordEvent()`, holds a rolling window per gameId, and decides whether to step difficulty up/down within the clinician-approved tier range. Step-up is **blocked** when fatigue guard / symptom severity / voice hesitation / elevated heart-rate is active — that safety logic is the core Responsible AI claim, keep it.
- `scorer.js` — `SymptomCheckinScorer`. Aggregates a daily symptom check-in (`{cognitiveScore, physicalScore, emotionalScore, sleepScore, communicationScore?}`, each 0–6) into a 0–1 `normalizedSeverity` that feeds `ZPDEngine.setSymptomSeverity()`. `communicationScore` is only active when the patient was flagged for language symptoms at intake.
- `sessionBootstrap.js` — `startPatientSession(patientId)` — the seam that wires `patient.difficultyTier` + `languageSymptomsFlagged` into a fresh `ZPDEngine` + `SymptomCheckinScorer` pair per session. This is what `RehabSessionShell` will call once auth is real.
- `ENGINE/` — `engine.js` (high-level facade), `faceTracker.js`, `fatigueGuard.js`, `heartrateGuard.js`, `voiceMonitor.js`, `Sessionengine.js`. These are the biometric/fatigue/safety guards that feed into `ZPDEngine`'s block-step-up signals.

### Server (`/server/`)
- `index.js` — Express bootstrap. **`import 'dotenv/config'` MUST be line 1** (it's a banner comment in the file — keep it). Loads `MONGO_URI` from `.env`, mounts `routes/index.js` under `/api`, listens on 3001. Also defines two legacy routes inline (`POST /api/login`, `GET /api/patients`) for hackathon continuity — newer routes live in `routes/`.
- `routes/index.js` — mounts `/clinicians`, `/patients`, `/intake-records`, `/symptom-checkins`, `/game-sessions`, `/game-events`, `/caregivers`, `/caregiver-links`.
- `models/` — Mongoose schemas. `GameSession` stores plaintext `accuracy` / `avgLatencyMs` / `errorType` by design — read access is gated at the route layer by `requireAuth({ resource: 'patient-scores' })` so only the patient themselves, the owning clinician, or a linked caregiver can fetch a patient's historical scores.
- `utils/mailer.js` — nodemailer wrapper. Note: `routes/caregivers.js` calls `sendCaregiverInviteEmail()` (referenced but commented-out import); this needs to be added to `mailer.js` to match the existing `sendPatientInviteEmail` shape.
- `server/.env` — contains real credentials. **`.env` is gitignored**; the version present locally has the hackathon dev secrets and should never be committed (and never pasted into chat).

### Privacy boundary summary
Game engines → `eventSchema.createGameSessionEvent()` (patient-agnostic) → game UI → `syncLayer.syncGameEvent()` → POST `/api/game-sessions` → server stores plaintext scores. Read access is gated by `requireAuth({ resource: 'patient-scores' })` so only the patient themselves, the owning clinician, or a linked caregiver can fetch a patient's historical scores. **Biometric / sensor data (webcam, PPG, audio) stays on-device** — see `client/src/pages/shared/PrivacySandbox.jsx` for the live network-telemetry proof panel.

## Repo-Specific Conventions
- ESM everywhere (`"type": "module"` in all three package.jsons).
- `dotenv/config` must remain line 1 of `server/index.js` — server boot fails silently without it.
- "Hackathon scope" is called out explicitly in code comments throughout (e.g. plaintext `authCredentialHash` in `Clinician`/`Caregiver`/`Patient` models, `localStorage` key custody in `webCrypto.js`). Don't "fix" these without coordinating — they're documented trade-offs, not bugs.
- Comments often name "Person 1/2/3/4" — that's the original team split. Person 1 = games, Person 2 = ZPD/biometric ML, Person 3 = sync/server, Person 4 = clinician intake/auth UI. Useful for grepping ownership when something needs review.
