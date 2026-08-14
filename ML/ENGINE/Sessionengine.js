import { getPatientSessionContext } from './patientSessionContext.js';
import { ZPDEngine } from './zpdEngine.js';
import { SymptomCheckinScorer } from './scorer.js';
import { FrustrationEngine } from './engine.js';

export class SessionEngine {
  constructor({ zpdEngine, symptomScorer, frustrationEngine, languageSymptomsFlagged }) {
    this.zpdEngine = zpdEngine;
    this.symptomScorer = symptomScorer;
    this.frustrationEngine = frustrationEngine;
    this.languageSymptomsFlagged = languageSymptomsFlagged;

    this.onDifficultyChange = null;
    this.onBreakSuggested = null;
    this.onMonitorUpdate = null;

    this._wireCallbacks();
  }

  _wireCallbacks() {
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

  async startMonitoring(videoElement) {
    await this.frustrationEngine.init(videoElement);
    this.frustrationEngine.start();
  }

  stopMonitoring() {
    this.frustrationEngine.stop();
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
