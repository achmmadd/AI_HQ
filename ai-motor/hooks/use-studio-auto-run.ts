"use client";

import { useEffect, useRef } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

type SearchParamsLike = {
  get: (key: string) => string | null;
  toString: () => string;
};

/**
 * Voert een studio-actie uit wanneer URL `run=1` + prompt bevat;
 * verwijdert daarna `run` uit de URL.
 */
export function useStudioAutoRun(opts: {
  pathname: string;
  searchParams: SearchParamsLike;
  router: AppRouterInstance;
  onRun: (prompt: string) => Promise<void>;
  promptKey?: string;
}) {
  const { pathname, searchParams, router, onRun, promptKey = "prompt" } = opts;
  const ranRef = useRef(false);

  useEffect(() => {
    ranRef.current = false;
  }, [searchParams.toString()]);

  useEffect(() => {
    if (searchParams.get("run") !== "1" || ranRef.current) return;
    const prompt = searchParams.get(promptKey)?.trim();
    if (!prompt) return;
    ranRef.current = true;
    void (async () => {
      await onRun(prompt);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("run");
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    })();
  }, [onRun, pathname, promptKey, router, searchParams]);
}
