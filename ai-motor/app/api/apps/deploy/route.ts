import { NextRequest, NextResponse } from "next/server";
import {
  GET as deployGet,
  POST as deployPost,
} from "@/lib/deploy-api-handlers";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return deployGet(req);
}

export async function POST(req: NextRequest) {
  return deployPost(req);
}
