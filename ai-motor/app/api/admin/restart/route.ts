import { spawn } from "child_process";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Alleen whitelist: `pm2 restart ai-motor --update-env`.
 * Geen parameters, geen andere commando's.
 */
export async function POST() {
  try {
    const child = spawn(
      "pm2",
      ["restart", "ai-motor", "--update-env"],
      {
        detached: true,
        stdio: "ignore",
      }
    );
    child.unref();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "spawn failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    detail: "pm2 restart ai-motor gestart (asynchroon).",
  });
}
