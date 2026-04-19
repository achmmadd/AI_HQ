"use client";

import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen pl-56">
      <Sidebar />
      <div className="flex min-h-screen flex-col">
        <Header title={title} />
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
