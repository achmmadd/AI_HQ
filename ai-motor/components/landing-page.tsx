"use client";

import Link from "next/link";
import { ArrowRight, Zap, Lock, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex items-center justify-between p-6">
        <h1 className="text-2xl font-bold text-white">MotorsAI</h1>
        <Link href="/login">
          <Button size="sm">Inloggen</Button>
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center space-y-8 px-6 py-20">
        <div className="max-w-2xl space-y-4 text-center">
          <h2 className="text-4xl font-bold text-white sm:text-5xl">
            Digitaal team gebouwd in seconden
          </h2>
          <p className="text-lg text-slate-300 sm:text-xl">
            AI agents die jouw bedrijf 24/7 runnen.
            <br />
            Data blijft van jou. Alles op je eigen server.
          </p>
        </div>

        <div className="mt-8 grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { icon: Zap, titel: "Instant", desc: "Apps gebouwd in minuten" },
            { icon: Lock, titel: "Privé", desc: "Data verlaat nooit je pand" },
            { icon: Cpu, titel: "AI", desc: "24/7 agents werkend" },
          ].map((f, i) => (
            <Card key={i} className="border-slate-700 bg-slate-800/50">
              <CardContent className="space-y-2 p-4">
                <f.icon className="h-6 w-6 text-blue-400" />
                <p className="font-medium text-white">{f.titel}</p>
                <p className="text-sm text-slate-400">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex gap-3">
          <Link href="/login">
            <Button size="lg" className="gap-2">
              Demo zien <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <p className="mt-12 text-center text-sm text-slate-400">
          Gebouwd in Nederland · AVG compliant · Open source stack
        </p>
      </div>

      <div className="border-t border-slate-700 p-6 text-center text-sm text-slate-400">
        <p>MotorsAI — eigen stack, eigen data</p>
      </div>
    </div>
  );
}
