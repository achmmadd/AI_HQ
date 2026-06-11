export type IntegrationCheck = {
  id: string;
  label: string;
  configured: boolean;
  required_for: string;
  env_keys: string[];
};

export type IntegrationReadiness = {
  checks: IntegrationCheck[];
  all_required_configured: boolean;
  missing: IntegrationCheck[];
};

function envSet(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

/** Server-side only — never expose secret values. */
export function getFumeroIntegrationReadiness(): IntegrationReadiness {
  const checks: IntegrationCheck[] = [
    {
      id: "fumero_admin",
      label: "Shop-login (Fumero admin)",
      configured: envSet("FUMERO_ADMIN_USER") && envSet("FUMERO_ADMIN_PASSWORD"),
      required_for: "Orders sync en shop-automatisering",
      env_keys: ["FUMERO_ADMIN_USER", "FUMERO_ADMIN_PASSWORD"],
    },
    {
      id: "smtp",
      label: "E-mail (SMTP)",
      configured:
        envSet("SMTP_HOST") && envSet("SMTP_USER") && envSet("SMTP_PASS"),
      required_for: "E-mailflows en notificaties",
      env_keys: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_PORT"],
    },
    {
      id: "n8n_social",
      label: "Social planner (n8n)",
      configured: envSet("N8N_SOCIAL_SCHEDULER_WEBHOOK"),
      required_for: "Geplande social posts",
      env_keys: ["N8N_SOCIAL_SCHEDULER_WEBHOOK"],
    },
  ];

  const missing = checks.filter((c) => !c.configured);
  return {
    checks,
    all_required_configured: missing.length === 0,
    missing,
  };
}
