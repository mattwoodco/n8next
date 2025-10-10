export interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  triggers: Trigger[];
  actions: Action[];
  platformData?: unknown;
}

export interface Trigger {
  id: string;
  type: "webhook" | "schedule" | "manual";
  config: {
    path?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    cron?: string;
  };
  next: string[]; // action IDs
}

export interface Action {
  id: string;
  type: "http" | "email" | "transform";
  config: {
    url?: string;
    method?: string;
    to?: string;
    subject?: string;
  };
  next: string[];
}

export interface WorkflowAdapter {
  list(): Promise<Workflow[]>;
  get(id: string): Promise<Workflow>;
  create(workflow: Workflow): Promise<Workflow>;
  update(id: string, workflow: Partial<Workflow>): Promise<Workflow>;
  delete(id: string): Promise<void>;
  activate(id: string): Promise<Workflow>;
  deactivate(id: string): Promise<Workflow>;
  execute(id: string, data?: unknown): Promise<{ id: string; status: string }>;
}
