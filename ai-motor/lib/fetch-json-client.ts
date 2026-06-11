"use client";

import { unwrapFetchFailure } from "@/lib/client-fetch-errors";
import { formatOpenRouterUserError } from "@/lib/openrouter-errors";

type JsonRecord = Record<string, unknown>;

function friendlyHtmlOrGatewayError(text: string, status: number): string | null {
  if (
    status === 524 ||
    text.includes("Error code 524") ||
    text.includes("A timeout occurred")
  ) {
    return "Server time-out (Cloudflare 524). Het antwoord duurde te lang — probeer een kortere vraag, een kleiner bestand, of zet agent-modus uit.";
  }
  if (/^\s*</.test(text) || text.includes("<!DOCTYPE")) {
    if (status === 401 || status === 403) {
      return "Sessie verlopen — log opnieuw in op MotorsAI.";
    }
    return "Server gaf een webpagina i.p.v. JSON (mogelijk time-out of uitval). Vernieuw de pagina of probeer opnieuw.";
  }
  return null;
}

/** Platte tekst of `{ error, detail? }` naar één Error (voor niet-OK responses). */
export function failedResponseToError(text: string, status: number): Error {
  const friendly = friendlyHtmlOrGatewayError(text, status);
  if (friendly) return new Error(friendly);
  if (!text.trim()) return new Error(`HTTP ${status}`);
  try {
    const v = JSON.parse(text) as unknown;
    if (
      v !== null &&
      typeof v === "object" &&
      typeof (v as { error?: unknown }).error === "string"
    ) {
      const body = v as { error: string; detail?: string };
      const combined = body.detail
        ? `${body.error} — ${body.detail}`
        : body.error;
      return new Error(formatOpenRouterUserError(combined));
    }
  } catch {
    /* val terug op raw */
  }
  return new Error(
    formatOpenRouterUserError(text.trim() || `HTTP ${status}`)
  );
}

function parseMaybeJson(text: string): JsonRecord | null {
  if (!text.trim()) return {};
  try {
    const v = JSON.parse(text) as unknown;
    return v !== null && typeof v === "object" && !Array.isArray(v)
      ? (v as JsonRecord)
      : null;
  } catch {
    return null;
  }
}

function htmlResponseHint(text: string, status: number): string {
  return (
    friendlyHtmlOrGatewayError(text, status) ??
    (text.trim() || `HTTP ${status}`)
  );
}

/** GET/POST JSON — null bij netwerk/HTML/non-JSON/fout (geen throw, geen res.json()). */
export async function fetchJsonOptional<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(input, init);
    const text = await res.text();
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !ct.includes("application/json") && !ct.includes("+json")) {
      if (/^\s*</.test(text) || text.includes("<!DOCTYPE")) return null;
    }
    const data = parseMaybeJson(text);
    return data === null ? null : (data as T);
  } catch {
    return null;
  }
}

/** GET/POST JSON naar eigen API — nette fout bij timeout/JSON/non-JSON. */
export async function fetchJsonChecked<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    throw unwrapFetchFailure(e);
  }

  const text = await res.text();
  const data = parseMaybeJson(text);

  if (!res.ok) {
    throw failedResponseToError(text, res.status);
  }

  if (data === null) {
    throw new Error(htmlResponseHint(text, res.status));
  }

  return data as T;
}
