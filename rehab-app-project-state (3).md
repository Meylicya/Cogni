# Concussion Recovery App — Project State & Task Split

**Hackathon:** Hack for Humanity
**Team size:** 4
**Target tracks:** Concussion Recovery, Physical Health, Best Use of AI/ML & Responsible AI, Design/Innovation (all-submission track)

---

## 1. Positioning

An active, adaptive cognitive rehabilitation tool for concussion recovery — clinician-supervised, privacy-first, and explicitly scoped to the **sub-acute / persistent-symptom phase**, not acute injury management.

**Core differentiator vs. existing tools (e.g. Concussion Coach):** Concussion Coach is static self-care content and symptom screening with no adaptive training and no clinical supervision loop. This app is active, ML-adapted cognitive rehabilitation with a built-in clinician supervision mechanism — a different category of tool, not a head-to-head competitor.

**Non-negotiable safety framing (bakes directly into Safety & Responsible Design scoring):**
- Not a diagnostic tool. Not a replacement for professional care.
- Not intended for acute-phase use (first 0–48 hrs) — cognitive exercises are gated behind an intake-based safety check.
- Transfer evidence for cognitive training is honestly represented as limited beyond the trained task (per Soveri et al., 2017) — not oversold as a cure.
- Camera-based fatigue detection is framed as a conservative break-prompt safety feature, not a diagnostic or symptom-severity measurement.

---

## 2. Unified Feature Set

### Pillar A: Rehabilitation Exercises
- **N-Back** (working memory) — mirrors real fNIRS studies using working-memory tasks in concussed patients (Kontos et al., 2014; Hocke et al., 2018)
- **Sequence Recall** (visual-spatial memory) — complements N-back with a different memory modality
- **Reaction / Sustained Attention task** (e.g. go/no-go) — attention deficits are among the most consistently reported concussion symptoms
- **Speech & Word-Finding module** — *conditional*, only shown if the clinician's intake form flags language/communication symptoms; grounded in cognitive-communication disorder research (Norman et al., 2019–2023), not classical aphasia assessment

### Pillar B: Adaptive ML & Frustration Guard
- **ZPD (Zone of Proximal Development) difficulty scaling** — on-device model adjusts difficulty within the tier a clinician has approved, based on accuracy/latency/error-frequency signals from Pillar A
- **Camera-based fatigue/overexertion guard** — on-device PPG/HRV-adjacent signal; if detected, pauses or scales back the session and suggests a break or brief mindfulness exercise. Framed conservatively as a safety feature, not a diagnostic one.
- **Daily symptom check-in** — lightweight, clinician-informed severity scale (0–6, matching the Amsterdam consensus convention) across cognitive, physical, emotional, sleep, and (conditionally) communication categories. Feeds the adaptive engine a second signal beyond in-game performance.

### Pillar C: Clinician & Caregiver Tools
- **Clinician-gated onboarding** — a clinician/therapist creates the patient record (with an honor-system professional attestation, since full identity verification is out of scope for a hackathon prototype)
- **Patient intake form** — structured Q&A covering injury timing, current symptoms, and language difficulty; sets the patient's starting difficulty tier
- **Safety gate** — if intake indicates acute phase (<48 hrs) or unresolved acute symptoms, the app blocks cognitive exercises and surfaces guidance to wait, rather than silently assigning a low difficulty
- **Patient invite flow** — magic-link/JWT-based invite generated after clinician intake; patient sets their own credentials and logs in independently from then on
- **Caregiver/therapist dashboard** — visualizes trends across accuracy, reaction time, memory scores, symptom check-ins, and engagement over time
- **PDF report export** — downloadable summary for clinical review
- **Privacy Sandbox** — live network telemetry panel proving no raw video/audio/biometric streams ever leave the device
- **In-app References page** — short "Evidence & Guidelines" page: 3–4 sentences of positioning (sub-acute phase, clinician-supervised, honest about transfer limitations) followed by the full citation list below

---

## 3. Responsible AI Architecture

