import { type N8nWorkflow, n8nFetch } from "@/lib/n8n";
import type { Workflow, WorkflowAdapter } from "./types";

export class N8nAdapter implements WorkflowAdapter {
  async list(): Promise<Workflow[]> {
    const { data } = (await n8nFetch("/api/v1/workflows")) as {
      data: N8nWorkflow[];
    };
    return data.map((wf) => this.toUWF(wf));
  }

  async get(id: string): Promise<Workflow> {
    const wf = (await n8nFetch(`/api/v1/workflows/${id}`)) as N8nWorkflow;
    return this.toUWF(wf);
  }

  async create(workflow: Workflow): Promise<Workflow> {
    const n8nWf = this.fromUWF(workflow);
    // Remove 'active' field for creation (n8n doesn't allow it on POST)
    // biome-ignore lint/correctness/noUnusedVariables: active is intentionally destructured out
    const { active, ...createPayload } = n8nWf;
    const created = (await n8nFetch("/api/v1/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    })) as N8nWorkflow;

    // If workflow should be enabled, activate it after creation
    if (workflow.enabled) {
      return this.activate(created.id);
    }

    return this.toUWF(created);
  }

  async update(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    const current = await this.get(id);
    const merged = { ...current, ...updates };
    const n8nWf = this.fromUWF(merged);

    const updated = (await n8nFetch(`/api/v1/workflows/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nWf),
    })) as N8nWorkflow;

    return this.toUWF(updated);
  }

  async delete(id: string): Promise<void> {
    await n8nFetch(`/api/v1/workflows/${id}`, { method: "DELETE" });
  }

  async activate(id: string): Promise<Workflow> {
    const wf = (await n8nFetch(`/api/v1/workflows/${id}/activate`, {
      method: "POST",
    })) as N8nWorkflow;
    return this.toUWF(wf);
  }

  async deactivate(id: string): Promise<Workflow> {
    const wf = (await n8nFetch(`/api/v1/workflows/${id}/deactivate`, {
      method: "POST",
    })) as N8nWorkflow;
    return this.toUWF(wf);
  }

  async execute(id: string, data?: unknown) {
    const result = (await n8nFetch(`/api/v1/workflows/${id}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data || {}),
    })) as { id: string; finished: boolean };

    return {
      id: result.id,
      status: result.finished ? "success" : "running",
    };
  }

  private toUWF(n8n: N8nWorkflow): Workflow {
    const triggers = n8n.nodes
      .filter((n) => n.type.includes("trigger") || n.type.includes("webhook"))
      .map((n) => ({
        id: n.id,
        type: this.mapTriggerType(n.type),
        config: n.parameters,
        next: this.getNextNodes(n.name, n8n.connections),
      }));

    const actions = n8n.nodes
      .filter((n) => !n.type.includes("trigger") && !n.type.includes("webhook"))
      .map((n) => ({
        id: n.id,
        type: this.mapActionType(n.type),
        config: n.parameters,
        next: this.getNextNodes(n.name, n8n.connections),
      }));

    return {
      id: n8n.id,
      name: n8n.name,
      enabled: n8n.active,
      triggers,
      actions,
      platformData: n8n,
    };
  }

  private fromUWF(wf: Workflow): Partial<N8nWorkflow> {
    // If platformData exists, use it for perfect round-trip
    if (wf.platformData) {
      const n8n = wf.platformData as N8nWorkflow;
      // Only include fields that n8n accepts on PUT (exclude read-only fields like 'active', 'id', etc)
      // Note: 'active' is read-only and must be set via /activate or /deactivate endpoints
      return {
        name: wf.name,
        nodes: n8n.nodes,
        connections: n8n.connections,
        settings: n8n.settings,
      };
    }

    // Otherwise build from scratch
    const nodes = [
      ...wf.triggers.map((t) => ({
        id: t.id,
        name: t.id,
        type: this.mapToN8nType(t.type),
        position: [250, 300] as [number, number],
        parameters: t.config,
      })),
      ...wf.actions.map((a) => ({
        id: a.id,
        name: a.id,
        type: this.mapToN8nType(a.type),
        position: [450, 300] as [number, number],
        parameters: a.config,
      })),
    ];

    const connections: Record<string, unknown> = {};
    [...wf.triggers, ...wf.actions].forEach((node) => {
      if (node.next.length > 0) {
        connections[node.id] = {
          main: [node.next.map((id) => ({ node: id, type: "main", index: 0 }))],
        };
      }
    });

    return { name: wf.name, nodes, connections, settings: {} };
  }

  private mapTriggerType(n8nType: string): "webhook" | "schedule" | "manual" {
    if (n8nType.includes("webhook")) return "webhook";
    if (n8nType.includes("schedule")) return "schedule";
    return "manual";
  }

  private mapActionType(n8nType: string): "http" | "email" | "transform" {
    if (n8nType.includes("http")) return "http";
    if (n8nType.includes("email")) return "email";
    return "transform";
  }

  private mapToN8nType(type: string): string {
    const map: Record<string, string> = {
      webhook: "n8n-nodes-base.webhook",
      schedule: "n8n-nodes-base.scheduleTrigger",
      manual: "n8n-nodes-base.manualTrigger",
      http: "n8n-nodes-base.httpRequest",
      email: "n8n-nodes-base.emailSend",
      transform: "n8n-nodes-base.set",
    };
    return map[type] || "n8n-nodes-base.function";
  }

  private getNextNodes(
    nodeName: string,
    connections: Record<string, unknown>,
  ): string[] {
    const conn = connections[nodeName] as {
      main?: Array<Array<{ node: string }>>;
    };
    return conn?.main?.[0]?.map((c) => c.node) || [];
  }
}
