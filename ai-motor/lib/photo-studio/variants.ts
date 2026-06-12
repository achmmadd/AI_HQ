import type { PhotoStudioAspect } from "@/lib/photo-studio/types";

export const PHOTO_STUDIO_ASPECTS: Array<{
  aspect: PhotoStudioAspect;
  label: string;
  width: number;
  height: number;
}> = [
  { aspect: "ig_1_1", label: "Instagram 1:1", width: 1080, height: 1080 },
  { aspect: "ig_4_5", label: "Instagram 4:5", width: 1080, height: 1350 },
  { aspect: "stories_9_16", label: "Stories / TikTok 9:16", width: 1080, height: 1920 },
  { aspect: "pinterest_2_3", label: "Pinterest 2:3", width: 1000, height: 1500 },
  { aspect: "hero_16_9", label: "Hero 16:9", width: 1920, height: 1080 },
];
