"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LandingBackground } from "@/components/landing/shared";
import { Logo } from "@/components/logo";
import { MOTORSAI_BRAND } from "@/lib/landing-content";

function LoginForm() {
  const searchParams = useSearchParams();
  const fromFumero = (searchParams.get("from") ?? "").startsWith("/fumero");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const canSubmit = Boolean(email.trim() && password && !loading);
  const missingFields = !email.trim() || !password;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = (await res.json()) as {
        token?: string;
        error?: string;
        user?: { scope?: string };
      };

      if (data.token) {
        const from = searchParams.get("from");
        const scope = data.user?.scope;
        const defaultHome =
          scope === "fumero"
            ? "/fumero"
            : scope === "bokas"
              ? "/bokas"
              : "/";
        router.push(from && from.startsWith("/") ? from : defaultHome);
        router.refresh();
        return;
      }

      if (res.status === 401) {
        setError("Onjuist e-mailadres of wachtwoord. Probeer het opnieuw.");
      } else if (res.status >= 500) {
        setError("De server reageert niet. Probeer het over een ogenblik opnieuw.");
      } else {
        setError(data.error || "Inloggen mislukt. Controleer je gegevens.");
      }
    } catch {
      setError("Geen verbinding met de server. Controleer je netwerk en probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-sm">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Terug naar home
      </Link>

      <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <CardHeader className="text-center">
          <Logo
            size="lg"
            elevate
            motion="wave"
            wrapperClassName="mx-auto mb-1"
            className="!h-14 !max-w-none"
          />
          <CardTitle className="text-white">
            {fromFumero ? "Fumero Studio" : MOTORSAI_BRAND.name}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {fromFumero
              ? "Log in om verder te gaan in Fumero Studio"
              : "Log in op je MotorsAI-omgeving"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-300" htmlFor="email">
                E-mail
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jij@bedrijf.nl"
                className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-[#69C400]/50 focus-visible:ring-2 focus-visible:ring-[#69C400]/40"
                autoFocus
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-300" htmlFor="pw">
                Wachtwoord
              </label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Jouw wachtwoord"
                className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-[#69C400]/50 focus-visible:ring-2 focus-visible:ring-[#69C400]/40"
                autoComplete="current-password"
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
              className="w-full bg-[#69C400] text-white hover:bg-[#5db000] disabled:opacity-50"
            >
              {loading ? "Bezig met inloggen…" : "Inloggen"}
            </Button>

            {missingFields && !loading ? (
              <p className="text-center text-xs text-slate-500">
                Vul e-mail en wachtwoord in om door te gaan
              </p>
            ) : null}
          </form>

          {!fromFumero ? (
            <div className="mt-6 border-t border-white/[0.06] pt-6 text-center">
              <p className="text-sm text-slate-500">Nog geen toegang?</p>
              <Link href="/demo">
                <Button
                  variant="outline"
                  className="mt-3 w-full gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  Plan een demo
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-[#080c14] p-6">
      <LandingBackground />
      <Suspense fallback={<div className="relative z-10 h-96 w-full max-w-sm animate-pulse rounded-2xl bg-white/5" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
