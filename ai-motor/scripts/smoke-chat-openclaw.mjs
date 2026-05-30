#!/usr/bin/env node
/**
 * Meet chat-latency (OpenClaw routing) tegen lokale of productie-URL.
 *
 *   BASE_URL=http://127.0.0.1:3040 node scripts/smoke-chat-openclaw.mjs
 */

const base = (process.env.BASE_URL || "http://127.0.0.1:3040").replace(/\/$/, "");
const prompt = process.env.SMOKE_PROMPT || "Zeg hallo in één korte zin.";

async function main() {
  const t0 = Date.now();
  let ttft = null;
  let routing = null;
  let message = "";

  const res = await fetch(`${base}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      klant: "fumero",
      agent_mode: false,
      context: [],
    }),
  });

  if (!res.ok) {
    console.error(`HTTP ${res.status}`);
    process.exit(1);
  }

  const text = await res.text();
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const ev = JSON.parse(line.slice(6));
      if (ev.type === "routing" && ev.routing) routing = ev.routing;
      if (ev.type === "delta" && ev.text && ttft === null) {
        ttft = Date.now() - t0;
      }
      if (ev.type === "done") {
        routing = ev.routing ?? routing;
        message = ev.message ?? message;
      }
    } catch {
      /* ignore */
    }
  }

  const total = Date.now() - t0;
  console.log(`BASE_URL=${base}`);
  console.log(`routing=${routing ?? "?"}`);
  console.log(`ttft_ms=${ttft ?? "—"}`);
  console.log(`total_ms=${total}`);
  console.log(`message=${message.slice(0, 120)}`);

  if (routing !== "openclaw" && routing !== "openrouter" && routing !== "n8n") {
    console.error("Onverwachte routing");
    process.exit(1);
  }
  if (!message.trim()) {
    console.error("Leeg antwoord");
    process.exit(1);
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
