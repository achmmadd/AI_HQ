import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Content generatie hoort in chat — studio is deprecated. */
export default async function FumeroContentRedirectPage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = new URLSearchParams();

  const prompt =
    (typeof sp.prompt === "string" ? sp.prompt : undefined) ??
    (typeof sp.q === "string" ? sp.q : undefined);
  if (prompt?.trim()) params.set("q", prompt.trim());

  const type = typeof sp.type === "string" ? sp.type : undefined;
  if (type) params.set("content_type", type);

  const platform = typeof sp.platform === "string" ? sp.platform : undefined;
  if (platform) params.set("platform", platform);

  const qs = params.toString();
  redirect(qs ? `/fumero/chat?${qs}` : "/fumero/chat");
}
