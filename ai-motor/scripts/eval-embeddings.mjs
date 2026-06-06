#!/usr/bin/env node
/**
 * Embeddings eval — compare nomic-embed-text vs optional e5-base-trm-nl (Sprint 2.2).
 *
 *   node scripts/eval-embeddings.mjs              # dry-run (no Ollama)
 *   node scripts/eval-embeddings.mjs --live       # call Ollama for both models
 *   OLLAMA_URL=http://hetzner:11434 node scripts/eval-embeddings.mjs --live
 *
 * Output: ranking overlap + cosine top-1 accuracy on a small NL FAQ set.
 * Re-index Qdrant only after switching OLLAMA_EMBED_MODEL — see docs/model-config.md.
 */

const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(
  /\/$/,
  ""
);
const BASELINE_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const CANDIDATE_MODEL =
  process.env.EMBED_EVAL_CANDIDATE || "e5-base-trm-nl";
const LIVE = process.argv.includes("--live");

/** Minimal NL FAQ pairs — query → expected doc id */
const FAQ_DOCS = [
  {
    id: "fumero-levertijd",
    text: "Fumero levert maatwerk meubels binnen 6 tot 10 weken na goedkeuring van het ontwerp.",
  },
  {
    id: "fumero-garantie",
    text: "Op alle Fumero meubels geldt 5 jaar garantie op constructie en afwerking.",
  },
  {
    id: "bokas-reserveren",
    text: "Reserveren bij Bokas kan online via het formulier of telefonisch tijdens openingstijden.",
  },
  {
    id: "bokas-allergenen",
    text: "Bokas vermeldt allergenen per gerecht op het menu en in de keukenkaart.",
  },
  {
    id: "motor-support",
    text: "Motor AI support is bereikbaar via de chat in je workspace of goedkeuringen in Cowork.",
  },
];

const FAQ_QUERIES = [
  {
    query: "Hoe lang duurt levering bij Fumero?",
    expect: "fumero-levertijd",
  },
  {
    query: "Welke garantie krijg ik op meubels?",
    expect: "fumero-garantie",
  },
  {
    query: "Hoe maak ik een tafelreservering?",
    expect: "bokas-reserveren",
  },
  {
    query: "Waar staan allergenen vermeld?",
    expect: "bokas-allergenen",
  },
  {
    query: "Hoe vraag ik hulp aan in Motor?",
    expect: "motor-support",
  },
];

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function pseudoEmbed(text, dim = 64) {
  const vec = new Array(dim).fill(0);
  const normalized = text.toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    vec[i % dim] += normalized.charCodeAt(i) / 256;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

async function ollamaEmbed(model, text) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text.slice(0, 8000) }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`Ollama embed ${model}: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error(`Ollama embed ${model}: empty vector`);
  }
  return data.embedding;
}

async function embed(model, text) {
  if (LIVE) return ollamaEmbed(model, text);
  return pseudoEmbed(`${model}::${text}`, 64);
}

function rankDocs(queryVec, docVecs) {
  return docVecs
    .map((d) => ({ id: d.id, score: cosine(queryVec, d.vec) }))
    .sort((a, b) => b.score - a.score);
}

function top1Accuracy(model, docEmbeds) {
  let hits = 0;
  const rows = [];

  for (const q of FAQ_QUERIES) {
    const qVec = docEmbeds[`${model}:query:${q.query}`];
    const ranked = rankDocs(
      qVec,
      FAQ_DOCS.map((d) => ({ id: d.id, vec: docEmbeds[`${model}:doc:${d.id}`] }))
    );
    const top = ranked[0]?.id;
    const ok = top === q.expect;
    if (ok) hits += 1;
    rows.push({ query: q.query, expect: q.expect, top, ok, score: ranked[0]?.score });
  }

  return { accuracy: hits / FAQ_QUERIES.length, rows };
}

async function main() {
  console.log(`Embeddings eval (${LIVE ? "LIVE Ollama" : "DRY-RUN pseudo vectors"})`);
  console.log(`  OLLAMA_URL=${OLLAMA_URL}`);
  console.log(`  baseline=${BASELINE_MODEL}`);
  console.log(`  candidate=${CANDIDATE_MODEL}`);
  console.log("");

  const store = {};

  for (const model of [BASELINE_MODEL, CANDIDATE_MODEL]) {
    for (const doc of FAQ_DOCS) {
      store[`${model}:doc:${doc.id}`] = await embed(model, doc.text);
    }
    for (const q of FAQ_QUERIES) {
      store[`${model}:query:${q.query}`] = await embed(model, q.query);
    }
  }

  const baseline = top1Accuracy(BASELINE_MODEL, store);
  const candidate = top1Accuracy(CANDIDATE_MODEL, store);

  console.log(`Baseline ${BASELINE_MODEL}: top-1 = ${(baseline.accuracy * 100).toFixed(0)}%`);
  for (const r of baseline.rows) {
    console.log(`  ${r.ok ? "✓" : "✗"} "${r.query}" → ${r.top} (expect ${r.expect})`);
  }

  console.log("");
  console.log(
    `Candidate ${CANDIDATE_MODEL}: top-1 = ${(candidate.accuracy * 100).toFixed(0)}%`
  );
  for (const r of candidate.rows) {
    console.log(`  ${r.ok ? "✓" : "✗"} "${r.query}" → ${r.top} (expect ${r.expect})`);
  }

  const overlap = baseline.rows.filter(
    (b, i) => b.top === candidate.rows[i]?.top
  ).length;

  console.log("");
  console.log(`Ranking overlap (same top-1): ${overlap}/${FAQ_QUERIES.length}`);
  console.log("");
  console.log("Re-index rule: wijzig OLLAMA_EMBED_MODEL alleen na eval + Qdrant re-ingest.");
  console.log("  node scripts/qdrant-migrate-collections.mjs --dry-run  # sanity");
  console.log("  See docs/model-config.md § Qdrant-collecties");

  if (!LIVE) {
    console.log("");
    console.log("Tip: run with --live when Ollama has both models pulled.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
