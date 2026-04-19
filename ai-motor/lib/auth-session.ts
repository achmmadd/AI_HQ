/** Shared password gate for Motor AI (cookie value = base64 of UTF-8 password bytes). Edge-safe. */

export const TOKEN_COOKIE = "motorsai_token";

export function encodePasswordAsToken(password: string): string {
  const bytes = new TextEncoder().encode(password);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export function getAuthPassword(): string {
  return process.env.MOTORSAI_PASSWORD || "demo123";
}

export function getExpectedSessionToken(): string {
  return encodePasswordAsToken(getAuthPassword());
}

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  return token === getExpectedSessionToken();
}
