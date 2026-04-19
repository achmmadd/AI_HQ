import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ChatWorkspace } from "@/components/chat-workspace";

export default function ChatPage() {
  return (
    <AppShell title="Chat">
      <Suspense
        fallback={
          <p className="py-8 text-center text-sm text-text-secondary">
            Chat laden…
          </p>
        }
      >
        <ChatWorkspace />
      </Suspense>
    </AppShell>
  );
}
