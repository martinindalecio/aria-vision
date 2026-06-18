"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CameraView, { type CameraViewHandle } from "@/components/CameraView";
import HUDOverlay from "@/components/HUDOverlay";
import { motionDetector } from "@/lib/motionDetector";
import { costTracker, type TokenTotals } from "@/lib/costTracker";

const MAX_LINES = 3;
const CAPTURE_TICK_MS = 100;
const COST_REFRESH_MS = 2000;
const BOOT_LINE = "[ARIA ONLINE — AWAITING VISUAL FEED]";

type VisionResponse = {
  result: string;
  inputTokens: number;
  outputTokens: number;
};

export default function Home() {
  const [lines, setLines] = useState<string[]>([BOOT_LINE]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [cost, setCost] = useState<string>("$0.0000");
  const [tokens, setTokens] = useState<TokenTotals>({ input: 0, output: 0 });

  const cameraRef = useRef<CameraViewHandle>(null);
  const linesRef = useRef<string[]>([BOOT_LINE]);
  const pausedRef = useRef<boolean>(false);
  const inFlightRef = useRef<boolean>(false);

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
      if (!res.ok) {
        throw new Error(`vision API responded ${res.status}`);
      }
      const data = (await res.json()) as VisionResponse;
      costTracker.addUsage(data.inputTokens, data.outputTokens);
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

  // Hydrate persisted totals + track connectivity.
  useEffect(() => {
    setCost(costTracker.getTotal());
    setTokens(costTracker.getTokens());
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

  // Capture loop (100ms tick — MotionDetector enforces the real rate limits)
  // and the 2s cost display refresh.
  useEffect(() => {
    const captureTick = window.setInterval(() => {
      void runCapture();
    }, CAPTURE_TICK_MS);

    const costTick = window.setInterval(() => {
      setCost(costTracker.getTotal());
      setTokens(costTracker.getTokens());
    }, COST_REFRESH_MS);

    return () => {
      window.clearInterval(captureTick);
      window.clearInterval(costTick);
    };
  }, [runCapture]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-black">
      <CameraView ref={cameraRef} isPaused={isPaused} onTogglePause={togglePause} />
      <HUDOverlay
        lines={lines}
        isLoading={isLoading}
        cost={cost}
        tokens={tokens}
        isPaused={isPaused}
        isOnline={isOnline}
      />
    </main>
  );
}
