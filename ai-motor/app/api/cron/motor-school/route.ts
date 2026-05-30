import { NextRequest, NextResponse } from "next/server";
import { assertCronSecret } from "@/lib/cron-secret";
import {
  runMotorSchoolExamWeekly,
  runMotorSchoolLessonDaily,
} from "@/lib/automation/run-motor-school";

export const runtime = "nodejs";

/**
 * Motor School — dagelijkse les of wekelijks examen via Telegram.
 * POST ?mode=lesson (default) | exam
 * Header: x-cron-secret (FEEDBACK_CRON_SECRET)
 */
export async function POST(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const mode =
    new URL(req.url).searchParams.get("mode")?.trim().toLowerCase() ?? "lesson";
  const result =
    mode === "exam"
      ? await runMotorSchoolExamWeekly()
      : await runMotorSchoolLessonDaily();

  return NextResponse.json({ mode, ...result });
}
