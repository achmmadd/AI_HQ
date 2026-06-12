export type AssetNamingInput = {
  brand: string;
  sku: string;
  hook: string;
  format: "1:1" | "4:5" | "9:16";
  version: number;
  ext?: string;
};

function slugify(value: string, maxLen = 24): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLen) || "asset";
}

/** Naming: {brand}_{sku}_{hook}_{format}_{v01} */
export function campaignAssetFilename(input: AssetNamingInput): string {
  const brand = slugify(input.brand, 16);
  const sku = slugify(input.sku, 20);
  const hook = slugify(input.hook, 20);
  const format = input.format.replace(":", "x");
  const version = `v${String(input.version).padStart(2, "0")}`;
  const ext = input.ext ?? (input.format === "9:16" ? "mp4" : "jpg");
  return `${brand}_${sku}_${hook}_${format}_${version}.${ext}`;
}

export function deriveSku(productName: string, brandKitId: string): string {
  const fromName = slugify(String(productName ?? ""), 20);
  if (fromName && fromName !== "asset") return fromName;
  return slugify(brandKitId.replace(/^bk_/, ""), 20);
}
