import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacyverklaring · Motor AI",
  description: "Hoe Motor AI omgaat met persoonsgegevens (AVG).",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-900 to-slate-950 text-slate-200">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="text-sm text-blue-400 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-white">
          Privacyverklaring
        </h1>
        <p className="mt-2 text-sm text-slate-400">Laatst bijgewerkt: april 2026</p>

        <div className="mt-10 space-y-6 text-sm leading-relaxed text-slate-300">
          <p>
            Motor AI (&quot;wij&quot;) respecteert je privacy. Deze verklaring
            beschrijft hoe we persoonsgegevens verwerken in lijn met de AVG,
            voor zover je onze software of website gebruikt.
          </p>

          <h2 className="text-lg font-semibold text-white">
            Welke gegevens
          </h2>
          <p>
            Afhankelijk van je gebruik kunnen wij o.a. verwerken: account- of
            contactgegevens die je invult, technische logs (zoals IP-adres en
            browser), en inhoud die je in de applicatie plaatst (bijv. chat of
            uploads). Verwerking gebeurt in de eerste plaats om de dienst te
            leveren en te beveiligen.
          </p>

          <h2 className="text-lg font-semibold text-white">Doelen en basis</h2>
          <p>
            We gebruiken gegevens om de applicatie beschikbaar te houden, te
            ondersteunen, fraude te voorkomen en — waar van toepassing —
            wettelijke verplichtingen na te komen. Rechtsgrondslag kan zijn:
            uitvoering van een overeenkomst, gerechtvaardigd belang (zoals
            beveiliging), of toestemming waar we die vragen.
          </p>

          <h2 className="text-lg font-semibold text-white">Bewaartermijn</h2>
          <p>
            We bewaren gegevens niet langer dan nodig is voor de doelen hierboven,
            tenzij een langere bewaarplicht geldt.
          </p>

          <h2 className="text-lg font-semibold text-white">Delen met derden</h2>
          <p>
            Verwerking kan plaatsvinden bij hosting-, e-mail- of AI-providers
            die voor jouw omgeving zijn geconfigureerd. Welke partijen dat zijn,
            hangt af van jouw installatie en contracten.
          </p>

          <h2 className="text-lg font-semibold text-white">Je rechten</h2>
          <p>
            Je hebt recht op inzage, correctie, verwijdering, beperking,
            dataportabiliteit en bezwaar waar de AVG dat toelaat. Je kunt ook
            een klacht indienen bij de Autoriteit Persoonsgegevens (
            <a
              href="https://autoriteitpersoonsgegevens.nl"
              className="text-blue-400 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              autoriteitpersoonsgegevens.nl
            </a>
            ).
          </p>

          <h2 className="text-lg font-semibold text-white">Contact</h2>
          <p>
            Voor privacyvragen: gebruik het contactadres op de{" "}
            <Link href="/#contact" className="text-blue-400 underline">
              landingspagina
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
