import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { P1FoundationShell } from "@/components/p1/p1-foundation-shell";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";
import { HOME_TENANT_ID, serializeFoundationView } from "@/pilot/p1-foundation";

/** Authenticated synthetic P1.0 shell. Never reads a live workspace. */
export default async function MotorFoundationPage() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!(await readAuthSession(token))) redirect("/login?from=%2Fmotor");
  const view = serializeFoundationView(HOME_TENANT_ID);
  if (!view) redirect("/");
  return <P1FoundationShell view={view} />;
}
