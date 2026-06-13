"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { BrandKitWizardStep } from "@/components/photo-studio/brand-kit-wizard-step";
import type { BrandKitRow } from "@/lib/photo-studio/brand-kit/types";
import {
  buildCampaignWizardSearchParams,
  clearCampaignWizardSession,
  readCampaignWizardFromSearchParams,
  readCampaignWizardSession,
  readCampaignWizardState,
  writeCampaignWizardSession,
  writeCampaignWizardState,
} from "@/lib/photo-studio/campaign/wizard-storage";
import {
  canAdvanceWizardStep,
  sanitizeWizardStepAfterRefresh,
  WIZARD_STEPS,
  wizardPrevStep,
  type WizardStep,
} from "@/lib/photo-studio/campaign/wizard-steps";
import type {
  AdStrategyResult,
  CampaignGoal,
  CampaignPackRow,
  CopyGeneratorResult,
} from "@/lib/photo-studio/campaign/types";
import { CAMPAIGN_GOALS } from "@/lib/photo-studio/campaign/types";
import { QualityBadges, QualitySummaryBadge } from "@/components/photo-studio/quality-badges";
import { CampaignProgressStepper } from "@/components/photo-studio/campaign-progress-stepper";
import { fetchJsonChecked } from "@/lib/fetch-json-client";
import type { CampaignStudioConfig } from "@/lib/photo-studio/campaign/studio-config";
import { cn } from "@/lib/utils";

type CampaignJobPollResponse = {
  ok?: boolean;
  job_id?: string;
  jobId?: string;
  status?: "processing" | "done" | "error";
  pack_id?: string;
  pack?: CampaignPackRow;
  phase?: string | null;
  progress?: {
    static_done?: number;
    static_total?: number;
    video_done?: number;
    video_total?: number;
  } | null;
  progress_message?: string | null;
  download_url?: string | null;
  partial?: boolean;
  error?: string;
  detail?: string;
  media_skip_reason?: string | null;
  config?: CampaignStudioConfig;
};

const POLL_INTERVAL_MS = 2_500;
const MAX_POLL_MS = 600_000;

function is524Error(message: string): boolean {
  return message.includes("524") || message.includes("time-out");
}

async function pollCampaignJob(
  jobId: string,
  onProgress: (job: CampaignJobPollResponse) => void,
  signal?: AbortSignal
): Promise<CampaignJobPollResponse> {
  const started = Date.now();
  while (Date.now() - started < MAX_POLL_MS) {
    if (signal?.aborted) {
      throw new DOMException("Polling geannuleerd", "AbortError");
    }
    const job = await fetchJsonChecked<CampaignJobPollResponse>(
      `/api/fumero/campaign/jobs/${encodeURIComponent(jobId)}`,
      { credentials: "include", signal }
    );
    onProgress(job);

    if (job.status === "done") return job;
    if (job.status === "error") {
      if (job.partial && job.pack) return job;
      throw new Error(job.error || "Campaign pack genereren mislukt.");
    }

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, POLL_INTERVAL_MS);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          reject(new DOMException("Polling geannuleerd", "AbortError"));
        },
        { once: true }
      );
    });
  }
  throw new Error(
    "Server time-out (Cloudflare 524). Het antwoord duurde te lang — probeer opnieuw of kies “Alleen strategy + copy”."
  );
}

