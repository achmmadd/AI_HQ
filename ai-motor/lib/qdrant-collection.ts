/**
 * Qdrant: strikte isolatie per klant via aparte collectienamen.
 * n8n / ingest moet dezelfde naam gebruiken: `${prefix}_${klant}`.
 *
 * - QDRANT_COLLECTION: legacy enkelvoudige collectie (zoeken zonder klant).
 * - QDRANT_COLLECTION_PREFIX: basis voor per-klant buckets (default: factory_os).
 */

const LEGACY_COLLECTION =
  (process.env.QDRANT_COLLECTION || "factory_os").replace(/\/$/, "") || "factory_os";

const PER_CUSTOMER_PREFIX =
  (process.env.QDRANT_COLLECTION_PREFIX || "factory_os").replace(/\/$/, "") ||
  "factory_os";

const SCOPED_CLIENTS = new Set(["fumero", "bokas"]);

export function qdrantLegacyCollection(): string {
  return LEGACY_COLLECTION;
}

/** Collectienaam voor vector search / upsert. Zonder klant: legacy bucket. */
export function qdrantCollectionForScope(klant?: string | null): string {
  const k = (klant || "").trim().toLowerCase();
  if (k && SCOPED_CLIENTS.has(k)) {
    return `${PER_CUSTOMER_PREFIX}_${k}`;
  }
  return LEGACY_COLLECTION;
}

/** True als we in de legacy bucket zitten en payload-filter op `client` zinvol kan zijn. */
export function qdrantShouldFilterByClient(
  collection: string,
  klant?: string | null
): boolean {
  const k = (klant || "").trim().toLowerCase();
  return collection === LEGACY_COLLECTION && !!k && SCOPED_CLIENTS.has(k);
}
