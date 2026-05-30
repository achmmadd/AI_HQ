/** Publieke Motor-URL voor widgets en embed-scripts (niet fumero.nl zelf). */
export function motorPublicOrigin(): string {
  const raw =
    process.env.MOTOR_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!raw) return "http://127.0.0.1:3040";
  if (raw.startsWith("http")) return raw.replace(/\/$/, "");
  return `https://${raw.replace(/\/$/, "")}`;
}

export function fumeroSiteOrigin(): string {
  return (
    process.env.FUMERO_PUBLIC_ORIGIN?.trim()?.replace(/\/$/, "") ||
    "https://www.fumero.nl"
  );
}

/** Type 1 — embed script op fumero.nl (publiek pad onder /embed/*) */
export function fumeroWidgetEmbedCode(slug: string): string {
  const origin = motorPublicOrigin();
  return `<script src="${origin}/embed/fumero/widget/${slug}" async></script>`;
}

/** Type 2 — interne app (login vereist) */
export function fumeroInternalAppUrl(slug: string): string {
  return `${motorPublicOrigin()}/apps/${slug}`;
}

/** Type 3 — klantpagina iframe (publiek) */
export function fumeroCustomerAppUrl(slug: string): string {
  return `${motorPublicOrigin()}/embed/fumero/app/${slug}`;
}

export function fumeroCustomerEmbedCode(slug: string): string {
  const src = fumeroCustomerAppUrl(slug);
  return `<iframe src="${src}" title="Fumero app" style="border:0;width:100%;min-height:480px" loading="lazy"></iframe>`;
}

export function fumeroPreviewPath(toolId: number, versionId: number): string {
  return `/embed/fumero/preview?tool=${toolId}&version=${versionId}`;
}
