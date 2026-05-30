import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { MotorsChatWorkspace } from "@/components/motors-chat-workspace";

export default function ChatPage() {
  return (
    <AppShell title="Chat" flush>
      <Suspense
        fallback={
          <p className="flex flex-1 items-center justify-center py-8 text-center text-[15px] text-text-secondary">
            Chat laden…
          </p>
        }
      >
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <MotorsChatWorkspace />
        </div>
      </Suspense>
    </AppShell>
  );
}
