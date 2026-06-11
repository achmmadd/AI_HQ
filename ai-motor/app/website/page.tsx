import { LandingPage } from "@/components/landing-page";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";

/** Publieke marketingpagina — altijd zichtbaar, ook als je ingelogd bent. */
export default function WebsitePage() {
  return (
    <>
      <LandingJsonLd />
      <LandingPage />
    </>
  );
}
