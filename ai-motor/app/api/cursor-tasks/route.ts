import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

function todoPath() {
  const home = process.env.HOME || "/home/pietje";
  return path.join(home, "AI_HQ/factory-os/docs/CURSOR_TODO.md");
}

async function ensureTodoFile() {
  const file = todoPath();
  await mkdir(path.dirname(file), { recursive: true });
  try {
    await readFile(file, "utf-8");
  } catch {
    await writeFile(
      file,
      "# Factory OS — Cursor todo lijst\n\n### FACTORY OS ZELF\n\n- [ ] Eerste taak\n",
      "utf-8"
    );
  }
}

export async function GET() {
  try {
    await ensureTodoFile();
    const content = await readFile(todoPath(), "utf-8");
    const pending =
      content.match(/- \[ \] .+/g)?.map((l) => l.replace("- [ ] ", "")) || [];
    const done =
      content.match(/- \[x\] .+/g)?.map((l) => l.replace("- [x] ", "")) || [];
    return NextResponse.json({
      pending,
      done,
      total: pending.length + done.length,
    });
  } catch {
    return NextResponse.json({ pending: [], done: [], total: 0 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    task,
    section = "FACTORY OS ZELF",
    priority = "normaal",
  } = body as Record<string, unknown>;

  if (!task || typeof task !== "string") {
    return NextResponse.json({ error: "task required" }, { status: 400 });
  }

  try {
    await ensureTodoFile();
    let content = await readFile(todoPath(), "utf-8");
    const marker = `### ${section}`;
    const newTask = `- [ ] ${task.trim()}`;

    if (content.includes(marker)) {
      content = content.replace(marker, `${marker}\n${newTask}`);
    } else {
      content += `\n${marker}\n${newTask}\n`;
    }

    await writeFile(todoPath(), content, "utf-8");

    if (priority === "hoog" || priority === "kritiek") {
      void sendTelegramMessage(
        `🏗️ Nieuwe Cursor-taak\n${task.trim()}\nSectie: ${section}`
      );
    }

    return NextResponse.json({ message: "Taak toegevoegd" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
