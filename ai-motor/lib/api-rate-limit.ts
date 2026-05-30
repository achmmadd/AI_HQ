import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  clientIp,
  rateLimitKey,
} from "@/lib/rate-limit";

export function rateLimitResponse(
  req: NextRequest,
  route: string,
  max: number,
  windowMs: number
): NextResponse | null {
  const key = rateLimitKey(clientIp(req), route);
  const result = checkRateLimit(key, max, windowMs);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Te veel verzoeken — probeer later opnieuw" },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    }
  );
}
