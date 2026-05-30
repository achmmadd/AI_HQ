import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  ensurePlatformSchema();
  const { id: idRaw } = await ctx.params;
  const id = parseInt(idRaw, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "ongeldig id" }, { status: 400 });
  }

  const existing = db
    .prepare(`SELECT * FROM motor_skills WHERE id = ?`)
    .get(id) as { id: number; klant: string; slug: string } | undefined;
  if (!existing) {
    return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { title, description, prompt_template, config_json, enabled } =
    body as {
      title?: string;
      description?: string | null;
      prompt_template?: string;
      config_json?: Record<string, unknown> | string | null;
      enabled?: boolean;
    };

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (typeof title === "string" && title.trim()) {
    updates.push("title = ?");
    values.push(title.trim().slice(0, 200));
  }
  if (description !== undefined) {
    updates.push("description = ?");
    values.push(
      description == null ? null : String(description).slice(0, 2000)
    );
  }
  if (typeof prompt_template === "string" && prompt_template.trim()) {
    updates.push("prompt_template = ?");
    values.push(prompt_template.trim());
  }
  if (config_json !== undefined) {
    updates.push("config_json = ?");
    values.push(
      config_json == null
        ? null
        : typeof config_json === "string"
          ? config_json
          : JSON.stringify(config_json)
    );
  }
  if (typeof enabled === "boolean") {
    updates.push("enabled = ?");
    values.push(enabled ? 1 : 0);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "geen velden" }, { status: 400 });
  }

  values.push(id);
  db.prepare(
    `UPDATE motor_skills SET ${updates.join(", ")} WHERE id = ?`
  ).run(...values);

  const skill = db.prepare(`SELECT * FROM motor_skills WHERE id = ?`).get(id);

  logAudit({
    action: "motor_skill.update",
    resource: `motor_skills/${existing.slug}`,
    klant: existing.klant,
    detail: { id },
  });

  return NextResponse.json({ skill });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  ensurePlatformSchema();
  const { id: idRaw } = await ctx.params;
  const id = parseInt(idRaw, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "ongeldig id" }, { status: 400 });
  }

  const existing = db
    .prepare(`SELECT id, klant, slug FROM motor_skills WHERE id = ?`)
    .get(id) as { id: number; klant: string; slug: string } | undefined;
  if (!existing) {
    return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
  }

  db.prepare(`DELETE FROM motor_skills WHERE id = ?`).run(id);

  logAudit({
    action: "motor_skill.delete",
    resource: `motor_skills/${existing.slug}`,
    klant: existing.klant,
    detail: { id },
  });

  return NextResponse.json({ ok: true });
}
