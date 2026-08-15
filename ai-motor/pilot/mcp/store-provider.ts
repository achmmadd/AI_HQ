/**
 * Store-backed read-only snapshot provider (coördinator, integratiefase).
 *
 * Leest de append-only conceptstore via de bestaande read-interface en
 * vertaalt een record naar een RawRunSnapshot. De ruwe concepttekst wordt
 * bewust wél in het raw-object gezet: de sanitizer in snapshot.ts is de
 * enige plek die beslist wat de MCP-grens over gaat, en de tests bewijzen
 * dat die tekst nooit meekomt.
 *
 * De provider heeft geen write-surface en krijgt er geen: hij ziet alleen
 * de listDrafts-leesfunctie.
 */

import { createHash } from "node:crypto";

import type { DraftStoreRecord } from "../draft-store.ts";
import type {
  RawRunSnapshot,
  RunSnapshotProvider,
  RunSnapshotScope,
} from "./snapshot.ts";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Store-record met tenancy-kolom. De gedeelde store is multi-workspace:
 * alleen een record dat expliciet aan de gevraagde workspace toebehoort
 * is zichtbaar. Records zonder dit veld (legacy, vóór de tenancy-kolom)
 * horen nergens aantoonbaar bij en zijn voor elke workspace onzichtbaar
 * — fail-closed, nooit een snapshot op alleen een run_id-gok.
 */
export type StoredDraftRecord = DraftStoreRecord & {
  readonly workspace_id?: string;
};

export interface StoreSnapshotProviderDeps {
  /** Read-only store interface (bijv. listDrafts). Nooit een write-functie. */
  readonly listDrafts: (
    limit?: number,
  ) => Promise<readonly StoredDraftRecord[]>;
  readonly workspaceId: string;
}

export function createStoreSnapshotProvider(
  deps: StoreSnapshotProviderDeps,
): RunSnapshotProvider {
  return Object.freeze({
    getRunSnapshot: async (scope: RunSnapshotScope) => {
      if (scope.workspace_id !== deps.workspaceId) {
        return null;
      }
      const drafts = await deps.listDrafts(1000);
      // Workspace-eigendom gaat vóór de run_id-match: een run van een andere
      // workspace volgt het bestaande not-found-pad, nooit een snapshot.
      const record = drafts.find(
        (d) =>
          d.workspace_id === scope.workspace_id && d.run_id === scope.run_id,
      );
      if (record === undefined) {
        return null;
      }
      const raw: RawRunSnapshot = {
        task_id: scope.task_id,
        run_id: record.run_id,
        status: "stored",
        // De store bewaart bewust geen attempt-/adapter-metadata; dat is
        // eerlijk rapporteren, niet gokken.
        attempt_id: "unavailable-in-record",
        adapter_id: "unavailable-in-record",
        adapter_version: "unavailable-in-record",
        draft_id: record.run_id,
        draft_digest: sha256(record.draft),
        artifact_id: "review",
        artifact_digest: sha256(record.review),
        evidence: [],
        evaluation_status: "not-evaluated",
        data_class: "internal",
        // Gevoelige ruwe velden: de sanitizer redacteert deze altijd.
        draft_text: record.draft,
      };
      return raw;
    },
  });
}
