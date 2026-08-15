/**
 * Security-track P0.6 — evidence-vervalsing en hergebruik (aanvalspunt 7).
 *
 * Settlement-v2-tamper per veld en replay zijn al afgedekt in
 * boundary.test.ts (4b, 6a, 6c); de basale orphan- en tamperdetectie staat in
 * lib/adr110/evidence.test.ts. Deze tests vullen aan waar een aanvaller
 * slimmer is dan de bestaande casussen:
 *
 *  - S7a: digest-vervalsing PER VELD — elk betekenisvol veld van een record
 *    wordt gemuteerd met behoud van de oude digest; de keten moet altijd
 *    "digest mismatch (tampered)" melden en nooit ok:true geven.
 *  - S7b: digest-substitutie — de digest van record A op record B plakken
 *    (replay van een geldige digest) wordt evengoed opgemerkt.
 *  - S7c: parent-herlinking — een record onder een andere bestaande parent
 *    hangen, ook mét eerlijk herberekende digest, wordt via de causale
 *    id's/stage-vorm als orphan opgemerkt.
 *  - S7d: hergebruik — een volledig geldig record uit een andere run
 *    invoegen, of een bestaand evidence_id opnieuw gebruiken, breekt de keten.
 *  - S7e: verwijdering van een tussenliggende schakel maakt alle
 *    afhankelijke records orphan.
 *
 * Alles synthetisch; geen echte data.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEvidenceChain,
  computeEvidenceDigest,
  findOrphans,
  makeEvidenceRecord,
} from "../../lib/adr110/evidence.ts";
import {
  buildProofFixture,
  createRunIds,
  runTaskThroughAdapter,
  T3,
} from "../../lib/adr110/scenario.ts";
import { createFakeAlphaAdapter } from "../../lib/adr110/adapters/fake-alpha.ts";
import { branded } from "../../lib/adr110/types.ts";
import type {
  EvidenceId,
  EvidenceRecord,
  RunId,
} from "../../lib/adr110/types.ts";

const fixture = buildProofFixture();
const run = await runTaskThroughAdapter(
  createFakeAlphaAdapter(),
  fixture,
  createRunIds("sec-evidence"),
);

function tamperErrors(records: readonly EvidenceRecord[]): string[] {
  const built = buildEvidenceChain(records);
  assert.equal(built.ok, false, "vervalste keten werd toch als ok beoordeeld");
  if (built.ok) return [];
  return [...built.errors];
}

test("S7a. digest-vervalsing per veld: elke mutatie met oude digest → tampered", () => {
  // Pak het outcome-record (laatste schakel, bevat alle causale id's).
  const original = run.evidence[run.evidence.length - 1];
  assert.ok(original, "testopstelling: outcome-record aanwezig");

  const mutations: readonly { veld: string; muteer: (r: EvidenceRecord) => EvidenceRecord }[] = [
    { veld: "evidence_id", muteer: (r) => ({ ...r, evidence_id: branded("ev-geponst") }) },
    { veld: "stage", muteer: (r) => ({ ...r, stage: "action" }) },
    { veld: "task_id", muteer: (r) => ({ ...r, task_id: branded("task-geponst") }) },
    { veld: "run_id", muteer: (r) => ({ ...r, run_id: branded<RunId>("run-geponst") }) },
    { veld: "attempt_id", muteer: (r) => ({ ...r, attempt_id: branded("attempt-geponst") }) },
    { veld: "subject_id", muteer: (r) => ({ ...r, subject_id: "act-geponst" }) },
    {
      veld: "parent_evidence_id",
      muteer: (r) => ({ ...r, parent_evidence_id: run.evidence[0]?.evidence_id }),
    },
    { veld: "kind_detail", muteer: (r) => ({ ...r, kind_detail: "human.review" }) },
    { veld: "data", muteer: (r) => ({ ...r, data: { status: "success" } }) },
    { veld: "occurred_at", muteer: (r) => ({ ...r, occurred_at: T3 }) },
  ];

  for (const { veld, muteer } of mutations) {
    const vervalst = muteer(original);
    const records = [...run.evidence.slice(0, -1), vervalst];
    const errors = tamperErrors(records);
    assert.ok(
      errors.some((e) => e.includes("tampered") || e.includes("orphan") || e.includes("digest")),
      `veld ${veld}: mutatie met oude digest moet opvallen, kreeg: ${JSON.stringify(errors)}`,
    );
  }
});

test("S7b. digest-substitutie: geldige digest van record A op record B → tampered", () => {
  const [eerste, tweede, ...rest] = run.evidence;
  assert.ok(eerste && tweede, "testopstelling: minstens twee records");

  // Aanvaller plakt een elders geldige digest op een ander record.
  const gesubstitueerd: EvidenceRecord = { ...tweede, digest: eerste.digest };
  const errors = tamperErrors([eerste, gesubstitueerd, ...rest]);
  assert.ok(
    errors.some((e) => e.includes("tampered")),
    `digest-substitutie moet als tampered opvallen: ${JSON.stringify(errors)}`,
  );
});

test("S7c. parent-herlinking: onder vreemde parent hangen is orphan — ook met herberekende digest", () => {
  const outcome = run.evidence[run.evidence.length - 1];
  assert.ok(outcome, "testopstelling: outcome-record aanwezig");

  // Aanval 1: herlink naar een parent die nergens bestaat — met een eerlijk
  // herberekende digest, zodat alleen de causale controle de aanval vangt.
  const herlinktBasis = {
    ...outcome,
    evidence_id: branded<EvidenceId>("ev-herlinkt"),
    parent_evidence_id: branded<EvidenceId>("ev-uit-andere-run"),
  };
  const { digest: _weg, ...zonderDigest } = herlinktBasis;
  const herlinkt: EvidenceRecord = {
    ...herlinktBasis,
    digest: computeEvidenceDigest(zonderDigest),
  };
  const orphans = findOrphans([...run.evidence, herlinkt]).map(
    (r) => r.evidence_id as string,
  );
  assert.ok(
    orphans.includes("ev-herlinkt"),
    "herlinkt record met onbekende parent moet orphan zijn",
  );
  const errors = tamperErrors([...run.evidence, herlinkt]);
  assert.ok(
    errors.some((e) => e.includes("orphan")),
    "ketenbouw moet de herlinking als orphan-fout melden",
  );

  // Aanval 2: parent-relatie wegsnijden (non-task doet alsof het root is).
  const zonderParentBasis = { ...outcome, evidence_id: branded<EvidenceId>("ev-root-claim") };
  delete (zonderParentBasis as { parent_evidence_id?: EvidenceId }).parent_evidence_id;
  const { digest: _weg2, ...zonderDigest2 } = zonderParentBasis;
  const zonderParent: EvidenceRecord = {
    ...zonderParentBasis,
    digest: computeEvidenceDigest(zonderDigest2),
  };
  const orphans2 = findOrphans([...run.evidence, zonderParent]).map(
    (r) => r.evidence_id as string,
  );
  assert.ok(
    orphans2.includes("ev-root-claim"),
    "record zonder parent (geen task-stage) moet orphan zijn",
  );
});

test("S7d. hergebruik: vreemd record invoegen of evidence_id recyclen breekt de keten", async () => {
  // Aanval 1: een volledig geldig, integers record uit een ANDERE run wordt
  // in deze keten gedropt (replay op record-niveau).
  const andereRun = await runTaskThroughAdapter(
    createFakeAlphaAdapter(),
    buildProofFixture(),
    createRunIds("sec-evidence-replay"),
  );
  const vreemdRecord = andereRun.evidence[andereRun.evidence.length - 1];
  assert.ok(vreemdRecord, "testopstelling: vreemd outcome-record aanwezig");
  const orphans = findOrphans([...run.evidence, vreemdRecord]).map(
    (r) => r.evidence_id as string,
  );
  assert.ok(
    orphans.includes(vreemdRecord.evidence_id as string),
    "gereplayed record uit een andere run moet orphan zijn (onbekende parent-keten)",
  );

  // Aanval 2: evidence_id-recycling — een tweede record hergebruikt een
  // bestaand id met andere inhoud.
  const slachtoffer = run.evidence[1];
  assert.ok(slachtoffer, "testopstelling: run-record aanwezig");
  const dubbel = makeEvidenceRecord({
    evidence_id: slachtoffer.evidence_id,
    stage: "action",
    task_id: fixture.task.task_id,
    run_id: run.run_id,
    attempt_id: run.attempt_id,
    subject_id: "act-recycled",
    parent_evidence_id: run.evidence[2]?.evidence_id,
    kind_detail: "gateway.decision",
    data: { decision: "ALLOW" },
    occurred_at: T3,
  });
  const errors = tamperErrors([...run.evidence, dubbel]);
  assert.ok(
    errors.some((e) => e.includes("duplicate evidence id")),
    `id-recycling moet als duplicate opvallen: ${JSON.stringify(errors)}`,
  );
});

test("S7e. verwijderde tussen-schakel: directe kinderen worden orphan, de keten faalt", () => {
  // Verwijder het attempt-record uit de task→run→attempt→artifact→outcome-
  // keten. findOrphans is bewust een directe-parent-check: het artifact
  // (kind van de attempt) wordt orphan; de outcome (kind van het artifact)
  // is niet direct flagbaar, maar de keten als geheel faalt altijd.
  const attemptIndex = run.evidence.findIndex((r) => r.stage === "attempt");
  assert.ok(attemptIndex >= 0, "testopstelling: attempt-record aanwezig");
  const gesnoeid = run.evidence.filter((_, i) => i !== attemptIndex);

  const orphans = findOrphans(gesnoeid).map((r) => r.evidence_id as string);
  const artifactId = run.evidence.find((r) => r.stage === "artifact")
    ?.evidence_id as string;
  assert.ok(artifactId, "testopstelling: artifact-record aanwezig");
  assert.ok(
    orphans.includes(artifactId),
    "het directe kind van de verwijderde schakel moet orphan zijn",
  );
  // De ketenbouwer meldt de gesnoeide keten in elk geval als geheel af.
  const built = buildEvidenceChain(gesnoeid);
  assert.equal(built.ok, false, "een keten met een gat mag nooit ok zijn");
});
