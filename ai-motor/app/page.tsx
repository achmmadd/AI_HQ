import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HomeOverview } from "@/components/home-overview";
import { LandingPage } from "@/components/landing-page";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  const session = await readAuthSession(token);
  if (session) {
    if (session.scope === "fumero") redirect("/fumero");
    if (session.scope === "bokas") redirect("/bokas");
    return (
      <AppShell title="Command Center">
        <HomeOverview />
      </AppShell>
    );
  }
  return (
    <>
      <LandingJsonLd />
      <LandingPage />
    </>
  );
}
