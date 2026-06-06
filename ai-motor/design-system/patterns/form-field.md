# Form field pattern

Accessible, opa-proof form fields for NL SMB users.

## Structure

```tsx
import { Input, Button } from "@/design-system/components";

<div className="flex flex-col gap-[var(--ds-stack-gap)]">
  <label htmlFor="email" className="text-sm font-medium text-text-primary">
    E-mailadres
  </label>
  <Input id="email" type="email" touchFriendly autoComplete="email" />
  <p className="text-sm text-text-secondary">We sturen geen spam.</p>
</div>

<Button type="submit" size="touch" className="w-full sm:w-auto">
  Inloggen
</Button>
```

## Rules

- Every `Input` has a visible `<label>` (not placeholder-only).
- Mobile customer flows: `touchFriendly` + `size="touch"` on submit.
- Error text: `text-error text-sm`, placed **below** the input; describe how to fix in Dutch.
- Helper text: `text-text-secondary`, max one line when possible.
- Primary action right or full-width on mobile; secondary `variant="outline"` left or stacked above on mobile.

## Anti-patterns

- Placeholder as sole label ("Vul in…")
- Submit buttons smaller than 44px on mobile
- English error strings in customer UI
