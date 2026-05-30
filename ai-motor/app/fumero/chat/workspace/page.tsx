import { redirect } from "next/navigation";

export default async function FumeroChatWorkspaceRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") q.set(k, v);
    else if (Array.isArray(v) && typeof v[0] === "string") q.set(k, v[0]);
  }
  const query = q.toString();
  redirect(query ? `/fumero/chat?${query}` : "/fumero/chat");
}
