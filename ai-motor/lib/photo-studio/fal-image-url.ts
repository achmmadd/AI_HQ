import { readFile } from "fs/promises";
import path from "path";
import { motorPublicOrigin } from "@/lib/fumero/public-url";
import { photoStudioDataDir } from "@/lib/photo-studio/paths";

const home = process.env.HOME || "/home/pietje";
const uploadsDir = path.join(home, "AI_HQ", "uploads");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function mimeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME[ext] ?? "image/jpeg";
}

function ownAppOrigins(): string[] {
  const origin = motorPublicOrigin();
  return [
    origin,
    "http://127.0.0.1:3040",
    "http://localhost:3040",
  ].map((o) => o.replace(/\/$/, ""));
}

function isOwnAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ownAppOrigins().some(
      (origin) => parsed.origin.replace(/\/$/, "") === origin
    );
  } catch {
    return url.startsWith("/api/");
  }
}

function pathnameFromRef(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/api/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (isOwnAppUrl(trimmed)) return parsed.pathname;
  } catch {
    /* ignore */
  }
  return null;
}

async function readLocalUpload(filename: string): Promise<Buffer> {
  const safe = path.basename(decodeURIComponent(filename));
  if (!safe || safe.includes("..")) {
    throw new Error("Ongeldig referentiebestand.");
  }
  return readFile(path.join(uploadsDir, safe));
}

async function readLocalAsset(filename: string): Promise<Buffer> {
  const safe = path.basename(decodeURIComponent(filename));
  if (!safe) throw new Error("Ongeldig asset-pad.");
  return readFile(path.join(photoStudioDataDir(), safe));
}

/** Load image bytes from a relative app URL or our own absolute URL. */
export async function loadImageBufferFromRef(url: string): Promise<Buffer> {
  const pathname = pathnameFromRef(url);
  if (pathname?.startsWith("/api/upload/file/")) {
    const name = pathname.split("/").pop() ?? "";
    return readLocalUpload(name);
  }
  if (pathname?.startsWith("/api/photo-studio/assets/")) {
    const name = pathname.split("/").pop() ?? "";
    return readLocalAsset(name);
  }

  if (url.startsWith("data:image/")) {
    const comma = url.indexOf(",");
    if (comma === -1) throw new Error("Ongeldige data-URL.");
    return Buffer.from(url.slice(comma + 1), "base64");
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    throw new Error(`Referentiebeeld laden mislukt (HTTP ${res.status}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function toDataUri(buffer: Buffer, filenameHint: string): string {
  const mime = mimeFromFilename(filenameHint);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/**
 * fal.ai needs publicly reachable URLs or data URIs.
 * Relative `/api/upload/file/…` paths are auth-gated and invisible to fal — convert locally.
 */
async function resolveOneImageUrlForFal(
  raw: string,
  cache?: Map<string, string>
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Lege referentie-URL." };
  }

  const cached = cache?.get(trimmed);
  if (cached) return { ok: true, url: cached };

  if (trimmed.startsWith("data:image/")) {
    cache?.set(trimmed, trimmed);
    return { ok: true, url: trimmed };
  }

  const pathname = pathnameFromRef(trimmed);
  const isLocal =
    Boolean(pathname?.startsWith("/api/upload/file/")) ||
    Boolean(pathname?.startsWith("/api/photo-studio/assets/")) ||
    (trimmed.startsWith("http") && isOwnAppUrl(trimmed));

  if (isLocal) {
    try {
      const buffer = await loadImageBufferFromRef(trimmed);
      const hint = pathname?.split("/").pop() ?? "ref.jpg";
      const dataUri = toDataUri(buffer, hint);
      cache?.set(trimmed, dataUri);
      return { ok: true, url: dataUri };
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "Referentiebeeld kon niet worden geladen.",
      };
    }
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    cache?.set(trimmed, trimmed);
    return { ok: true, url: trimmed };
  }

  return {
    ok: false,
    error: `Ongeldige referentie-URL: ${trimmed.slice(0, 80)}`,
  };
}

export async function resolveImageUrlsForFal(
  urls: string[],
  cache?: Map<string, string>
): Promise<{ ok: true; urls: string[] } | { ok: false; error: string }> {
  const resolved: string[] = [];

  for (const raw of urls) {
    const one = await resolveOneImageUrlForFal(raw, cache);
    if (!one.ok) return one;
    resolved.push(one.url);
  }

  if (!resolved.length) {
    return { ok: false, error: "Geen geldige referentiebeelden." };
  }

  return { ok: true, urls: resolved };
}
