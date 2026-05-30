export type ConversationListItem = {
  id: number;
  title: string;
  updated_at: string;
  created_at: string;
};

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Client-side fallback titel uit eerste gebruikersbericht (max ~6 woorden). */
export function deriveConversationTitleFromMessage(text: string): string {
  const cleaned = text
    .replace(/^[\s📎]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Nieuwe chat";
  const words = cleaned.split(/\s+/).slice(0, 6);
  let title = words.join(" ");
  if (title.length > 48) title = `${title.slice(0, 45)}…`;
  return title;
}

/** Fumero coder sidebar: max N recente threads, rest in archief. */
function isEmptyNewChat(c: ConversationListItem): boolean {
  return c.title.trim() === "Nieuwe chat";
}

/** Verberg lege duplicate "Nieuwe chat" — houd de meest recente. */
export function dedupeEmptyNewChats(
  conversations: ConversationListItem[]
): ConversationListItem[] {
  let keptEmpty = false;
  return conversations.filter((c) => {
    if (!isEmptyNewChat(c)) return true;
    if (keptEmpty) return false;
    keptEmpty = true;
    return true;
  });
}

export function groupFumeroChatThreads(
  conversations: ConversationListItem[],
  maxRecent = 3
): { recent: ConversationListItem[]; archive: ConversationListItem[] } {
  const sorted = dedupeEmptyNewChats(
    [...conversations].sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime()
    )
  );
  return {
    recent: sorted.slice(0, maxRecent),
    archive: sorted.slice(maxRecent),
  };
}

export function groupConversationsByDate(conversations: ConversationListItem[]): {
  label: string;
  items: ConversationListItem[];
}[] {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = startOfLocalDay(yesterday);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStart = startOfLocalDay(weekAgo);

  const today: ConversationListItem[] = [];
  const yday: ConversationListItem[] = [];
  const thisWeek: ConversationListItem[] = [];
  const older: ConversationListItem[] = [];

  for (const c of conversations) {
    const t = new Date(c.updated_at || c.created_at).getTime();
    if (t >= todayStart) today.push(c);
    else if (t >= yesterdayStart) yday.push(c);
    else if (t >= weekStart) thisWeek.push(c);
    else older.push(c);
  }

  const out: { label: string; items: ConversationListItem[] }[] = [];
  if (today.length) out.push({ label: "Vandaag", items: today });
  if (yday.length) out.push({ label: "Gisteren", items: yday });
  if (thisWeek.length) out.push({ label: "Deze week", items: thisWeek });
  if (older.length) out.push({ label: "Eerder", items: older });
  return out;
}
