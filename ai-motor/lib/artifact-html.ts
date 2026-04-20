import {
  extractAppCodeFromFactoryOutput,
  normalizeAppCodeForPreview,
  validateAppCode,
} from "@/lib/builder-code";
import { isBuildLikePrompt } from "@/lib/build-intent";
import { extractMessage } from "@/lib/chat-n8n";

const DIFY_BASE_URL = (
  process.env.DIFY_BASE_URL ||
  process.env.DIFY_CODE_INTERPRETER_BASE_URL ||
  "http://127.0.0.1:5001"
).replace(/\/$/, "");

/** Zelfde volgorde als `lib/dify-client.ts` — één geconfigureerde key volstaat. */
function getDifyBuilderApiKey(): string | undefined {
  return (
    process.env.DIFY_SOCIAL_API_KEY ||
    process.env.DIFY_CODE_INTERPRETER_API_KEY ||
    process.env.DIFY_API_KEY
  );
}

const BUILDER_HINT =
  "Lever één volledig HTML5-document met <!DOCTYPE html>, <html>, <head>, <body>, minstens één <script> zonder type=module, vanilla DOM (geen React/JSX). Tailwind mag via CDN in <head>. Geen markdown-fences; alleen ruwe HTML.";

async function callDifyChatMessages(
  query: string,
  inputs: Record<string, string>
): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
  rawText: string;
}> {
  const apiKey = getDifyBuilderApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      data: { error: "DIFY_CODE_INTERPRETER_API_KEY (or DIFY_API_KEY) not set" },
      rawText: "",
    };
  }

  const res = await fetch(`${DIFY_BASE_URL}/v1/chat-messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs,
      query,
      response_mode: "blocking",
      user: "artifact",
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const rawText = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    data = { answer: rawText };
  }

  return { ok: res.ok, status: res.status, data, rawText };
}

function difyErrorDetail(data: Record<string, unknown>, status: number): string {
  const msg = data.message ?? data.msg ?? data.error;
  const code = data.code;
  if (typeof msg === "string") {
    return code != null ? `${msg} (${String(code)})` : msg;
  }
  if (typeof code === "string" || typeof code === "number") {
    return `Dify HTTP ${status} (code: ${code})`;
  }
  return `Dify HTTP ${status}`;
}

export { isBuildLikePrompt };

export async function generateArtifactHtml(
  userPrompt: string,
  klant: string,
  afdeling: string,
  maxAttempts = 3
): Promise<{ html: string; attempts: number; error?: string }> {
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const retryHint =
      attempt > 1
        ? `\n\nVORIGE POGING MISLUKT: ${lastError}\nLos dit op: één volledig HTML-bestand met vanilla JS (geen React/JSX), geen import/export, geen markdown-fences.`
        : "";

    const query = `${BUILDER_HINT}\n\nBouw deze app: ${userPrompt.trim()}${retryHint}`;

    try {
      const { ok, status, data } = await callDifyChatMessages(query, {
        klant,
        afdeling,
      });

      if (!ok) {
        lastError = difyErrorDetail(data, status);
        continue;
      }

      const text = extractMessage(data);
      let code = extractAppCodeFromFactoryOutput(text);
      code = code
        .replace(/```(?:jsx?|tsx?|javascript|react)?\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();
      code = normalizeAppCodeForPreview(code);

      const validation = validateAppCode(code);
      if (validation.valid) {
        return { html: validation.code, attempts: attempt };
      }
      lastError = validation.error;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    html: "",
    attempts: maxAttempts,
    error: `Mislukt na ${maxAttempts} pogingen: ${lastError}`,
  };
}

export function assertDifyConfigured(): boolean {
  return Boolean(getDifyBuilderApiKey());
}
