import { validateGameSessionEvent } from './eventSchema.js';
import { MIN_DIFFICULTY, MAX_DIFFICULTY } from './difficultyConfig.js';


export class ZPDEngine {
  constructor({
    startingTier = 1,
    clinicianMinTier = MIN_DIFFICULTY,
    clinicianMaxTier = MAX_DIFFICULTY,
    windowSize = 6,
    minTrialsBeforeAdjust = 6,
    upperAccuracyThreshold = 0.85,
    lowerAccuracyThreshold = 0.55,
    maxErrorRate = 0.3,
    cooldownMs = 20000,
    noErrorValues = ['none']
  } = {}) {
    if (clinicianMinTier > clinicianMaxTier) {
      throw new Error('clinicianMinTier cannot be greater than clinicianMaxTier');
    }

    this.clinicianMinTier = this._clampToGlobalRange(clinicianMinTier);
    this.clinicianMaxTier = this._clampToGlobalRange(clinicianMaxTier);
    this.currentTier = this._clampToClinicianRange(startingTier);

    this.windowSize = windowSize;
    this.minTrialsBeforeAdjust = minTrialsBeforeAdjust;
    this.upperAccuracyThreshold = upperAccuracyThreshold;
    this.lowerAccuracyThreshold = lowerAccuracyThreshold;
    this.maxErrorRate = maxErrorRate;
    this.cooldownMs = cooldownMs;
    this.noErrorValues = new Set(noErrorValues);

    this.windows = new Map(); // gameId -> GameSessionEvent[]
    this.lastAdjustmentAt = -Infinity;

    this.fatigueActive = false;
    this.symptomSeverity = 0; // 0-1, set by the daily check-in scoring logic

    
    this.onTierChange = null;
  }

  _clampToGlobalRange(tier) {
    return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, tier));
  }

  _clampToClinicianRange(tier) {
    return Math.min(this.clinicianMaxTier, Math.max(this.clinicianMinTier, tier));
  }

  
  setClinicianBounds(minTier, maxTier) {
    if (minTier > maxTier) throw new Error('minTier cannot be greater than maxTier');
    this.clinicianMinTier = this._clampToGlobalRange(minTier);
    this.clinicianMaxTier = this._clampToGlobalRange(maxTier);
    this.currentTier = this._clampToClinicianRange(this.currentTier);
  }

  
  setFatigueActive(isActive) {
    this.fatigueActive = Boolean(isActive);
  }

  
  setSymptomSeverity(score) {
    this.symptomSeverity = Math.min(1, Math.max(0, score));
  }

  getCurrentTier() {
    return this.currentTier;
  }

  
  recordEvent(event) {
    const errors = validateGameSessionEvent(event);
    if (errors.length > 0) {
      console.warn('ZPDEngine: skipping invalid GameSessionEvent', errors, event);
      return null;
    }

    if (!this.windows.has(event.gameId)) this.windows.set(event.gameId, []);
    const window = this.windows.get(event.gameId);
    window.push(event);
    while (window.length > this.windowSize) window.shift();

    if (window.length < this.minTrialsBeforeAdjust) return null;

    return this._evaluate(event.gameId, window);
  }

  _evaluate(gameId, window) {
    const now = Date.now();
    if (now - this.lastAdjustmentAt < this.cooldownMs) return null;

    const accuracy = window.reduce((a, e) => a + e.accuracy, 0) / window.length;
    const errorRate = window.filter(e => !this.noErrorValues.has(e.errorType)).length / window.length;

    const mid = Math.floor(window.length / 2);
    const firstHalfLatency = this._meanLatency(window.slice(0, mid));
    const secondHalfLatency = this._meanLatency(window.slice(mid));
    const gettingFaster = secondHalfLatency < firstHalfLatency * 0.9;
    const gettingSlower = secondHalfLatency > firstHalfLatency * 1.15;

    const performingWell = accuracy >= this.upperAccuracyThreshold && errorRate <= this.maxErrorRate;
    const struggling = accuracy <= this.lowerAccuracyThreshold || errorRate > this.maxErrorRate;

    const safetyBlockingStepUp = this.fatigueActive || this.symptomSeverity >= 0.6;

    let direction = 0; // -1 down, 0 hold, +1 up
    let reason = 'in the target zone - holding steady';

    if (struggling) {
      direction = -1;
      reason = `accuracy ${accuracy.toFixed(2)} / error rate ${errorRate.toFixed(2)} below target - stepping down`;
    } else if (performingWell && gettingFaster && !safetyBlockingStepUp) {
      direction = 1;
      reason = `accuracy ${accuracy.toFixed(2)} and speeding up - stepping up`;
    } else if (performingWell && safetyBlockingStepUp) {
      reason = this.fatigueActive
        ? 'performance is strong but fatigue guard is active - holding, not increasing difficulty'
        : 'performance is strong but today\'s symptom check-in is elevated - holding, not increasing difficulty';
    } else if (performingWell && gettingSlower) {
      reason = 'accuracy is strong but response times are drifting up - holding for now';
    }

    const stats = { accuracy, errorRate, firstHalfLatency, secondHalfLatency };

    if (direction === 0) {
      return { tierChanged: false, currentTier: this.currentTier, reason, stats };
    }

    const previousTier = this.currentTier;
    const proposedTier = this._clampToClinicianRange(previousTier + direction);

    if (proposedTier === previousTier) {
      reason += ` (already at the clinician-approved ${direction > 0 ? 'maximum' : 'minimum'} tier)`;
      return { tierChanged: false, currentTier: this.currentTier, reason, stats };
    }

    this.currentTier = proposedTier;
    this.lastAdjustmentAt = now;
    this.windows.set(gameId, []); 

    if (this.onTierChange) {
      this.onTierChange(this.currentTier, { previousTier, reason, gameId, stats });
    }

    return { tierChanged: true, currentTier: this.currentTier, previousTier, reason, stats };
  }

  _meanLatency(events) {
    if (events.length === 0) return 0;
    return events.reduce((a, e) => a + e.responseLatencyMs, 0) / events.length;
  }
}