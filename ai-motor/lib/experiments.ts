import db from "@/lib/db/database";
import { appendLearnedInstructionChunk } from "@/lib/chat-learned";
import { sendTelegramMessage } from "@/lib/telegram";

export type ExperimentVariant = "a" | "b";

export type ExperimentRow = {
  id: number;
  name: string;
  hypothesis: string;
  variant_a: string;
  variant_b: string;
  status: string;
  klant: string | null;
  winner_variant: string | null;
  created_at: string;
  ends_at: string | null;
  closed_at: string | null;
  summary_json: string | null;
};

export type AutoExperimentTemplate = {
  name: string;
  hypothesis: string;
  variant_a: string;
  variant_b: string;
  klant: string | null;
};

export const AUTO_EXPERIMENT_TEMPLATES: AutoExperimentTemplate[] = [
  {
    name: "Korter antwoorden",
    hypothesis: "Kortere antwoorden scoren hoger bij gebruikers.",
    variant_a:
      "Geef volledige, uitgebreide antwoorden met context waar nodig.",
    variant_b:
      "Houd antwoorden minimaal 50% korter dan normaal: geen herhaling, max kern en één voorbeeld.",
    klant: null,
  },
  {
    name: "Bullet points",
    hypothesis: "Gestructureerde opsomming verbetert tevredenheid.",
    variant_a: "Gebruik vloeiende alinea's zoals nu standaard.",
    variant_b:
      "Structureer het antwoord met duidelijke bullet points (•) per onderdeel, tenzij één zin genoeg is.",
    klant: null,
  },
  {
    name: "Tabel formaat",
    hypothesis: "Tabellen helpen bij vergelijkingen en overzicht.",
    variant_a: "Geen tabellen tenzij de gebruiker erom vraagt.",
    variant_b:
      "Als je ≥3 vergelijkbare items of kengetallen noemt, gebruik een markdown-tabel; anders normaal tekstantwoord.",
    klant: null,
  },
];

export function pickVariant(): ExperimentVariant {
  return Math.random() < 0.5 ? "a" : "b";
}

/** Actief = status active, nog niet verlopen, en klant-match (NULL = alle klanten). */
export function getActiveExperimentForKlant(klant: string): ExperimentRow | null {
  const row = db
    .prepare(
      `SELECT id, name, hypothesis, variant_a, variant_b, status, klant,
              winner_variant, created_at, ends_at, closed_at, summary_json
       FROM experiments
       WHERE status = 'active'
         AND (ends_at IS NULL OR datetime(ends_at) > datetime('now'))
         AND (klant IS NULL OR klant = ?)
       ORDER BY id DESC
       LIMIT 1`
    )
    .get(klant) as ExperimentRow | undefined;
  return row ?? null;
}

export function experimentInstructionOverlay(
  exp: ExperimentRow,
  variant: ExperimentVariant
): string {
  const body = variant === "a" ? exp.variant_a : exp.variant_b;
  return `\n\n[A/B experiment "${exp.name}" — variant ${variant.toUpperCase()} — volg strikt:]\n${body.trim()}\n`;
}

type Agg = {
  variant: ExperimentVariant;
  msg_n: number;
  feedback_n: number;
  avg_rating: number | null;
  avg_latency: number | null;
  avg_len: number | null;
};

function rowToAgg(
  v: string | null,
  msg_n: number,
  feedback_n: number,
  avg_rating: number | null,
  avg_latency: number | null,
  avg_len: number | null
): Agg | null {
  if (v !== "a" && v !== "b") return null;
  return {
    variant: v,
    msg_n: msg_n ?? 0,
    feedback_n: feedback_n ?? 0,
    avg_rating: avg_rating ?? null,
    avg_latency: avg_latency ?? null,
    avg_len: avg_len ?? null,
  };
}

export function aggregateExperimentMessages(experimentId: number): {
  a: Agg;
  b: Agg;
} {
  const rows = db
    .prepare(
      `SELECT ch.experiment_variant as v,
        COUNT(*) as msg_n,
        SUM(CASE WHEN mf.id IS NOT NULL THEN 1 ELSE 0 END) as feedback_n,
        AVG(mf.rating) as avg_rating,
        AVG(ch.latency_ms) as avg_latency,
        AVG(LENGTH(ch.content)) as avg_len
       FROM chat_history ch
       LEFT JOIN message_feedback mf ON mf.message_id = ch.id
       WHERE ch.experiment_id = ?
         AND ch.role = 'assistant'
         AND ch.experiment_variant IN ('a', 'b')
       GROUP BY ch.experiment_variant`
    )
    .all(experimentId) as Array<{
      v: string;
      msg_n: number;
      feedback_n: number;
      avg_rating: number | null;
      avg_latency: number | null;
      avg_len: number | null;
    }>;

  const empty = (variant: ExperimentVariant): Agg => ({
    variant,
    msg_n: 0,
    feedback_n: 0,
    avg_rating: null,
    avg_latency: null,
    avg_len: null,
  });

  let a: Agg = empty("a");
  let b: Agg = empty("b");
  for (const r of rows) {
    const agg = rowToAgg(
      r.v,
      r.msg_n,
      r.feedback_n,
      r.avg_rating,
      r.avg_latency,
      r.avg_len
    );
    if (!agg) continue;
    if (agg.variant === "a") a = agg;
    else b = agg;
  }
  return { a, b };
}

