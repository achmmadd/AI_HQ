import { redirect } from "next/navigation";

/** Legacy apps hub → Projecten. */
export default function FumeroAppsRedirectPage() {
  redirect("/fumero/projecten");
}
