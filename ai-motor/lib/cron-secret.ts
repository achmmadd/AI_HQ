import { NextRequest } from "next/server";

/** n8n cron / interne jobs: zet FEEDBACK_CRON_SECRET en stuur `x-cron-secret` of `?secret=`. */
export function assertCronSecret(req: NextRequest): void {
  const secret = process.env.FEEDBACK_CRON_SECRET?.trim();
  if (!secret) {
    throw new Error("FEEDBACK_CRON_SECRET is niet geconfigureerd");
  }
  const header = req.headers.get("x-cron-secret")?.trim();
  const q = new URL(req.url).searchParams.get("secret")?.trim();
  if (header !== secret && q !== secret) {
    throw new Error("Unauthorized");
  }
}