export function pickWinner(a: Agg, b: Agg): ExperimentVariant | null {
  if (a.msg_n === 0 && b.msg_n === 0) return null;

  const ra = a.feedback_n > 0 && a.avg_rating != null ? a.avg_rating : null;
  const rb = b.feedback_n > 0 && b.avg_rating != null ? b.avg_rating : null;

  if (ra != null && rb != null) {
    if (Math.abs(ra - rb) >= 0.05) return ra > rb ? "a" : "b";
    const la = a.avg_latency;
    const lb = b.avg_latency;
    if (la != null && lb != null && Math.abs(la - lb) > 50) {
      return la < lb ? "a" : "b";
    }
    const ca = a.avg_len;
    const cb = b.avg_len;
    if (ca != null && cb != null && Math.abs(ca - cb) > 20) {
      return ca < cb ? "a" : "b";
    }
    return ra >= rb ? "a" : "b";
  }
  if (ra != null && rb == null) return "a";
  if (rb != null && ra == null) return "b";

  const la = a.avg_latency;
  const lb = b.avg_latency;
  if (la != null && lb != null && a.msg_n > 0 && b.msg_n > 0) {
    return la <= lb ? "a" : "b";
  }
  if (a.msg_n > b.msg_n) return "a";
  if (b.msg_n > a.msg_n) return "b";
  return "a";
}

/** Start automatisch 1 experiment (1 week) als er geen actief niet-verlopen experiment is. */
export function seedAutoExperimentIfIdle(): number | null {
  if (countActiveExperiments() > 0) return null;
  const t =
    AUTO_EXPERIMENT_TEMPLATES[
      Math.floor(Math.random() * AUTO_EXPERIMENT_TEMPLATES.length)
    ];
  const r = db
    .prepare(
      `INSERT INTO experiments (name, hypothesis, variant_a, variant_b, status, klant, ends_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, datetime('now', '+7 days'), datetime('now'))`
    )
    .run(
      t.name,
      t.hypothesis,
      t.variant_a,
      t.variant_b,
      t.klant
    );
  const id = Number(r.lastInsertRowid);
  void sendTelegramMessage(
    `Nieuw auto-experiment gestart: ${t.name} (7 dagen, 50/50 A/B).`
  );
  return id || null;
}

function ratingImprovementPct(a: Agg, b: Agg, winner: ExperimentVariant): number | null {
  const wa = winner === "a" ? a : b;
  const lo = winner === "a" ? b : a;
  const hi = wa.avg_rating;
  const loR = lo.avg_rating;
  if (hi == null || loR == null || loR === 0) return null;
  return Math.round(((hi - loR) / loR) * 100);
}

/** Sluit experiment af, past winnaar toe op learned suffix, Telegram. */
export function finalizeExperiment(experimentId: number): {
  ok: boolean;
  winner: ExperimentVariant | null;
  summary: Record<string, unknown>;
} {
  const exp = db
    .prepare(
      `SELECT id, name, hypothesis, variant_a, variant_b, status, klant,
              winner_variant, created_at, ends_at, closed_at, summary_json
       FROM experiments WHERE id = ?`
    )
    .get(experimentId) as ExperimentRow | undefined;

  if (!exp || exp.status !== "active") {
    return { ok: false, winner: null, summary: { error: "not_active" } };
  }

  const { a, b } = aggregateExperimentMessages(experimentId);
  const winner = pickWinner(a, b);

  const summary: Record<string, unknown> = {
    experiment_id: experimentId,
    name: exp.name,
    aggregates: { a, b },
    winner,
  };

  if (winner) {
    const winningText = winner === "a" ? exp.variant_a : exp.variant_b;
    const pct = ratingImprovementPct(a, b, winner);
    summary.rating_improvement_pct_vs_loser = pct;

    appendLearnedInstructionChunk(
      `[A/B winnaar experiment "${exp.name}" (${winner.toUpperCase()})]: ${winningText.trim()}`
    );

    db.prepare(
      `UPDATE experiments
       SET status = 'done',
           winner_variant = ?,
           closed_at = datetime('now'),
           summary_json = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      winner,
      JSON.stringify(summary),
      experimentId
    );

    const pctStr =
      pct != null ? `${pct > 0 ? "+" : ""}${pct}% op gem. score vs verliezer` : "geen ratings — tie-break op snelheid/lengte/volume";
    void sendTelegramMessage(
      `Experiment afgelopen: ${exp.name}\nWinnaar: variant ${winner.toUpperCase()}\n${pctStr}\nToegepast op systeem-instructies.`
    );

    return { ok: true, winner, summary };
  }

  db.prepare(
    `UPDATE experiments
     SET status = 'done',
         winner_variant = NULL,
         closed_at = datetime('now'),
         summary_json = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(JSON.stringify({ ...summary, note: "insufficient_data" }), experimentId);

  void sendTelegramMessage(
    `Experiment afgelopen zonder winnaar: ${exp.name} (onvoldoende data).`
  );

  return { ok: true, winner: null, summary };
}

/** Experiments waarvan ends_at verstreken is en nog active. */
export function listExperimentsDueForClosing(): number[] {
  const rows = db
    .prepare(
      `SELECT id FROM experiments
       WHERE status = 'active'
         AND ends_at IS NOT NULL
         AND datetime(ends_at) <= datetime('now')`
    )
    .all() as { id: number }[];
  return rows.map((r) => r.id);
}

export function archiveAllActiveExperiments(): void {
  db.prepare(
    `UPDATE experiments
     SET status = 'archived',
         closed_at = datetime('now'),
         updated_at = datetime('now')
     WHERE status = 'active'`
  ).run();
}

export function countActiveExperiments(): number {
  const r = db
    .prepare(
      `SELECT COUNT(*) as c FROM experiments
       WHERE status = 'active'
         AND (ends_at IS NULL OR datetime(ends_at) > datetime('now'))`
    )
    .get() as { c: number };
  return r.c;
}
