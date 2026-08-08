import { FaceTracker } from './faceTracker.js';


export class FatigueGuard {
  constructor({ ownsModel = true } = {}) {
    this.ownsModel = ownsModel;
    this.tracker = ownsModel ? new FaceTracker() : null;

    this.earThreshold = 0.21;

    
    this.closedDurationLimitMs = 500;   
    this.openResetDurationMs = 400;     

    this.closedSinceMs = null;
    this.openSinceMs = null;
    this.isFatigued = false;
  }

  async init() {
    if (!this.ownsModel) return;
    await this.tracker.init();
  }

  dispose() {
    if (this.tracker) this.tracker.dispose();
  }

  calculateEAR(eye, width, height) {
    const dist = (p1, p2) => Math.hypot((p1.x - p2.x) * width, (p1.y - p2.y) * height);
    const v1 = dist(eye[1], eye[5]);
    const v2 = dist(eye[2], eye[4]);
    const h = dist(eye[0], eye[3]);
    return (v1 + v2) / (2.0 * h);
  }

  
  detectFatigue(videoElement, timestamp = performance.now()) {
    if (!this.ownsModel) {
      throw new Error('FatigueGuard was created with ownsModel:false - call detectFatigueFromLandmarks() instead.');
    }
    const frame = this.tracker.detect(videoElement, timestamp);
    if (!frame) {
      return { isFatigued: this.isFatigued, ear: null };
    }
    return this.detectFatigueFromLandmarks(frame.landmarks, frame.width, frame.height, frame.timestamp);
  }

  
  detectFatigueFromLandmarks(landmarks, width, height, timestamp) {
    const leftEyeIdx = [33, 160, 158, 133, 153, 144];
    const rightEyeIdx = [362, 385, 387, 263, 373, 380];

    const leftEye = leftEyeIdx.map(i => landmarks[i]);
    const rightEye = rightEyeIdx.map(i => landmarks[i]);

    const leftEAR = this.calculateEAR(leftEye, width, height);
    const rightEAR = this.calculateEAR(rightEye, width, height);
    const avgEAR = (leftEAR + rightEAR) / 2.0;

    const eyesClosed = avgEAR < this.earThreshold;

    if (eyesClosed) {
      if (this.closedSinceMs === null) this.closedSinceMs = timestamp;
      this.openSinceMs = null;

      const closedDuration = timestamp - this.closedSinceMs;
      if (closedDuration >= this.closedDurationLimitMs) {
        this.isFatigued = true;
      }
    } else {
      if (this.openSinceMs === null) this.openSinceMs = timestamp;
      this.closedSinceMs = null;

    
      const openDuration = timestamp - this.openSinceMs;
      if (this.isFatigued && openDuration >= this.openResetDurationMs) {
        this.isFatigued = false;
      }
    }

    return { isFatigued: this.isFatigued, ear: Number(avgEAR.toFixed(2)) };
  }
}