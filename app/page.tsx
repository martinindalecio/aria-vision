"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CameraView, { type CameraViewHandle } from "@/components/CameraView";
import HUDOverlay from "@/components/HUDOverlay";
import { motionDetector } from "@/lib/motionDetector";

const MAX_LINES = 3;
const CAPTURE_TICK_MS = 100;
const BOOT_LINE = "[ARIA ONLINE — AWAITING VISUAL FEED]";
const THROTTLE_LINE = "[ARIA THROTTLED — QUEUED]";

type VisionResponse = {
  result: string;
  inputTokens: number;
  outputTokens: number;
  sceneCount?: number;
};

export default function Home() {
  const [lines, setLines] = useState<string[]>([BOOT_LINE]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [sceneCount, setSceneCount] = useState<number>(0);

  const cameraRef = useRef<CameraViewHandle>(null);
  const linesRef = useRef<string[]>([BOOT_LINE]);
  const pausedRef = useRef<boolean>(false);
  const inFlightRef = useRef<boolean>(false);
  const throttleUntilRef = useRef<number>(0);

  const pushLine = useCallback((text: string): void => {
    setLines((prev) => {
      const next = [...prev, text].slice(-MAX_LINES);
      linesRef.current = next;
      return next;
    });
  }, []);

  const togglePause = useCallback((): void => {
    setIsPaused((prev) => {
      pausedRef.current = !prev;
      return !prev;
    });
  }, []);

  const runCapture = useCallback(async (): Promise<void> => {
    if (pausedRef.current || inFlightRef.current) return;
    if (Date.now() < throttleUntilRef.current) return;

    const video = cameraRef.current?.getVideoElement() ?? null;
    const frame = motionDetector.shouldCapture(video);
    if (!frame) return;

    inFlightRef.current = true;
    setIsLoading(true);
    try {
      const prevContext = linesRef.current[linesRef.current.length - 1] ?? "";
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: frame, prevContext }),
      });
      if (res.status === 429) {
        // Global rate limit hit — back off for the server-suggested window and
        // show a calm "queued" state instead of a connection error.
        const retryAfter = Number(res.headers.get("Retry-After")) || 4;
        throttleUntilRef.current = Date.now() + retryAfter * 1000;
        if (linesRef.current[linesRef.current.length - 1] !== THROTTLE_LINE) {
          pushLine(THROTTLE_LINE);
        }
        setIsOnline(true);
        return;
      }
      if (!res.ok) {
        throw new Error(`vision API responded ${res.status}`);
      }
      const data = (await res.json()) as VisionResponse;
      if (data.sceneCount !== undefined) setSceneCount(data.sceneCount);
      pushLine(data.result);
      setIsOnline(true);
    } catch {
      pushLine("[SIGNAL LOST — RECONNECTING]");
      setIsOnline(false);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [pushLine]);

  // Track connectivity.
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = (): void => setIsOnline(true);
    const goOffline = (): void => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Capture loop — 100ms tick, MotionDetector enforces the real rate limits.
  useEffect(() => {
    const captureTick = window.setInterval(() => {
      void runCapture();
    }, CAPTURE_TICK_MS);
    return () => window.clearInterval(captureTick);
  }, [runCapture]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-black">
      <CameraView ref={cameraRef} isPaused={isPaused} onTogglePause={togglePause} />
      <HUDOverlay
        lines={lines}
        isLoading={isLoading}
        sceneCount={sceneCount}
        isPaused={isPaused}
        isOnline={isOnline}
      />
    </main>
  );
}
