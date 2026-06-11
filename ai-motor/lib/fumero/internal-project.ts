/** Internal/test code workspaces — hidden from end-user project lists. */
export function isInternalCodeProject(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n.startsWith("_phase-test-") || n.startsWith("_import-");
}
