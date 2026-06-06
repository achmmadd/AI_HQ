# Migration guide — adopting the design system

> Sprint 4.1 foundation · incremental, non-breaking

## What changed

1. **`design-system/`** — new folder with tokens, workspace themes, components, patterns, RULES.
2. **`app/globals.css`** — imports `design-system/index.css`; color tokens removed (live in DS).
3. **`app/workspace-theme.css`** — now re-exports `design-system/workspaces.css` (import path unchanged in `layout.tsx`).
4. **`tailwind.config.ts`** — extended spacing/typography/radius from DS tokens; scans `design-system/**`.
5. **`components/ui/{button,card,input}.tsx`** — re-export from design system (API unchanged).

Existing UI should render identically. Dark shell + workspace accents unchanged.

---

## For developers

### New features

```tsx
import { Button, Input, Modal, ModalContent, ModalHeader, ModalTitle } from "@/design-system/components";

<Button size="touch">Opslaan</Button>
<Input touchFriendly placeholder="Zoeken…" />
```

### Mobile / opa-proof flows (required from 4.2)

- Buttons: `size="touch"` or `size="iconTouch"`
- Inputs: `touchFriendly`
- See `design-system/RULES.md` for 44px minimum

### Theming

- Edit colors: `design-system/tokens.css` (global) + `design-system/workspaces.css` (per workspace)
- Runtime workspace switch: still `applyWorkspaceToDocument()` in `lib/workspace-themes.ts`
- Keep TS `WORKSPACE_THEMES` in sync with CSS `[data-workspace]` blocks

### Modals

Replace custom overlay + fixed div patterns:

```tsx
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  Button,
} from "@/design-system/components";

<Modal open={open} onOpenChange={setOpen}>
  <ModalContent>
    <ModalHeader>
      <ModalTitle>Publiceren</ModalTitle>
    </ModalHeader>
    …
    <ModalFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
      <Button size="touch">Publiceren</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

Candidates: `fumero-publish-modal.tsx`, `fumero-app-data-modal.tsx`.

### Tables

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/design-system/components";
```

Mobile: wrapper scrolls horizontally automatically.

### Navigation (Sprint 4.2)

```tsx
import { Nav } from "@/design-system/components";

<Nav variant="bottom" items={navItems} pathname={pathname} />
```

---

## File map

```
design-system/
├── index.css              ← imported by globals.css
├── tokens.css             ← colors, spacing, typography, touch
├── workspaces.css         ← fumero / bokas / personal
├── base.css               ← html/body base layer
├── RULES.md
├── COMPONENT-MAP.md
├── MIGRATION.md           ← this file
├── components/
│   ├── index.ts
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── modal.tsx
│   ├── table.tsx
│   └── nav.tsx
└── patterns/
    ├── page-shell.md
    ├── form-field.md
    └── data-list.md
```

---

## Verification

```bash
npm run build
```

Visual smoke: `/login`, `/chat`, `/fumero/chat`, `/bokas/bonnen` — accents and dark shell intact.

---

## Rollback

If needed, revert `globals.css` to inline tokens and remove `@import "../design-system/index.css"`. Re-exports in `components/ui/` can point back to local implementations.
