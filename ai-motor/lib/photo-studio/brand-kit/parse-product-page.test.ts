import assert from "node:assert/strict";
import test from "node:test";
import { parseProductPageHtml } from "@/lib/photo-studio/brand-kit/parse-product-page";
import { validateBrandKitData, emptyBrandKitDraft } from "@/lib/photo-studio/brand-kit/types";

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>HHC Vape Pen Mango — Fumero Vapes &amp; More</title>
  <meta property="og:title" content="HHC Vape Pen Mango" />
  <meta property="og:description" content="Premium HHC vape met mango smaak." />
  <meta property="og:image" content="https://fumero.nl/wp-content/uploads/mango-vape.jpg" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "HHC Vape Pen Mango",
    "description": "Premium HHC vape met mango smaak.",
    "image": ["https://fumero.nl/wp-content/uploads/mango-vape.jpg"],
    "offers": {
      "@type": "Offer",
      "price": "24.95",
      "priceCurrency": "EUR"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "12"
    },
    "review": {
      "@type": "Review",
      "author": { "@type": "Person", "name": "Jan" },
      "reviewRating": { "@type": "Rating", "ratingValue": "5" },
      "reviewBody": "Heerlijke smaak!",
      "datePublished": "2025-03-01"
    }
  }
  </script>
</head>
<body>
  <span class="woocommerce-Price-amount amount">€24,95</span>
</body>
</html>`;

test("parseProductPageHtml: JSON-LD product fields", () => {
  const parsed = parseProductPageHtml(
    SAMPLE_HTML,
    "https://fumero.nl/product/hhc-vape-pen-mango/"
  );
  assert.equal(parsed.product_name, "HHC Vape Pen Mango");
  assert.equal(parsed.price, "24.95");
  assert.equal(parsed.currency, "EUR");
  assert.match(parsed.description, /mango/i);
  assert.ok(parsed.images.some((i) => i.url.includes("mango-vape.jpg")));
  assert.ok(parsed.reviews.length >= 2);
});

test("parseProductPageHtml: fallback warnings without JSON-LD", () => {
  const html = `<html><head><title>Test Product — Fumero</title></head><body></body></html>`;
  const parsed = parseProductPageHtml(html, "https://fumero.nl/product/test/");
  assert.equal(parsed.product_name, "Test Product");
  assert.ok(parsed.warnings.some((w) => /JSON-LD/i.test(w)));
});

test("validateBrandKitData: required fields", () => {
  const draft = emptyBrandKitDraft("manual");
  assert.match(validateBrandKitData(draft) ?? "", /Naam/i);
  draft.name = "Test";
  assert.match(validateBrandKitData(draft) ?? "", /Productnaam/i);
  draft.product_name = "Product";
  assert.equal(validateBrandKitData(draft), null);
});

test("parseProductPageHtml: JSON-LD price wins over sidebar HTML", () => {
  const html = `<!DOCTYPE html><html><head>
  <script type="application/ld+json">
  {"@type":"Product","name":"Kings HHC Disposable Vape","offers":{"price":"24.95","priceCurrency":"EUR"}}
  </script></head><body>
  <aside><span class="woocommerce-Price-amount amount">€12,95</span></aside>
  <div class="entry-summary">
    <p class="price"><span class="woocommerce-Price-amount amount">€24,95</span></p>
  </div>
  </body></html>`;
  const parsed = parseProductPageHtml(
    html,
    "https://fumero.nl/product/kings-hhc-disposable-vape-super-lemon-haze-500mg/"
  );
  assert.equal(parsed.price, "24.95");
});

test("parseProductPageHtml: JSON-LD priceSpecification on Offer", () => {
  const html = `<!DOCTYPE html><html><head>
  <script type="application/ld+json">
  {"@graph":[{"@type":"Product","name":"Kings HHC","offers":[{"@type":"Offer",
  "priceSpecification":[{"@type":"UnitPriceSpecification","price":"24.95","priceCurrency":"EUR"}]}]}]}
  </script></head><body></body></html>`;
  const parsed = parseProductPageHtml(
    html,
    "https://fumero.nl/product/kings-hhc-disposable-vape-super-lemon-haze-500mg/"
  );
  assert.equal(parsed.price, "24.95");
});

test("parseProductPageHtml: scoped HTML fallback ignores sidebar price", () => {
  const html = `<!DOCTYPE html><html><head><title>Kings — Fumero</title></head><body>
  <aside class="widget"><span class="woocommerce-Price-amount amount">€12,95</span></aside>
  <div class="entry-summary">
    <p class="price"><span class="woocommerce-Price-amount amount">€24,95</span></p>
  </div>
  </body></html>`;
  const parsed = parseProductPageHtml(
    html,
    "https://fumero.nl/product/kings-hhc-disposable-vape-super-lemon-haze-500mg/"
  );
  assert.equal(parsed.price, "24.95");
});

test("validateBrandKitData: confirmed requires photo, description, price", () => {
  const draft = emptyBrandKitDraft("manual");
  draft.name = "Kit";
  draft.product_name = "Product";
  draft.status = "confirmed";
  assert.match(validateBrandKitData(draft) ?? "", /Beschrijving/i);
  draft.description = "Tekst";
  assert.match(validateBrandKitData(draft) ?? "", /Prijs/i);
  draft.price = "24.95";
  assert.match(validateBrandKitData(draft) ?? "", /Productfoto/i);
  draft.images = [{ url: "https://example.com/p.png", role: "product" }];
  assert.equal(validateBrandKitData(draft), null);
});
