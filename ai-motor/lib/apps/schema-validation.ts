export type SchemaColumn = {
  name: string;
  type?: string;
  required?: boolean;
  pk?: boolean;
  default?: unknown;
};

export type SchemaTable = {
  name: string;
  columns?: SchemaColumn[];
};

export type AppDbSchema = {
  tables?: SchemaTable[];
};

function parseSchema(dbSchema: string | null | undefined): AppDbSchema | null {
  if (!dbSchema) return null;
  try {
    return JSON.parse(dbSchema) as AppDbSchema;
  } catch {
    return null;
  }
}

export function getTableSchema(
  dbSchema: string | null | undefined,
  tableName: string
): SchemaTable | null {
  const schema = parseSchema(dbSchema);
  if (!schema?.tables) return null;
  return schema.tables.find((t) => t.name === tableName) ?? null;
}

function coerceValue(value: unknown, type: string | undefined): unknown {
  if (value == null) return value;
  const t = (type || "text").toLowerCase();
  if (t === "integer" || t === "int") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : value;
  }
  if (t === "number" || t === "float") {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (t === "boolean" || t === "bool") {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === 1 || value === "1") return true;
    if (value === "false" || value === 0 || value === "0") return false;
    return value;
  }
  return value;
}

function isValidType(value: unknown, type: string | undefined): boolean {
  if (value == null) return true;
  const t = (type || "text").toLowerCase();
  if (t === "integer" || t === "int") return Number.isInteger(Number(value));
  if (t === "number" || t === "float") return Number.isFinite(Number(value));
  if (t === "boolean" || t === "bool") return typeof value === "boolean";
  if (t === "text" || t === "string") return typeof value === "string";
  if (t === "json" || t === "object") return typeof value === "object";
  return true;
}

export type RowValidationResult =
  | { valid: true; row: Record<string, unknown> }
  | { valid: false; errors: Record<string, string> };

/**
 * Validate and coerce a row against db_schema table definition.
 * Unknown columns are stripped; required columns must be present on POST.
 */
export function validateRowAgainstSchema(
  tableName: string,
  row: Record<string, unknown>,
  dbSchema: string | null | undefined,
  mode: "create" | "update"
): RowValidationResult {
  const table = getTableSchema(dbSchema, tableName);
  if (!table?.columns?.length) {
    return { valid: true, row };
  }

  const errors: Record<string, string> = {};
  const allowed = new Map(table.columns.map((c) => [c.name, c]));
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith("__")) continue;
    const col = allowed.get(key);
    if (!col) {
      errors[key] = `Kolom "${key}" bestaat niet in tabel "${tableName}"`;
      continue;
    }
    if (!isValidType(value, col.type)) {
      errors[key] = `Ongeldig type voor "${key}" (verwacht: ${col.type || "text"})`;
      continue;
    }
    cleaned[key] = coerceValue(value, col.type);
  }

  if (mode === "create") {
    for (const col of table.columns) {
      if (col.pk) continue;
      if (col.required && cleaned[col.name] == null && col.default === undefined) {
        errors[col.name] = `"${col.name}" is verplicht`;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, row: cleaned };
}
