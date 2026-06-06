import type { AuthSession } from "@/lib/auth-session";

/** Owner / env override: skip diff review before writing files. */
export function shouldAutoWriteCode(session?: AuthSession | null): boolean {
  if (process.env.MOTOR_CODE_AUTO_WRITE === "1") return true;
  return session?.role === "admin";
}

export function resolveReviewWrites(
  session: AuthSession | null | undefined,
  clientPref?: boolean
): boolean {
  if (shouldAutoWriteCode(session)) return false;
  return clientPref !== false;
}
