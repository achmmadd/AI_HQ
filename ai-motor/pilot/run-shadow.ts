/**
 * run-shadow.ts — Motor shadow-pilot CLI runner (one-shot).
 *
 * Dunne CLI-wrapper om draft-core.runDraft(): één run, één JSON op stdout.
 * De review is standaard synthetisch; echt via args/env:
 *
 *   node pilot/run-shadow.ts --review "★★★★☆ ..."
 *   REVIEW_TEXT="..." node pilot/run-shadow.ts
 *
 * De API-variant (server.ts) gebruikt exact dezelfde kern.
 */

import { SYNTHETIC_REVIEW, runDraft } from "./draft-core.ts";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && v.trim() ? v : undefined;
}

async function main(): Promise<number> {
  const cliReview = argValue("--review");
  const envReview = process.env.REVIEW_TEXT?.trim() || undefined;
  const reviewText = cliReview ?? envReview ?? SYNTHETIC_REVIEW;
  // Context komt nooit uit CLI/env: CONTEXT_MODE (demo|private) bepaalt de
  // bron — demodata of het privé contextvolume. Zie draft-core.ts.

  const output = await runDraft({
    reviewText,
    isSynthetic: !cliReview && !envReview,
  });

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return output.ok ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })}\n`,
    );
    process.exitCode = 1;
  });
