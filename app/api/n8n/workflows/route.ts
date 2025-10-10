import { type NextRequest, NextResponse } from "next/server";
import { n8nFetch } from "@/lib/n8n";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `/api/v1/workflows?${queryString}`
      : "/api/v1/workflows";

    const data = await n8nFetch(endpoint);
    return NextResponse.json(data);
  } catch (error) {
    // Check if it's a 400-level error from n8n (validation/business logic error)
    let status = 500;
    if (error instanceof Error && error.message.includes("400 Bad Request")) {
      status = 400;
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch workflows",
      },
      { status },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const data = await n8nFetch("/api/v1/workflows", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return NextResponse.json(data);
  } catch (error) {
    // Check if it's a 400-level error from n8n (validation/business logic error)
    let status = 500;
    if (error instanceof Error && error.message.includes("400 Bad Request")) {
      status = 400;
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create workflow",
      },
      { status },
    );
  }
}
