/**
 * run-shadow.ts — Motor shadow-pilot CLI runner (one-shot).
 *
 * Dunne CLI-wrapper om draft-core.runDraft(): één run, één JSON op stdout.
 * Input is standaard synthetisch (geen echte klantdata); echt via args/env:
 *
 *   node pilot/run-shadow.ts --review "★★★★☆ ..." [--context "..."]
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
  // Alleen expliciet meegegeven context wordt "request"-context; anders
  // beslist draft-core: privé contextvolume (indien aanwezig) → demo-fallback.
  const contextText =
    argValue("--context") ??
    (process.env.ONDERNEMER_CONTEXT?.trim() || undefined);

  const output = await runDraft({
    reviewText,
    contextText,
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
