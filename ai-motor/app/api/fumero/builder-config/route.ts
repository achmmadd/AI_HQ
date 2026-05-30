import { NextResponse } from "next/server";
import { getFumeroBuilderLabel } from "@/lib/fumero/builder-config";

export const runtime = "nodejs";

/** Public builder badge for Fumero chat cards (no auth — label only). */
export async function GET() {
  return NextResponse.json({ label: getFumeroBuilderLabel() });
}
