import { redirect } from "next/navigation";

/** Legacy tools route → Apps hub. */
export default function FumeroToolsRedirectPage() {
  redirect("/fumero/projecten");
}
