import type { CompanyId } from "@/lib/types";

export type IntegrationId =
  | "gmail"
  | "website"
  | "kennisbank"
  | "qdrant"
  | "openclaw";

export type CompanyIntegrationStatus = {
  id: IntegrationId;
  label: string;
  connected: boolean;
  hint: string;
};

/** Welke bedrijfsbronnen Motor mag gebruiken (env + vaste regels). */
export function getCompanyIntegrations(
  company: CompanyId
): CompanyIntegrationStatus[] {
  const gmail =
    Boolean(process.env.GMAIL_CLIENT_ID?.trim()) ||
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim());
  const website = Boolean(process.env[`${company.toUpperCase()}_SITE_URL`]?.trim());
  const kennis = true;
  const qdrant = Boolean(process.env.QDRANT_URL?.trim());
  const openclaw = Boolean(process.env.OPENCLAW_GATEWAY_URL?.trim());

  return [
    {
      id: "gmail",
      label: "Gmail",
      connected: gmail,
      hint: gmail
        ? "E-mail & facturen via automation"
        : "Zet GMAIL_CLIENT_ID of service account",
    },
    {
      id: "website",
      label: "Website",
      connected: website,
      hint: website
        ? `Live data van ${company}`
        : `Zet ${company.toUpperCase()}_SITE_URL`,
    },
    {
      id: "kennisbank",
      label: "Kennisbank",
      connected: kennis,
      hint: "Interne docs + chat-geheugen",
    },
    {
      id: "qdrant",
      label: "Geheugen (Qdrant)",
      connected: qdrant,
      hint: qdrant ? "Vector-geheugen actief" : "QDRANT_URL ontbreekt",
    },
    {
      id: "openclaw",
      label: "Motor (OpenClaw)",
      connected: openclaw,
      hint: openclaw ? "Agent op NUC" : "OPENCLAW_GATEWAY_URL ontbreekt",
    },
  ];
}
