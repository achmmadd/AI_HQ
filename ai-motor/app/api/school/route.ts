import { NextResponse } from "next/server";
import db from "@/lib/db/database";
import {
  appendSchoolPassToLearned,
  getSchoolLessonForDate,
  MOTOR_SCHOOL_CURRICULUM,
} from "@/lib/motor-school";

export const runtime = "nodejs";

const LOG_KEY = "motor_school_logbook";

export async function GET() {
  const lesson = getSchoolLessonForDate();
  const logRow = db
    .prepare(`SELECT value FROM app_settings WHERE key = ?`)
    .get(LOG_KEY) as { value: string } | undefined;
  let logbook: Array<{
    date: string;
    lesson_id: string;
    pass: boolean;
    notes: string;
  }> = [];
  if (logRow?.value) {
    try {
      const parsed = JSON.parse(logRow.value) as unknown;
      if (Array.isArray(parsed)) logbook = parsed as typeof logbook;
    } catch {
      /* ignore */
    }
  }

  const learnedRow = db
    .prepare(`SELECT value, updated_at FROM app_settings WHERE key = ?`)
    .get("chat_learned_suffix") as
    | { value: string; updated_at: string }
    | undefined;

  return NextResponse.json({
    today: lesson,
    curriculum: MOTOR_SCHOOL_CURRICULUM,
    logbook: logbook.slice(0, 50),
    learned_suffix: learnedRow?.value?.trim() ?? "",
    learned_updated_at: learnedRow?.updated_at ?? null,
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    lesson_id?: string;
    pass?: boolean;
    notes?: string;
  };
  const lessonId = body.lesson_id?.trim() || getSchoolLessonForDate().id;
  const pass = Boolean(body.pass);
  const notes = (body.notes ?? "").trim().slice(0, 500);

  const logRow = db
    .prepare(`SELECT value FROM app_settings WHERE key = ?`)
    .get(LOG_KEY) as { value: string } | undefined;
  let logbook: Array<{
    date: string;
    lesson_id: string;
    pass: boolean;
    notes: string;
  }> = [];
  if (logRow?.value) {
    try {
      const parsed = JSON.parse(logRow.value) as unknown;
      if (Array.isArray(parsed)) logbook = parsed as typeof logbook;
    } catch {
      /* ignore */
    }
  }

  const entry = {
    date: new Date().toISOString().slice(0, 10),
    lesson_id: lessonId,
    pass,
    notes,
  };
  logbook.unshift(entry);
  logbook = logbook.slice(0, 100);

  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = datetime('now')`
  ).run(LOG_KEY, JSON.stringify(logbook));

  const learnedAppended = pass
    ? appendSchoolPassToLearned(lessonId, notes)
    : false;

  return NextResponse.json({
    ok: true,
    entry,
    logbook: logbook.slice(0, 20),
    learned_appended: learnedAppended,
  });
}
