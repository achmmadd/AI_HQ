import type { BrandKitColor } from "@/lib/photo-studio/brand-kit/types";

/** Remove duplicate hex values (case-insensitive), keep first occurrence. */
export function dedupeBrandKitColors(colors: BrandKitColor[]): BrandKitColor[] {
  const seen = new Set<string>();
  const out: BrandKitColor[] = [];
  for (const c of colors) {
    const key = c.hex.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
