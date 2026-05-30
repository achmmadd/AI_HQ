import { NextRequest } from "next/server";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";

export async function isAdminSession(req: NextRequest): Promise<boolean> {
  const token =
    req.cookies.get(TOKEN_COOKIE)?.value ||
    req.headers.get("x-motorsai-token")?.trim();
  const session = await readAuthSession(token || undefined);
  if (!session) return false;
  if (session.role === "admin") return true;
  if (process.env.MOTORSAI_ADMIN?.trim() === "1") return true;
  return false;
}
