export async function downloadImageBuffer(url: string): Promise<Buffer> {
  return downloadMediaBuffer(url, 120_000);
}

export async function downloadMediaBuffer(
  url: string,
  timeoutMs = 120_000
): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`Download mislukt: HTTP ${res.status}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
