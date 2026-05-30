import { redirect } from "next/navigation";

/** Feedback-loop UI niet meer in gebruik voor publieke rollout. */
export default function ImprovementsLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  redirect("/");
}
