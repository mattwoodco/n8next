// Types
export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters: Record<string, unknown>;
  [key: string]: unknown;
}

// Helper function
export async function n8nFetch(
  endpoint: string,
  options?: RequestInit,
): Promise<unknown> {
  const protocol = process.env.N8N_PROTOCOL || "http";
  const host = process.env.N8N_HOST || "localhost";
  const port = process.env.N8N_PORT || "5678";
  const apiKey = process.env.N8N_API_KEY;
  const timeout = Number(process.env.N8N_API_TIMEOUT) || 10000;

  if (!apiKey) {
    throw new Error("N8N_API_KEY environment variable is not set");
  }

  const url = `${protocol}://${host}:${port}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "X-N8N-API-KEY": apiKey,
        ...options?.headers,
      },
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      let errorMessage = `n8n API error: ${response.status} ${response.statusText}`;

      // Try to get error details from response body
      try {
        const errorBody = await response.json();
        if (errorBody.message) {
          errorMessage += ` - ${errorBody.message}`;
        }
      } catch {
        // If we can't parse the error body, just use the status
      }

      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch from n8n: ${error.message}`);
    }
    throw error;
  }
}
