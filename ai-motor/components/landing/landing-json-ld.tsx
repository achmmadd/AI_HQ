import { MOTORSAI_BRAND } from "@/lib/landing-content";

export function LandingJsonLd() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://motorsai.nl";

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: MOTORSAI_BRAND.name,
        url: baseUrl,
        description: MOTORSAI_BRAND.tagline,
        email: MOTORSAI_BRAND.contactEmail,
        areaServed: "NL",
      },
      {
        "@type": "SoftwareApplication",
        name: MOTORSAI_BRAND.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "On-premise, Linux",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          description: "Demo op aanvraag",
        },
      },
      {
        "@type": "WebSite",
        name: MOTORSAI_BRAND.name,
        url: baseUrl,
        inLanguage: "nl-NL",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
