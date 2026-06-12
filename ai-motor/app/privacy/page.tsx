import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { MOTORSAI_BRAND } from "@/lib/landing-content";

export const metadata: Metadata = {
  title: `Privacyverklaring · ${MOTORSAI_BRAND.name}`,
  description: `Hoe ${MOTORSAI_BRAND.name} omgaat met persoonsgegevens (AVG).`,
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[#080c14] text-slate-200">
      <header className="border-b border-white/[0.06] px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Home
          </Link>
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="sm" elevate decorative />
            <span className="font-semibold text-white">{MOTORSAI_BRAND.name}</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold text-white">Privacyverklaring</h1>
        <p className="mt-2 text-sm text-slate-400">Laatst bijgewerkt: juni 2026</p>

        <div className="mt-10 space-y-6 text-sm leading-relaxed text-slate-300">
          <p>
            {MOTORSAI_BRAND.name} (&quot;wij&quot;) respecteert je privacy. Deze verklaring
            beschrijft hoe we persoonsgegevens verwerken in lijn met de AVG,
            voor zover je onze software of website gebruikt.
          </p>

          <h2 className="text-lg font-semibold text-white">Welke gegevens</h2>
          <p>
            Afhankelijk van je gebruik kunnen wij o.a. verwerken: account- of
            contactgegevens die je invult (inclusief demo-aanvragen), technische logs
            (zoals IP-adres en browser), en inhoud die je in de applicatie plaatst
            (bijv. chat of uploads). Verwerking gebeurt in de eerste plaats om de
            dienst te leveren en te beveiligen.
          </p>

          <h2 className="text-lg font-semibold text-white">Doelen en basis</h2>
          <p>
            We gebruiken gegevens om de applicatie beschikbaar te houden, demo-aanvragen
            op te volgen, te ondersteunen, fraude te voorkomen en — waar van toepassing —
            wettelijke verplichtingen na te komen. Rechtsgrondslag kan zijn:
            uitvoering van een overeenkomst, gerechtvaardigd belang (zoals
            beveiliging), of toestemming waar we die vragen.
          </p>

          <h2 className="text-lg font-semibold text-white">Bewaartermijn</h2>
          <p>
            We bewaren gegevens niet langer dan nodig is voor de doelen hierboven,
            tenzij een langere bewaarplicht geldt. Demo-aanvragen worden maximaal
            24 maanden bewaard, tenzij een lopend traject langer vereist.
          </p>

          <h2 className="text-lg font-semibold text-white">Delen met derden</h2>
          <p>
            Verwerking kan plaatsvinden bij hosting-, e-mail- of AI-providers
            die voor jouw omgeving zijn geconfigureerd. Welke partijen dat zijn,
            hangt af van jouw installatie en contracten. Demo-aanvragen worden
            niet gedeeld met derden voor marketingdoeleinden.
          </p>

          <h2 className="text-lg font-semibold text-white">Je rechten</h2>
          <p>
            Je hebt recht op inzage, correctie, verwijdering, beperking,
            dataportabiliteit en bezwaar waar de AVG dat toelaat. Je kunt ook
            een klacht indienen bij de Autoriteit Persoonsgegevens (
            <a
              href="https://autoriteitpersoonsgegevens.nl"
              className="text-[#69C400] underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              autoriteitpersoonsgegevens.nl
            </a>
            ).
          </p>

          <h2 className="text-lg font-semibold text-white">Contact</h2>
          <p>
            Voor privacyvragen:{" "}
            <a
              href={`mailto:${MOTORSAI_BRAND.contactEmail}`}
              className="text-[#69C400] underline"
            >
              {MOTORSAI_BRAND.contactEmail}
            </a>
            . Of gebruik het{" "}
            <Link href="/#contact" className="text-[#69C400] underline">
              contactgedeelte
            </Link>{" "}
            op de landingspagina.
          </p>
        </div>
      </div>
    </div>
  );
}