export function CampaignStudioWizard({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useRef(false);
  const skipPersist = useRef(true);
  const pollAbortRef = useRef<AbortController | null>(null);

  const [step, setStep] = useState<WizardStep>("brand");
  const [kits, setKits] = useState<BrandKitRow[]>([]);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [goal, setGoal] = useState<CampaignGoal>("verkoop");
  const [strategy, setStrategy] = useState<AdStrategyResult | null>(null);
  const [copy, setCopy] = useState<CopyGeneratorResult | null>(null);
  const [pack, setPack] = useState<CampaignPackRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipMedia, setSkipMedia] = useState(false);
  const [studioConfig, setStudioConfig] = useState<CampaignStudioConfig | null>(null);
  const [jobProgress, setJobProgress] = useState<string | null>(null);
  const [jobPhase, setJobPhase] = useState<string | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const jobId = resumeJobRef.current;
    if (!jobId || loading) return;
    resumeJobRef.current = null;
    void (async () => {
      setLoading(true);
      setError(null);
      setStep("generate");
      setJobPhase("static");
      setJobProgress("Generatie hervat na refresh…");
      pollAbortRef.current?.abort();
      const pollAc = new AbortController();
      pollAbortRef.current = pollAc;
      try {
        const finished = await pollCampaignJob(
          jobId,
          (job) => {
            setJobPhase(job.phase ?? null);
            setJobProgress(job.progress_message ?? null);
          },
          pollAc.signal
        );
        if (finished.config) setStudioConfig(finished.config);
        const resultPack = finished.pack ?? null;
        setPack(resultPack);
        setCopy(resultPack?.copy ?? null);
        setStrategy(resultPack?.strategy ?? null);
        if (finished.partial || finished.status === "error") {
          setPartialWarning(
            finished.error ??
              "Generatie stopte voortijdig — hieronder zie je wat wél is gelukt."
          );
        }
        setStep("preview");
        clearCampaignWizardSession(
          typeof window !== "undefined" ? window.sessionStorage : null
        );
      } catch (err) {
        clearCampaignWizardSession(
          typeof window !== "undefined" ? window.sessionStorage : null
        );
        setError(err instanceof Error ? err.message : "Hervatten mislukt.");
        setStep("concepts");
      } finally {
        setLoading(false);
        setJobProgress(null);
        setJobPhase(null);
      }
    })();
  }, [loading]);

  const confirmedKits = kits.filter((k) => k.status === "confirmed");
  const selectedKit = confirmedKits.find((k) => k.id === selectedKitId) ?? null;
  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);

  const persistState = useCallback(
    (patch: Partial<{ step: WizardStep; selectedKitId: string | null; goal: CampaignGoal }>) => {
      const next = {
        step: patch.step ?? step,
        selectedKitId: patch.selectedKitId !== undefined ? patch.selectedKitId : selectedKitId,
        goal: patch.goal ?? goal,
      };
      writeCampaignWizardState(next, typeof window !== "undefined" ? window.localStorage : null);
      const params = buildCampaignWizardSearchParams(next);
      router.replace(`/fumero/campaign-studio?${params.toString()}`, { scroll: false });
    },
    [step, selectedKitId, goal, router]
  );

  const resumeJobRef = useRef<string | null>(null);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const sessionStorage =
      typeof window !== "undefined" ? window.sessionStorage : null;
    const session = readCampaignWizardSession(sessionStorage);
    const fromUrl = readCampaignWizardFromSearchParams(searchParams);
    const fromStorage = readCampaignWizardState(
      typeof window !== "undefined" ? window.localStorage : null
    );
    const rawStep = fromUrl.step ?? fromStorage.step;
    const initialStep = sanitizeWizardStepAfterRefresh(rawStep, session);
    const initialKit =
      session?.selectedKitId ?? fromUrl.selectedKitId ?? fromStorage.selectedKitId;
    setStep(initialStep);
    setSelectedKitId(initialKit);
    setGoal(session?.goal ?? fromUrl.goal ?? fromStorage.goal);
    if (session?.jobId && (initialStep === "generate" || initialStep === "preview")) {
      resumeJobRef.current = session.jobId;
    }
    skipPersist.current = false;
  }, [searchParams]);

  useEffect(() => {
    if (!hydrated.current || skipPersist.current) return;
    persistState({});
  }, [step, selectedKitId, goal, persistState]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchJsonChecked<{
          config?: CampaignStudioConfig;
        }>("/api/fumero/campaign/generate", { credentials: "include" });
        if (cancelled || !data.config) return;
        setStudioConfig(data.config);
        if (data.config.default_skip_media) {
          setSkipMedia(true);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleKitsLoaded = useCallback((items: BrandKitRow[]) => {
    setKits(items);
    setSelectedKitId((current) => {
      if (current && items.some((k) => k.id === current && k.status === "confirmed")) {
        return current;
      }
      const firstConfirmed = items.find((k) => k.status === "confirmed");
      return firstConfirmed?.id ?? current;
    });
  }, []);

  const handleSelectKit = useCallback((kitId: string) => {
    setSelectedKitId(kitId);
    setError(null);
  }, []);

  const handleKitConfirmed = useCallback((kitId: string) => {
    setSelectedKitId(kitId);
    setStep("goal");
    setError(null);
  }, []);

  async function runStrategy() {
    if (!selectedKitId || !selectedKit) {
      setError("Selecteer een bevestigde Brand Kit om verder te gaan.");
      return;
    }
    setLoading(true);
    setError(null);
    setJobPhase("strategy");
    setJobProgress("Advertentieconcepten worden gegenereerd…");
    try {
      const data = await fetchJsonChecked<{
        strategy?: AdStrategyResult;
        error?: string;
        config?: CampaignStudioConfig;
      }>("/api/fumero/campaign/strategy", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_kit_id: selectedKitId, goal }),
      });
      if (data.config) {
        setStudioConfig(data.config);
        if (data.config.default_skip_media) setSkipMedia(true);
      }
      if (!data.strategy?.concepts?.length) {
        throw new Error("Geen advertentieconcepten ontvangen — probeer opnieuw.");
      }
      setStrategy(data.strategy);
      setStep("concepts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Strategie genereren mislukt.");
    } finally {
      setLoading(false);
      setJobProgress(null);
      setJobPhase(null);
    }
  }

  async function runGenerate() {
    if (!selectedKitId) return;
    setLoading(true);
    setError(null);
    setPartialWarning(null);
    setCanRetry(false);
    setStep("generate");
    setJobPhase("strategy");
    setJobProgress("Campaign pack starten…");
    pollAbortRef.current?.abort();
    const pollAc = new AbortController();
    pollAbortRef.current = pollAc;
    try {
      const startRes = await fetch("/api/fumero/campaign/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_kit_id: selectedKitId,
          goal,
          skip_media: skipMedia,
          strategy: strategy ?? undefined,
        }),
      });
      const startText = await startRes.text();
      let startData: {
        job_id?: string;
        jobId?: string;
        status?: string;
        pack?: CampaignPackRow;
        error?: string;
        detail?: string;
        media_skip_reason?: string | null;
        config?: CampaignStudioConfig;
      };
      try {
        startData = JSON.parse(startText) as typeof startData;
      } catch {
        throw new Error(
          startRes.status === 524
            ? "Server time-out (Cloudflare 524). Het antwoord duurde te lang — probeer opnieuw."
            : "Ongeldig antwoord van de server."
        );
      }

      if (!startRes.ok) {
        const msg = startData.error
          ? startData.detail
            ? `${startData.error} — ${startData.detail}`
            : startData.error
          : `HTTP ${startRes.status}`;
        throw new Error(msg);
      }

      if (startData.config) setStudioConfig(startData.config);

      if (startRes.status === 202) {
        const jobId = startData.job_id ?? startData.jobId;
        if (!jobId) throw new Error("Async job starten mislukt — geen job_id.");

        writeCampaignWizardSession(
          {
            step: "generate",
            jobId,
            selectedKitId,
            goal,
            startedAt: Date.now(),
          },
          typeof window !== "undefined" ? window.sessionStorage : null
        );

        const finished = await pollCampaignJob(
          jobId,
          (job) => {
            setJobPhase(job.phase ?? null);
            setJobProgress(job.progress_message ?? null);
          },
          pollAc.signal
        );

        if (finished.config) setStudioConfig(finished.config);
        const resultPack = finished.pack ?? null;
        setPack(resultPack);
        setCopy(resultPack?.copy ?? null);
        setStrategy(resultPack?.strategy ?? strategy);
        if (finished.partial || finished.status === "error") {
          setPartialWarning(
            finished.error ??
              "Generatie stopte voortijdig — hieronder zie je wat wél is gelukt."
          );
        }
        setStep("preview");
        clearCampaignWizardSession(
          typeof window !== "undefined" ? window.sessionStorage : null
        );
        return;
      }

      setPack(startData.pack ?? null);
      setCopy(startData.pack?.copy ?? null);
      setStrategy(startData.pack?.strategy ?? strategy);
      setStep("preview");
      clearCampaignWizardSession(
        typeof window !== "undefined" ? window.sessionStorage : null
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Onbekende fout";
      if (studioConfig && !studioConfig.fal_configured && !skipMedia) {
        setError(
          `${message} Tip: vink “Alleen strategy + copy” aan — FAL_KEY ontbreekt op de server.`
        );
      } else if (is524Error(message)) {
        setError(
          "Server time-out (Cloudflare 524). Het antwoord duurde te lang — media-generatie duurt soms meer dan 2 minuten. Probeer opnieuw of kies “Alleen strategy + copy”."
        );
        setCanRetry(true);
      } else {
        setError(message);
        setCanRetry(true);
      }
      setStep("concepts");
      clearCampaignWizardSession(
        typeof window !== "undefined" ? window.sessionStorage : null
      );
    } finally {
      setLoading(false);
      setJobProgress(null);
      setJobPhase(null);
    }
  }

  function nextStep() {
    if (step === "brand" && selectedKitId) setStep("goal");
    else if (step === "goal") void runStrategy();
    else if (step === "concepts") void runGenerate();
  }

  function prevStep() {
    const prev = wizardPrevStep(step);
    if (prev) setStep(prev);
  }

  const canGoNext = canAdvanceWizardStep(step, {
    selectedKitId: selectedKit?.id ?? null,
    hasStrategy: Boolean(strategy?.concepts?.length),
  });

  return (
    <div className={cn("mx-auto max-w-4xl space-y-6 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-8 md:pb-8", className)}>
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-[var(--fumero-accent)]" />
          <h1 className="fumero-text-heading text-[var(--fumero-text)]">
            Campaign Studio
          </h1>
        </div>
        <p className="fumero-text-body-sm text-[var(--fumero-text-muted)]">
          Brand Kit → campagnedoel → 3 advertentieconcepten → copy + static + video → download pack.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Wizard stappen">
        {WIZARD_STEPS.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1 fumero-text-caption",
              i <= stepIndex
                ? "bg-[var(--fumero-accent-muted)] text-[var(--fumero-accent)]"
                : "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-muted)]"
            )}
          >
            {i < stepIndex ? <Check className="h-3 w-3" /> : null}
            {s.label}
          </div>
        ))}
      </nav>

      {studioConfig?.hints.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 fumero-text-body-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">Serverconfiguratie</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {studioConfig.hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
          {!studioConfig.fal_configured ? (
            <label className="mt-3 flex items-center gap-2 font-normal">
              <input
                type="checkbox"
                checked={skipMedia}
                onChange={(e) => setSkipMedia(e.target.checked)}
              />
              Alleen strategy + copy (aanbevolen zonder FAL_KEY)
            </label>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 fumero-text-body-sm text-red-700">
          <p>{error}</p>
          {canRetry ? (
            <button
              type="button"
              onClick={() => void runGenerate()}
              disabled={loading}
              className="mt-3 inline-flex h-8 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 fumero-text-caption font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Opnieuw proberen
            </button>
          ) : null}
        </div>
      ) : null}

      {partialWarning ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 fumero-text-body-sm text-amber-900">
          {partialWarning}
        </div>
      ) : null}

      {step === "brand" ? (
        <section className="rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-5">
          <h2 className="mb-4 fumero-text-subheading text-[var(--fumero-text)]">
            Stap 1 — Brand Kit
          </h2>
          <BrandKitWizardStep
            selectedKitId={selectedKitId}
            onSelectKit={handleSelectKit}
            onKitConfirmed={handleKitConfirmed}
            onKitsLoaded={handleKitsLoaded}
          />
        </section>
      ) : null}

      {step === "goal" ? (
        <section className="space-y-4 rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-5">
          <h2 className="fumero-text-subheading text-[var(--fumero-text)]">Campagnedoel</h2>
          <p className="fumero-text-body-sm text-[var(--fumero-text-muted)]">
            Product: <strong>{selectedKit?.product_name}</strong>
          </p>
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--fumero-accent)]" />
              <p className="fumero-text-body-sm text-[var(--fumero-text-muted)]">
                Advertentieconcepten worden gegenereerd…
              </p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {CAMPAIGN_GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoal(g.id)}
                  disabled={loading}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left",
                    goal === g.id
                      ? "border-[var(--fumero-accent)] bg-[var(--fumero-accent-muted)]"
                      : "border-[var(--fumero-border)]"
                  )}
                >
                  <p className="font-medium">{g.label}</p>
                  <p className="fumero-text-caption text-[var(--fumero-text-muted)]">
                    {g.description}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {step === "concepts" && strategy ? (
        <section className="space-y-4 rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-5">
          <h2 className="fumero-text-subheading text-[var(--fumero-text)]">
            3 Advertentieconcepten
          </h2>
          <p className="fumero-text-caption text-[var(--fumero-text-muted)]">
            Bron: {strategy.source === "llm" ? "AI strategie" : "Template fallback"}
          </p>
          <div className="grid gap-3">
            {strategy.concepts.map((c) => (
              <article
                key={c.angle}
                className="rounded-lg border border-[var(--fumero-border)] p-4"
              >
                <p className="fumero-text-caption font-semibold uppercase text-[var(--fumero-accent)]">
                  {c.angle_label}
                </p>
                <p className="mt-1 font-medium text-[var(--fumero-text)]">{c.hook}</p>
                <p className="mt-2 fumero-text-body-sm text-[var(--fumero-text-muted)]">
                  {c.visual_direction}
                </p>
              </article>
            ))}
          </div>
          <div className="rounded-lg border-2 border-[var(--fumero-accent)] bg-[var(--fumero-accent-muted)] p-4">
            <label className="flex cursor-pointer items-start gap-3 fumero-text-body-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={skipMedia}
                onChange={(e) => setSkipMedia(e.target.checked)}
              />
              <span>
                <span className="font-semibold text-[var(--fumero-text)]">
                  Alleen strategy + copy
                </span>
                <span className="mt-1 block text-[var(--fumero-text-muted)]">
                  Sla static creatives en video over — sneller en betrouwbaarder
                  {studioConfig?.template_only ? " (aanbevolen in template-modus)" : ""}.
                </span>
              </span>
            </label>
          </div>
        </section>
      ) : null}

      {step === "generate" ? (
        <section className="flex flex-col items-center gap-6 py-12">
          <CampaignProgressStepper
            phase={jobPhase}
            message={jobProgress ?? "Campaign pack wordt gebouwd…"}
          />
          {!skipMedia && studioConfig?.fal_configured ? (
            <p className="max-w-md text-center fumero-text-caption text-[var(--fumero-text-muted)]">
              Static creatives en video worden op de achtergrond gegenereerd — dit kan enkele minuten duren.
            </p>
          ) : null}
        </section>
      ) : null}

      {step === "preview" && !(pack || copy || strategy) ? (
        <section className="rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-8 text-center">
          <p className="fumero-text-body-sm text-[var(--fumero-text-muted)]">
            Geen pack in dit tabblad — genereer opnieuw of ga terug naar advertentieconcepten.
          </p>
          <button
            type="button"
            onClick={() => setStep(strategy ? "concepts" : "goal")}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--fumero-accent)] px-4 fumero-text-body-sm font-semibold text-[var(--fumero-accent-foreground)]"
          >
            {strategy ? "Terug naar concepten" : "Naar campagnedoel"}
          </button>
        </section>
      ) : null}

      {step === "preview" && (pack || copy || strategy) ? (
        <section className="space-y-6">
          {pack ? (
            <div className="rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="fumero-text-subheading text-[var(--fumero-text)]">
                    {pack.product_name} — {pack.goal}
                  </h2>
                  <p className="fumero-text-caption text-[var(--fumero-text-muted)]">
                    Pack {pack.id} · {pack.status}
                  </p>
                </div>
                {pack.zip_path ? (
                  <a
                    href={`/api/fumero/campaign/${pack.id}/download`}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--fumero-accent)] px-4 fumero-text-body-sm font-semibold text-[var(--fumero-accent-foreground)]"
                  >
                    <Download className="h-4 w-4" />
                    Download ZIP
                  </a>
                ) : null}
              </div>
              {pack.errors.length ? (
                <ul className="mt-3 space-y-1 fumero-text-caption text-amber-700">
                  {pack.errors.map((e) => (
                    <li key={e}>⚠ {e}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {strategy && !pack ? (
            <div className="rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-5">
              <h3 className="mb-3 fumero-text-subheading">Strategie</h3>
              <div className="grid gap-3">
                {strategy.concepts.map((c) => (
                  <article
                    key={c.angle}
                    className="rounded-lg border border-[var(--fumero-border)] p-4"
                  >
                    <p className="fumero-text-caption font-semibold uppercase text-[var(--fumero-accent)]">
                      {c.angle_label}
                    </p>
                    <p className="mt-1 font-medium text-[var(--fumero-text)]">{c.hook}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {copy ? (
            <div className="rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-5">
              <h3 className="mb-3 fumero-text-subheading">Copy sets ({copy.sets.length})</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {copy.sets.map((s) => (
                  <div
                    key={`${s.angle}-${s.hook_variant}`}
                    className="rounded-lg border border-[var(--fumero-border)] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="fumero-text-caption font-semibold uppercase">
                        {s.angle} v{s.hook_variant}
                      </span>
                      {s.policy_pass ? (
                        <span className="fumero-text-caption text-emerald-600">Policy OK</span>
                      ) : (
                        <span className="fumero-text-caption text-amber-600">Policy check</span>
                      )}
                    </div>
                    <p className="font-medium">{s.headline}</p>
                    <p className="mt-1 fumero-text-caption text-[var(--fumero-text-muted)]">
                      {s.primary_text.slice(0, 120)}…
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {pack && pack.static_assets.filter((a) => a.public_url).length ? (
            <div className="rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-5">
              <h3 className="mb-3 fumero-text-subheading">Static creatives</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pack.static_assets
                  .filter((a) => a.public_url)
                  .map((a) => (
                    <div key={a.filename} className="space-y-2">
                      <div className="relative aspect-square overflow-hidden rounded-lg border border-[var(--fumero-border)]">
                        <Image
                          src={a.public_url}
                          alt={a.filename}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="fumero-text-caption">{a.format}</span>
                        <QualitySummaryBadge pass={a.quality_pass} />
                      </div>
                      <QualityBadges checks={a.quality_checks} compact />
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          {pack && pack.video_assets.filter((a) => a.public_url).length ? (
            <div className="rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-5">
              <h3 className="mb-3 fumero-text-subheading">Reels video</h3>
              {pack.video_assets
                .filter((a) => a.public_url)
                .map((a) => (
                  <div key={a.filename} className="space-y-2">
                    <video
                      src={a.public_url}
                      controls
                      className="max-h-96 w-full rounded-lg"
                    />
                    <QualityBadges checks={a.quality_checks} />
                  </div>
                ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <footer className="sticky bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-10 flex items-center justify-between border-t border-[var(--fumero-border)] bg-[var(--fumero-bg)]/95 py-4 backdrop-blur-sm md:bottom-0 md:pb-4">
        <button
          type="button"
          onClick={prevStep}
          disabled={stepIndex === 0 || loading}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--fumero-border)] px-3 fumero-text-body-sm disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug
        </button>

        {step !== "generate" && step !== "preview" ? (
          <button
            type="button"
            onClick={nextStep}
            disabled={loading || !canGoNext}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--fumero-accent)] px-4 fumero-text-body-sm font-semibold text-[var(--fumero-accent-foreground)] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : step === "concepts" ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {step === "goal"
              ? "Genereer concepten"
              : step === "concepts"
                ? "Genereer campaign pack"
                : "Volgende"}
          </button>
        ) : null}
      </footer>
    </div>
  );
}
