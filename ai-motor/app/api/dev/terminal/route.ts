import { NextRequest, NextResponse } from "next/server";
import {
  getDefaultTerminalCwd,
  runDevTerminalCommand,
} from "@/lib/dev-terminal-exec";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    cwd: getDefaultTerminalCwd(),
    hint: "Shell op de NUC (zelfde machine als PM2). Voor .env.local: cd AI_HQ/ai-motor && nano .env.local",
    presets: [
      { label: "pm2 status", command: "pm2 status" },
      { label: "pm2 logs ai-motor", command: "pm2 logs ai-motor --lines 40 --nostream" },
      {
        label: "openclaw status",
        command: "openclaw gateway status 2>/dev/null || curl -s http://127.0.0.1:18789/ | head -1",
      },
      {
        label: "env check",
        command: "cd ~/AI_HQ/ai-motor && grep -E '^[A-Z]' .env.local 2>/dev/null | sed 's/=.*/=***/' | head -30",
      },
      {
        label: "rebuild + restart",
        command:
          "export PATH=\"$HOME/.nvm/versions/node/v22.22.2/bin:$PATH\" && cd ~/AI_HQ/ai-motor && npm run build && pm2 restart ecosystem.config.cjs --update-env",
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { command?: string; cwd?: string };
    const command = body.command?.trim();
    if (!command) {
      return NextResponse.json({ error: "command is required" }, { status: 400 });
    }

    const result = await runDevTerminalCommand({
      command,
      cwd: body.cwd,
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
