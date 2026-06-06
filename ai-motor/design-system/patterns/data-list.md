# Data list pattern

Responsive data display — card list on mobile, table on desktop.

## Mobile-first (default)

Stack rows as cards; easier to tap and scan on phone.

```tsx
import { Card, CardContent } from "@/design-system/components";

<ul className="flex flex-col gap-3">
  {rows.map((row) => (
    <li key={row.id}>
      <Card className="p-4">
        <CardContent className="p-0 flex flex-col gap-1">
          <span className="font-medium">{row.title}</span>
          <span className="text-sm text-text-secondary">{row.meta}</span>
        </CardContent>
      </Card>
    </li>
  ))}
</ul>
```

## Desktop table

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/design-system/components";

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Titel</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {rows.map((row) => (
      <TableRow key={row.id}>
        <TableCell>{row.title}</TableCell>
        <TableCell>{row.status}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

## Rules

- **`<md`**: prefer card list for ≤6 columns
- **`md+`**: table OK; wrapper handles horizontal scroll if needed
- Row actions: min 44px touch target (`Button size="iconTouch"`)
- Empty state: centered copy in NL + one primary CTA (`size="touch"`)

## Existing pages to migrate (4.2)

- `/approvals` — approval rows
- `/kosten/usage` — usage table
- `/admin/agent-runs` — run log
