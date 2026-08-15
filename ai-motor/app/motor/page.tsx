import { renderMotorShell } from "./render-motor-shell";

/** Authenticated synthetic P1.1 shell. Never reads a live workspace. */
export default async function MotorShellPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderMotorShell({ query: await searchParams });
}
