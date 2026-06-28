"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CameraView, { type CameraViewHandle } from "@/components/CameraView";
import HUDOverlay from "@/components/HUDOverlay";
import LangPrompt from "@/components/LangPrompt";
import { motionDetector } from "@/lib/motionDetector";
import { parseLang, type Lang } from "@/lib/i18n";
import { getSessionLocation, type GeoResult } from "@/lib/geo";

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

function safeLsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeLsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private browsing — silent */ }
}

export default function Home() {
  // undefined = reading localStorage (avoid first-paint flash for returning users)
  // null = localStorage read, no lang stored → show LangPrompt
  // Lang = ready
  const [lang, setLang] = useState<Lang | null | undefined>(undefined);

  const [lines, setLines] = useState<string[]>([BOOT_LINE]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [sceneCount, setSceneCount] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const cameraRef = useRef<CameraViewHandle>(null);
  const linesRef = useRef<string[]>([BOOT_LINE]);
  const pausedRef = useRef<boolean>(false);
  const inFlightRef = useRef<boolean>(false);
  const throttleUntilRef = useRef<number>(0);
  const geoRef = useRef<GeoResult | null>(null);
  const locationStartedRef = useRef<boolean>(false);

  // Read stored language preference on mount
  useEffect(() => {
    const stored = safeLsGet("aria:lang");
    setLang(stored ? parseLang(stored) : null);
  }, []);

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

  const toggleFacing = useCallback((): void => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  const toggleLang = useCallback((): void => {
    setLang((prev) => {
      const next: Lang = prev === "es" ? "en" : "es";
      safeLsSet("aria:lang", next);
      return next;
    });
  }, []);

  function handleLangSelect(chosen: Lang): void {
    safeLsSet("aria:lang", chosen);
    setLang(chosen);
  }

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
        body: JSON.stringify({
          imageBase64: frame,
          prevContext,
          ...(geoRef.current ? { geo: geoRef.current } : {}),
        }),
      });
      if (res.status === 429) {
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

  // Track connectivity
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

  // Acquire GPS location once after lang is chosen — runs in parallel with capture loop.
  useEffect(() => {
    if (!lang || locationStartedRef.current) return;
    locationStartedRef.current = true;
    pushLine("[ALLOW LOCATION TO PIN YOUR CITY — OPTIONAL]");
    void getSessionLocation().then((result) => {
      geoRef.current = result;
    });
  }, [lang, pushLine]);

  // Capture loop — only starts after lang is chosen
  useEffect(() => {
    if (!lang) return;
    const captureTick = window.setInterval(() => {
      void runCapture();
    }, CAPTURE_TICK_MS);
    return () => window.clearInterval(captureTick);
  }, [runCapture, lang]);

  // Loading: lang not yet read from localStorage — render nothing (imperceptible)
  if (lang === undefined) {
    return <main className="h-screen w-screen overflow-hidden bg-black" />;
  }

  // New user: lang not chosen → boot screen
  if (lang === null) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-black">
        <LangPrompt onSelect={handleLangSelect} />
      </main>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-black">
      <CameraView
        ref={cameraRef}
        isPaused={isPaused}
        facingMode={facingMode}
        onTogglePause={togglePause}
      />
      <HUDOverlay
        lines={lines}
        isLoading={isLoading}
        sceneCount={sceneCount}
        isPaused={isPaused}
        isOnline={isOnline}
        lang={lang}
        onToggleLang={toggleLang}
        onToggleFacing={toggleFacing}
      />
    </main>
  );
}
