import { FaceTracker } from './faceTracker.js';
import { FatigueGuard } from './fatigueGuard.js';
import { HeartRateGuard } from './heartrateGuard.js';
import { VoiceStressMonitor } from './voiceMonitor.js';

export class FrustrationEngine {
  constructor({
    useVoice = true,
    breakScoreThreshold = 3,
    breakCooldownMs = 60000
  } = {}) {
    this.useVoice = useVoice;
    this.breakScoreThreshold = breakScoreThreshold;
    this.breakCooldownMs = breakCooldownMs;

    this.tracker = new FaceTracker();
    this.fatigueGuard = new FatigueGuard({ ownsModel: false });
    this.heartRateGuard = new HeartRateGuard();
    this.voiceMonitor = this.useVoice ? new VoiceStressMonitor() : null;

    this._externalPerformanceDegrading = false;
    this._lastBreakSuggestedAt = -Infinity;
    this._rafId = null;

    this.onUpdate = null;          
    this.onBreakSuggested = null;  
  }

  async init(videoElement) {
    this.videoElement = videoElement;
    await this.tracker.init();
    
    if (this.voiceMonitor) {
      await this.voiceMonitor.init();
      this.voiceMonitor.start();
    }
  }

  /** called from person 1's (Mel) event stream/ZPD engine when accuracy or latency is trending worse. */
  setPerformanceDegrading(isDegrading) {
    this._externalPerformanceDegrading = Boolean(isDegrading);
  }

  start() {
    const loop = (timestamp) => {
      this._processFrame(timestamp);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  dispose() {
    this.stop();
    this.tracker.dispose();
    if (this.voiceMonitor) this.voiceMonitor.dispose();
  }

  _processFrame(timestamp) {
    const frame = this.tracker.detect(this.videoElement, timestamp);

    let fatigueResult = { isFatigued: this.fatigueGuard.isFatigued, ear: null };
    let heartResult = { bpm: null, confidence: 0, elevated: false };

    if (frame) {
      fatigueResult = this.fatigueGuard.detectFatigueFromLandmarks(
        frame.landmarks, frame.width, frame.height, frame.timestamp
      );
      heartResult = this.heartRateGuard.processLandmarks(
        frame.landmarks, this.videoElement, frame.width, frame.height, frame.timestamp
      );
    }

    const hesitationScore = this.voiceMonitor ? this.voiceMonitor.getHesitationScore() : null;

    const { breakScore, sustainedEyesOnly } = this._computeBreakScore(fatigueResult, heartResult, hesitationScore, timestamp);

    const state = {
      timestamp,
      ear: fatigueResult.ear,
      isFatigued: fatigueResult.isFatigued,
      bpm: heartResult.bpm,
      bpmConfidence: heartResult.confidence,
      heartRateElevated: heartResult.elevated,
      voiceHesitation: hesitationScore,
      performanceDegrading: this._externalPerformanceDegrading,
      breakScore
    };

    if (this.onUpdate) this.onUpdate(state);

    const cooledDown = timestamp - this._lastBreakSuggestedAt >= this.breakCooldownMs;
    if ((breakScore >= this.breakScoreThreshold || sustainedEyesOnly) && cooledDown) {
      this._lastBreakSuggestedAt = timestamp;
      if (this.onBreakSuggested) this.onBreakSuggested(state);
    }
  }

  _computeBreakScore(fatigueResult, heartResult, hesitationScore, timestamp) {
    let score = 0;

    if (fatigueResult.isFatigued) score += 2;
    if (heartResult.elevated && heartResult.confidence >= this.heartRateGuard.minConfidence) score += 1.5;
    if (hesitationScore !== null && hesitationScore > 0.6) score += 1;
    if (this._externalPerformanceDegrading) score += 1;


    const closedSince = this.fatigueGuard.closedSinceMs;
    const extendedClosureMs = 3000;
    const sustainedEyesOnly =
      fatigueResult.isFatigued &&
      closedSince !== null &&
      (timestamp - closedSince) >= extendedClosureMs;

    return { breakScore: score, sustainedEyesOnly };
  }
}