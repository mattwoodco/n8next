import { type NextRequest, NextResponse } from "next/server";
import { N8nAdapter } from "@/lib/uwf/n8n-adapter";

const adapter = new N8nAdapter();

export async function GET() {
  try {
    const workflows = await adapter.list();
    return NextResponse.json(workflows);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list workflows",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const workflow = await request.json();
    const created = await adapter.create(workflow);
    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create workflow",
      },
      { status: 500 },
    );
  }
}
