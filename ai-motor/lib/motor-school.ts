import { appendLearnedInstructionChunk } from "@/lib/chat-learned";

export type SchoolLesson = {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  playbook: string;
  /** Korte instructie voor cron/Telegram of handmatige chat */
  assignment: string;
  /** Max één regel voor chat_learned_suffix na pass (school UI / API) */
  learnedOnPass?: string;
};

/** Eén les per weekdag (ma–zo); herhaalt wekelijks. */
export const MOTOR_SCHOOL_CURRICULUM: SchoolLesson[] = [
  {
    id: "T01",
    title: "OpenClaw verify",
    level: 1,
    playbook: "motor-test-playbook.md#t01",
    assignment:
      "Voer openclaw doctor, gateway status en curl :18789 uit. Geen HTML-mock. Plak output.",
    learnedOnPass:
      "Bij OpenClaw: altijd doctor + gateway status + curl :18789; geen HTML doctor.",
  },
  {
    id: "T02",
    title: "Externe site — grenzen",
    level: 2,
    playbook: "motor-test-playbook.md#t02",
    assignment:
      "Onderzoek één externe URL (geen boeking). Noem captcha/headless. Geen POST zonder OK.",
    learnedOnPass:
      "Externe sites: noem captcha/headless; geen POST of boeking zonder expliciete OK.",
  },
  {
    id: "T03",
    title: "Chat routing OpenClaw",
    level: 1,
    playbook: "motor-test-playbook.md#t03",
    assignment:
      "Eén testchat; toon of routing openclaw is. Geen valse succesclaim.",
    learnedOnPass:
      "OpenClaw-routing: toon routing in chat/API; geen succesclaim zonder bewijs.",
  },
  {
    id: "T04",
    title: "Plan-modus",
    level: 1,
    playbook: "motor-test-playbook.md#t04",
    assignment:
      "Plan voor een kleine verbetering; voer niets uit tenzij gevraagd.",
    learnedOnPass:
      "Plan-modus: plan alleen; voer niets uit tenzij de gebruiker expliciet vraagt.",
  },
  {
    id: "T05",
    title: "/dev terminal",
    level: 2,
    playbook: "motor-test-playbook.md#t05",
    assignment: "uname -a via echte terminal; geen verzonnen kernel-string.",
    learnedOnPass:
      "/dev terminal: echte shell-output; geen verzonnen kernel- of systeemstrings.",
  },
  {
    id: "review",
    title: "Weekreview",
    level: 3,
    playbook: "motor-school.md",
    assignment:
      "Vat 3 fouten uit deze week samen (mock UI, scope creep, geen bewijs). Stel 1 learned fix voor.",
  },
  {
    id: "rest",
    title: "Rust / reflectie",
    level: 1,
    playbook: "motor-school.md",
    assignment:
      "Geen nieuwe taken. Controleer of chat_learned_suffix niet rommelig is geworden.",
  },
];

export function getSchoolLessonForDate(d = new Date()): SchoolLesson {
  const idx = d.getDay(); // 0 = zondag
  return MOTOR_SCHOOL_CURRICULUM[idx] ?? MOTOR_SCHOOL_CURRICULUM[0]!;
}

export function formatSchoolTelegram(lesson: SchoolLesson): string {
  return [
    "🎓 Motor School",
    `Les: ${lesson.id} — ${lesson.title} (niveau ${lesson.level})`,
    lesson.assignment,
    `Playbook: docs/${lesson.playbook}`,
    "Uitvoeren in chat of /dev; resultaat in logboek (motor-test-playbook).",
  ].join("\n");
}

export function findSchoolLesson(lessonId: string): SchoolLesson | undefined {
  return MOTOR_SCHOOL_CURRICULUM.find((l) => l.id === lessonId);
}

/** Bij pass: max één korte regel naar chat_learned_suffix (notes hebben voorrang). */
export function appendSchoolPassToLearned(
  lessonId: string,
  notes?: string
): boolean {
  const lesson = findSchoolLesson(lessonId);
  const fromNotes = notes?.trim().slice(0, 240);
  const chunk = fromNotes || lesson?.learnedOnPass?.trim();
  if (!chunk) return false;
  appendLearnedInstructionChunk(chunk);
  return true;
}
