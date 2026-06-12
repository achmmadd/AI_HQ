/** Canonical brand logo asset (generated via scripts/build-fumero-brand-assets.mjs). */
export const BRAND_LOGO = {
  src: "/brands/logo.png",
  srcSvg: "/brands/logo.svg",
  width: 759,
  height: 911,
  alt: "Fumero",
} as const;

/** @deprecated Use BRAND_LOGO */
export const FUMERO_BRAND = {
  accent: "#69C400",
  logoGreen: "#78BE00",
  logo: BRAND_LOGO,
  og: {
    src: "/brands/og.png",
    width: 1200,
    height: 630,
  },
  favicon: "/brands/favicon.png",
  appleTouchIcon: "/brands/icon-180.png",
} as const;
