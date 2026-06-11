export type AutomationFixHint = {
  label: string;
  href: string;
};

/** Map failed-run detail text to a user-facing fix action. */
export function getAutomationFixHint(detail: string | null | undefined): AutomationFixHint | null {
  if (!detail?.trim()) return null;
  const d = detail.toLowerCase();

  if (
    d.includes("fumero_admin_user") ||
    d.includes("fumero_admin_password") ||
    d.includes("playwright-login")
  ) {
    return {
      label: "Shop-login configureren",
      href: "/fumero/settings/context",
    };
  }

  if (d.includes("smtp")) {
    return {
      label: "E-mail (SMTP) instellen",
      href: "/fumero/settings/context",
    };
  }

  if (d.includes("n8n") || d.includes("webhook")) {
    return {
      label: "n8n / webhook configureren",
      href: "/fumero/settings/context",
    };
  }

  if (d.includes("dify") || d.includes("api_key")) {
    return {
      label: "AI-keys controleren",
      href: "/fumero/settings/context",
    };
  }

  if (d.includes("configureer") || d.includes("ontbreekt") || d.includes("niet geconfigureerd")) {
    return {
      label: "Instellingen openen",
      href: "/fumero/settings/context",
    };
  }

  return null;
}
