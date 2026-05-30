import {
  getDefaultEnabledConnectorIds,
  type ConnectorId,
} from "@/lib/connectors/registry";

const STORAGE_KEY = "fumero-connectors-enabled-v1";

const ALL_IDS = new Set<ConnectorId>([
  "fumero_orders",
  "fumero_bibliotheek",
  "fumero_briefing",
  "fumero_automations",
  "online_research",
  "designer",
  "ux_review",
  "templates",
  "copywriter",
  "seo",
  "stripe",
  "google_sheets",
  "gmail",
]);

function parseStored(raw: string | null): ConnectorId[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const ids = parsed.filter(
      (x): x is ConnectorId => typeof x === "string" && ALL_IDS.has(x as ConnectorId)
    );
    return ids;
  } catch {
    return null;
  }
}

export function readEnabledConnectors(): ConnectorId[] {
  if (typeof window === "undefined") {
    return getDefaultEnabledConnectorIds();
  }
  const stored = parseStored(sessionStorage.getItem(STORAGE_KEY));
  return stored ?? getDefaultEnabledConnectorIds();
}

export function writeEnabledConnectors(ids: ConnectorId[]): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function isConnectorEnabled(id: ConnectorId): boolean {
  return readEnabledConnectors().includes(id);
}

export function setConnectorEnabled(id: ConnectorId, enabled: boolean): ConnectorId[] {
  const current = new Set(readEnabledConnectors());
  if (enabled) current.add(id);
  else current.delete(id);
  const next = [...current];
  writeEnabledConnectors(next);
  return next;
}
