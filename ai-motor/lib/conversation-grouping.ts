export type ConversationListItem = {
  id: number;
  title: string;
  updated_at: string;
  created_at: string;
};

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
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
