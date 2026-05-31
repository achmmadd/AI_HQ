import fs from "fs";
import path from "path";
import { FUMERO_DESIGN_SYSTEM_BLOCK } from "@/lib/connectors/specialists";

let cached: string | null = null;

/** Lees en cache design-builder.md voor LLM build prompts. */
export function loadFumeroBuilderDesignContext(): string {
  if (cached) return cached;
  const filePath = path.join(process.cwd(), "docs/fumero/design-builder.md");
  try {
    cached = fs.readFileSync(filePath, "utf8").trim();
  } catch {
    cached = FUMERO_DESIGN_SYSTEM_BLOCK;
  }
  return cached;
}

export function clearFumeroBuilderDesignCache(): void {
  cached = null;
}
