import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { HomeOverview } from "@/components/home-overview";
import { LandingPage } from "@/components/landing-page";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (await readAuthSession(token)) {
    return (
      <AppShell title="Home">
        <HomeOverview />
      </AppShell>
    );
  }
  return <LandingPage />;
}
