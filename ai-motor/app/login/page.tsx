"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = (await res.json()) as { token?: string; error?: string };

      if (data.token) {
        localStorage.setItem("motorsai_token", data.token);
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Wachtwoord incorrect");
      }
    } catch {
      setError("Fout bij inloggen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <Card className="w-full max-w-sm border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-center">Motor AI</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
                autoFocus
              />
            </div>

            {error && (
              <div className="flex gap-2 rounded-lg border border-red-700 bg-red-900/30 p-3 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full"
            >
              {loading ? "Bezig..." : "Inloggen"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
