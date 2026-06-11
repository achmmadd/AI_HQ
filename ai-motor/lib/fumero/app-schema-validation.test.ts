import assert from "node:assert/strict";
import test from "node:test";
import { validateRowAgainstSchema } from "@/lib/apps/schema-validation";

const SCHEMA = JSON.stringify({
  tables: [
    {
      name: "products",
      columns: [
        { name: "id", type: "integer", pk: true },
        { name: "naam", type: "text", required: true },
        { name: "prijs", type: "number" },
        { name: "aantal", type: "integer", default: 0 },
      ],
    },
    {
      name: "orders",
      columns: [
        { name: "status", type: "text", required: true },
        { name: "totaal", type: "number", required: true },
      ],
    },
  ],
});

test("validateRowAgainstSchema rejects unknown columns", () => {
  const result = validateRowAgainstSchema(
    "products",
    { naam: "Test", onbekend: true },
    SCHEMA,
    "create"
  );
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.onbekend);
});

test("validateRowAgainstSchema requires fields on create", () => {
  const result = validateRowAgainstSchema(
    "orders",
    { totaal: 49 },
    SCHEMA,
    "create"
  );
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.status);
});

test("validateRowAgainstSchema accepts valid product row", () => {
  const result = validateRowAgainstSchema(
    "products",
    { naam: "HHC Vape", prijs: 59, aantal: 10 },
    SCHEMA,
    "create"
  );
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.row.naam, "HHC Vape");
    assert.equal(result.row.prijs, 59);
  }
});

test("validateRowAgainstSchema rejects invalid types", () => {
  const result = validateRowAgainstSchema(
    "products",
    { naam: "X", aantal: "geen getal" },
    SCHEMA,
    "create"
  );
  assert.equal(result.valid, false);
});
