import { formatSchoolTelegram, getSchoolLessonForDate } from "@/lib/motor-school";
import { sendTelegramMessage } from "@/lib/telegram";

/** Stuurt de les van vandaag naar Telegram — startpunt voor menselijke of chat-uitvoering. */
export async function runMotorSchoolLessonDaily(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const lesson = getSchoolLessonForDate();
  const text = formatSchoolTelegram(lesson);
  await sendTelegramMessage(text);
  return {
    ok: true,
    detail: `School les ${lesson.id} (${lesson.title}) naar Telegram gestuurd.`,
  };
}

/** Wekelijkse herinnering: logboek + learned suffix review. */
export async function runMotorSchoolExamWeekly(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const text = [
    "🎓 Motor School — weekexamen",
    "Vul het logboek in docs/motor-test-playbook.md (T01–T05).",
    "Keur max. 1 nieuwe regel goed voor chat_learned_suffix (system-improvements).",
    "Geen autonome externe acties.",
  ].join("\n");
  await sendTelegramMessage(text);
  return { ok: true, detail: "Weekexamen-herinnering naar Telegram gestuurd." };
}
