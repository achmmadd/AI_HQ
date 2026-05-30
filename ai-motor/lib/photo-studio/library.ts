import db from "@/lib/db/database";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import { newPhotoTrackingId } from "@/lib/photo-studio/tracking-id";
import { attributionHooksFor } from "@/lib/photo-studio/analytics/tracking";
import { downloadImageBuffer, downloadMediaBuffer } from "@/lib/photo-studio/download-master";
import {
  resizeMasterToVariants,
  saveMasterOnly,
  saveVideoMaster,
} from "@/lib/photo-studio/resize-variants";
import type { CompanyId } from "@/lib/types";
import type { ContentStudioMediaType, PhotoStudioMode } from "@/lib/photo-studio/types";

export type PersistGenerationInput = {
  klant: CompanyId;
  mode: PhotoStudioMode;
  user_prompt: string;
  fal_prompt?: string | null;
  /** @deprecated Legacy column — kept in sync with fal_prompt or user_prompt */
  prompt?: string;
  master_url: string;
  source_image_url?: string | null;
  seed?: number | null;
  workspace_preset?: string | null;
  auto_variants?: boolean;
  media_type?: ContentStudioMediaType;
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
  analytics?: {
    tracking_id: string;
    hooks: { social: boolean; conversion: boolean; coach: boolean };
  };
};

export async function persistPhotoGenerationFromBuffer(
  input: PersistGenerationInput & { buffer: Buffer }
): Promise<PersistedGeneration> {
  ensurePhotoStudioSchema();
  const tracking_id = newPhotoTrackingId();
  const buffer = input.buffer;
  return persistWithBuffer(input, tracking_id, buffer);
}

export async function persistPhotoGeneration(
  input: PersistGenerationInput
): Promise<PersistedGeneration> {
  const buffer = await downloadImageBuffer(input.master_url);
  return persistPhotoGenerationFromBuffer({ ...input, buffer });
}

export async function persistVideoGeneration(
  input: Omit<PersistGenerationInput, "auto_variants" | "master_url"> & {
    video_url: string;
  }
): Promise<PersistedGeneration> {
  ensurePhotoStudioSchema();
  const tracking_id = newPhotoTrackingId();
  const buffer = await downloadMediaBuffer(input.video_url, 300_000);
  return persistWithBuffer(
    { ...input, master_url: input.video_url, auto_variants: false, media_type: "video" },
    tracking_id,
    buffer,
    "video"
  );
}

async function persistWithBuffer(
  input: PersistGenerationInput,
  tracking_id: string,
  buffer: Buffer,
  kind: "image" | "video" = "image"
): Promise<PersistedGeneration> {
  ensurePhotoStudioSchema();
  const autoVariants = kind === "image" && input.auto_variants !== false;
  const { master_path, master_public_url, variants } =
    kind === "video"
      ? await saveVideoMaster(buffer, tracking_id)
      : autoVariants
        ? await resizeMasterToVariants(buffer, tracking_id)
        : await saveMasterOnly(buffer, tracking_id);

  const userPrompt = input.user_prompt.trim();
  const falPrompt = input.fal_prompt?.trim() ?? input.prompt?.trim() ?? userPrompt;
  const legacyPrompt = falPrompt;
  const mediaType = input.media_type ?? (kind === "video" ? "video" : "image");

  const insert = db.prepare(
    `INSERT INTO photo_studio_generations (
      tracking_id, klant, mode, prompt, user_prompt, fal_prompt,
      source_image_url, seed, master_url, master_path, workspace_preset, media_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = insert.run(
    tracking_id,
    input.klant,
    input.mode,
    legacyPrompt,
    userPrompt,
    falPrompt,
    input.source_image_url ?? null,
    input.seed ?? null,
    master_public_url,
    master_path,
    input.workspace_preset ?? null,
    mediaType
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
  const caption = userPrompt.slice(0, 500);
  const postType = mediaType === "video" ? "video" : "product_photo";
  const contentResult = db
    .prepare(
      `INSERT INTO content_posts (klant, platform, type, titel, content, status, source, media_url)
       VALUES (?, 'instagram', ?, ?, ?, 'draft', 'photo_studio', ?)`
    )
    .run(
      input.klant,
      postType,
      userPrompt.slice(0, 80) || `Studio ${tracking_id}`,
      caption,
      mediaType === "video" ? master_public_url : ig?.public_url ?? master_public_url
    );
  const content_id = Number(contentResult.lastInsertRowid);
  db.prepare(`UPDATE photo_studio_generations SET content_id = ? WHERE id = ?`).run(
    content_id,
    generationId
  );

  const hooks = attributionHooksFor(tracking_id);

  return {
    id: generationId,
    tracking_id,
    master_public_url,
    variants: variantRows,
    content_id,
    analytics: {
      tracking_id,
      hooks: {
        social: !!hooks.social.recordClick,
        conversion: !!hooks.conversion.recordConversion,
        coach: hooks.coach.enabled,
      },
    },
  };
}

function parseVariantsJson(raw: unknown): Array<{
  aspect: string;
  public_url: string;
  width: number;
  height: number;
}> {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

  return rows.map((r) => {
    const userPrompt =
      (typeof r.user_prompt === "string" && r.user_prompt.trim()) ||
      (typeof r.prompt === "string" ? r.prompt : "");
    return {
      id: r.id as number,
      tracking_id: r.tracking_id as string,
      mode: r.mode as string,
      prompt: userPrompt,
      user_prompt: userPrompt,
      master_url: r.master_url as string,
      media_type:
        (typeof r.media_type === "string" && r.media_type === "video"
          ? "video"
          : "image") as ContentStudioMediaType,
      content_id: r.content_id as number | null,
      created_at: r.created_at as string,
      variants: parseVariantsJson(r.variants_json),
    };
  });
}
