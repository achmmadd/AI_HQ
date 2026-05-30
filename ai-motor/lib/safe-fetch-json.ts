/**
 * Leest Response body als tekst en probeert JSON; voorkomt crashes bij HTML/plaintext upstream.
 */
export async function readResponseJson<T>(res: Response, fallback: T): Promise<T> {
  const text = await res.text();
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}
