/**
 * Qdrant: strikte isolatie per klant via aparte collectienamen.
 * n8n / ingest moet dezelfde naam gebruiken: `${prefix}_${klant}`.
 *
 * ADR-001 dual-search: factory_os_{klant} + {klant}_kennisbank.
 * Sprint 1.3: geen legacy `factory_os` zonder suffix in productiepaden.
 */

const PER_CUSTOMER_PREFIX =
  (process.env.QDRANT_COLLECTION_PREFIX || "factory_os").replace(/\/$/, "") ||
  "factory_os";

const SCOPED_CLIENTS = new Set(["fumero", "bokas", "motor"]);

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
  return `${PER_CUSTOMER_PREFIX}_${k}`;
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
