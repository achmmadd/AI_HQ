/**
 * Minimal same-origin HTML for the P2.0 /motor console.
 * Synthetic P1 view only. No secrets, no context body, no P0 draft/decision UI.
 */

import { PRIMARY_NAV, type FoundationViewModel } from "./p1-foundation.ts";
import { reviewStatusForDraft } from "./p1-review.ts";
import { collectWorkspaceEvidence } from "./p1-evidence.ts";

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderMotorHtml(view: FoundationViewModel): string {
  const nav = PRIMARY_NAV.map((item) => `<a href="#${item.id}">${escapeHtml(item.label)}</a>`).join("");
  const now = view.now.items
    .map((item) => `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.summary)}</li>`)
    .join("");
  const projects = view.projects
    .map((row) => {
      const drafts = row.drafts
        .map((draft) => {
          const status = reviewStatusForDraft(draft, row.reviews);
          return `<li data-draft="${escapeHtml(draft.id)}">${escapeHtml(draft.title)} <em>${escapeHtml(status)}</em>
            <button data-act="submit" data-draft="${escapeHtml(draft.id)}">Indienen</button>
            <button data-act="approve" data-draft="${escapeHtml(draft.id)}">Goedkeuren</button>
            <button data-act="reject" data-draft="${escapeHtml(draft.id)}">Afwijzen</button>
            <button data-act="publish" data-draft="${escapeHtml(draft.id)}">Publiceren</button>
          </li>`;
        })
        .join("");
      const publishes = row.publishes
        .map((pub) => `<span class="deny">publish ${escapeHtml(pub.decision)}</span>`)
        .join(" ");
      return `<article><h3>${escapeHtml(row.project.name)}</h3><ul>${drafts}</ul>${publishes}</article>`;
    })
    .join("");
  const departments = view.departments
    .map((dep) => `<li>${escapeHtml(dep.name)} — ${escapeHtml(dep.purpose)}</li>`)
    .join("");
  const evidence = collectWorkspaceEvidence(view)
    .refs.map((ref) => `<li>${escapeHtml(ref.kind)} ${escapeHtml(ref.id)} ${escapeHtml(ref.status)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Motor AI — /motor</title>
<style>
  :root { --bg:#0b0f14; --panel:#12181f; --text:#e6edf3; --muted:#8b98a5; --deny:#f85149; --border:#1f2a35; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:var(--bg); color:var(--text); }
  header, section { max-width:920px; margin:0 auto; padding:20px; }
  nav { display:flex; gap:16px; }
  nav a { color:var(--text); }
  section { background:var(--panel); border:1px solid var(--border); border-radius:12px; margin:16px auto; }
  .deny { color:var(--deny); font-weight:600; }
  button { margin:4px 4px 0 0; }
  #status { min-height:1.4em; color:var(--muted); }
</style>
</head>
<body>
<header>
  <h1>Motor</h1>
  <p class="deny">Publiceren blijft DENY</p>
  <nav>${nav}</nav>
  <p id="status"></p>
</header>
<section id="now"><h2>Nu</h2><ul>${now}</ul></section>
<section id="projects">
  <h2>Projecten</h2>
  <p>
    <button data-act="create" data-template="tpl-p21-review-reply">Nieuw synthetisch reviewantwoord</button>
    <button data-act="create" data-template="tpl-p21-observation-note">Nieuwe synthetische observatienoot</button>
  </p>
  ${projects}
</section>
<section id="departments"><h2>Afdelingen</h2><ul>${departments}</ul></section>
<section id="evidence"><h2>Evidence</h2><ul>${evidence}</ul></section>
<script>
const statusEl = document.getElementById("status");
async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  statusEl.textContent = JSON.stringify(json);
}
document.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-act]");
  if (!btn) return;
  const draftId = btn.getAttribute("data-draft");
  const act = btn.getAttribute("data-act");
  if (act === "create") {
    post("/api/motor/draft", {
      workspace: "ws-motor",
      synthetic_template_id: btn.getAttribute("data-template"),
    });
    return;
  }
  if (act === "submit") post("/api/motor/review/submit", { draftId, workspace: "ws-motor" });
  if (act === "approve") post("/api/motor/review/decide", { draftId, decision: "approve", workspace: "ws-motor" });
  if (act === "reject") post("/api/motor/review/decide", { draftId, decision: "reject", workspace: "ws-motor" });
  if (act === "publish") post("/api/motor/publish", { draftId, workspace: "ws-motor" });
});
</script>
</body>
</html>`;
}
