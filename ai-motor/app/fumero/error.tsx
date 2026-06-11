"use client";

import { useEffect } from "react";
import Link from "next/link";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { Button } from "@/components/ui/button";

export default function FumeroError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[fumero/error]", error);
  }, [error]);

  return (
    <FumeroShell page="Fout">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--fumero-text)]">
          Er ging iets mis
        </h1>
        <p className="text-sm text-[var(--fumero-text-muted)]">
          Fumero Studio kon deze pagina niet laden. Probeer opnieuw of ga terug
          naar het Command Center.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            className="rounded-lg bg-[var(--fumero-accent)] hover:bg-[var(--fumero-accent-hover)]"
            onClick={() => reset()}
          >
            Opnieuw proberen
          </Button>
          <Button asChild type="button" variant="secondary" className="rounded-lg">
            <Link href="/fumero">Naar Command Center</Link>
          </Button>
        </div>
      </div>
    </FumeroShell>
  );
}
