"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const KLANTEN = ["fumero", "bokas", "system"] as const;
const CATEGORIES = [
  "product",
  "process",
  "policy",
  "contact",
  "other",
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
      setMessage("Opgeslagen via Factory OS (n8n → Qdrant).");
      setContent("");
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Fout bij opslaan"
      );
    } finally {
      setLoading(false);
    }
  };

  const selectClass =
    "mt-1 flex h-10 w-full rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-text-primary";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kennis toevoegen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm text-text-secondary" htmlFor="kb-klant">
              Bedrijf
            </label>
            <select
              id="kb-klant"
              className={selectClass}
              value={klant}
              onChange={(e) => setKlant(e.target.value)}
              disabled={loading}
            >
              {KLANTEN.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-text-secondary" htmlFor="kb-cat">
              Categorie
            </label>
            <select
              id="kb-cat"
              className={selectClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm text-text-secondary" htmlFor="kb-body">
            Inhoud
          </label>
          <Textarea
            id="kb-body"
            placeholder="Bijv. Fumero verkoopt premium vapes en gummies voor volwassenen 18+"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="mt-1 rounded-2xl"
            disabled={loading}
          />
        </div>

        {message && (
          <p
            className={cn(
              "text-sm",
              message.includes("Fout") || message.includes("error")
                ? "text-error"
                : "text-text-secondary"
            )}
          >
            {message}
          </p>
        )}

        <Button
          type="button"
          onClick={handleAdd}
          disabled={loading || !content.trim()}
          className="w-full rounded-2xl"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opslaan...
            </>
          ) : (
            "Opslaan in kennisbank"
          )}
        </Button>

        <p className="text-xs text-text-secondary">
          Wordt naar Factory OS gestuurd met type <code>knowledge_add</code>.
        </p>
      </CardContent>
    </Card>
  );
}
