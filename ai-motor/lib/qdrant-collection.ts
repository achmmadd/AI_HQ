/**
 * Qdrant: strikte isolatie per klant via aparte collectienamen.
 * n8n / ingest moet dezelfde naam gebruiken: `${prefix}_${klant}`.
 *
 * ADR-001 dual-search: factory_os_{klant} + {klant}_kennisbank.
 * Sprint 1.3: geen legacy `factory_os` zonder suffix in productiepaden.
 */

const SCOPED_CLIENTS = new Set(["fumero", "bokas", "motor"]);

function qdrantCollectionPrefix(): string {
  return (
    (process.env.QDRANT_COLLECTION_PREFIX || "factory_os").replace(/\/$/, "") ||
    "factory_os"
  );
}

/**
 * Legacy single-collection name — **alleen** voor `scripts/qdrant-migrate-collections.mjs`.
 * Niet gebruiken in app/API/ingest/search.
 */
export function qdrantLegacyCollection(): string {
  return (
    (process.env.QDRANT_COLLECTION || "factory_os").replace(/\/$/, "") ||
    "factory_os"
  );
}

function normalizeKlant(klant?: string | null): string {
  const k = (klant || "").trim().toLowerCase();
  if (k && SCOPED_CLIENTS.has(k)) return k;
  if (k === "system" || k === "algemeen") return "motor";
  return "motor";
}

/** Collectienaam voor vector search / upsert — altijd scoped (`factory_os_{klant}`). */
export function qdrantCollectionForScope(klant?: string | null): string {
  const k = normalizeKlant(klant);
  return `${qdrantCollectionPrefix()}_${k}`;
}

/** Scrape-kennisbank bucket per klant (bijv. fumero_kennisbank). */
export function qdrantScrapeCollectionForScope(
  klant?: string | null
): string | null {
  const k = normalizeKlant(klant);
  if (k === "fumero") {
    return (
      process.env.QDRANT_FUMERO_KENNISBANK_COLLECTION?.trim() ||
      "fumero_kennisbank"
    );
  }
  if (k === "bokas") {
    return (
      process.env.QDRANT_BOKAS_KENNISBANK_COLLECTION?.trim() ||
      "bokas_kennisbank"
    );
  }
  return null;
}

/**
 * Dual-search: file-ingest bucket + scrape bucket (ADR-001 — geen merge-migratie).
 */
export function qdrantSearchCollectionsForScope(
  klant?: string | null
): string[] {
  const primary = qdrantCollectionForScope(klant);
  const scrape = qdrantScrapeCollectionForScope(klant);
  if (scrape && scrape !== primary) return [primary, scrape];
  return [primary];
}

/** UI-label: primaire ingest-collectie voor een klant (zelfde logica als upsert). */
export function qdrantIngestCollectionLabel(klant?: string | null): string {
  return qdrantCollectionForScope(klant);
}

/** Canonical ingest target — alias for file/chat upsert paths. */
export function qdrantIngestCollectionForScope(klant?: string | null): string {
  return qdrantCollectionForScope(klant);
}

export type QdrantScopeCollectionPlan = {
  klant: string;
  /** File/chat ingest bucket (`factory_os_{klant}`). */
  ingest: string;
  /** Scrape bucket or null when dual-search uses ingest only. */
  scrape: string | null;
  /** All buckets searched by `searchKnowledge()` (deduped, ingest first). */
  search: string[];
  /** Legacy bucket — migratiescript only; not used in prod search/ingest. */
  legacy: string;
};

/**
 * SSOT snapshot for logging, health checks, and UI catalog.
 * Ingest always targets `ingest`; search fans out to `search` (ingest + optional scrape).
 */
export function describeQdrantCollectionsForScope(
  klant?: string | null
): QdrantScopeCollectionPlan {
  const k = normalizeKlant(klant);
  const ingest = qdrantIngestCollectionForScope(k);
  const scrape = qdrantScrapeCollectionForScope(k);
  const search = qdrantSearchCollectionsForScope(k);
  return {
    klant: k,
    ingest,
    scrape,
    search,
    legacy: qdrantLegacyCollection(),
  };
}

/** Warn when legacy env suggests writes to a bucket search no longer queries. */
export function logQdrantCollectionPlan(
  context: string,
  klant?: string | null
): QdrantScopeCollectionPlan {
  const plan = describeQdrantCollectionsForScope(klant);
  if (process.env.NODE_ENV === "test") return plan;

  const legacy = plan.legacy.trim();
  const legacyInSearch = plan.search.includes(legacy);
  const legacyIsIngest = legacy === plan.ingest;

  if (legacy && !legacyInSearch && !legacyIsIngest && legacy !== qdrantCollectionPrefix()) {
    console.warn(
      `[qdrant:${context}] QDRANT_COLLECTION=${legacy} is legacy-only; ingest→${plan.ingest}, search→[${plan.search.join(", ")}]. Run scripts/qdrant-migrate-collections.mjs if data still lives in ${legacy}.`
    );
  }

  return plan;
}

/** Collecties die we op health/integration-readiness monitoren (geen legacy bucket). */
export function listMonitoredQdrantCollections(): string[] {
  const names = new Set<string>();
  for (const k of SCOPED_CLIENTS) {
    names.add(qdrantCollectionForScope(k));
    const scrape = qdrantScrapeCollectionForScope(k);
    if (scrape) names.add(scrape);
  }
  return [...names];
}
