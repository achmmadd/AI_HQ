# Motor AI Design System — RULES

> **Sprint 4.1** · team-first · opa-proof · mobile-first · NL MKB  
> Canonical tokens: `design-system/tokens.css` · Components: `design-system/components/`

---

## Principles

1. **Mobile-first** — Design for 375px viewport first; enhance at `md` (768px) and up.
2. **Opa-proof** — Assume non-technical Dutch SMB users; plain NL labels, no jargon in UI copy.
3. **Team-first** — Shared primitives across Motor shell, Fumero Studio, and Bokas.
4. **Incremental adoption** — Import from `@/design-system/components` in new code; existing `@/components/ui/*` re-exports stay valid.

---

## Touch targets (mandatory)

| Rule | Value | Token / class |
|------|-------|---------------|
| Minimum interactive size | **44×44 px** | `--ds-touch-min` (2.75rem) |
| Comfortable primary actions | **48×48 px** | `--ds-touch-comfortable` (3rem) |
| Bottom nav items | min-height 44px | `Nav variant="bottom"` |
| Icon-only buttons (mobile) | use `size="iconTouch"` | `Button` |
| Primary CTAs on mobile | use `size="touch"` | `Button` |
| Form inputs (mobile flows) | `touchFriendly` prop | `Input` |
| Modal close control | min 44×44 px | built into `ModalContent` |

**WCAG 2.5.5 (AAA)** recommends 44×44 CSS pixels. Apple HIG uses the same minimum. All new interactive surfaces in customer-facing flows (chat, kennisbank, approvals, onboarding) **must** meet this from Sprint 4.2 onward.

Desktop-dense admin views (`/dev`, `/admin/*`) may use `size="sm"` / `size="default"` but prefer `touch` on primary actions visible on tablet breakpoints.

---

## Spacing

| Token | Mobile | Tablet+ |
|-------|--------|---------|
| `--ds-page-gutter` | 16px | 24px (`md+`) |
| `--ds-section-gap` | 24px | 24px |
| `--ds-stack-gap` | 12px | 12px |

Use Tailwind: `px-[var(--ds-page-gutter)]`, `gap-[var(--ds-section-gap)]`, or semantic `p-4 md:p-6`.

---

## Typography

| Role | Mobile size | Usage |
|------|-------------|-------|
| Display | 1.75rem → 2rem | Hero / empty states |
| H1 | 1.5rem → 1.75rem | Page titles |
| H2 | 1.25rem | Section headers |
| Body | **1rem (16px)** | Default — never below 16px on mobile inputs |
| Caption | 0.8125rem | Metadata only, not primary actions |

Font stack: `--ds-font-sans` (Geist + Poppins). Workspace accent font: `--ws-font`.

**NL copy:** Use "je/jij" for end users; "u" only if client brand requires formal tone.

---

## Color

- **Semantic tokens only** in components: `background`, `surface`, `accent`, `text-primary`, etc.
- **Never hardcode hex** in React — use Tailwind `bg-accent`, `text-text-secondary`, or CSS vars.
- Workspace brand colors flow: `WORKSPACE_THEMES` → `applyWorkspaceToDocument()` → `--ws-accent` → `--accent`.

Themes: `.dark` (Motor default), `.light`, plus `[data-workspace="fumero|bokas|personal"]`.

---

## Components

| Primitive | Import | Notes |
|-----------|--------|-------|
| Button | `@/design-system/components` | Radix Slot + CVA |
| Card | same | Includes `CardFooter` |
| Input | same | `touchFriendly` for mobile forms |
| Modal | same | Radix Dialog; NL `aria-label="Sluiten"` |
| Table | same | Horizontal scroll wrapper on mobile |
| Nav | same | `variant="bottom"` for Sprint 4.2 shell |

Match shadcn/Radix patterns: `forwardRef`, `cn()`, `className` override, focus rings via `ring-accent`.

---

## Patterns

See `design-system/patterns/` for compositional recipes:

- `page-shell.md` — page layout + safe areas
- `form-field.md` — label + input + error
- `data-list.md` — table vs card list on mobile

---

## Workspace parity

Fumero, Bokas, and Motor shell **must** use the same primitives. Workspace-specific styling is limited to:

- Accent color (`--ws-accent`)
- Font (`--ws-font`)
- Optional studio CSS (`styles/fumero-ops.css`, etc.) for feature-specific chrome — not duplicate buttons/cards.

---

## Do not

- Add new color hex values outside `tokens.css` / `workspaces.css`
- Ship interactive elements smaller than 44px on mobile customer flows
- Create one-off modal/dialog markup — use `Modal`
- Bypass `@/components/ui` re-exports without updating `COMPONENT-MAP.md`

---

## Sprint 4.2 checklist (preview)

- [ ] Replace ad-hoc modals with `Modal`
- [ ] `MotorsSidebar` → compose `Nav` + bottom bar on `<md`
- [ ] Onboarding screens: all CTAs `size="touch"`
- [ ] Kennisbank / approvals: `Input touchFriendly`
