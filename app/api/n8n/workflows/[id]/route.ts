import { type NextRequest, NextResponse } from "next/server";
import { n8nFetch } from "@/lib/n8n";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const download = searchParams.get("download") === "true";

    const data = await n8nFetch(`/api/v1/workflows/${id}`);

    if (download) {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename=workflow-${id}.json`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    // Check if it's a 400-level error from n8n (validation/business logic error)
    let status = 500;
    if (error instanceof Error && error.message.includes("400 Bad Request")) {
      status = 400;
    } else if (
      error instanceof Error &&
      error.message.includes("404 Not Found")
    ) {
      status = 404;
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch workflow",
      },
      { status },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const data = await n8nFetch(`/api/v1/workflows/${id}`, {
      method: "PUT",
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
    } else if (
      error instanceof Error &&
      error.message.includes("404 Not Found")
    ) {
      status = 404;
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update workflow",
      },
      { status },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const data = await n8nFetch(`/api/v1/workflows/${id}`, {
      method: "DELETE",
    });

    return NextResponse.json(data);
  } catch (error) {
    // Check if it's a 400-level error from n8n (validation/business logic error)
    let status = 500;
    if (error instanceof Error && error.message.includes("400 Bad Request")) {
      status = 400;
    } else if (
      error instanceof Error &&
      error.message.includes("404 Not Found")
    ) {
      status = 404;
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete workflow",
      },
      { status },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    let endpoint: string;
    let body: string | undefined;

    switch (action) {
      case "activate":
        endpoint = `/api/v1/workflows/${id}/activate`;
        break;
      case "deactivate":
        endpoint = `/api/v1/workflows/${id}/deactivate`;
        break;
      case "execute":
        endpoint = `/api/v1/workflows/${id}/execute`;
        body = JSON.stringify(await request.json());
        break;
      default:
        return NextResponse.json(
          {
            error:
              "Invalid action. Supported actions: activate, deactivate, execute",
          },
          { status: 400 },
        );
    }

    const data = await n8nFetch(endpoint, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
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
          error instanceof Error ? error.message : "Failed to perform action",
      },
      { status },
    );
  }
}
