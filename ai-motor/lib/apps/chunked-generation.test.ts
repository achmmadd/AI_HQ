import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleFullAppArtifact,
  buildDeterministicPageChunk,
  buildSchemaFromPlan,
  generateSchemaChunk,
  shouldUseChunkedGeneration,
  tablesForPage,
} from "@/lib/apps/chunked-generation";
import { createFallbackGenerationPlan } from "@/lib/apps/generation-plan";
import { validateFullAppArtifact } from "@/lib/fumero/build-full-app-validation";

const PROJECT_PROMPT =
  "Maak een projectmanagement portaal met dashboard, detailpagina's, admin-overzicht, klanten, projecten, taken, rollen en login.";

test("shouldUseChunkedGeneration detects multi-page portal scope", () => {
  const plan = createFallbackGenerationPlan(PROJECT_PROMPT);
  assert.equal(shouldUseChunkedGeneration(plan, PROJECT_PROMPT), true);
  const simplePlan = createFallbackGenerationPlan("maak een rekenmachine");
  assert.equal(shouldUseChunkedGeneration(simplePlan, "maak een rekenmachine"), false);
});

test("buildSchemaFromPlan includes pages, tables and seed_rows", () => {
  const plan = createFallbackGenerationPlan(PROJECT_PROMPT);
  const schema = buildSchemaFromPlan(plan, "demo-portaal");
  assert.ok(Array.isArray(schema.tables) && schema.tables.length >= 2);
  assert.ok(Array.isArray(schema.pages) && schema.pages.length >= 2);
  assert.ok(schema.tables?.every((t) => Array.isArray(t.seed_rows) && t.seed_rows.length >= 1));
  assert.equal(schema.meta?.generation, "chunked");
});

test("generateSchemaChunk is alias for buildSchemaFromPlan", () => {
  const plan = createFallbackGenerationPlan(PROJECT_PROMPT);
  const slug = "alias-test";
  assert.deepEqual(generateSchemaChunk(plan, slug), buildSchemaFromPlan(plan, slug));
});

test("tablesForPage maps admin/dashboard to all tables", () => {
  const plan = createFallbackGenerationPlan(PROJECT_PROMPT);
  const admin = plan.pages.find((p) => p.id === "admin") ?? plan.pages[0];
  const tables = tablesForPage(plan, admin);
  assert.equal(tables.length, plan.dataTables.length);
});

test("assembleFullAppArtifact produces portal HTML with nav, routing and CRUD", () => {
  const plan = createFallbackGenerationPlan(PROJECT_PROMPT);
  const slug = "project-portaal-test";
  const schema = buildSchemaFromPlan(plan, slug);
  const chunks = plan.pages.map((page) => buildDeterministicPageChunk(plan, page, slug));
  const frontend = assembleFullAppArtifact(plan, schema, slug, chunks, "Projectportaal");

  assert.match(frontend, /<!DOCTYPE html>/i);
  assert.match(frontend, new RegExp(`/api/apps/${slug}/data`));
  assert.match(frontend, /role="navigation"/);
  assert.match(frontend, /hashchange/);
  assert.match(frontend, /aria-current/);
  assert.match(frontend, /method:\s*"POST"/);
  assert.match(frontend, /method:\s*"DELETE"/);
  assert.doesNotMatch(frontend, /max-width:\s*480px/i);
  assert.doesNotMatch(frontend, /\blocalStorage\b/);

  const validation = validateFullAppArtifact(frontend, schema, slug, PROJECT_PROMPT, {
    builderVersion: 2,
  });
  assert.equal(validation.valid, true, validation.errors.join("; "));
});

test("assemble includes all planned page sections", () => {
  const plan = createFallbackGenerationPlan(PROJECT_PROMPT);
  const slug = "sections-test";
  const chunks = plan.pages.map((page) => buildDeterministicPageChunk(plan, page, slug));
  const frontend = assembleFullAppArtifact(
    plan,
    buildSchemaFromPlan(plan, slug),
    slug,
    chunks
  );
  for (const page of plan.pages) {
    assert.match(frontend, new RegExp(`data-page="${page.id}"`));
  }
});
