# Fumero Builder — Design Context

Compact design rules injected into tool-build and artifact generation prompts.

## Brand tokens

- Primary accent: `#69C400` (buttons, success, primary CTA only)
- Accent hover: `#5DB000`
- Background canvas: `#FAFAFA`
- Surface / cards: `#FFFFFF`
- Muted surface: `#F5F5F5`
- Border: `#E5E5E5`
- Text primary: `#171717`
- Text secondary: `#525252`
- Text muted: `#737373`
- Destructive: `#DC2626`

## Typography

- Font stack: Geist, system-ui, -apple-system, sans-serif
- Body: 14px / line-height 1.57
- Small labels: 12–13px, medium weight
- Headings in widgets: 15–18px semibold
- Monospace (IDs, code snippets): Geist Mono 12px
- No emoji in UI chrome

## Spacing (8px grid)

- Compact padding: 8px
- Default card padding: 16–24px
- Section gaps: 24–32px
- Border radius: 8px (controls), 12px (cards)
- Min touch target: 44px height for buttons

## Widget constraints

- Embeddable widgets: max width ~480px, mobile-first
- Calculator / functional widgets: max ~360px
- Standalone HTML: inline CSS, one vanilla `<script>` block
- No React, no ES modules, no external frameworks
- Responsive via viewport meta + flex/grid
- WCAG AA contrast for body text

## Layout patterns

- White or light grey backgrounds — avoid pure black except dark widgets (e.g. calculator)
- One primary green button per view
- Subtle 1px borders instead of heavy shadows
- Chat column white, preview rail `#FAFAFA`

## Copy (NL)

- Use Dutch UI labels
- Status: "concept" → "Versie X · nog niet live"
- Publish CTA: "Online zetten" not "Deploy"
- Avoid dev jargon: Flash, Turbo, Coder in user-facing text

## Interactive requirements

- All buttons and inputs must work via vanilla JS in iframe
- Form fields need `<label>` or `aria-label`
- Visible `:focus` styles for keyboard users
- `<html lang="nl">` and descriptive `<title>`

## Fumero B2B tone

- Professional, calm, premium CBD/HHC retail context
- No playful gradients or glassmorphism
- Green accent sparingly — trust through clarity
