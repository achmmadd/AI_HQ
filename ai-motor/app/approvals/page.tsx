"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ApprovalsInner() {
  const sp = useSearchParams();
  const approve = sp.get("approve");
  const reject = sp.get("reject");
  const [msg, setMsg] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const idStr = approve || reject;
    const status = approve ? "approved" : reject ? "rejected" : null;
    if (!idStr || !status) return;
    if (done.current) return;
    done.current = true;

    const id = parseInt(idStr, 10);
    if (Number.isNaN(id)) {
      queueMicrotask(() => setMsg("Ongeldig id"));
      return;
    }

    void fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
      .then(async (r) => {
        const j = await r.json();
        queueMicrotask(() =>
          setMsg(r.ok ? `Status: ${j.message}` : j.error || r.statusText)
        );
      })
      .catch(() => queueMicrotask(() => setMsg("Netwerkfout")));
  }, [approve, reject]);

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-base">Goedkeuring</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {approve && <p>Bezig met goedkeuren #{approve}…</p>}
        {reject && <p>Bezig met afwijzen #{reject}…</p>}
        {!approve && !reject && (
          <p className="text-text-secondary">
            Gebruik de link uit Telegram (?approve= of ?reject=).
          </p>
        )}
        {msg && <p className="text-text-primary">{msg}</p>}
        <Button variant="secondary" className="rounded-xl" asChild>
          <Link href="/">Terug naar Home</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ApprovalsPage() {
  return (
    <AppShell title="Goedkeuringen">
      <Suspense fallback={<p className="text-text-secondary">Laden…</p>}>
        <ApprovalsInner />
      </Suspense>
    </AppShell>
  );
}
