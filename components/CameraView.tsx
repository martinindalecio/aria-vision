"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const FRAME_WIDTH = 480;
const FRAME_HEIGHT = 360;
const JPEG_QUALITY = 0.55;

export type CameraViewHandle = {
  /** Capture the current frame as a 480x360 JPEG, bare base64 (no prefix). */
  captureFrame: () => string | null;
  /** The live <video> element, for external frame processing. */
  getVideoElement: () => HTMLVideoElement | null;
};

type CameraViewProps = {
  isPaused: boolean;
  onTogglePause: () => void;
};

const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(
  function CameraView({ isPaused, onTogglePause }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        captureFrame: (): string | null => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas) return null;
          if (video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) {
            return null;
          }
          canvas.width = FRAME_WIDTH;
          canvas.height = FRAME_HEIGHT;
          const ctx = canvas.getContext("2d");
          if (!ctx) return null;
          ctx.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
          const base64 = canvas.toDataURL("image/jpeg", JPEG_QUALITY).split(",")[1];
          return base64 ? base64 : null;
        },
        getVideoElement: (): HTMLVideoElement | null => videoRef.current,
      }),
      []
    );

    useEffect(() => {
      let stream: MediaStream | null = null;
      let cancelled = false;

      const acquireWakeLock = async (): Promise<void> => {
        if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
        try {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        } catch {
          // Wake lock can be refused (low battery, unsupported) — non-fatal.
        }
      };

      const handleVisibility = (): void => {
        // Wake locks auto-release when the tab is hidden; re-acquire on return.
        if (document.visibilityState === "visible") {
          void acquireWakeLock();
        }
      };

      const start = async (): Promise<void> => {
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices?.getUserMedia
        ) {
          setCameraError("CAMERA UNSUPPORTED — REQUIRES HTTPS OR LOCALHOST");
          return;
        }
        try {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: "user" },
              audio: false,
            });
          }
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            await video.play().catch(() => undefined);
          }
          setCameraError(null);
          await acquireWakeLock();
        } catch {
          if (!cancelled) {
            setCameraError("CAMERA OFFLINE — CHECK PERMISSIONS");
          }
        }
      };

      document.addEventListener("visibilitychange", handleVisibility);
      void start();

      return () => {
        cancelled = true;
        document.removeEventListener("visibilitychange", handleVisibility);
        stream?.getTracks().forEach((track) => track.stop());
        void wakeLockRef.current?.release().catch(() => undefined);
        wakeLockRef.current = null;
      };
    }, []);

    return (
      <div
        className="fixed inset-0 z-0 h-screen w-screen bg-black"
        onClick={onTogglePause}
        role="button"
        aria-label={isPaused ? "Resume ARIA feed" : "Pause ARIA feed"}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            isPaused ? "opacity-40" : "opacity-100"
          }`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {cameraError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
            <span className="glow text-center font-mono text-sm tracking-widest text-hud">
              {cameraError}
            </span>
          </div>
        )}

        {isPaused && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
            <span className="glow font-mono text-sm tracking-[0.3em] text-hud">
              ⏸ PAUSED — TAP TO RESUME
            </span>
          </div>
        )}
      </div>
    );
  }
);

export default CameraView;
