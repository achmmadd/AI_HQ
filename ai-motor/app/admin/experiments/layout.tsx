import { redirect } from "next/navigation";

/** Prototype verwijderd van navigatie/voor MotorsAI.live — route afgebogen. */
export default function ExperimentsLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  redirect("/");
}
