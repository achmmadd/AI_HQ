# ADR-110 — Pure Contract Proof

**Authority:** ADR-110 "Dunne semantische kern en vervangbare uitvoering",
ratified by the owner 2026-08-14 (`ai-motor/docs/DECISIONS.md`), gate amendment
of 2026-08-14, and the explicit owner build order of 2026-08-14.

**Scope:** pure types, invariants, pure functions and tests only. No I/O, no
database, no network, no secrets, no live data, no side effects, no file
reads/writes from the proof code. The only runtime import outside
`node:test`/`node:assert` is `node:crypto` (SHA-256 digests, pure CPU).
All timestamps are injected; the module never reads a clock.

This proof adds no service, no store and no deployment component. It is not a
product build and authorizes nothing beyond itself.

## File map

| File | Contents |
|---|---|
| `types.ts` | The eight versioned primitives (`Identity`, `Employee`, `Task`, `ContextItem`/`ContextManifest`, `Policy`, `ActionRequest`, `EvidenceRecord`, `EvaluationCriteria`) plus the strictly separated execution bindings (`Run`, `Attempt`, `Agent`, `RuntimeBinding`, `ModelBinding`). Branded id types. |
| `digest.ts` | Canonical JSON, SHA-256 digests, deep freeze. |
| `context.ts` | `validateContextItem`, `buildContextManifest`, `validateManifest`, `bindManifest` (exactly one manifest per Attempt), `manifestSemanticsEqual`. |
| `engine.ts` | `EngineEvent`; engine reducer owns Run/Attempt state; `applyEngineEvent` Kernel projection (Task only, idempotent on event-id). |
| `gateway.ts` | `evaluatePolicy` → `ALLOW \| DENY \| REQUIRE_APPROVAL`; `createGateway` with branded opaque `GatewayReceipt`, minted only after ALLOW, single-use, bound to (tool, argument_hash, task_id, run_id, attempt_id, expires_at), re-checked immediately before execution. |
| `evidence.ts` | `makeEvidenceRecord`, `buildEvidenceChain`, `findOrphans` for the causal chain task → run → attempt → action/artifact → outcome. |
| `evaluation.ts` | `computeEvaluation`: the five active criteria from the evidence chain only. |
| `adapters/contract.ts` | The capability-adapter contract. |
| `adapters/fake-alpha.ts`, `adapters/fake-beta.ts` | The two fake adapters (different simulated latency/cost metadata; no state, no credentials, no policy truth). |
| `scenario.ts` | Pure fixture: one Employee ("ReviewResponder"), one Task, and the pure run-through-adapter orchestration used by the tests. |
| `index.ts` | Public API barrel. |
| `*.test.ts` | The proof tests (colocated, `node:test`). |

## How to run

Requires Node ≥ 22.6 (type stripping; verified on Node v24). No install, no
new dependencies.

```bash
# tests
node --test 'lib/adr110/*.test.ts'

# typecheck (scoped config extends the root tsconfig, see Deviations)
node_modules/.bin/tsc -p lib/adr110/tsconfig.json --noEmit
```

## Acceptance criteria → proof

1. **Same Employee/Task through two fake adapters** — `proof.test.ts`
   ("proof scenario"): identical `employee_id`, `task_id`, policy digest and
   manifest semantics (`manifestSemanticsEqual`, equal total digests) across
   `fake-alpha` and `fake-beta`.
2. **Context Contract** — `context.test.ts`: cross-workspace rejected, expired
   rejected, scope binding enforced, provenance/scope/digest validated, total
   digest recomputed over ordered item digests (item tamper and reorder both
   fail), exactly one manifest per Attempt (`bindManifest`).
3. **Evidence + no double Run truth** — `evidence.test.ts` (orphan-free valid
   chain; injected orphans flagged; tamper detected; unauthorized attempts are
   recorded as valid chain evidence) and `engine.test.ts` (idempotent
   re-application returns the identical state reference; `KernelProjection`
   has no `runs`/`attempts` keys and no run-mutation API — enforced by a
   compile-time assertion and runtime key checks; the engine reducer alone
   owns Run/Attempt state).
4. **No action without Gateway decision + receipt** — `gateway.test.ts`:
   absent, forged (well-formed shape, never minted), cloned (copied fields,
   new object identity), expired, tool-mismatched, argument-hash-mismatched,
   causally-mismatched and reused receipts all return `DENY`; the receipt is a
   branded type that cannot be constructed outside `gateway.ts`
   (`@ts-expect-error` compile-time assertion). This proof performs no real
   side effect: a successful `executeAction` returns a settlement record.
5. **Five active criteria from the same evidence** — `evaluation.test.ts`:
   exact expected values on a known fixture chain (success rate 0.5,
   corrections 7.5/10, unauthorized 0 — and 2 with injected unauthorized
   attempts — cost per successful task 10 cents, operator trust 0.5).
6. **No second task/context/policy/memory truth, no new production SQLite** —
   design proof: the module contains no store, database, persistence,
   credential or cache construct; the only import outside the test runner is
   `node:crypto`; all contract objects are deep-frozen; all functions are
   pure with injected clocks. Runtime proof in `proof.test.ts` ("criterion 6"):
   the public API surface (`import * as api`) exposes no symbol matching
   store/database/sqlite/persist/credential/secret/cache/repository, every
   exported object is frozen, and both adapters expose exactly the contract
   members (no state). No `.db`/SQLite file is created anywhere by this proof.

## Deviations from the build-order spec

- **Test runner:** the spec's first choice (project runner such as tsx via
  `npx tsx --test`, per `TESTING.md`) was unavailable: `node_modules/.bin/tsx`
  is a dangling symlink (tsx is not installed) and no `node` is on PATH. The
  proof therefore uses `node:test` — already the project's test framework
  (`lib/auth-guards.test.ts`, `scripts/audit-motor-runtime.test.mjs`) — via
  Node's native TypeScript type stripping. No dependency was added.
- **Import specifiers:** Node-native type stripping requires explicit `.ts`
  extensions in relative imports. TypeScript rejects these unless
  `allowImportingTsExtensions` is set, so a scoped `lib/adr110/tsconfig.json`
  extends the root `tsconfig.json` and adds only that flag (the root config
  already sets `noEmit`, its prerequisite). The root `tsconfig.json` is
  untouched.
- **`lib/adr110/package.json`:** new scoped file with `"type": "module"` so
  Node loads these files as ES modules without a reparsing warning. The root
  `package.json` is untouched.
- **Full-project typecheck:** `tsc -p tsconfig.json --noEmit` was already red
  before this proof (pre-existing parse error `lib/master-context.ts(84,57)
  error TS1109`, unrelated to this change and left untouched). The meaningful
  evidence is the scoped typecheck above, which passes.

## Independent verification 2026-08-14

Re-run by a second agent, independent of the builder, from `ai-motor/`:

- Tests: `node --test 'lib/adr110/*.test.ts'` → 16 suites, 70 tests, 70 pass,
  0 fail (Node v22.22.1).
- Scoped typecheck: `./node_modules/.bin/tsc -p lib/adr110/tsconfig.json
  --noEmit` → exit code 0, no output. (`npx` is not on PATH in this shell;
  the local binary was invoked directly, same invocation otherwise.)
- Lint: `./node_modules/.bin/eslint lib/adr110` → exit code 0, zero findings.

No files under `lib/adr110/` were changed by this verification; only this
section was appended to `PROOF.md`.
