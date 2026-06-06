# Page shell pattern

Mobile-first page layout for Motor / Fumero / Bokas screens.

## Structure

```tsx
<main className="min-h-dvh pb-[calc(var(--ds-touch-min)+env(safe-area-inset-bottom))] md:pb-0">
  <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-md px-[var(--ds-page-gutter)] py-3">
    <h1 className="text-xl font-semibold md:text-2xl">Paginatitel</h1>
  </header>
  <div className="mx-auto max-w-5xl px-[var(--ds-page-gutter)] py-[var(--ds-section-gap)]">
    {children}
  </div>
</main>
```

## Rules

- **Bottom padding** on mobile when using `Nav variant="bottom"` — reserve space for tab bar + safe area.
- **Page gutter** — always `var(--ds-page-gutter)`; never hardcode `px-4` in new pages.
- **Max width** — `max-w-5xl` for content; full-bleed only for chat/canvas surfaces.
- **Sticky header** — use for pages with scroll; chat workspaces may omit.

## Workspace roots

- Motor shell: `MotorsSidebar` + content column (4.2: add bottom `Nav`)
- Fumero: `fumero-workspace-root.tsx` + fumero sidebar
- Bokas: `bokas-workspace-root.tsx`

Each root must call `applyWorkspaceToDocument()` so `--accent` resolves correctly.
