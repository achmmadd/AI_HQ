import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  isMultiPagePrompt,
  isShopPrompt,
  validateFullAppArtifact,
  validateFullAppSchema,
  validateShopApp,
  validateAuthRequiredApp,
  runFullAppSmokeTest,
} from "@/lib/fumero/build-full-app-validation";
import { MIN_UX_PUBLISH_SCORE } from "@/lib/fumero/build-smoke-test";

const SEEDS = join(import.meta.dirname ?? __dirname, "seeds");

const MULTI_SCHEMA = {
  tables: [
    {
      name: "products",
      columns: [
        { name: "id", type: "integer", pk: true },
        { name: "naam", type: "text", required: true },
        { name: "prijs", type: "number" },
        { name: "sku", type: "text" },
      ],
    },
    {
      name: "orders",
      columns: [
        { name: "id", type: "integer", pk: true },
        { name: "status", type: "text" },
        { name: "totaal", type: "number" },
      ],
    },
  ],
  pages: [
    { id: "home", title: "Home", route: "#/" },
    { id: "shop", title: "Shop", route: "#/shop" },
    { id: "checkout", title: "Checkout", route: "#/checkout" },
    { id: "dashboard", title: "Dashboard", route: "#/dashboard" },
  ],
};

test("isMultiPagePrompt detects B2B shop prompt", () => {
  assert.equal(
    isMultiPagePrompt("B2B shop met home shop checkout dashboard"),
    true
  );
  assert.equal(isMultiPagePrompt("maak een rekenmachine"), false);
});

test("validateFullAppSchema requires tables and pages for multi-page", () => {
  const singleTable = validateFullAppSchema({ tables: [{ name: "products" }] });
  assert.equal(singleTable.length, 0);

  const noPages = validateFullAppSchema(
    { tables: [{ name: "products" }] },
    { requireMultiPage: true }
  );
  assert.ok(noPages.some((e) => /pages/i.test(e)));

  const ok = validateFullAppSchema(MULTI_SCHEMA, { requireMultiPage: true });
  assert.equal(ok.length, 0);
});

test("rejects frontend without data API slug", () => {
  const html = readFileSync(join(SEEDS, "chatbot-reference.html"), "utf8");
  const result = validateFullAppArtifact(html, MULTI_SCHEMA, "test-app", "B2B shop");
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /fetch|data API|\/api\/apps/i.test(e)));
});

test("full-app-multipage reference passes validation and smoke", () => {
  const html = readFileSync(join(SEEDS, "full-app-multipage.html"), "utf8");
  const slug = "demo-b2b-shop";
  const prompt = "B2B shop met home shop checkout dashboard";

  const validation = validateFullAppArtifact(html, MULTI_SCHEMA, slug, prompt);
  assert.equal(validation.valid, true, validation.errors.join("; "));

  const smoke = runFullAppSmokeTest(html, MULTI_SCHEMA, slug, prompt);
  assert.equal(smoke.passed, true, smoke.errors.join("; "));
  assert.ok(smoke.uxScore >= MIN_UX_PUBLISH_SCORE);
});

test("simulate validation on multi-page schema rejects missing nav", () => {
  const badFrontend = `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>x</title></head><body><p>een pagina</p><script>
fetch("/api/apps/my-app/data?table_name=products");
document.getElementById("x");
</script></body></html>`;
  const result = validateFullAppArtifact(
    badFrontend,
    MULTI_SCHEMA,
    "my-app",
    "website met home en shop"
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /nav|routing|active/i.test(e)));
});

test("isShopPrompt detects B2B e-commerce prompt", () => {
  assert.equal(isShopPrompt("B2B webshop met checkout en cart"), true);
  assert.equal(isShopPrompt("maak een rekenmachine"), false);
});

test("full-app-b2b-shop reference passes shop validation", () => {
  const html = readFileSync(join(SEEDS, "full-app-b2b-shop.html"), "utf8");
  const shopErrors = validateShopApp(html, MULTI_SCHEMA);
  assert.equal(shopErrors.length, 0, shopErrors.join("; "));
});

test("validateShopApp rejects iDEAL copy", () => {
  const errors = validateShopApp(
    "Betaal met iDEAL bij checkout. Min €49. 18 jaar en ouder.",
    MULTI_SCHEMA
  );
  assert.ok(errors.some((e) => /ideal/i.test(e)));
});

test("validateAuthRequiredApp requires auth API and 18+ gate", () => {
  const html = readFileSync(join(SEEDS, "full-app-multipage.html"), "utf8");
  const errors = validateAuthRequiredApp(html, MULTI_SCHEMA, "demo-b2b-shop");
  assert.ok(errors.some((e) => /auth/i.test(e)));
});