- **100% client-side processing:** facial/PPG tracking, audio analysis, and adaptive game logic run entirely in-browser via TensorFlow.js and Transformers.js / ONNX Web
- **Zero biometric streaming:** raw webcam frames, audio streams, and PPG signals are processed in volatile RAM and immediately discarded — never transmitted
- **Encrypted, anonymized sync:** only anonymized numerical scores (e.g. "Memory Index: 82") are encrypted client-side via the Web Crypto API before syncing
- **Extends to intake data:** patient medical intake (injury history, clinician notes) is also encrypted at rest and never used beyond the exercises without explicit clinician/patient consent
- **Privacy Sandbox UI:** live network telemetry tab, proving to judges and users exactly what does (and doesn't) get transmitted

---

## 4. Team Task Split (4 people)

### Person 1 — Rehabilitation Exercises & Speech Module (Pillar A, frontend + logic)
- N-Back game (engine + UI) — **built and tested**: `nbackEngine.js` (pure logic, 14 passing unit tests) + `NBackGame.jsx` (UI in Harbor/Deep Water branding), emitting `GameSessionEvent` objects per the shared schema
- Sequence Recall game (engine + UI, same tested-logic-first pattern as N-Back)
- Reaction/Attention task (engine + UI)
- Speech & Word-Finding module — build behind a feature flag driven by Person 4's intake data (`languageSymptomsFlagged: boolean`)
- Owns the shared event schema (`eventSchema.js`) and difficulty config (`difficultyConfig.js`) — the seam consumed by Person 2's ML engine

### Person 2 — Adaptive ML & Frustration Guard (Pillar B)
- ZPD difficulty-scaling model consuming Person 1's event stream, adjusting within the tier Person 4's clinician flow has approved
- Camera-based fatigue/overexertion detection — validate feasibility early (webcam PPG is genuinely noisy); have a fallback signal ready (self-report pacing, interaction-pattern deltas) if it proves unreliable
- Daily symptom check-in scoring logic — feeds into the same adaptive engine as a second input signal
- All processing must be client-side (TF.js/ONNX Web) — no raw media ever leaves the device; this is the Responsible AI backbone and should be tested explicitly, not just assumed

### Person 3 — Dashboard, Backend, Database & Privacy Architecture (Pillar C, frontend + backend)
- **Owns the database schema and implementation** — see Section 6 for the full schema (clinicians, patients, intake_records, symptom_checkins, game_sessions, game_events, caregivers, caregiver_patient_links)
- Sets up the DB (e.g. Postgres/SQLite depending on time budget) and the sync layer that injects the authenticated `patientId` into Person 1's patient-agnostic `GameSessionEvent` objects before persisting them
- Caregiver/therapist trend dashboard (charts across accuracy, latency, memory scores, symptom check-ins, engagement) — must support the caregiver "switcher view" across multiple linked patients (many-to-many via `caregiver_patient_links`)
- PDF report generation for clinical review
- Minimal Express API — receives only anonymized, client-encrypted scores
- Client-side encryption pipeline (Web Crypto API) before sync
- Privacy Sandbox live network-telemetry panel — the single most convincing artifact for the Responsible AI prize judging
- Encryption-at-rest for intake data and caregiver-link data
- Implements the read-only vs. clinical-write role check (caregivers can view; only clinicians can adjust `difficulty_tier` or intake data)

### Person 4 — Clinician Onboarding, Patient Safety Gate & Evidence Grounding (new)
- Clinician account creation + professional attestation flow (honor-system, explicitly disclosed as a hackathon-scope limitation)
- Patient intake form (injury timing, symptoms, language difficulty) — outputs the starting difficulty tier and the `languageSymptomsFlagged` signal Person 1 depends on
- Safety gate logic — blocks cognitive exercises and shows wait guidance if intake indicates acute phase or unresolved acute symptoms
- Patient invite flow (magic-link/JWT) — generates credentials after clinician intake is complete
- Caregiver access-grant flow — clinician or patient approves a caregiver's link to a patient record (writes to `caregiver_patient_links`); caregivers must never be able to self-link to a patient
- In-app References / "Evidence & Guidelines" page — positioning copy + the verified citation list below
- Owns final verification of all citations before submission (spot-check any not already confirmed)

---

## 5. Branding & UI Direction

**Platform:** Desktop/laptop-first. Webcam-based fatigue detection needs stable, well-lit, fixed-distance capture; the caregiver dashboard should still be responsive for quick mobile check-ins.

**Chosen direction: "Harbor" palette + "Deep Water" typography**
- **Palette:** Background `#F2F5F7`, Primary `#1E3A4C` (deep navy), Secondary `#5B8A9A` (dusty teal-blue), Accent `#D98E5B` (warm orange)
- **Typography:** Headings — Newsreader (literary serif); Body — Work Sans
- **Rationale:** avoids generic "AI product" visual cues (no purple/blue gradients, no glossy chatbot aesthetic, no floating 3D blobs). Reads as considered and human-designed rather than templated.
- Sample tagline: *"Recovery, one step at a time."*

---

## 6. Database Schema

Core relationships:

```
Clinician    1 ──── * Patient           (a clinician manages many patients)
Caregiver    * ──── * Patient           (many-to-many, via caregiver_patient_links)
Patient      1 ──── * IntakeRecord      (usually one, but allow history/updates)
Patient      1 ──── * SymptomCheckIn    (daily)
Patient      1 ──── * GameSession       (one row per completed round)
GameSession  1 ──── * GameEvent         (optional, per-response granularity)
```

**`clinicians`**
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| email | text | unique |
| name | text | |
| professional_attestation | boolean | honor-system checkbox, hackathon scope |
| created_at | timestamp | |

**`patients`**
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| clinician_id | uuid | FK → clinicians.id |
| email | text | nullable until patient completes invite |
| invite_token | text | magic-link token, nulled after first login |
| auth_credential_hash | text | set once patient logs in themselves |
| difficulty_tier | int | 1–5, set from intake, adjusted by Person 2's ZPD engine |
| language_symptoms_flagged | boolean | drives Person 1's speech module visibility |
| status | enum | `pending_invite` / `acute_phase_blocked` / `active` |
| created_at | timestamp | |

**`intake_records`**
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| patient_id | uuid | FK |
| injury_timestamp | timestamp | drives the acute-phase safety gate |
| reported_symptoms | jsonb | structured Q&A answers |
| language_difficulty_reported | boolean | sets `language_symptoms_flagged` |
| created_at | timestamp | |

**`symptom_checkins`**
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| patient_id | uuid | FK |
| cognitive_score | int | 0–6 |
| physical_score | int | 0–6 |
| emotional_score | int | 0–6 |
| sleep_score | int | 0–6 |
| communication_score | int | nullable, 0–6, only if flagged |
| checkin_date | date | one per day, unique(patient_id, checkin_date) |

**`game_sessions`**
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| patient_id | uuid | FK |
| game_id | text | "n-back" / "sequence-recall" / etc. |
| difficulty_level | int | |
| accuracy | float | round summary |
| avg_latency_ms | int | |
| completed_at | timestamp | |

**`game_events`** *(optional — only if per-response detail is needed, not just round summaries; consider keeping this client-side/ephemeral only, for Responsible AI data-minimization)*
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| session_id | uuid | FK → game_sessions.id |
| accuracy | int | 0 or 1 |
| response_latency_ms | int | |
| error_type | text | |
| timestamp | timestamp | |

**`caregivers`**
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| email | text | unique |
| name | text | |
| auth_credential_hash | text | |
| created_at | timestamp | |

**`caregiver_patient_links`** *(join table — many-to-many; a caregiver may watch multiple patients, a patient may have multiple caregivers)*
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| caregiver_id | uuid | FK → caregivers.id |
| patient_id | uuid | FK → patients.id |
| relationship_label | text | optional, e.g. "parent", "spouse" — for dashboard display |
| access_granted_by | uuid | FK → clinicians.id or patients.id — who approved this link |
| created_at | timestamp | |

**Design notes:**
- Caregiver access is **read-only** (dashboard + PDF export); only clinicians can adjust clinical parameters like `difficulty_tier` or intake data. Worth a simple `role` check if the dashboard UI is shared between clinicians and caregivers.
- Caregiver-patient links must be **granted, not self-assigned** — a clinician or the patient approves the link. Unrestricted self-linking would be a real privacy hole and is worth calling out explicitly in the Responsible AI writeup as a deliberate access-control decision.
- A caregiver's dashboard is a **switcher view** — list of all linked patients, not locked to one.
- `GameSessionEvent` objects emitted from Person 1's games are patient-agnostic by design (no `patientId` baked into `eventSchema.js`); the sync layer (Person 3) injects the authenticated patient's ID at the point events are sent to the backend, keeping the games themselves testable in isolation.

---

## 7. Verified Research Citations

**Confirmed accurate via independent search verification:**

- Bayley, M. T., et al. (2023). INCOG 2.0 Guidelines for Cognitive Rehabilitation Following Traumatic Brain Injury: Methods, Overview, and Principles. *Journal of Head Trauma Rehabilitation*, 38(1), 7–23.
- Velikonja, D., et al. (2023). INCOG 2.0 Guidelines for Cognitive Rehabilitation Following Traumatic Brain Injury, Part V: Memory. *Journal of Head Trauma Rehabilitation*, 38(1), 83–102.
- Patricios, J. S., et al. (2023). Consensus statement on concussion in sport: the 6th International Conference on Concussion in Sport–Amsterdam, October 2022. *British Journal of Sports Medicine*, 57(11), 695–711.
- Soveri, A., Antfolk, J., Karlsson, L., Salo, B., & Laine, M. (2017). Working memory training revisited: A multi-level meta-analysis of n-back training studies. *Psychonomic Bulletin & Review*, 24(4), 1077–1096. *(Note: correct journal is Psychonomic Bulletin & Review — not "OSF Preprints" as an earlier draft listed.)*
- Norman, R. S., Shah, M. N., & Turkstra, L. S. (2019). Language Comprehension After Mild Traumatic Brain Injury: The Role of Speed. *American Journal of Speech-Language Pathology*, 28(4), 1479–1490. *(Caveat: the speeded-condition accuracy difference did not reach statistical significance — cite as suggestive, not confirmed, evidence.)*
- Cicerone, K. D., et al. (2011) and Bayley et al. (2014) — active rehabilitation (not cognitive rest) as standard of care for non-sports-concussion TBI; cognitive engagement including "game playing, computer use" is explicitly named as part of active rehabilitation.

**Cited in team research but not yet independently verified — spot-check before final submission:**
- Blacker, K. J., Negoita, S., Ewen, J. B., & Courtney, S. M. (2017). N-back versus complex span working memory training. *Journal of Cognitive Enhancement*, 1(4), 434–454.
- Bogdanova, Y., Yee, M. K., Ho, V. T., & Cicerone, K. D. (2016). Computerized Cognitive Rehabilitation of Attention and Executive Function in Acquired Brain Injury: A Systematic Review. *Journal of Head Trauma Rehabilitation*, 31(6), 419–433.
- Hocke, L. M., Duszynski, C. C., Debert, C. T., Dleikan, D., & Dunn, J. F. (2018). Reduced Functional Connectivity in Adults with Persistent Post-Concussion Symptoms: A Functional Near-Infrared Spectroscopy Study. *Journal of Neurotrauma*, 35(11), 1224–1232.
- Kontos, A. P., et al. (2014). Brain activation during neurocognitive testing using functional near-infrared spectroscopy in patients following concussion compared to healthy controls. *Brain Imaging and Behavior*, 8(4), 621–634.
- Lee, H. Y., Hyun, S. E., & Oh, B.-M. (2023). Rehabilitation for Impaired Attention in the Acute and Post-Acute Phase After Traumatic Brain Injury: A Narrative Review. *Korean Journal of Neurotrauma*, 19(1), 20–32.
- de Freitas Cardoso, M. G., et al. (2019). Cognitive Impairment Following Acute Mild Traumatic Brain Injury. *Frontiers in Neurology*, 10.
- Ilie, G., Cusimano, M. D., & Li, W. (2017). Prosodic processing post traumatic brain injury – a systematic review. *Systematic Reviews*, 6.
- Norman, R. S., Flaugher, T., Chang, S., & Power, E. (2023). Self-Perception of Cognitive-Communication Functions After Mild Traumatic Brain Injury. *American Journal of Speech-Language Pathology*, 32(2), 883–906.
- Norman, R. S., Mueller, K. D., Huerta, P., et al. (2022). Discourse Performance in Adults With Mild Traumatic Brain Injury, Orthopedic Injuries, and Moderate to Severe Traumatic Brain Injury, and Healthy Controls. *American Journal of Speech-Language Pathology*, 31(1), 67–83.
- Patel, S., Grabowski, C., Dayalu, V., & Testa, A. J. (2023). Speech error rates after a sports-related concussion. *Frontiers in Psychology*, 14.
- Cottingham, M. E., & Boone, K. B. (2010). Non-credible language deficits following mild traumatic brain injury. *The Clinical Neuropsychologist*, 24(6), 1006–1025.

---

## 8. Daily Symptom Check-in Categories
Modeled on standard post-concussion symptom scale structure, rated 0–6 severity:
- **Cognitive:** concentration, memory, mental fog
- **Physical:** headache, dizziness, fatigue, light/noise sensitivity, nausea, balance
- **Emotional:** irritability, low mood, anxiety
- **Sleep:** sleeping more/less than usual, unrested
- **Communication** (conditional, clinician-flagged only): word-finding difficulty, conversation speed/following fast speech

---

## 9. Competitive Positioning vs. Concussion Coach (VA)

| | Concussion Coach | Our app |
|---|---|---|
| Core model | Static self-care & education content | Active, adaptive cognitive rehabilitation |
| Symptom tracking | Screeners, no daily trend view | Daily check-ins with trend tracking |
| Training | Suggested activities, not adaptive | ML-driven difficulty scaling (ZPD engine) |
| Clinical oversight | None built in | Clinician-gated onboarding & supervision dashboard |
| Privacy | Standard mobile app data practices | All biometrics processed on-device, zero raw media transmitted |

---

## 10. Key Risks
- **Camera-based fatigue detection** remains the highest-risk technical component — webcam-based signal extraction is genuinely noisy in practice. Validate early; have a fallback signal ready.
- **Unverified citations** (Section 6, second list) should be spot-checked before final submission — even a strong reference list can carry one wrong detail.
- **Scope creep from the pivot** — the clinician onboarding + safety gate + intake flow is real net-new work on top of the original 3-person plan. With a 4th person now covering exactly that surface area, scope should be back in balance, but worth re-checking against the actual submission deadline.
