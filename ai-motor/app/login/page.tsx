"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fromFumero, setFromFumero] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get("from") ?? "";
    setFromFumero(from.startsWith("/fumero"));
  }, []);

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

      const data = (await res.json()) as { token?: string; error?: string };

      if (data.token) {
        localStorage.setItem("motorsai_token", data.token);
        const from =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("from")
            : null;
        router.push(from && from.startsWith("/") ? from : "/");
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
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <Card className="w-full max-w-sm border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-center">
            {fromFumero ? "Fumero Studio" : "Motor AI"}
          </CardTitle>
          {fromFumero ? (
            <CardDescription className="text-center text-slate-400">
              Log in om verder te gaan in Fumero Studio
            </CardDescription>
          ) : null}
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
                className="border-slate-600 bg-slate-700 text-white"
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
                className="border-slate-600 bg-slate-700 text-white"
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <div className="flex gap-2 rounded-lg border border-red-700 bg-red-900/30 p-3 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "w-full disabled:opacity-50",
                fromFumero && "bg-[#69C400] text-white hover:bg-[#5db000]"
              )}
            >
              {loading ? "Bezig met inloggen…" : "Inloggen"}
            </Button>

            {missingFields && !loading ? (
              <p className="text-center text-xs text-slate-500">
                Vul e-mail en wachtwoord in om door te gaan
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
