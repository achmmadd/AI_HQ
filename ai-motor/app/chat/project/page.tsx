import { redirect } from "next/navigation";

export default function ChatProjectPage() {
  redirect("/chat?mode=project");
}
