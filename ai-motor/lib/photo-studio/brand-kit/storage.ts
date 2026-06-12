import db from "@/lib/db/database";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import type { BrandKitData, BrandKitRow } from "@/lib/photo-studio/brand-kit/types";
import type { CompanyId } from "@/lib/types";

type DbRow = {
  id: string;
  klant: string;
  data_json: string;
  created_at: string;
  updated_at: string;
};

function rowToBrandKit(row: DbRow): BrandKitRow {
  const data = JSON.parse(row.data_json) as BrandKitData;
  return {
    id: row.id,
    klant: row.klant as CompanyId,
    ...data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listBrandKits(klant: CompanyId): BrandKitRow[] {
  ensurePhotoStudioSchema();
  const rows = db
    .prepare(
      `SELECT * FROM photo_studio_brand_kits WHERE klant = ? ORDER BY updated_at DESC`
    )
    .all(klant) as DbRow[];
  return rows.map(rowToBrandKit);
}

export function getBrandKit(id: string, klant: CompanyId): BrandKitRow | null {
  ensurePhotoStudioSchema();
  const row = db
    .prepare(`SELECT * FROM photo_studio_brand_kits WHERE id = ? AND klant = ?`)
    .get(id, klant) as DbRow | undefined;
  return row ? rowToBrandKit(row) : null;
}

export function saveBrandKit(
  klant: CompanyId,
  data: BrandKitData,
  id?: string
): BrandKitRow {
  ensurePhotoStudioSchema();
  const kitId = id ?? `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const json = JSON.stringify(data);

  const existing = id
    ? (db
        .prepare(`SELECT id FROM photo_studio_brand_kits WHERE id = ? AND klant = ?`)
        .get(id, klant) as { id: string } | undefined)
    : undefined;

  if (existing) {
    db.prepare(
      `UPDATE photo_studio_brand_kits
       SET data_json = ?, updated_at = datetime('now')
       WHERE id = ? AND klant = ?`
    ).run(json, kitId, klant);
  } else {
    db.prepare(
      `INSERT INTO photo_studio_brand_kits (id, klant, data_json)
       VALUES (?, ?, ?)`
    ).run(kitId, klant, json);
  }

  const saved = getBrandKit(kitId, klant);
  if (!saved) throw new Error("Brand Kit opslaan mislukt.");
  return saved;
}

export function deleteBrandKit(id: string, klant: CompanyId): boolean {
  ensurePhotoStudioSchema();
  const result = db
    .prepare(`DELETE FROM photo_studio_brand_kits WHERE id = ? AND klant = ?`)
    .run(id, klant);
  return result.changes > 0;
}
