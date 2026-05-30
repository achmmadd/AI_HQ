import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export async function GET(req: NextRequest) {
  ensurePlatformSchema();
  const klant =
    new URL(req.url).searchParams.get("klant")?.trim() || "fumero";

  const skills = db
    .prepare(
      `SELECT id, klant, slug, title, description, prompt_template,
              config_json, enabled, created_at
       FROM motor_skills
       WHERE klant = ?
       ORDER BY title ASC`
    )
    .all(klant);

  return NextResponse.json({ skills, klant });
}

export async function POST(req: NextRequest) {
  ensurePlatformSchema();
  const body = await req.json().catch(() => ({}));
  const {
    klant = "fumero",
    slug,
    title,
    description,
    prompt_template,
    config_json,
    enabled = true,
  } = body as {
    klant?: string;
    slug?: string;
    title?: string;
    description?: string;
    prompt_template?: string;
    config_json?: Record<string, unknown> | string | null;
    enabled?: boolean;
  };

  if (!title?.trim() || !prompt_template?.trim()) {
    return NextResponse.json(
      { error: "title en prompt_template zijn verplicht" },
      { status: 400 }
    );
  }

  const finalSlug = slugify(slug?.trim() || title);
  if (!finalSlug) {
    return NextResponse.json({ error: "ongeldige slug" }, { status: 400 });
  }

  const configStr =
    config_json == null
      ? null
      : typeof config_json === "string"
        ? config_json
        : JSON.stringify(config_json);

  try {
    const result = db
      .prepare(
        `INSERT INTO motor_skills (klant, slug, title, description, prompt_template, config_json, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        String(klant).slice(0, 32),
        finalSlug,
        title.trim().slice(0, 200),
        description?.trim().slice(0, 2000) ?? null,
        prompt_template.trim(),
        configStr,
        enabled ? 1 : 0
      );

    const skill = db
      .prepare(`SELECT * FROM motor_skills WHERE id = ?`)
      .get(result.lastInsertRowid);

    logAudit({
      action: "motor_skill.create",
      resource: `motor_skills/${finalSlug}`,
      klant: String(klant),
      detail: { id: result.lastInsertRowid, slug: finalSlug },
    });

    return NextResponse.json({ skill }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "slug bestaat al voor deze klant" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
