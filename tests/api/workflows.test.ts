import { afterEach, beforeAll, describe, expect, test } from "bun:test";

const API_BASE = "http://localhost:3000/api/workflows";
const createdIds: string[] = [];

// Helper: Create minimal UWF workflow
function createMinimalWorkflow(name: string) {
  return {
    id: crypto.randomUUID(),
    name,
    enabled: false,
    triggers: [
      {
        id: crypto.randomUUID(),
        type: "webhook" as const,
        config: {
          path: `/${crypto.randomUUID()}`,
          method: "POST" as const,
        },
        next: [],
      },
    ],
    actions: [
      {
        id: crypto.randomUUID(),
        type: "transform" as const,
        config: {},
        next: [],
      },
    ],
  };
}

// Helper: Track created workflow for cleanup
function trackWorkflow(id: string) {
  createdIds.push(id);
}

// Cleanup after each test
afterEach(async () => {
  for (const id of createdIds) {
    try {
      await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    } catch {}
  }
  createdIds.length = 0;
});

beforeAll(async () => {
  // Verify dev server is running
  const res = await fetch(API_BASE);
  expect(res.ok).toBe(true);
});

describe("Workflow CRUD", () => {
  test("GET /api/workflows - list workflows", async () => {
    const res = await fetch(API_BASE);
    expect(res.ok).toBe(true);
    const workflows = await res.json();
    expect(Array.isArray(workflows)).toBe(true);
    if (workflows.length > 0) {
      expect(workflows[0]).toHaveProperty("id");
      expect(workflows[0]).toHaveProperty("name");
      expect(workflows[0]).toHaveProperty("enabled");
      expect(workflows[0]).toHaveProperty("triggers");
      expect(workflows[0]).toHaveProperty("actions");
    }
  });

  test("POST /api/workflows - create workflow", async () => {
    const workflow = createMinimalWorkflow("Test Workflow");
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workflow),
    });
    expect(res.ok).toBe(true);
    const created = await res.json();
    expect(created).toHaveProperty("id");
    expect(created.name).toBe("Test Workflow");
    expect(created).toHaveProperty("platformData");
    trackWorkflow(created.id);
  });

  test("GET /api/workflows/:id - get workflow", async () => {
    // Create workflow first
    const workflow = createMinimalWorkflow("Get Test");
    const createRes = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workflow),
    });
    const created = await createRes.json();
    trackWorkflow(created.id);

    // Get workflow
    const res = await fetch(`${API_BASE}/${created.id}`);
    expect(res.ok).toBe(true);
    const fetched = await res.json();
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe("Get Test");
  });

  test("GET /api/workflows/:id - 404 for non-existent", async () => {
    const res = await fetch(`${API_BASE}/nonexistent-id`);
    expect(res.status).toBe(404);
  });

  test("PUT /api/workflows/:id - update workflow", async () => {
    // Create workflow
    const workflow = createMinimalWorkflow("Update Test");
    const createRes = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workflow),
    });
    const created = await createRes.json();
    trackWorkflow(created.id);

    // Update workflow
    const updated = { ...created, name: "Updated Name" };
    const res = await fetch(`${API_BASE}/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    expect(res.ok).toBe(true);
    const result = await res.json();
    expect(result.name).toBe("Updated Name");
    expect(result).toHaveProperty("platformData");
  });

  test("PATCH /api/workflows/:id - activate", async () => {
    // Create workflow
    const workflow = createMinimalWorkflow("Activate Test");
    const createRes = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workflow),
    });
    const created = await createRes.json();
    trackWorkflow(created.id);

    // Activate
    const res = await fetch(`${API_BASE}/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
    expect(res.ok).toBe(true);
    const activated = await res.json();
    expect(activated.enabled).toBe(true);
  });

  test("PATCH /api/workflows/:id - deactivate", async () => {
    // Create and activate workflow
    const workflow = createMinimalWorkflow("Deactivate Test");
    const createRes = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workflow),
    });
    const created = await createRes.json();
    trackWorkflow(created.id);

    await fetch(`${API_BASE}/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });

    // Deactivate
    const res = await fetch(`${API_BASE}/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.ok).toBe(true);
    const deactivated = await res.json();
    expect(deactivated.enabled).toBe(false);
  });

  test("DELETE /api/workflows/:id - delete workflow", async () => {
    // Create workflow
    const workflow = createMinimalWorkflow("Delete Test");
    const createRes = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workflow),
    });
    const created = await createRes.json();

    // Delete
    const deleteRes = await fetch(`${API_BASE}/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.ok).toBe(true);

    // Verify deleted
    const getRes = await fetch(`${API_BASE}/${created.id}`);
    expect(getRes.status).toBe(404);
  });

  test("Round-trip: create -> get -> update -> get -> delete", async () => {
    // Create
    const workflow = createMinimalWorkflow("Round Trip Test");
    const createRes = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workflow),
    });
    const created = await createRes.json();
    const _originalPlatformData = created.platformData;
    trackWorkflow(created.id);

    // Get
    const getRes1 = await fetch(`${API_BASE}/${created.id}`);
    const fetched1 = await getRes1.json();
    expect(fetched1.name).toBe("Round Trip Test");

    // Update
    const updated = { ...fetched1, name: "Updated Round Trip" };
    const updateRes = await fetch(`${API_BASE}/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    const _updatedResult = await updateRes.json();

    // Get again
    const getRes2 = await fetch(`${API_BASE}/${created.id}`);
    const fetched2 = await getRes2.json();
    expect(fetched2.name).toBe("Updated Round Trip");
    expect(fetched2.platformData).toBeDefined();

    // Delete
    const deleteRes = await fetch(`${API_BASE}/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.ok).toBe(true);

    // Verify deleted
    const getRes3 = await fetch(`${API_BASE}/${created.id}`);
    expect(getRes3.status).toBe(404);
  });
});
