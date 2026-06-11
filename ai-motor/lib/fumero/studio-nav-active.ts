/** Active state for studio burger-menu links on /fumero/photo-studio. */
export function isStudioCreatieNavActive(
  pathname: string,
  href: string,
  searchParams: URLSearchParams
): boolean {
  if (!pathname.startsWith("/fumero/photo-studio")) return false;

  const queryIndex = href.indexOf("?");
  const target = new URLSearchParams(queryIndex >= 0 ? href.slice(queryIndex + 1) : "");
  const mode = target.get("mode");
  const view = target.get("view");
  const currentMode = searchParams.get("mode");
  const currentView = searchParams.get("view");

  if (view === "history") return currentView === "history";
  if (mode === "image") return currentMode === "image";
  if (mode === "video") return currentMode === "video";
  return !currentMode && currentView !== "history";
}
