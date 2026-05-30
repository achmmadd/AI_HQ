import { NextResponse } from "next/server";
import { getCodeExecutorStatus } from "@/lib/code-executor";

export const runtime = "nodejs";

export async function GET() {
  const status = await getCodeExecutorStatus();
  return NextResponse.json(status);
}
