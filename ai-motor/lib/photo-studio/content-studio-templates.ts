import db from "@/lib/db/database";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import type {
  ContentStudioTemplateRow,
  PromptBlocks,
  StarterTemplate,
} from "@/lib/photo-studio/types";
import type { CompanyId } from "@/lib/types";

type DbRow = {
  id: string;
  klant: string;
  title: string;
  category: string;
  platform: string;
  thumbnail_url: string | null;
  blocks_json: string;
  aspect_ratio: string;
  quality: string;
  tags_json: string | null;
  is_recipe: number;
  created_at: string;
};

function rowToTemplate(row: DbRow): ContentStudioTemplateRow {
  return {
    id: row.id,
    klant: row.klant as CompanyId,
    title: row.title,
    category: row.category as ContentStudioTemplateRow["category"],
    platform: row.platform as ContentStudioTemplateRow["platform"],
    thumbnail_url: row.thumbnail_url,
    blocks: JSON.parse(row.blocks_json) as PromptBlocks,
    aspect_ratio: row.aspect_ratio as ContentStudioTemplateRow["aspect_ratio"],
    quality: row.quality as ContentStudioTemplateRow["quality"],
    tags: row.tags_json ? (JSON.parse(row.tags_json) as string[]) : [],
    is_recipe: row.is_recipe === 1,
    created_at: row.created_at,
  };
}

export function listContentStudioTemplates(opts: {
  klant: CompanyId;
  recipesOnly?: boolean;
}): ContentStudioTemplateRow[] {
  ensurePhotoStudioSchema();
  const sql = opts.recipesOnly
    ? `SELECT * FROM content_studio_templates WHERE klant = ? AND is_recipe = 1 ORDER BY created_at DESC`
    : `SELECT * FROM content_studio_templates WHERE klant = ? ORDER BY created_at DESC`;
  const rows = db.prepare(sql).all(opts.klant) as DbRow[];
  return rows.map(rowToTemplate);
}

export function saveContentStudioTemplate(opts: {
  klant: CompanyId;
  title: string;
  category: StarterTemplate["category"];
  platform: StarterTemplate["platform"];
  blocks: PromptBlocks;
  aspect_ratio: StarterTemplate["aspect_ratio"];
  quality: StarterTemplate["quality"];
  tags?: string[];
  thumbnail_url?: string | null;
  is_recipe?: boolean;
}): ContentStudioTemplateRow {
  ensurePhotoStudioSchema();
  const id = `cst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    `INSERT INTO content_studio_templates (
      id, klant, title, category, platform, thumbnail_url,
      blocks_json, aspect_ratio, quality, tags_json, is_recipe
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    opts.klant,
    opts.title.trim(),
    opts.category,
    opts.platform,
    opts.thumbnail_url ?? null,
    JSON.stringify(opts.blocks),
    opts.aspect_ratio,
    opts.quality,
    JSON.stringify(opts.tags ?? []),
    opts.is_recipe ? 1 : 0
  );
  const row = db
    .prepare(`SELECT * FROM content_studio_templates WHERE id = ?`)
    .get(id) as DbRow;
  return rowToTemplate(row);
}

export function deleteContentStudioTemplate(
  id: string,
  klant: CompanyId
): boolean {
  ensurePhotoStudioSchema();
  const result = db
    .prepare(
      `DELETE FROM content_studio_templates WHERE id = ? AND klant = ? AND is_recipe = 1`
    )
    .run(id, klant);
  return result.changes > 0;
}
