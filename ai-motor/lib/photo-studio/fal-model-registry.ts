import type { ContentStudioModelId } from "@/lib/photo-studio/types";

/** Client-safe model registry — no server/fs imports. */
export const FAL_MODEL_REGISTRY = {
  "nano-banana-2": {
    label: "Nano Banana 2",
    txt2img: "fal-ai/nano-banana-2",
    edit: "fal-ai/nano-banana-2/edit",
    phase: "A" as const,
  },
  "seedream-5-lite": {
    label: "Seedream 5.0",
    txt2img: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    edit: "fal-ai/bytedance/seedream/v5/lite/edit",
    phase: "B" as const,
  },
  "gpt-image-2": {
    label: "GPT Image 2",
    txt2img: "openai/gpt-image-2",
    edit: "openai/gpt-image-2/edit",
    phase: "B" as const,
  },
} as const satisfies Record<
  ContentStudioModelId,
  {
    label: string;
    txt2img: string;
    edit: string;
    phase: "A" | "B";
  }
>;
