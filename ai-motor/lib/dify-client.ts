import { extractMessage } from "@/lib/chat-n8n";

const DIFY_BASE_URL = (
  process.env.DIFY_BASE_URL ||
  process.env.DIFY_CODE_INTERPRETER_BASE_URL ||
  "http://127.0.0.1:5001"
).replace(/\/$/, "");

function getDifyApiKey(): string | undefined {
  return (
    process.env.DIFY_SOCIAL_API_KEY ||
    process.env.DIFY_CODE_INTERPRETER_API_KEY ||
    process.env.DIFY_API_KEY
  );
}

export async function callDifyBlocking(opts: {
  query: string;
  inputs?: Record<string, string>;
  user?: string;
}): Promise<{ ok: boolean; answer: string; status: number; raw?: string }> {
  const apiKey = getDifyApiKey();
  if (!apiKey) {
    return {
      ok: false,
      answer: "",
      status: 0,
      raw: "DIFY_API_KEY (or DIFY_SOCIAL_API_KEY) missing",
    };
  }

  const res = await fetch(`${DIFY_BASE_URL}/v1/chat-messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: opts.inputs ?? {},
      query: opts.query,
      response_mode: "blocking",
      user: opts.user ?? "automation",
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const rawText = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return { ok: res.ok, answer: rawText.slice(0, 8000), status: res.status, raw: rawText };
  }

  if (!res.ok) {
    const err = extractMessage(data);
    return { ok: false, answer: err, status: res.status, raw: rawText };
  }

  return {
    ok: true,
    answer: extractMessage(data),
    status: res.status,
    raw: rawText,
  };
}
