/**
  IMPORTANT: do not wire this up as the sole trigger for anything.
 **/
export class HeartRateGuard {
  constructor({
    windowSeconds = 8,      // how much history we analyze at once
    sampleHz = 20,          // we resample the raw signal to a fixed rate before analysis
    minBpm = 45,
    maxBpm = 180,
    minConfidence = 2.5     // peak power must be this many times the average to be trusted
  } = {}) {
    this.windowSeconds = windowSeconds;
    this.sampleHz = sampleHz;
    this.minBpm = minBpm;
    this.maxBpm = maxBpm;
    this.minConfidence = minConfidence;

    this.raw = []; // t,r,g,b mean ROI color per processed frame
    this.baselineBpm = null;
    this.bpmHistory = [];

    this._roiCanvas = document.createElement('canvas');
    this._roiCtx = this._roiCanvas.getContext('2d', { willReadFrequently: true });
  }

  reset() {
    this.raw = [];
    this.baselineBpm = null;
    this.bpmHistory = [];
  }

  
  getROIBoundingBoxes(landmarks, width, height, patchRadius = 12) {
    const anchors = {
      forehead: 10,
      leftCheek: 123,
      rightCheek: 352
    };

    const boxes = {};
    for (const [name, idx] of Object.entries(anchors)) {
      const p = landmarks[idx];
      const cx = p.x * width;
      const cy = p.y * height;
      boxes[name] = {
        x: Math.max(0, Math.round(cx - patchRadius)),
        y: Math.max(0, Math.round(cy - patchRadius)),
        w: patchRadius * 2,
        h: patchRadius * 2
      };
    }
    return boxes;
  }

  _meanColorInBox(videoElement, box) {
    this._roiCanvas.width = box.w;
    this._roiCanvas.height = box.h;
    this._roiCtx.drawImage(videoElement, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);

    let data;
    try {
      data = this._roiCtx.getImageData(0, 0, box.w, box.h).data;
    } catch {
      return null; // e.g canvas tainted or box out of bounds
    }

    let r = 0, g = 0, b = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    return { r: r / n, g: g / n, b: b / n };
  }

  
  processLandmarks(landmarks, videoElement, width, height, timestamp) {
    const boxes = this.getROIBoundingBoxes(landmarks, width, height);
    const samples = ['forehead', 'leftCheek', 'rightCheek']
      .map(name => this._meanColorInBox(videoElement, boxes[name]))
      .filter(Boolean);

    if (samples.length === 0) return this._currentResult();

    const avg = samples.reduce((acc, s) => ({
      r: acc.r + s.r / samples.length,
      g: acc.g + s.g / samples.length,
      b: acc.b + s.b / samples.length
    }), { r: 0, g: 0, b: 0 });

    this.raw.push({ t: timestamp, ...avg });

    const cutoff = timestamp - this.windowSeconds * 1000;
    this.raw = this.raw.filter(s => s.t >= cutoff);

    return this._currentResult();
  }

  _currentResult() {
    if (this.raw.length < this.sampleHz * 3) {
     
      return { bpm: null, confidence: 0, elevated: false };
    }

    const signal = this._posSignal(this._resample(this.raw));
    const { bpm, confidence } = this._estimateBpm(signal);

    if (bpm === null || confidence < this.minConfidence) {
      return { bpm: null, confidence, elevated: false };
    }

    if (this.baselineBpm === null) {
      this.baselineBpm = bpm;
    } else {
      
      this.baselineBpm = this.baselineBpm * 0.95 + bpm * 0.05;
    }

    this.bpmHistory.push(bpm);
    if (this.bpmHistory.length > 20) this.bpmHistory.shift();


    const elevated = bpm > this.baselineBpm * 1.15;

    return { bpm: Math.round(bpm), confidence: Number(confidence.toFixed(2)), elevated };
  }

  
  _resample(raw) {
    const t0 = raw[0].t;
    const tN = raw[raw.length - 1].t;
    const n = Math.floor(((tN - t0) / 1000) * this.sampleHz);
    if (n < 8) return raw;

    const out = [];
    for (let i = 0; i < n; i++) {
      const t = t0 + (i * 1000) / this.sampleHz;
      let j = 0;
      while (j < raw.length - 2 && raw[j + 1].t < t) j++;
      const a = raw[j], b = raw[Math.min(j + 1, raw.length - 1)];
      const span = b.t - a.t || 1;
      const f = Math.min(1, Math.max(0, (t - a.t) / span));
      out.push({
        t,
        r: a.r + (b.r - a.r) * f,
        g: a.g + (b.g - a.g) * f,
        b: a.b + (b.b - a.b) * f
      });
    }
    return out;
  }

  /** POS algorithm **/
  _posSignal(samples) {
    const rs = samples.map(s => s.r);
    const gs = samples.map(s => s.g);
    const bs = samples.map(s => s.b);

    const mean = arr => arr.reduce((a, v) => a + v, 0) / arr.length;
    const std = (arr, m) => Math.sqrt(arr.reduce((a, v) => a + (v - m) ** 2, 0) / arr.length) || 1;

    const rMean = mean(rs), gMean = mean(gs), bMean = mean(bs);
    const rn = rs.map(v => v / rMean);
    const gn = gs.map(v => v / gMean);
    const bn = bs.map(v => v / bMean);

    const s1 = gn.map((g, i) => g - bn[i]);
    const s2 = gn.map((g, i) => -2 * rn[i] + g + bn[i]);

    const s1Std = std(s1, mean(s1));
    const s2Std = std(s2, mean(s2));
    const alpha = s1Std / s2Std;

    const h = s1.map((v, i) => v + alpha * s2[i]);
    const hMean = mean(h);
    return h.map(v => v - hMean);
  }

  
  _estimateBpm(signal) {
    const N = signal.length;
    const fs = this.sampleHz;

    const goertzelPower = (freqHz) => {
      const k = Math.round((freqHz / fs) * N);
      const omega = (2 * Math.PI * k) / N;
      const cosine = Math.cos(omega);
      const coeff = 2 * cosine;
      let s0 = 0, s1 = 0, s2 = 0;
      for (let i = 0; i < N; i++) {
        s0 = signal[i] + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
      }
      return s1 * s1 + s2 * s2 - coeff * s1 * s2;
    };

    let bestBpm = null;
    let bestPower = -Infinity;
    let totalPower = 0;
    let count = 0;

    for (let bpm = this.minBpm; bpm <= this.maxBpm; bpm += 1) {
      const power = goertzelPower(bpm / 60);
      totalPower += power;
      count++;
      if (power > bestPower) {
        bestPower = power;
        bestBpm = bpm;
      }
    }

    const avgPower = totalPower / count || 1;
    const confidence = bestPower / avgPower;

    return { bpm: bestBpm, confidence };
  }
}