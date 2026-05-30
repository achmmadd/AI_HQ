import { redirect } from "next/navigation";

/** Legacy Email Studio route — redirects to Automations hub (permanent redirect in next.config too). */
export default function FumeroEmailRedirectPage() {
  redirect("/fumero/automations");
}
