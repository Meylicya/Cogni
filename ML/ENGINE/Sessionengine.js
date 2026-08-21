import { getPatientSessionContext } from '../patientSessionContext.js';
import { ZPDEngine } from '../zpdEngine.js';
import { SymptomCheckinScorer } from '../scorer.js';
import { FrustrationEngine } from './engine.js';



export class SessionEngine {
  constructor({ zpdEngine, symptomScorer, frustrationEngine, languageSymptomsFlagged }) {
    this.zpdEngine = zpdEngine;
    this.symptomScorer = symptomScorer;
    this.frustrationEngine = frustrationEngine;
    this.languageSymptomsFlagged = languageSymptomsFlagged;

    this.onDifficultyChange = null; // (tier) => void
    this.onBreakSuggested = null;   // (monitorState) => void
    this.onMonitorUpdate = null;    // (monitorState) => void

    this._wireCallbacks();
  }

  _wireCallbacks() {
    // ZPD tier changes -> whoever is holding this SessionEngine
    this.zpdEngine.onTierChange = (newTier, meta) => {
      if (this.onDifficultyChange) this.onDifficultyChange(newTier, meta);
    };

    
    this.frustrationEngine.onUpdate = (state) => {
      this.zpdEngine.setFatigueActive(state.isFatigued);
      this.zpdEngine.setVoiceHesitation(state.voiceHesitation);
      this.zpdEngine.setHeartRateStatus({
        elevated: state.heartRateElevated,
        confidence: state.bpmConfidence,
      });
      if (this.onMonitorUpdate) this.onMonitorUpdate(state);
    };

    
    this.frustrationEngine.onBreakSuggested = (state) => {
      if (this.onBreakSuggested) this.onBreakSuggested(state);
    };
  }

  
  /**
   * Boots the biometric guards against the supplied <video> element.
   *
   * @param {HTMLVideoElement} videoElement
   * @param {Object} [opts]
   * @param {boolean} [opts.audioGranted=false] — when false, the voice
   *   hesitation guard stays parked (VAD model is still initialized so a
   *   later re-grant is fast). The plan: see Item A in
   *   plans/transient-whistling-fountain.md.
   */
  async startMonitoring(videoElement, { audioGranted = false } = {}) {
    await this.frustrationEngine.init(videoElement, { audioGranted });
    this.frustrationEngine.start();
  }

  stopMonitoring() {
    this.frustrationEngine.stop();
  }

  /**
   * Symmetric flip for the voice-hesitation arm. Used by RehabSessionShell
   * when the patient grants audio permission after the camera was already
   * live (e.g. partial-grant path where the user later enables the mic).
   */
  setVoiceMonitorActive(active) {
    this.frustrationEngine.setVoiceMonitorActive(Boolean(active));
  }

  dispose() {
    this.frustrationEngine.dispose();
  }

  
  recordGameEvent(event) {
    const result = this.zpdEngine.recordEvent(event);

    
    if (result && result.stats) {
      const { firstHalfLatency, secondHalfLatency } = result.stats;
      const gettingSlower = secondHalfLatency > firstHalfLatency * 1.15;
      this.frustrationEngine.setPerformanceDegrading(gettingSlower);
    }

    return result;
  }

  
  recordSymptomCheckin(checkin) {
    const result = this.symptomScorer.score(checkin, {
      languageSymptomsFlagged: this.languageSymptomsFlagged,
    });
    this.zpdEngine.setSymptomSeverity(result.normalizedSeverity);
    return result;
  }

  
  async submitSymptomCheckin(checkin) {
    const res = await fetch('/api/symptom-checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkin),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Symptom check-in submission failed (${res.status})`);
    }

    const saved = await res.json();
    const { patientId, ...scoreFields } = saved;
    return this.recordSymptomCheckin(scoreFields);
  }

  getCurrentTier() {
    return this.zpdEngine.getCurrentTier();
  }
}

export async function createSessionEngine(patientId) {
  const { difficultyTier, languageSymptomsFlagged } = await getPatientSessionContext(patientId);

  const zpdEngine = new ZPDEngine({ startingTier: difficultyTier });
  const symptomScorer = new SymptomCheckinScorer();
  const frustrationEngine = new FrustrationEngine({ useVoice: true });

  return new SessionEngine({
    zpdEngine,
    symptomScorer,
    frustrationEngine,
    languageSymptomsFlagged,
  });
}
