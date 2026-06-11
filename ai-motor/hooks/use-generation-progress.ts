"use client";

import { useCallback, useRef, useState } from "react";

/** Simulated progress for sync blocking generate calls (0→90% over duration, 100% on complete). */
export function useGenerationProgress(estimatedMs = 10_000) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const estimatedMsRef = useRef(estimatedMs);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stopInterval();
    estimatedMsRef.current = estimatedMs;
    startedAtRef.current = Date.now();
    setProgress(0);
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const ratio = Math.min(1, elapsed / estimatedMsRef.current);
      const pct = Math.min(90, Math.round(ratio * 90));
      setProgress(pct);
      if (pct >= 90) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, 120);
  }, [estimatedMs, stopInterval]);

  const complete = useCallback(() => {
    stopInterval();
    setProgress(100);
    window.setTimeout(() => setProgress(0), 400);
  }, [stopInterval]);

  const reset = useCallback(() => {
    stopInterval();
    setProgress(0);
  }, [stopInterval]);

  const etaSeconds = Math.max(1, Math.round(estimatedMs / 1000));

  return { progress, etaSeconds, start, complete, reset };
}
