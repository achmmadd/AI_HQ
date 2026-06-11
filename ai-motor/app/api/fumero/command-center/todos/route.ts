import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import {
  buildCommandCenterTodos,
  updateCommandCenterTaskState,
  type CommandCenterTaskStatus,
} from "@/lib/fumero/command-center-todos";
import { ensureFumeroSchemaAsync } from "@/lib/fumero/db-migrate";

export const runtime = "nodejs";

const VALID_STATUSES = new Set<CommandCenterTaskStatus>([
  "open",
  "in_behandeling",
  "wacht_goedkeuring",
  "afgerond",
  "genegeerd",
]);

export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  try {
    await ensureFumeroSchemaAsync();
    const payload = buildCommandCenterTodos("fumero");
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[fumero/command-center/todos GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  try {
    await ensureFumeroSchemaAsync();
    const body = (await req.json().catch(() => ({}))) as {
      item_key?: string;
      status?: string;
      actor?: string;
    };

    const item_key = body.item_key?.trim();
    const status = body.status as CommandCenterTaskStatus | undefined;

    if (!item_key || !status || !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "item_key and valid status required" },
        { status: 400 }
      );
    }

    const task = updateCommandCenterTaskState({
      klant: "fumero",
      item_key,
      status,
      actor: body.actor?.trim() || auth.sessionScope,
    });

    return NextResponse.json({ task, message: "Status bijgewerkt" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[fumero/command-center/todos PATCH]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
