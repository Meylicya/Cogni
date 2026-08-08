import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';


export class FaceTracker {
  constructor() {
    this.faceLandmarker = null;
    this.isReady = false;
    this.lastTimestamp = -1;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );

    const baseOptions = {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
    };

    try {
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { ...baseOptions, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1
      });
    } catch {
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { ...baseOptions, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numFaces: 1
      });
    }

    this.isReady = true;
  }


  detect(videoElement, timestamp = performance.now()) {
    if (
      !this.isReady ||
      !videoElement ||
      videoElement.readyState < 2 ||
      videoElement.videoWidth === 0 ||
      timestamp <= this.lastTimestamp
    ) {
      return null;
    }

    this.lastTimestamp = timestamp;

    let results;
    try {
      results = this.faceLandmarker.detectForVideo(videoElement, timestamp);
    } catch (err) {
      
      console.warn('FaceTracker: detection failed for this frame', err);
      return null;
    }

    if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
      return null;
    }

    return {
      landmarks: results.faceLandmarks[0],
      width: videoElement.videoWidth,
      height: videoElement.videoHeight,
      timestamp
    };
  }

  dispose() {
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }
    this.isReady = false;
  }
}