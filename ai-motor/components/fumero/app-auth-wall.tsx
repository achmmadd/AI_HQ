"use client";
import { useState } from "react";
import { Button, Input } from "@/design-system/components";
export function AppAuthWall({
  slug,
  appName,
  onAuthenticated,
}: {
  slug: string;
  appName: string;
  onAuthenticated?: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const path =
        mode === "login"
          ? `/api/apps/${encodeURIComponent(slug)}/auth/login`
          : `/api/apps/${encodeURIComponent(slug)}/auth/register`;
      const body: Record<string, unknown> = { email, password };
      if (mode === "register") body.age_confirmed = ageConfirmed;
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Actie mislukt");
      onAuthenticated?.();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Actie mislukt");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--fumero-surface-muted)] px-4">
      {" "}
      <div className="w-full max-w-md rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-6 shadow-sm">
        {" "}
        <h1 className="text-lg font-semibold text-[var(--fumero-text)]">
          {appName}
        </h1>{" "}
        <p className="mt-1 text-sm text-[var(--fumero-text-muted)]">
          {" "}
          {mode === "login"
            ? "Log in om verder te gaan"
            : "Maak een account aan om verder te gaan"}{" "}
        </p>{" "}
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          {" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-[var(--fumero-text-muted)]">
              {" "}
              E-mailadres{" "}
            </label>{" "}
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              touchFriendly
              className="rounded-xl"
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-[var(--fumero-text-muted)]">
              {" "}
              Wachtwoord{" "}
            </label>{" "}
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              touchFriendly
              className="rounded-xl"
            />{" "}
          </div>{" "}
          {mode === "register" ? (
            <label className="flex items-start gap-2 text-sm text-[var(--fumero-text-muted)]">
              {" "}
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-1"
                required
              />{" "}
              <span>Ik ben 18 jaar en ouder</span>{" "}
            </label>
          ) : null}{" "}
          {error ? (
            <p className="rounded-lg border border-[var(--fumero-danger-border)] bg-[var(--fumero-danger-bg)] px-3 py-2 text-sm text-[var(--fumero-danger-fg)]">
              {" "}
              {error}{" "}
            </p>
          ) : null}{" "}
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--fumero-accent)] hover:bg-[var(--fumero-accent-hover)]"
          >
            {" "}
            {loading
              ? "Even geduld…"
              : mode === "login"
                ? "Inloggen"
                : "Registreren"}{" "}
          </Button>{" "}
        </form>{" "}
        <p className="mt-4 text-center text-sm text-[var(--fumero-text-muted)]">
          {" "}
          {mode === "login" ? "Nog geen account?" : "Al een account?"}
          {""}{" "}
          <button
            type="button"
            className="font-medium text-[var(--fumero-accent)] hover:underline"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {" "}
            {mode === "login" ? "Registreren" : "Inloggen"}{" "}
          </button>{" "}
        </p>{" "}
      </div>{" "}
    </div>
  );
}
