# Component audit — `components/ui/` ↔ design system

> Sprint 4.1 · Last updated: 2026-06-06

## Summary

| `components/ui/` | Design system source | Status | Notes |
|------------------|---------------------|--------|-------|
| `button.tsx` | `design-system/components/button.tsx` | **Re-export** | DS adds `touch`, `iconTouch` sizes |
| `card.tsx` | `design-system/components/card.tsx` | **Re-export** | DS adds `CardFooter` |
| `input.tsx` | `design-system/components/input.tsx` | **Re-export** | DS adds `touchFriendly` prop |
| `textarea.tsx` | — | **App-local** | Same styling tokens; migrate in 4.2 |
| `tabs.tsx` | — | **App-local** | Radix Tabs; candidate for DS in 4.2 |
| `scroll-area.tsx` | — | **App-local** | Radix ScrollArea; keep in ui/ |

## New design-system-only components

| Component | Path | Replaces / complements |
|-----------|------|------------------------|
| Modal | `design-system/components/modal.tsx` | Ad-hoc modals: `FumeroPublishModal`, `FumeroAppDataModal`, custom overlays |
| Table | `design-system/components/table.tsx` | Inline `<table>` in admin, kosten, approvals |
| Nav | `design-system/components/nav.tsx` | Extract from `motors-sidebar.tsx` (Sprint 4.2) |

## Consumers of `@/components/ui/*` (~70 files)

No import path changes required for Sprint 4.1. Re-exports preserve API compatibility.

Heavy users:

- **Button** — login, kennisbank, dev, approvals, fumero features, cowork panels
- **Card** — dashboards, admin, bokas bonnen
- **Input** — login, kennisbank ingest/search
- **Tabs** — dev page, kennisbank, agent panels
- **Textarea** — chat-adjacent forms, improvements

## Workspace-specific styling (not in ui/)

| Area | Location | Action |
|------|----------|--------|
| Fumero ops chrome | `styles/fumero-ops.css` | Keep; uses DS tokens via `--accent` |
| Fumero studio v3 | `styles/fumero-studio-v3.css` | Keep; maps `--ws-accent` |
| Bokas studio | `styles/bokas-studio.css` | Keep |
| Workspace runtime | `lib/workspace-themes.ts` + `design-system/workspaces.css` | SSOT split: TS for JS, CSS for static |

## Duplicate styling to consolidate (Sprint 4.2+)

1. Custom modal overlays in Fumero features → `Modal`
2. Sidebar nav item classes in `motors-sidebar.tsx` → `Nav variant="sidebar"`
3. Raw tables in `/kosten`, `/admin/agent-runs` → `Table` primitives
4. `textarea.tsx` → move to `design-system/components/textarea.tsx`

## Import guidance

```tsx
// Preferred for new code (Sprint 4.1+)
import { Button, Card, Input, Modal, Table, Nav } from "@/design-system/components";

// Still valid — thin re-export layer
import { Button } from "@/components/ui/button";
```
