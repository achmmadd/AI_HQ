import { NextResponse } from "next/server";
import { buildErrorPayload } from "@/lib/error-payload";

export function jsonOk<T extends Record<string, unknown>>(
  body: T,
  init?: ResponseInit
) {
  return NextResponse.json(body, { ...init, status: init?.status ?? 200 });
}

export function jsonHttpError(status: number, message: string, detail?: string | null) {
  return NextResponse.json(buildErrorPayload(message, detail ?? undefined), {
    status,
  });
}

/** Vangt onbekende fouten in route handlers; `code` = stabiele machine-key voor clients. */
export function jsonCatchError(code: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(code, msg);
  return jsonHttpError(500, code, msg);
}
