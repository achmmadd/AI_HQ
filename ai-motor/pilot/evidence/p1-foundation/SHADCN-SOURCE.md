# SHADCN-SOURCE — P1 Product Foundation

P1 gebruikt uitsluitend officiële MIT-primitieven van [shadcn/ui](https://ui.shadcn.com).
Geen betaalde template, geen gekopieerde admin-app, geen extra npm-dependency.

## Licentie

- Project: [shadcn/ui](https://github.com/shadcn-ui/ui)
- Licentie: MIT
- Copyright: shadcn (see upstream LICENSE)

## Overgenomen primitieven

Lokaal aangepast in `ai-motor/components/p1/ui.tsx` aan bestaande Motor-tokens
(`primary`, `accent`, `success`, `warning`, `error`). Geen runtime-/modelnamen.

| Primitive | Upstream (docs) | Lokale file |
|---|---|---|
| Button | https://ui.shadcn.com/docs/components/button | `components/p1/ui.tsx` (`P1Button`) |
| Card | https://ui.shadcn.com/docs/components/card | `components/p1/ui.tsx` (`P1Card*`) |
| Badge | https://ui.shadcn.com/docs/components/badge | `components/p1/ui.tsx` (`P1Badge`) |
| Textarea | https://ui.shadcn.com/docs/components/textarea | `components/p1/ui.tsx` (`P1Textarea`) |

Button gebruikt `@radix-ui/react-slot` (reeds in `package.json`) en
`class-variance-authority` (reeds in `package.json`), zoals de officiële
shadcn-implementatie.

## Niet gebruikt

- Geen shadcn-blokken, dashboard-templates of betaalde kits.
- Geen kopie uit Fumero/Bokas/legacy-admin.
- Geen nieuwe UI-dependency toegevoegd.
