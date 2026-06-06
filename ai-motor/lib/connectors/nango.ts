/**
 * Nango OAuth integration skeleton (Sprint 2.3.1).
 * Placeholder for future Odoo/Mollie connectors — no live Nango calls until activated.
 */

import type { ConnectorId } from "@/lib/connectors/registry";

export type NangoProviderId = "odoo" | "mollie";

export type NangoProviderStatus = "coming_soon" | "available";

export type NangoProviderDefinition = {
  id: NangoProviderId;
  integrationKey: string;
  name: string;
  description: string;
  connectorId: ConnectorId;
  status: NangoProviderStatus;
};

/** OAuth providers routed through Nango when enabled. */
export const NANGO_PROVIDERS: NangoProviderDefinition[] = [
  {
    id: "odoo",
    integrationKey: "odoo",
    name: "Odoo",
    description: "Boekhouding en ERP — OAuth via Nango (Bokas bookkeeping)",
    connectorId: "odoo",
    status: "coming_soon",
  },
  {
    id: "mollie",
    integrationKey: "mollie",
    name: "Mollie",
    description: "Betalingen en facturatie — OAuth via Nango",
    connectorId: "mollie",
    status: "coming_soon",
  },
];

export function isNangoEnabled(): boolean {
  return process.env.NANGO_ENABLED?.trim() === "1";
}

export function isNangoConfigured(): boolean {
  return Boolean(
    isNangoEnabled() && process.env.NANGO_SECRET_KEY?.trim()
  );
}

export function getNangoHost(): string {
  return (
    process.env.NANGO_HOST?.trim() || "https://api.nango.dev"
  );
}

export function getNangoProvider(
  id: NangoProviderId
): NangoProviderDefinition | undefined {
  return NANGO_PROVIDERS.find((p) => p.id === id);
}

export type NangoConnectPlaceholder = {
  provider: NangoProviderId;
  integration_key: string;
  status: "not_configured" | "coming_soon" | "ready";
  connect_url: string | null;
  message: string;
};

/**
 * OAuth connect URL placeholder — returns null until Nango is configured and provider is live.
 */
export function getNangoConnectPlaceholder(opts: {
  provider: NangoProviderId;
  workspaceSlug: string;
  returnUrl?: string;
}): NangoConnectPlaceholder {
  const provider = getNangoProvider(opts.provider);
  if (!provider) {
    return {
      provider: opts.provider,
      integration_key: opts.provider,
      status: "not_configured",
      connect_url: null,
      message: "Onbekende Nango-provider",
    };
  }

  if (!isNangoConfigured()) {
    return {
      provider: opts.provider,
      integration_key: provider.integrationKey,
      status: "not_configured",
      connect_url: null,
      message:
        "Nango niet geconfigureerd — zet NANGO_ENABLED=1 en NANGO_SECRET_KEY",
    };
  }

  if (provider.status === "coming_soon") {
    return {
      provider: opts.provider,
      integration_key: provider.integrationKey,
      status: "coming_soon",
      connect_url: null,
      message: `${provider.name} OAuth wordt later geactiveerd via Nango`,
    };
  }

  const returnPath = opts.returnUrl ?? `/settings/connectors`;
  const connectUrl = `${getNangoHost()}/oauth/connect/${provider.integrationKey}?workspace=${encodeURIComponent(opts.workspaceSlug)}&return_url=${encodeURIComponent(returnPath)}`;

  return {
    provider: opts.provider,
    integration_key: provider.integrationKey,
    status: "ready",
    connect_url: connectUrl,
    message: "OAuth-koppeling beschikbaar",
  };
}

/** List Nango-backed providers for admin/health surfaces. */
export function listNangoProviderStatus(): Array<{
  id: NangoProviderId;
  name: string;
  status: NangoProviderStatus;
  nango_configured: boolean;
}> {
  return NANGO_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    nango_configured: isNangoConfigured(),
  }));
}
