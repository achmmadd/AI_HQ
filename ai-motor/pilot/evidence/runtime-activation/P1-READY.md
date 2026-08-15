# P1-READY — wat P0 sloot, wat P1 mag, wat nog openstaat

> Eigenaar: Pietje · Datum: 2026-08-15 · Branch: `pilot/runtime-activation`
> P1 start **niet** vanzelf. Eerst een expliciete eigenaarsopdracht.

## Wat P0 bewees

1. Vijf adapters (inclusief echte hermes- en agentscope-sidecars) voldoen aan het contract; isolation, MCP-deny, decision-loop en failure-evidence zijn regressie-groen.
2. Beide sidecars praten live met de lokale ModelPort (synthetische taak, tailnet-only) en de drie adapters leveren een e2e-draft (publish DENY).
3. Store-tenancy is verplicht; compose-sidecars draaien healthy zonder store-recreate of publieke ingress.
4. `CONTEXT_MODE=private` faalt gesloten zonder bestand en werkt met een synthetisch volume; `body.context` is in beide modes 400.
5. Geen echte bedrijfsdata, geen master-merge, geen publieke ingress, geen live-autonomie. Suite: 225 pass / 0 fail / 1 skip; types 0; lint 0.

## Wat P1 mag worden — en wat het níét opent

**Mag (ná expliciete opdracht):** een product-shell en koppelingen op deze
pilot-lijn — UI/API-afwerking, eigenaarsbediening, de drie owner-acties
hieronder. Geen nieuwe architectuur; de bestaande spine blijft de grens.

**Opent P1 niet automatisch:**

- master-merge
- publieke ingress
- echte bedrijfscontext (alleen als jij het volume vult, zie B)
- live-autonomie / LIVE_AUTHORITY

## Owner-acties die nog open staan

Kopieerbaar. Wij wijzigen hiervoor geen code en geen CI-yaml.

**A. CI python-conformance-job**

Het yaml-blok staat in
`ai-motor/pilot/evidence/runtime-activation/P07-LIVE-SMOKE.md` (sectie
“Stap 7 — CI-gate yaml”). Plak het via de GitHub web-UI in
`.github/workflows/pilot-spine.yml` op branch `pilot/runtime-activation`.
Eerste groene runner-run is het bewijs; tot die tijd blijft de alpine-gate
1 skip tonen.

**B. Echte bedrijfscontext**

Self-serve commando's staan in
`ai-motor/pilot/evidence/runtime-activation/P09-PRIVATE.md` (sectie
“Self-serve commando's”). Jij vult het volume; wij wijzigen geen code.
Zonder bestand blijft `CONTEXT_MODE=private` fail-closed. Terug naar demo:
zelfde recreate met `CONTEXT_MODE=demo`.

**C. Optioneel: Hetzner-host in `PILOT_ACL`**

Live smokes liepen via de Mac (de builder-host zit niet in de ACL → 403
`node_not_allowed`). Hermes-container-IP is niet stabiel over recreates;
`HERMES_SIDECAR_URL` moet dan opnieuw. Alleen doen als jij host-side smokes
wilt; geen codewijziging.
