"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_FORM } from "@/lib/landing-content";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  company: string;
  email: string;
  phone: string;
  teamSize: string;
  message: string;
};

const INITIAL: FormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  teamSize: "",
  message: "",
};

export function DemoRequestForm({ className }: { className?: string }) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const canSubmit =
    Boolean(form.name.trim() && form.company.trim() && form.email.trim() && form.teamSize) &&
    !loading;

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          company: form.company.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          teamSize: form.teamSize,
          message: form.message.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (res.ok && data.ok) {
        setSuccess(true);
        return;
      }

      setError(data.error || "Versturen mislukt. Probeer het opnieuw.");
    } catch {
      setError("Geen verbinding met de server. Controleer je netwerk en probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center",
          className
        )}
        role="status"
      >
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" aria-hidden />
        <h2 className="mt-4 text-xl font-semibold text-white">Aanvraag ontvangen</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Bedankt, {form.name.split(" ")[0]}. We nemen binnen één werkdag contact op op{" "}
          <span className="text-white">{form.email}</span> om je demo in te plannen.
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
            Terug naar home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-8",
        className
      )}
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-1">
          <label htmlFor="demo-name" className="text-sm font-medium text-slate-300">
            Naam *
          </label>
          <Input
            id="demo-name"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Jan de Vries"
            className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            autoComplete="name"
          />
        </div>

        <div className="space-y-2 sm:col-span-1">
          <label htmlFor="demo-company" className="text-sm font-medium text-slate-300">
            Bedrijfsnaam *
          </label>
          <Input
            id="demo-company"
            required
            value={form.company}
            onChange={(e) => update("company", e.target.value)}
            placeholder="Bedrijf B.V."
            className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            autoComplete="organization"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="demo-email" className="text-sm font-medium text-slate-300">
          Zakelijk e-mailadres *
        </label>
        <Input
          id="demo-email"
          type="email"
          required
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="jan@bedrijf.nl"
          className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
          autoComplete="email"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="demo-phone" className="text-sm font-medium text-slate-300">
            Telefoon <span className="text-slate-500">(optioneel)</span>
          </label>
          <Input
            id="demo-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+31 6 12345678"
            className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            autoComplete="tel"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="demo-team" className="text-sm font-medium text-slate-300">
            Teamgrootte *
          </label>
          <select
            id="demo-team"
            required
            value={form.teamSize}
            onChange={(e) => update("teamSize", e.target.value)}
            className="flex h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69C400]/50"
          >
            <option value="" disabled className="bg-slate-900">
              Selecteer…
            </option>
            {DEMO_FORM.teamSizes.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-slate-900">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="demo-message" className="text-sm font-medium text-slate-300">
          Wat wil je bereiken? <span className="text-slate-500">(optioneel)</span>
        </label>
        <Textarea
          id="demo-message"
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          placeholder="Bijv. klantenservice automatiseren, interne kennisbank, sales follow-up…"
          rows={4}
          className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
        />
      </div>

      {error ? (
        <div className="flex gap-2 rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-12 w-full gap-2 bg-[#69C400] text-base font-semibold text-white hover:bg-[#5db000] disabled:opacity-50"
      >
        {loading ? "Versturen…" : "Demo aanvragen"}
        {!loading ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
      </Button>

      <p className="text-center text-xs text-slate-500">
        Door te versturen ga je akkoord met onze{" "}
        <Link href="/privacy" className="text-slate-400 underline hover:text-white">
          privacyverklaring
        </Link>
        . Geen spam — alleen contact over je demo.
      </p>
    </form>
  );
}
