import db from "@/lib/db/database";
import { ensureCampaignSchema } from "@/lib/photo-studio/campaign/db-migrate";
import type { CampaignPackData, CampaignPackRow, CampaignPackStatus } from "@/lib/photo-studio/campaign/types";
import type { CompanyId } from "@/lib/types";

type DbRow = {
  id: string;
  klant: string;
  status: string;
  data_json: string;
  zip_path: string | null;
  created_at: string;
  updated_at: string;
};

function rowToPack(row: DbRow): CampaignPackRow {
  const data = JSON.parse(row.data_json) as CampaignPackData;
  return {
    id: row.id,
    klant: row.klant as CompanyId,
    status: row.status as CampaignPackStatus,
    zip_path: row.zip_path,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...data,
  };
}

export function getCampaignPack(id: string, klant?: CompanyId): CampaignPackRow | null {
  ensureCampaignSchema();
  const row = klant
    ? (db
        .prepare(`SELECT * FROM fumero_campaign_packs WHERE id = ? AND klant = ?`)
        .get(id, klant) as DbRow | undefined)
    : (db
        .prepare(`SELECT * FROM fumero_campaign_packs WHERE id = ?`)
        .get(id) as DbRow | undefined);
  return row ? rowToPack(row) : null;
}

export function saveCampaignPack(
  id: string,
  klant: CompanyId,
  data: CampaignPackData,
  status: CampaignPackStatus,
  zipPath?: string | null
): CampaignPackRow {
  ensureCampaignSchema();
  const json = JSON.stringify(data);
  const existing = db
    .prepare(`SELECT id FROM fumero_campaign_packs WHERE id = ?`)
    .get(id) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE fumero_campaign_packs
       SET data_json = ?, status = ?, zip_path = ?, klant = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(json, status, zipPath ?? null, klant, id);
  } else {
    db.prepare(
      `INSERT INTO fumero_campaign_packs (id, klant, status, data_json, zip_path)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, klant, status, json, zipPath ?? null);
  }

  const saved = getCampaignPack(id, klant);
  if (!saved) throw new Error("Campaign pack opslaan mislukt.");
  return saved;
}

export function listCampaignPacks(klant: CompanyId, limit = 20): CampaignPackRow[] {
  ensureCampaignSchema();
  const rows = db
    .prepare(
      `SELECT * FROM fumero_campaign_packs WHERE klant = ?
       ORDER BY updated_at DESC LIMIT ?`
    )
    .all(klant, limit) as DbRow[];
  return rows.map(rowToPack);
}
