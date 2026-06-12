import path from "path";
import type { BrandKitData } from "@/lib/photo-studio/brand-kit/types";

/** Baseline Fumero product fixtures for quality, brand-kit, and campaign tests. */
export type FumeroProductFixture = {
  id: string;
  slug: string;
  product_name: string;
  variant: string;
  strain?: string;
  price: string;
  description: string;
  /** Absolute path to PNG on disk */
  imagePath: string;
  filename: string;
};

const FIXTURES_DIR = path.join(
  process.cwd(),
  "lib",
  "photo-studio",
  "fixtures",
  "fumero-products"
);

export const FUMERO_PRODUCT_FIXTURES: FumeroProductFixture[] = [
  {
    id: "delta-munchies-strawberry-dream",
    slug: "delta-munchies-strawberry-dream-sativa",
    product_name: "Delta Munchies HHC Vape",
    variant: "Strawberry Dream Sativa",
    strain: "Sativa",
    price: "29.95",
    description:
      "Delta Munchies HHC Vape Strawberry Dream — sativa strain, premium smaak en discrete verpakking. 18+.",
    imagePath: path.join(FIXTURES_DIR, "delta-munchies-strawberry-dream-sativa.png"),
    filename: "delta-munchies-strawberry-dream-sativa.png",
  },
  {
    id: "loom-strawberry-ice",
    slug: "loom-strawberry-ice",
    product_name: "LOOM HHC Vape 2ml",
    variant: "Strawberry Ice",
    price: "24.95",
    description:
      "ACAN LOOM HHC Vape 2ml Strawberry Ice — compact, premium kwaliteit. 18+.",
    imagePath: path.join(FIXTURES_DIR, "loom-strawberry-ice.png"),
    filename: "loom-strawberry-ice.png",
  },
  {
    id: "delta-munchies-og-kush",
    slug: "delta-munchies-og-kush-indica",
    product_name: "Delta Munchies HHC Vape",
    variant: "OG Kush Indica",
    strain: "Indica",
    price: "29.95",
    description:
      "Delta Munchies HHC Vape OG Kush — indica strain, rijke smaak. 18+.",
    imagePath: path.join(FIXTURES_DIR, "delta-munchies-og-kush-indica.png"),
    filename: "delta-munchies-og-kush-indica.png",
  },
];

export function getFixture(id: string): FumeroProductFixture | undefined {
  return FUMERO_PRODUCT_FIXTURES.find((f) => f.id === id);
}

/** Build a BrandKitData draft from a product fixture (for tests and dry-run packs). */
export function brandKitFromFixture(
  fixture: FumeroProductFixture,
  overrides: Partial<BrandKitData> = {}
): BrandKitData {
  const fullName = `${fixture.product_name} ${fixture.variant}`;
  return {
    name: `Fumero — ${fixture.variant}`,
    product_name: fullName,
    price: fixture.price,
    currency: "EUR",
    description: fixture.description,
    source_url: `https://fumero.nl/product/${fixture.slug}`,
    source: "manual",
    reviews: [
      {
        author: "Baseline tester",
        rating: 5,
        text: "Sterk product, snelle levering.",
      },
    ],
    images: [
      {
        url: `file://${fixture.imagePath}`,
        alt: fullName,
        role: "product",
      },
    ],
    colors: [
      { hex: "#69C400", label: "Fumero accent", role: "accent" },
      { hex: "#1A1A1A", label: "Neutral", role: "neutral" },
    ],
    logo_url: null,
    status: "confirmed",
    import_warnings: [],
    ...overrides,
  };
}

/** BrandKitRow-shaped mock for campaign unit tests. */
export function brandKitRowFromFixture(
  fixture: FumeroProductFixture,
  id = `bk_fixture_${fixture.id}`
) {
  const data = brandKitFromFixture(fixture);
  return {
    id,
    klant: "fumero" as const,
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
