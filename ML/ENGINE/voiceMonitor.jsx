import { MicVAD } from '@ricky0123/vad-web';


export class VoiceStressMonitor {
  constructor({
    longPauseMs = 2500,     // a pause longer than this counts as "hesitant"
    windowSeconds = 30       // rolling window for the hesitation score
  } = {}) {
    this.longPauseMs = longPauseMs;
    this.windowSeconds = windowSeconds;
    this.vad = null;
    this.isRunning = false;

    this._lastSpeechEndMs = null;
    this._pauses = []; // { t, durationMs }
  }

  async init() {
    this.vad = await MicVAD.new({
      onSpeechStart: () => {
        if (this._lastSpeechEndMs !== null) {
          const durationMs = performance.now() - this._lastSpeechEndMs;
          this._pauses.push({ t: performance.now(), durationMs });
        }
      },
      onSpeechEnd: () => {
        this._lastSpeechEndMs = performance.now();
      }
    });
  }

  start() {
    if (!this.vad) throw new Error('VoiceStressMonitor: call init() first.');
    this.vad.start();
    this.isRunning = true;
  }

  stop() {
    if (this.vad) this.vad.pause();
    this.isRunning = false;
  }

  dispose() {
    this.stop();
    this.vad = null;
  }


  getHesitationScore() {
    const now = performance.now();
    const cutoff = now - this.windowSeconds * 1000;
    this._pauses = this._pauses.filter(p => p.t >= cutoff);

    if (this._pauses.length < 2) return null;

    const longPauseCount = this._pauses.filter(p => p.durationMs >= this.longPauseMs).length;
    return longPauseCount / this._pauses.length;
  }
}