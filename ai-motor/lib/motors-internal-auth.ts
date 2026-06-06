import { NextRequest } from "next/server";

/** Service-to-service auth for OpenClaw / internal HTTP tools (Bearer MOTORS_INTERNAL_TOKEN). */
export function isMotorsInternalAuthorized(req: NextRequest): boolean {
  const expected = process.env.MOTORS_INTERNAL_TOKEN?.trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}
