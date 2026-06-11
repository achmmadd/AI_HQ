"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroWorldclassStudio } from "@/components/fumero/worldclass-studio/fumero-worldclass-studio";
function RouteBody({ legacy }: { legacy: React.ReactNode }) {
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant") ?? "worldclass";
  if (variant === "legacy") {
    return <>{legacy}</>;
  }
  return (
    <FumeroShell
      page="Studio"
      flush
      breadcrumbs={[
        { label: "Fumero Studio", href: "/fumero/chat" },
        { label: "Studio" },
      ]}
    >
      {" "}
      <FumeroWorldclassStudio klant="fumero" />{" "}
    </FumeroShell>
  );
}
export function FumeroPhotoStudioRoute({
  legacy,
}: {
  legacy: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <p className="py-8 text-center fumero-text-body-sm text-[var(--fumero-text-muted)]">
          {" "}
          Studio laden…{" "}
        </p>
      }
    >
      {" "}
      <RouteBody legacy={legacy} />{" "}
    </Suspense>
  );
}
