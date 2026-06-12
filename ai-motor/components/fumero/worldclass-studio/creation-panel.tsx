"use client";
import { ImagePlus, Loader2, Settings2, Square, X } from "lucide-react";
import { ContentStudioGenerationProgress } from "@/components/photo-studio/content-studio-generation-progress";
import { ContentStudioModelPicker } from "@/components/photo-studio/content-studio-model-picker";
import { ContentStudioSettingsPopover } from "@/components/photo-studio/content-studio-settings-popover";
import type { usePhotoStudioGeneration } from "@/hooks/use-photo-studio-generation";
import { canSubmitGeneration } from "@/lib/fumero/worldclass-studio/prompt-submit";
import { starterTemplatesForKlant } from "@/lib/photo-studio/starter-templates";
import {
  CREATION_SPEED_PRESETS,
  type CreationSpeedPreset,
  type StarterTemplate,
} from "@/lib/photo-studio/types";
import type { CompanyId } from "@/lib/types";
import { useState } from "react";
type Gen = ReturnType<typeof usePhotoStudioGeneration>;
type Props = { klant: CompanyId; studio: Gen; step: 1 | 2 | 3 };
export function CreationPanel({ klant, studio, step }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    prompt,
    setPrompt,
    mediaType,
    setMediaType,
    settings,
    patchSettings,
    refs,
    uploading,
    fileRef,
    frameFileRef,
    creditsLabel,
    creditsLoading,
    startFrame,
    setStartFrame,
    maxRefs,
    isVideo,
    isEdit,
    busy,
    genProgress,
    generate,
    cancelGenerate,
    uploadImages,
    uploadStartFrame,
    removeRef,
    applyStarter,
  } = studio;
  const activePreset = settings.speed_preset ?? "balans";
  const applySpeedPreset = (preset: CreationSpeedPreset) => {
    const meta = CREATION_SPEED_PRESETS[preset];
    patchSettings({
      speed_preset: preset,
      model: meta.model,
      quality: meta.quality,
    });
  };
  const starters = starterTemplatesForKlant(klant).filter(
    (t) => mediaType !== "video" || t.tags.includes("video"),
  );
  const canSubmit = canSubmitGeneration(prompt, refs.length, mediaType, busy);
  const onPromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) void generate();
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
      {" "}
      <div>
        {" "}
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--wc-text)]">
          {" "}
          Wat wil je maken?{" "}
        </h2>{" "}
        <div className="wc-step-indicator mt-2">
          {" "}
          <span
            className={`wc-step-dot${step >= 1 ? " wc-step-dot--active" : ""}`}
          />{" "}
          <span>Beschrijven</span>{" "}
          <span className="mx-1 text-[var(--wc-text-subtle)]">→</span>{" "}
          <span
            className={`wc-step-dot${step >= 2 ? " wc-step-dot--active" : ""}`}
          />{" "}
          <span>Bekijken</span>{" "}
          <span className="mx-1 text-[var(--wc-text-subtle)]">→</span>{" "}
          <span
            className={`wc-step-dot${step >= 3 ? " wc-step-dot--active" : ""}`}
          />{" "}
          <span>Publiceren</span>{" "}
        </div>{" "}
      </div>{" "}
      <div
        className="inline-flex self-start rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface-muted)] p-0.5"
        role="group"
        aria-label="Media type"
      >
        {" "}
        {(["image", "video"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`rounded-md px-3 py-1 text-[13px] font-medium transition-colors ${mediaType === m ? "bg-[var(--wc-surface)] text-[var(--wc-text)] shadow-sm" : "text-[var(--wc-text-muted)]"}`}
            aria-pressed={mediaType === m}
            onClick={() => setMediaType(m)}
          >
            {" "}
            {m === "image" ? "Afbeelding" : "Video"}{" "}
          </button>
        ))}{" "}
      </div>{" "}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={onPromptKeyDown}
        placeholder={
          isVideo
            ? "Beschrijf je video — scène, beweging, sfeer (startframe optioneel)…"
            : isEdit
              ? "Wat wil je aanpassen aan je referentie? (optioneel)"
              : "Beschrijf wat je wilt maken — campagne, illustratie, logo, social, product, portret…"
        }
        className="w-full resize-y rounded-xl border border-[var(--wc-border)] bg-[var(--fumero-surface)] px-3 py-3 text-[14px] text-[var(--wc-text)] outline-none placeholder:text-[var(--wc-text-muted)] focus:border-[var(--wc-accent)] focus:ring-1 focus:ring-[var(--wc-accent)]"
        style={{ minHeight: 120, maxHeight: 200 }}
        disabled={busy}
        aria-label="Prompt"
      />{" "}
      <div className="flex flex-wrap items-center gap-2">
        {" "}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void uploadImages(files);
          }}
        />{" "}
        <input
          ref={frameFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            void uploadStartFrame(f);
          }}
        />{" "}
        {refs.length < maxRefs ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--wc-border)] px-2.5 py-1 text-[13px] text-[var(--wc-text-muted)] hover:border-[var(--wc-accent)] hover:text-[var(--wc-text)]"
            disabled={uploading || busy}
            onClick={() => fileRef.current?.click()}
          >
            {" "}
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}{" "}
            Referentie{" "}
          </button>
        ) : null}{" "}
        {refs.map((ref, i) => (
          <span
            key={ref.url}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--wc-border)] bg-[var(--wc-surface-muted)] py-0.5 pl-0.5 pr-2 text-[13px]"
          >
            {" "}
            {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
            <img
              src={ref.preview}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
            />{" "}
            <span className="text-[11px] text-[var(--wc-text-muted)]">
              Ref {i + 1}
            </span>{" "}
            <button
              type="button"
              className="rounded-full p-0.5 text-[var(--wc-text-muted)] hover:bg-[var(--wc-surface-muted)]"
              onClick={() => removeRef(i)}
              aria-label={`Referentie ${i + 1} verwijderen`}
            >
              {" "}
              <X className="h-3 w-3" />{" "}
            </button>{" "}
          </span>
        ))}{" "}
      </div>{" "}
      {isVideo ? (
        <button
          type="button"
          className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--wc-border)] bg-[var(--wc-surface-muted)] text-[10px] text-[var(--wc-text-muted)]"
          onClick={() => frameFileRef.current?.click()}
        >
          {startFrame ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={startFrame.preview}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <button
                type="button"
                className="absolute right-0.5 top-0.5 rounded-full bg-black/50 p-0.5 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  if (startFrame.preview.startsWith("blob:"))
                    URL.revokeObjectURL(startFrame.preview);
                  setStartFrame(null);
                }}
                aria-label="Startframe verwijderen"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <>
              <ImagePlus className="mb-0.5 h-3.5 w-3.5" />
              Startframe
            </>
          )}
        </button>
      ) : null}{" "}
      {!isVideo ? (
        <div
          className="inline-flex self-start rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface-muted)] p-0.5"
          role="group"
          aria-label="Snelheid"
        >
          {" "}
          {(Object.keys(CREATION_SPEED_PRESETS) as CreationSpeedPreset[]).map(
            (key) => (
              <button
                key={key}
                type="button"
                className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${activePreset === key ? "bg-[var(--wc-surface)] text-[var(--wc-text)] shadow-sm" : "text-[var(--wc-text-muted)]"}`}
                aria-pressed={activePreset === key}
                onClick={() => applySpeedPreset(key)}
                disabled={busy}
              >
                {" "}
                {CREATION_SPEED_PRESETS[key].label}{" "}
              </button>
            ),
          )}{" "}
        </div>
      ) : null}{" "}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface-muted)] px-2 py-1.5">
        {" "}
        <span className="text-[12px] text-[var(--wc-text-muted)]">
          {" "}
          {settings.aspect_ratio} · {settings.quality} · {settings.count}×{" "}
        </span>{" "}
        <ContentStudioModelPicker
          value={settings.model}
          onChange={(m) => patchSettings({ model: m })}
        />{" "}
        <ContentStudioSettingsPopover
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={settings}
          onChange={patchSettings}
          trigger={
            <button
              type="button"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-[var(--wc-text-muted)] hover:bg-[var(--wc-surface-muted)] hover:text-[var(--wc-text)]"
              aria-label="Instellingen"
            >
              {" "}
              <Settings2 className="h-4 w-4" />{" "}
            </button>
          }
        />{" "}
      </div>{" "}
      {starters.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {" "}
          {starters.slice(0, 4).map((t: StarterTemplate) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyStarter(t)}
              className="rounded-full border border-[var(--wc-border)] px-2 py-0.5 text-[11px] text-[var(--wc-text-muted)] hover:bg-[var(--wc-surface-muted)]"
            >
              {" "}
              {t.title}{" "}
            </button>
          ))}{" "}
        </div>
      ) : null}{" "}
      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--wc-text-muted)]">
        {" "}
        <input
          type="checkbox"
          checked={settings.brand_enhancement === true}
          onChange={(e) =>
            patchSettings({ brand_enhancement: e.target.checked })
          }
          disabled={busy}
          className="h-3.5 w-3.5 accent-[var(--wc-accent)]"
        />{" "}
        Merkstijl verrijking (product/food studio — optioneel){" "}
      </label>{" "}
      <p className="text-center text-[11px] text-[var(--wc-text-subtle)]">
        {" "}
        Credits · {creditsLoading ? "laden…" : creditsLabel}{" "}
      </p>{" "}
      {busy ? (
        <ContentStudioGenerationProgress
          progress={genProgress.progress}
          etaSeconds={genProgress.etaSeconds}
          onCancel={cancelGenerate}
        />
      ) : null}{" "}
      <button
        type="button"
        className={`wc-btn-primary mt-auto w-full${isEdit && !busy ? " !bg-[var(--fumero-text-muted)] hover:!bg-[var(--fumero-text-subtle)]" : ""}${busy ? " !bg-[var(--fumero-text-muted)] hover:!bg-[var(--fumero-text-subtle)]" : ""}`}
        disabled={!busy && (!canSubmit || uploading)}
        onClick={() => (busy ? cancelGenerate() : void generate())}
        data-testid="make-button"
      >
        {" "}
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Square className="h-4 w-4 fill-current" />
        )}{" "}
        {busy ? "Stoppen" : isEdit ? "Bewerken" : "Maken"}{" "}
      </button>{" "}
    </div>
  );
}
