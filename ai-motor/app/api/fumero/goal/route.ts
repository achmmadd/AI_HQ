import { NextResponse } from "next/server";
import {
  getMotorUserContext,
  upsertMotorUserContext,
} from "@/lib/motor-user-context";
import { applyGoalCommand, parseMaxGoalCommand } from "@/lib/fumero/max-goal";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const klant = url.searchParams.get("klant")?.trim() || "fumero";
  const ctx = getMotorUserContext(klant);
  return NextResponse.json({
    goals: ctx?.goals ?? null,
    preferences: ctx?.preferences ?? null,
    updated_at: ctx?.updated_at ?? null,
  });
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      klant?: string;
      command?: string;
      goals?: string | null;
    };
    const klant = body.klant?.trim() || "fumero";

    if (typeof body.command === "string") {
      const cmd = parseMaxGoalCommand(body.command);
      if (!cmd) {
        return NextResponse.json({ error: "Geen /goal-commando" }, { status: 400 });
      }
      const result = applyGoalCommand(klant, cmd);
      return NextResponse.json(result);
    }

    if (body.goals !== undefined) {
      upsertMotorUserContext(klant, {
        goals:
          body.goals === null ? null : String(body.goals).slice(0, 1500),
      });
      const ctx = getMotorUserContext(klant);
      return NextResponse.json({ goals: ctx?.goals ?? null });
    }

    return NextResponse.json({ error: "command of goals vereist" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Doel opslaan mislukt" },
      { status: 500 }
    );
  }
}
