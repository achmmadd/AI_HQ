import { redirect } from "next/navigation";

/** Legacy Marketing Studio route — redirects to Automations hub (permanent redirect in next.config too). */
export default function FumeroMarketingRedirectPage() {
  redirect("/fumero/automations");
}
