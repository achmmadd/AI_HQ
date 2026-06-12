import { redirect } from "next/navigation";

/** Brand Kit is stap 1 van Campaign Studio — redirect voor bookmarks en oude links. */
export default function FumeroBrandKitPage() {
  redirect("/fumero/campaign-studio?step=brand");
}
