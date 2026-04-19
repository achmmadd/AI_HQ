import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { HomeDashboard } from "@/components/home-dashboard";
import { LandingPage } from "@/components/landing-page";
import { isValidSessionToken, TOKEN_COOKIE } from "@/lib/auth-session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (isValidSessionToken(token)) {
    return (
      <AppShell title="Home">
        <HomeDashboard />
      </AppShell>
    );
  }
  return <LandingPage />;
}
