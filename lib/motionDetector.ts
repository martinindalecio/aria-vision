const THUMB_SIZE = 50;
const FRAME_WIDTH = 480;
const FRAME_HEIGHT = 360;
const JPEG_QUALITY = 0.55;
/** Fraction of thumbnail pixels that must change for a frame to count as motion. */
const MOTION_RATIO_THRESHOLD = 0.08;
/** Per-pixel grayscale delta (0-255) above which a pixel counts as changed. */
const PIXEL_DELTA_THRESHOLD = 28;
/** Send a frame after this long even if the scene is static (heartbeat). */
const HEARTBEAT_MS = 4000;
/** Hard rate limit between API calls. */
const MIN_INTERVAL_MS = 1200;

export class MotionDetector {
  private thumbCanvas: HTMLCanvasElement | null = null;
  private frameCanvas: HTMLCanvasElement | null = null;
  private lastThumbnail: Uint8ClampedArray | null = null;
  private lastCaptureAt = 0;

  /**
   * Decide whether a frame should be sent to the vision API right now.
   * Returns the 480x360 JPEG as a bare base64 string (no data: prefix)
   * when motion exceeds 8% or the 4s heartbeat is due, respecting the
   * 1200ms hard rate limit. Returns null otherwise.
   */
  shouldCapture(video: HTMLVideoElement | null): string | null {
    if (typeof document === "undefined" || !video) return null;
    if (video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) {
      return null;
    }

    const now = Date.now();
    if (now - this.lastCaptureAt < MIN_INTERVAL_MS) return null;

    const thumbnail = this.captureThumbnail(video);
    if (!thumbnail) return null;

    // First frame counts as full motion so the feed starts immediately.
    const diffRatio = this.lastThumbnail
      ? this.computeDiffRatio(thumbnail, this.lastThumbnail)
      : 1;
    const heartbeatDue = now - this.lastCaptureAt >= HEARTBEAT_MS;

    if (diffRatio <= MOTION_RATIO_THRESHOLD && !heartbeatDue) return null;

    const frame = this.exportFrame(video);
    if (!frame) return null;

    this.lastThumbnail = thumbnail;
    this.lastCaptureAt = now;
    return frame;
  }

  /** Clear motion history (e.g. when the camera restarts). */
  reset(): void {
    this.lastThumbnail = null;
    this.lastCaptureAt = 0;
  }

  /** Downsample the current video frame to a 50x50 grayscale thumbnail. */
  private captureThumbnail(video: HTMLVideoElement): Uint8ClampedArray | null {
    if (!this.thumbCanvas) {
      this.thumbCanvas = document.createElement("canvas");
      this.thumbCanvas.width = THUMB_SIZE;
      this.thumbCanvas.height = THUMB_SIZE;
    }
    const ctx = this.thumbCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, THUMB_SIZE, THUMB_SIZE);
    const { data } = ctx.getImageData(0, 0, THUMB_SIZE, THUMB_SIZE);

    const gray = new Uint8ClampedArray(THUMB_SIZE * THUMB_SIZE);
    for (let i = 0; i < gray.length; i++) {
      const offset = i * 4;
      gray[i] = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
    }
    return gray;
  }

  /** Fraction of pixels whose grayscale value changed beyond the threshold. */
  private computeDiffRatio(
    current: Uint8ClampedArray,
    previous: Uint8ClampedArray
  ): number {
    let changed = 0;
    for (let i = 0; i < current.length; i++) {
      if (Math.abs(current[i] - previous[i]) > PIXEL_DELTA_THRESHOLD) {
        changed++;
      }
    }
    return changed / current.length;
  }

  /** Export the current frame as a 480x360 JPEG (quality 0.55), bare base64. */
  private exportFrame(video: HTMLVideoElement): string | null {
    if (!this.frameCanvas) {
      this.frameCanvas = document.createElement("canvas");
      this.frameCanvas.width = FRAME_WIDTH;
      this.frameCanvas.height = FRAME_HEIGHT;
    }
    const ctx = this.frameCanvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    const dataUrl = this.frameCanvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const base64 = dataUrl.split(",")[1];
    return base64 ? base64 : null;
  }
}

export const motionDetector = new MotionDetector();
