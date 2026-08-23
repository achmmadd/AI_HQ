/**
 * Minimal same-origin HTML for the P2.0 /motor console.
 * Synthetic P1 view only. Journal drafts render as title + digest.
 * No secrets, no context/P0 body, no P0 draft/decision UI.
 */

import { PRIMARY_NAV, type FoundationViewModel, type P1Draft } from "./p1-foundation.ts";
import { reviewStatusForDraft, type ReviewStatus } from "./p1-review.ts";
import { collectWorkspaceEvidence } from "./p1-evidence.ts";
import { EMPTY_JOURNAL_OVERVIEW, type JournalOverview } from "./p2-review-journal.ts";

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isJournalDraftId(id: string): boolean {
  return id.startsWith("draft-p21-");
}

function actionButtons(draft: P1Draft, status: ReviewStatus): string {
  if (!isJournalDraftId(draft.id)) {
    return `<span class="muted">vast voorbeeld</span>`;
  }
  const id = escapeHtml(draft.id);
  const btn = (act: string, label: string) =>
    `<button type="button" data-act="${act}" data-draft="${id}">${label}</button>`;
  if (status === "draft") return btn("submit", "Indienen");
  if (status === "in_review") return `${btn("approve", "Goedkeuren")}${btn("reject", "Afwijzen")}`;
  return btn("publish", "Publiceren");
}

function journalRowMeta(overview: JournalOverview, draft: P1Draft): string {
  const item = overview.items.find((row) => row.draft_id === draft.id);
  const digest = item?.digest ?? draft.bodyDigest;
  if (!digest) return "";
  return `<span class="muted" data-digest="${escapeHtml(digest)}">${escapeHtml(digest)}</span>`;
}

export function renderMotorHtml(
  view: FoundationViewModel,
  overview: JournalOverview = EMPTY_JOURNAL_OVERVIEW,
): string {
  const nav = PRIMARY_NAV.map((item) => `<a href="#${item.id}">${escapeHtml(item.label)}</a>`).join("");
  const journalNow = view.now.items.filter((item) => item.id.startsWith("att-draft-p21-"));
  const seedNow = view.now.items.filter((item) => !item.id.startsWith("att-draft-p21-"));
  const nowItems = seedNow
    .map((item) => `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.summary)}</li>`)
    .join("");
  const nowJournal =
    journalNow.length === 0
      ? ""
      : `<li><strong>${journalNow.length} synthetische P2.1-concepten</strong> — staan onder Projecten. Publiceren blijft DENY.</li>`;
  const now = nowItems + nowJournal;
  const counts = overview.counts;
  const journalCounts = `<p id="journal-overview" class="muted">Synthetisch journal: open ${counts.open} · in review ${counts.in_review} · afgehandeld ${counts.done}</p>`;
  const projects = view.projects
    .map((row) => {
      const journalDrafts = row.drafts.filter((draft) => isJournalDraftId(draft.id));
      const seedDrafts = row.drafts.filter((draft) => !isJournalDraftId(draft.id));
      const journalList = journalDrafts
        .map((draft) => {
          const status = reviewStatusForDraft(draft, row.reviews);
          return `<li data-draft="${escapeHtml(draft.id)}" data-journal="1"><strong data-title="1">${escapeHtml(draft.title)}</strong> <em>${escapeHtml(status)}</em>
            ${journalRowMeta(overview, draft)}
            ${actionButtons(draft, status)}
          </li>`;
        })
        .join("");
      const seedList = seedDrafts
        .map((draft) => {
          const status = reviewStatusForDraft(draft, row.reviews);
          return `<li data-draft="${escapeHtml(draft.id)}" data-seed="1">${escapeHtml(draft.title)} <em>${escapeHtml(status)}</em>
            ${actionButtons(draft, status)}
          </li>`;
        })
        .join("");
      const publishes = row.publishes
        .map((pub) => `<span class="deny">publish ${escapeHtml(pub.decision)}</span>`)
        .join(" ");
      const journalBlock =
        journalList.length > 0 ? `<ul data-list="journal">${journalList}</ul>` : "";
      const seedBlock =
        seedList.length > 0
          ? `<p class="muted">Vast voorbeeld</p><ul data-list="seed">${seedList}</ul>`
          : "";
      return `<article><h3>${escapeHtml(row.project.name)}</h3>${journalBlock}${seedBlock}${publishes}</article>`;
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
  .muted { color:var(--muted); }
  button { margin:4px 4px 0 0; }
  #status { min-height:1.4em; color:var(--muted); white-space:pre-wrap; }
</style>
</head>
<body>
<header>
  <h1>Motor</h1>
  <p class="deny">Publiceren blijft DENY</p>
  <nav>${nav}</nav>
  <p id="status">Kies onder Projecten: nieuw concept, daarna Indienen, daarna Goedkeuren of Afwijzen.</p>
</header>
<section id="now"><h2>Nu</h2><ul>${now}</ul></section>
<section id="projects">
  <h2>Projecten</h2>
  <p>
    <button type="button" data-act="create" data-template="tpl-p21-review-reply">Nieuw synthetisch reviewantwoord</button>
    <button type="button" data-act="create" data-template="tpl-p21-observation-note">Nieuwe synthetische observatienoot</button>
  </p>
  ${journalCounts}
  ${projects}
</section>
<section id="departments"><h2>Afdelingen</h2><ul>${departments}</ul></section>
<section id="evidence"><h2>Evidence</h2><ul>${evidence}</ul></section>
<script>
const statusEl = document.getElementById("status");
let busy = false;
async function post(path, body) {
  statusEl.textContent = "Bezig…";
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = { ok: false, error: "bad_response" };
  try { json = await res.json(); } catch {}
  statusEl.textContent = JSON.stringify(json);
  if (json && json.ok === true) location.reload();
}
document.addEventListener("click", (event) => {
  const t = event.target;
  if (!(t instanceof Element)) return;
  const btn = t.closest("button[data-act]");
  if (!btn || busy) return;
  event.preventDefault();
  const draftId = btn.getAttribute("data-draft");
  const act = btn.getAttribute("data-act");
  busy = true;
  const done = post;
  const finish = (p) => p.finally(() => { busy = false; });
  if (act === "create") {
    finish(done("/api/motor/draft", {
      workspace: "ws-motor",
      synthetic_template_id: btn.getAttribute("data-template"),
    }));
    return;
  }
  if (act === "submit") finish(done("/api/motor/review/submit", { draftId, workspace: "ws-motor" }));
  if (act === "approve") finish(done("/api/motor/review/decide", { draftId, decision: "approve", workspace: "ws-motor" }));
  if (act === "reject") finish(done("/api/motor/review/decide", { draftId, decision: "reject", workspace: "ws-motor" }));
  if (act === "publish") finish(done("/api/motor/publish", { draftId, workspace: "ws-motor" }));
});
</script>
</body>
</html>`;
}
