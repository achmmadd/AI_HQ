import Link from "next/link";
import { ShieldCheck, Server, Mail } from "lucide-react";
import { FOOTER, MOTORSAI_BRAND } from "@/lib/landing-content";

const BADGE_ICONS = {
  "AVG-compliant": ShieldCheck,
  "On-premise": Server,
  "Nederlandse support": Mail,
} as const;

export function LandingFooter() {
  return (
    <footer
      id="contact"
      className="relative z-10 border-t border-white/[0.06] px-6 py-12 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-lg font-semibold text-white">{MOTORSAI_BRAND.name}</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
              {FOOTER.tagline}
            </p>
          </div>

          <nav aria-label="Footer navigatie">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Links
            </p>
            <ul className="mt-4 space-y-2">
              {FOOTER.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith("mailto:") ? (
                    <a
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Vertrouwen
            </p>
            <ul className="mt-4 space-y-2">
              {FOOTER.badges.map((badge) => {
                const Icon = BADGE_ICONS[badge as keyof typeof BADGE_ICONS] ?? ShieldCheck;
                return (
                  <li
                    key={badge}
                    className="flex items-center gap-2 text-sm text-slate-400"
                  >
                    <Icon className="h-3.5 w-3.5 text-[#69C400]" aria-hidden />
                    {badge}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-8 sm:flex-row">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} {MOTORSAI_BRAND.name}. Alle rechten voorbehouden.
          </p>
          <p className="text-xs text-slate-600">
            Gehost in Nederland · Enterprise AI-automatisering
          </p>
        </div>
      </div>
    </footer>
  );
}
