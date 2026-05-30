import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";

/**
 * Dev-panel: altijd in development; in productie met MOTORSAI_DEV_PANEL=1
 * of wanneer je ingelogd bent (solo gebruik).
 */
export default async function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const envEnabled =
    process.env.NODE_ENV !== "production" ||
    Boolean(process.env.MOTORSAI_DEV_PANEL?.trim());

  if (envEnabled) return <>{children}</>;

  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (await readAuthSession(token)) return <>{children}</>;

  redirect("/login?from=/dev");
}
