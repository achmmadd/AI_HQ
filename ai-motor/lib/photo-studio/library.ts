import db from "@/lib/db/database";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import { newPhotoTrackingId } from "@/lib/photo-studio/tracking-id";
import { downloadImageBuffer } from "@/lib/photo-studio/download-master";
import { resizeMasterToVariants } from "@/lib/photo-studio/resize-variants";
import type { CompanyId } from "@/lib/types";
import type { PhotoStudioMode } from "@/lib/photo-studio/types";

export type PersistGenerationInput = {
  klant: CompanyId;
  mode: PhotoStudioMode;
  prompt: string;
  master_url: string;
  source_image_url?: string | null;
  seed?: number | null;
  workspace_preset?: string | null;
};

export type PersistedGeneration = {
  id: number;
  tracking_id: string;
  master_public_url: string;
  variants: Array<{
    aspect: string;
    public_url: string;
    width: number;
    height: number;
  }>;
  content_id: number | null;
};

export async function persistPhotoGeneration(
  input: PersistGenerationInput
): Promise<PersistedGeneration> {
  ensurePhotoStudioSchema();
  const tracking_id = newPhotoTrackingId();
  const buffer = await downloadImageBuffer(input.master_url);
  const { master_path, master_public_url, variants } =
    await resizeMasterToVariants(buffer, tracking_id);

  const insert = db.prepare(
    `INSERT INTO photo_studio_generations (
      tracking_id, klant, mode, prompt, source_image_url, seed,
      master_url, master_path, workspace_preset
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = insert.run(
    tracking_id,
    input.klant,
    input.mode,
    input.prompt,
    input.source_image_url ?? null,
    input.seed ?? null,
    master_public_url,
    master_path,
    input.workspace_preset ?? null
  );
  const generationId = Number(result.lastInsertRowid);

  const variantInsert = db.prepare(
    `INSERT INTO photo_studio_variants (
      generation_id, aspect, width, height, file_path, public_url
    ) VALUES (?, ?, ?, ?, ?, ?)`
  );

  const variantRows = variants.map((v) => {
    variantInsert.run(
      generationId,
      v.aspect,
      v.width,
      v.height,
      v.file_path,
      v.public_url
    );
    return {
      aspect: v.aspect,
      public_url: v.public_url,
      width: v.width,
      height: v.height,
    };
  });

  const ig = variantRows.find((v) => v.aspect === "ig_1_1");
  const caption = input.prompt.slice(0, 500);
  const contentResult = db
    .prepare(
      `INSERT INTO content_posts (klant, platform, type, titel, content, status, source, media_url)
       VALUES (?, 'instagram', 'product_photo', ?, ?, 'draft', 'photo_studio', ?)`
    )
    .run(
      input.klant,
      `Photo Studio ${tracking_id}`,
      caption,
      ig?.public_url ?? master_public_url
    );
  const content_id = Number(contentResult.lastInsertRowid);
  db.prepare(`UPDATE photo_studio_generations SET content_id = ? WHERE id = ?`).run(
    content_id,
    generationId
  );

  return {
    id: generationId,
    tracking_id,
    master_public_url,
    variants: variantRows,
    content_id,
  };
}

export function listPhotoGenerations(klant: CompanyId, limit = 30) {
  ensurePhotoStudioSchema();
  const rows = db
    .prepare(
      `SELECT g.*, (
        SELECT json_group_array(json_object(
          'aspect', v.aspect, 'public_url', v.public_url,
          'width', v.width, 'height', v.height
        ))
        FROM photo_studio_variants v WHERE v.generation_id = g.id
      ) AS variants_json
      FROM photo_studio_generations g
      WHERE g.klant = ?
      ORDER BY datetime(g.created_at) DESC
      LIMIT ?`
    )
    .all(klant, limit) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as number,
    tracking_id: r.tracking_id as string,
    mode: r.mode as string,
    prompt: r.prompt as string,
    master_url: r.master_url as string,
    content_id: r.content_id as number | null,
    created_at: r.created_at as string,
    variants: JSON.parse((r.variants_json as string) || "[]") as Array<{
      aspect: string;
      public_url: string;
      width: number;
      height: number;
    }>,
  }));
}
