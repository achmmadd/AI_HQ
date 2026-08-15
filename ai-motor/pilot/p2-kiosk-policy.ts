/**
 * P2.0 NUC kiosk policy — one pinned tailnet /motor origin. Fail closed.
 * No secrets. Browser start is a separate owner activation step.
 */

import { P2_PINNED_ORIGIN } from "./p2-bind.ts";

export { P2_PINNED_ORIGIN };

export type KioskDenyReason =
  | "empty"
  | "not_http"
  | "not_pinned"
  | "public_ip"
  | "wrong_route"
  | "not_tailnet";

export type KioskOriginDecision =
  | { readonly ok: true; readonly origin: typeof P2_PINNED_ORIGIN }
  | { readonly ok: false; readonly reason: KioskDenyReason };

function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function ipv4Parts(host: string): readonly number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1).map((item) => Number(item));
  if (parts.some((part) => part > 255)) return null;
  return parts;
}

function isTailscaleCgNat(host: string): boolean {
  const parts = ipv4Parts(host);
  if (!parts) return false;
  return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
}

function isRfc1918(host: string): boolean {
  const parts = ipv4Parts(host);
  if (!parts) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function isLoopback(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

/** Public IPv4 that is not Tailscale CGNAT. Used only to classify rejected URLs. */
export function isPublicInternetIp(host: string): boolean {
  const parts = ipv4Parts(host);
  if (!parts) return false;
  if (isLoopback(host) || isRfc1918(host) || isTailscaleCgNat(host)) return false;
  if (parts[0] === 0 || parts[0] >= 224) return false;
  return true;
}

export function evaluateKioskOrigin(raw: string | undefined): KioskOriginDecision {
  if (!raw || raw.trim().length === 0) return { ok: false, reason: "empty" };

  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return { ok: false, reason: "not_http" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "not_http" };
  }

  const normalized = normalizeOrigin(parsed.href);
  const pinned = normalizeOrigin(P2_PINNED_ORIGIN);
  if (normalized === pinned) {
    return { ok: true, origin: P2_PINNED_ORIGIN };
  }

  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/motor") return { ok: false, reason: "wrong_route" };
  if (isPublicInternetIp(parsed.hostname)) return { ok: false, reason: "public_ip" };
  if (!isTailscaleCgNat(parsed.hostname)) return { ok: false, reason: "not_tailnet" };
  return { ok: false, reason: "not_pinned" };
}

export function healthUrlForPinnedOrigin(): string {
  return `${normalizeOrigin(P2_PINNED_ORIGIN)}/health`;
}
