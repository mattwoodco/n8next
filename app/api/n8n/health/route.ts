import { NextResponse } from "next/server";
import { n8nFetch } from "@/lib/n8n";

export async function GET() {
  try {
    await n8nFetch("/api/v1/workflows?limit=0");
    return NextResponse.json({ status: "connected" });
  } catch (_error) {
    return NextResponse.json({ status: "disconnected" }, { status: 503 });
  }
}
