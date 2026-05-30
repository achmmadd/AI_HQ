import { NextResponse } from "next/server";
import { getComputerUseScreenshotRequestInit } from "@/lib/computer-use-config";

export const runtime = "nodejs";

/**
 * Safe adapter: alleen echte screenshot als COMPUTER_USE_SCREENSHOT_URL
 * naar een endpoint wijst dat een afbeelding teruggeeft. Anders null.
 */
export async function GET() {
  const url = process.env.COMPUTER_USE_SCREENSHOT_URL?.trim();
  if (!url) {
    return NextResponse.json({
      screenshot_base64: null,
      configured: false,
      hint: "Zet COMPUTER_USE_SCREENSHOT_URL naar een image URL of endpoint.",
    });
  }

  try {
    const extra = getComputerUseScreenshotRequestInit();
    const res = await fetch(url, {
      method: extra.method ?? "GET",
      headers: extra.headers,
      body: extra.method === "POST" ? extra.body : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return NextResponse.json({
        screenshot_base64: null,
        configured: true,
        http_status: res.status,
      });
    }
    const ct = res.headers.get("content-type") || "image/png";
    if (!ct.toLowerCase().startsWith("image/")) {
      return NextResponse.json({
        screenshot_base64: null,
        configured: true,
        error: "response_not_image",
      });
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 6 * 1024 * 1024) {
      return NextResponse.json({
        screenshot_base64: null,
        configured: true,
        error: "image_too_large",
      });
    }
    const b64 = buf.toString("base64");
    return NextResponse.json({
      screenshot_base64: `data:${ct};base64,${b64}`,
      configured: true,
    });
  } catch (e) {
    return NextResponse.json({
      screenshot_base64: null,
      configured: true,
      error: e instanceof Error ? e.message : "fetch_failed",
    });
  }
}
