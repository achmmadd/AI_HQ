import { redirect } from "next/navigation";

/** Legacy route — next.config redirect + deze pagina → chat hub. */
export default function FumeroRootPage() {
  redirect("/fumero/chat");
}
