import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";

initDb();

type DemoPayload = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  teamSize?: string;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: DemoPayload;

  try {
    body = (await req.json()) as DemoPayload;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const company = body.company?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const phone = body.phone?.trim() ?? "";
  const teamSize = body.teamSize?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!name || !company || !email || !teamSize) {
    return NextResponse.json(
      { error: "Vul alle verplichte velden in." },
      { status: 400 }
    );
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Ongeldig e-mailadres." }, { status: 400 });
  }

  try {
    db.prepare(
      `INSERT INTO demo_requests (name, company, email, phone, team_size, message)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(name, company, email, phone || null, teamSize, message || null);
  } catch {
    return NextResponse.json(
      { error: "Opslaan mislukt. Probeer het later opnieuw." },
      { status: 500 }
    );
  }

  const lines = [
    "🎯 Nieuwe demo-aanvraag MotorsAI",
    `Naam: ${name}`,
    `Bedrijf: ${company}`,
    `E-mail: ${email}`,
    `Telefoon: ${phone || "—"}`,
    `Team: ${teamSize}`,
  ];
  if (message) lines.push(`Doel: ${message.slice(0, 500)}`);

  await sendTelegramMessage(lines.join("\n"));

  return NextResponse.json({ ok: true });
}
