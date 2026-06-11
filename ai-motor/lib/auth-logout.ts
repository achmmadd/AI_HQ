/** Client-side logout: clears session cookie via API and redirects to login. */
export async function logoutClient(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem("motorsai_token");
  } catch {
    /* ignore */
  }
  window.location.href = "/login";
}
