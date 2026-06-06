import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingWorkspaceFlow } from "@/components/onboarding/onboarding-workspace-flow";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";

export default async function OnboardingPage() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const session = await readAuthSession(token);
  if (!session) {
    redirect("/login?from=/onboarding");
  }

  return (
    <div className="min-h-dvh bg-background">
      <OnboardingWorkspaceFlow />
    </div>
  );
}
