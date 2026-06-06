"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/design-system/components";
import { cn } from "@/lib/utils";

const KLANTEN = [
  { id: "fumero", label: "Fumero" },
  { id: "bokas", label: "Bokas" },
  { id: "system", label: "Algemeen (Motor)" },
] as const;

const CATEGORIES = [
  { id: "product", label: "Product" },
  { id: "process", label: "Werkwijze" },
  { id: "policy", label: "Regels & beleid" },
  { id: "contact", label: "Contact & support" },
  { id: "other", label: "Overig" },
] as const;

export function KennisbankAdd() {
  const [klant, setKlant] = useState<string>("fumero");
  const [category, setCategory] = useState<string>("product");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleAdd = async () => {
    if (!content.trim()) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/knowledge/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klant, content, category }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      setMessage("Opgeslagen. Het team kan dit nu terugvinden via zoeken.");
      setContent("");
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Opslaan mislukt");
    } finally {
      setLoading(false);
    }
  };

  const selectClass =
    "mt-1 flex min-h-[var(--ds-touch-min)] w-full rounded-2xl border border-border bg-surface px-4 py-2 text-base text-text-primary";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Kennis toevoegen voor het team</CardTitle>
        <p className="text-sm text-text-secondary">
          Schrijf wat collega&apos;s en de AI moeten weten. Gebruik gewone taal.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-text-primary" htmlFor="kb-klant">
              Voor welk bedrijf?
            </label>
            <select
              id="kb-klant"
              className={selectClass}
              value={klant}
              onChange={(e) => setKlant(e.target.value)}
              disabled={loading}
            >
              {KLANTEN.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary" htmlFor="kb-cat">
              Onderwerp
            </label>
            <select
              id="kb-cat"
              className={selectClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-text-primary" htmlFor="kb-body">
            Tekst
          </label>
          <textarea
            id="kb-body"
            placeholder="Bijv.: Klanten kunnen binnen 14 dagen retourneren. Vraag altijd om het bonnummer."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="mt-1 min-h-[8rem] w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            disabled={loading}
          />
        </div>

        {message && (
          <p
            className={cn(
              "text-sm",
              message.includes("mislukt") || message.includes("Fout")
                ? "text-error"
                : "text-text-secondary"
            )}
            role="status"
          >
            {message}
          </p>
        )}

        <Button
          type="button"
          size="touch"
          onClick={handleAdd}
          disabled={loading || !content.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Bezig met opslaan…
            </>
          ) : (
            "Opslaan voor het team"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
