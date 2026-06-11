import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";

export default async function OnboardingPage() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const session = await readAuthSession(token);
  if (!session) {
    redirect("/login?from=/onboarding");
  }

  return <OnboardingWizard />;
}
