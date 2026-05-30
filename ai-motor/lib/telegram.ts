export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    /* optional */
  }
}

function coworkBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3040"
  );
}

export type CoworkTab =
  | "tasks"
  | "approvals"
  | "skills"
  | "n8n"
  | "bridge"
  | "audit";

/** Telegram-melding met deeplink naar /cowork?tab=… */
export async function notifyCoworkEvent(opts: {
  title: string;
  detail?: string;
  tab?: CoworkTab;
  klant?: string;
}): Promise<void> {
  const tab = opts.tab ?? "tasks";
  const url = `${coworkBaseUrl()}/cowork?tab=${tab}`;
  const lines = [`Cowork: ${opts.title}`];
  if (opts.detail?.trim()) lines.push(opts.detail.trim());
  if (opts.klant?.trim()) lines.push(`Klant: ${opts.klant.trim()}`);
  lines.push(`Open: ${url}`);
  await sendTelegramMessage(lines.join("\n"));
}
