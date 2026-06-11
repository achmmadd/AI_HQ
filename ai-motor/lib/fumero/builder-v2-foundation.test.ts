import assert from "node:assert/strict";
import test from "node:test";
import {
  createFallbackGenerationPlan,
  validateGenerationPlan,
} from "@/lib/apps/generation-plan";
import { repairFullAppArtifactV2 } from "@/lib/apps/full-app-v2";
import { validateFullAppArtifact } from "@/lib/fumero/build-full-app-validation";

const PROJECT_PLAN_PROMPT =
  "Bouw een projectmanagementportaal met dashboard, projecten, taken, klanten, teamleden, statusfilters, detailpagina's en een admin-overzicht.";

test("fallback GenerationPlan is generic and follows project-management prompt", () => {
  const plan = createFallbackGenerationPlan(PROJECT_PLAN_PROMPT);
  assert.equal(plan.version, 2);
  assert.equal(plan.fallback, true);
  assert.ok(plan.pages.some((page) => page.id === "dashboard"));
  assert.ok(plan.pages.some((page) => page.id === "projecten"));
  assert.ok(plan.dataTables.some((table) => table.name === "projects"));
  assert.ok(plan.dataTables.some((table) => table.name === "tasks"));
  assert.equal(plan.dataTables.some((table) => table.name === "products"), false);
});

test("validateGenerationPlan normalizes minimal valid JSON plan", () => {
  const result = validateGenerationPlan({
    version: 2,
    appType: "todo",
    summary: "Takenlijst",
    pages: [{ id: "taken", title: "Taken", route: "#/taken", purpose: "CRUD" }],
    dataTables: [{ name: "Tasks", purpose: "Taken", columns: [{ name: "Titel", type: "text" }] }],
    components: [{ id: "List", purpose: "Lijst", pages: ["taken"] }],
    acceptanceCriteria: ["Taken kunnen worden afgevinkt"],
    risks: [],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.plan.dataTables[0].name, "tasks");
    assert.equal(result.plan.dataTables[0].columns[0].name, "titel");
  }
});

test("validateGenerationPlan enforces data API storage language", () => {
  const result = validateGenerationPlan({
    version: 2,
    appType: "todo",
    summary: "Takenlijst client-side zonder backend met localStorage",
    pages: [{ id: "home", title: "Taken", route: "#/", purpose: "Opslag in localStorage" }],
    dataTables: [{ name: "tasks", purpose: "Taken in localStorage", columns: [{ name: "title", type: "text" }] }],
    components: [],
    acceptanceCriteria: ["Taken blijven bewaard via localStorage"],
    risks: ["localStorage is niet beveiligd"],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    const serialized = JSON.stringify(result.plan);
    assert.doesNotMatch(serialized, /localStorage|zonder backend/i);
    assert.match(serialized, /\/api\/apps\/\{slug\}\/data|data-API/i);
  }
});


test("repairFullAppArtifact applies deterministic slug and active-nav fixes", async () => {
  const slug = "project-portaal";
  const schema = {
    tables: [{
      name: "projects",
      columns: [{ name: "id", type: "integer", pk: true }, { name: "naam", type: "text" }],
      seed_rows: [{ id: 1, naam: "Demo project" }],
    }],
    pages: [
      { id: "home", title: "Home", route: "#/" },
      { id: "dashboard", title: "Dashboard", route: "#/dashboard" },
    ],
    meta: { builder_version: 2 },
  };
  const frontend = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Projecten</title></head>
<body>
  <nav><a href="#/" data-route="home">Home</a><a href="#/dashboard" data-route="dashboard">Dashboard</a></nav>
  <input id="zoek" aria-label="Zoeken">
  <button id="add">Toevoegen</button>
  <main id="app">Projectmanagement dashboard</main>
  <script>
    fetch("/api/apps/wrong-slug/data?table_name=projects").then(function(r){return r.json();});
    document.getElementById("add").addEventListener("click", function(){ document.getElementById("app").innerHTML = document.getElementById("zoek").value; });
    window.addEventListener("hashchange", function(){ document.getElementById("app").textContent = location.hash || "#/"; });
  </script>
</body>
</html>`;
  const before = validateFullAppArtifact(frontend, schema, slug, "dashboard met projecten", {
    builderVersion: 2,
  });
  assert.equal(before.valid, false);

  const repaired = await repairFullAppArtifactV2(
    { schema, frontend },
    before.errors,
    createFallbackGenerationPlan(PROJECT_PLAN_PROMPT),
    slug,
    "dashboard met projecten"
  );
  assert.equal(repaired.validationErrors.length, 0);
  const after = validateFullAppArtifact(
    repaired.artifact.frontend,
    repaired.artifact.schema,
    slug,
    "dashboard met projecten",
    { builderVersion: 2 }
  );
  assert.equal(after.valid, true, after.errors.join("; "));
  assert.match(repaired.artifact.frontend, new RegExp(`/api/apps/${slug}/data`));
  assert.match(repaired.artifact.frontend, /aria-current/);
  assert.doesNotMatch(repaired.artifact.frontend, /\.innerHTML\s*=/);
});
