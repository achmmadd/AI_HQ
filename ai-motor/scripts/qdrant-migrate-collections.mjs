#!/usr/bin/env node
/**
 * Migreer vectors van legacy `factory_os` naar per-klant buckets `factory_os_{klant}`.
 *
 * Gebruik:
 *   node scripts/qdrant-migrate-collections.mjs --dry-run
 *   node scripts/qdrant-migrate-collections.mjs --klant fumero
 *   node scripts/qdrant-migrate-collections.mjs --klant bokas --batch 200
 *
 * Env:
 *   QDRANT_URL                  (default http://127.0.0.1:6333)
 *   QDRANT_COLLECTION           legacy bron-collectie (default factory_os)
 *   QDRANT_COLLECTION_PREFIX    doel-prefix (default factory_os)
 *
 * --dry-run: alleen tellen en rapporteren; geen upserts.
 * Zonder --klant: migreer fumero én bokas.
 */

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const klantArgIdx = args.indexOf("--klant");
const batchArgIdx = args.indexOf("--batch");

const klantFilter =
  klantArgIdx >= 0 && args[klantArgIdx + 1]
    ? args[klantArgIdx + 1].trim().toLowerCase()
    : null;

const batchSize = Math.min(
  Math.max(Number(args[batchArgIdx + 1]) || 100, 10),
  500
);

const QDRANT_URL = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(
  /\/$/,
  ""
);
const LEGACY_COLLECTION =
  (process.env.QDRANT_COLLECTION || "factory_os").replace(/\/$/, "") ||
  "factory_os";
const PREFIX =
  (process.env.QDRANT_COLLECTION_PREFIX || "factory_os").replace(/\/$/, "") ||
  "factory_os";

const TENANTS = ["fumero", "bokas"];

function targetCollection(klant) {
  return `${PREFIX}_${klant}`;
}

async function qdrantFetch(path, init = {}) {
  const res = await fetch(`${QDRANT_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

async function collectionExists(name) {
  const { res } = await qdrantFetch(`/collections/${encodeURIComponent(name)}`);
  return res.ok;
}

async function ensureTargetCollection(name, vectorSize) {
  if (await collectionExists(name)) return { ok: true, created: false };

  const { res, text } = await qdrantFetch(
    `/collections/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        vectors: { size: vectorSize, distance: "Cosine" },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Create ${name} failed: ${res.status} ${text}`);
  }
  return { ok: true, created: true };
}

async function scrollLegacyPoints(klant, offset) {
  const filter = {
    must: [{ key: "client", match: { value: klant } }],
  };
  const { res, body, text } = await qdrantFetch(
    `/collections/${encodeURIComponent(LEGACY_COLLECTION)}/points/scroll`,
    {
      method: "POST",
      body: JSON.stringify({
        limit: batchSize,
        offset: offset ?? undefined,
        with_payload: true,
        with_vector: true,
        filter,
      }),
    }
  );

  if (res.status === 404) {
    return { points: [], nextOffset: null, missing: true };
  }
  if (!res.ok) {
    throw new Error(`Scroll failed: ${res.status} ${text}`);
  }

  const points = Array.isArray(body?.result?.points) ? body.result.points : [];
  const nextOffset = body?.result?.next_page_offset ?? null;
  return { points, nextOffset, missing: false };
}

async function upsertPoints(collection, points) {
  const { res, text } = await qdrantFetch(
    `/collections/${encodeURIComponent(collection)}/points?wait=true`,
    {
      method: "PUT",
      body: JSON.stringify({
        points: points.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: {
            ...(p.payload || {}),
            client: p.payload?.client || collection.split("_").pop(),
            migrated_from: LEGACY_COLLECTION,
            migrated_at: new Date().toISOString(),
          },
        })),
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Upsert to ${collection} failed: ${res.status} ${text}`);
  }
}

async function migrateKlant(klant) {
  const target = targetCollection(klant);
  console.log(`\n── ${klant}: ${LEGACY_COLLECTION} → ${target} ${dryRun ? "(dry-run)" : ""}`);

  if (!(await collectionExists(LEGACY_COLLECTION))) {
    console.log(`  ⚠ Bron-collectie ${LEGACY_COLLECTION} ontbreekt — overslaan.`);
    return { klant, scanned: 0, upserted: 0, skipped: true };
  }

  let offset = undefined;
  let scanned = 0;
  let upserted = 0;
  let vectorSize = null;

  for (;;) {
    const { points, nextOffset, missing } = await scrollLegacyPoints(klant, offset);
    if (missing) break;
    if (!points.length) break;

    scanned += points.length;
    if (vectorSize == null && points[0]?.vector?.length) {
      vectorSize = points[0].vector.length;
    }

    if (dryRun) {
      console.log(`  … ${scanned} punten gevonden (batch ${points.length})`);
    } else {
      if (vectorSize) {
        await ensureTargetCollection(target, vectorSize);
      }
      await upsertPoints(target, points);
      upserted += points.length;
      console.log(`  ✓ ${upserted} punten gekopieerd`);
    }

    if (nextOffset == null) break;
    offset = nextOffset;
  }

  if (scanned === 0) {
    console.log(`  · Geen punten met client=${klant} in ${LEGACY_COLLECTION}`);
  } else if (dryRun) {
    console.log(`  ✓ Dry-run: ${scanned} punten zouden naar ${target} gaan`);
  } else {
    console.log(`  ✓ Klaar: ${upserted} punten in ${target}`);
  }

  return { klant, scanned, upserted: dryRun ? 0 : upserted, skipped: false };
}

async function main() {
  const tenants = klantFilter
    ? TENANTS.includes(klantFilter)
      ? [klantFilter]
      : (console.error(`Onbekende --klant: ${klantFilter}`), process.exit(1))
    : TENANTS;

  console.log("Qdrant collectie-migratie");
  console.log(`  URL:     ${QDRANT_URL}`);
  console.log(`  Bron:    ${LEGACY_COLLECTION}`);
  console.log(`  Prefix:  ${PREFIX}`);
  console.log(`  Modus:   ${dryRun ? "dry-run (geen writes)" : "live copy"}`);
  console.log(`  Klanten: ${tenants.join(", ")}`);

  const summary = [];
  for (const klant of tenants) {
    summary.push(await migrateKlant(klant));
  }

  console.log("\n── Samenvatting ──");
  for (const row of summary) {
    if (row.skipped) continue;
    console.log(
      `  ${row.klant}: ${row.scanned} gescand, ${dryRun ? "0 (dry-run)" : row.upserted} geschreven`
    );
  }

  if (dryRun) {
    console.log(
      "\nDry-run afgerond. Voer zonder --dry-run uit om daadwerkelijk te kopiëren."
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
