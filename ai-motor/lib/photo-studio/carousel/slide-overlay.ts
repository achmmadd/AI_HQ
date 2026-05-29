import sharp from "sharp";

export async function applyCarouselSlideOverlay(
  buffer: Buffer,
  headline: string,
  subline?: string
): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 1080;
  const h = meta.height ?? 1080;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = Buffer.from(`
    <svg width="${w}" height="${h}">
      <rect x="0" y="${h - 160}" width="${w}" height="160" fill="rgba(0,0,0,0.45)"/>
      <text x="40" y="${h - 90}" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="#ffffff">${esc(headline.slice(0, 48))}</text>
      ${subline ? `<text x="40" y="${h - 40}" font-family="Arial,sans-serif" font-size="24" fill="#e5e5e5">${esc(subline.slice(0, 64))}</text>` : ""}
    </svg>`);
  return sharp(buffer).composite([{ input: svg, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
}
