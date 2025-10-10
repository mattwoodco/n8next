# next8n

Universal workflow API with adapter pattern. Write once, run anywhere.

Platform-agnostic workflow orchestration built on Next.js. Currently supports n8n, designed for extensibility.

## Quick Start

```bash
bun install && bun run setup:n8n && bun dev
# n8n UI → http://localhost:5678 (admin@example.com / Admin123)
# API → http://localhost:3000/api/workflows
```

## Architecture

**UWF (Universal Workflow Format)** → **Adapters** → **Platforms**

```
lib/uwf/types.ts          # Platform-agnostic types
lib/uwf/n8n-adapter.ts    # n8n ↔ UWF converter
app/api/workflows/**      # RESTful CRUD
```

## API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/workflows` | List all |
| `POST` | `/api/workflows` | Create |
| `GET` | `/api/workflows/:id` | Get one |
| `PUT` | `/api/workflows/:id` | Update |
| `PATCH` | `/api/workflows/:id` | Activate/deactivate |
| `DELETE` | `/api/workflows/:id` | Delete |

<details>
<summary>Example: Create Workflow</summary>

```json
POST /api/workflows
{
  "id": "uuid",
  "name": "Webhook → HTTP",
  "enabled": false,
  "triggers": [{
    "id": "t1",
    "type": "webhook",
    "config": { "path": "/hook", "method": "POST" },
    "next": ["a1"]
  }],
  "actions": [{
    "id": "a1",
    "type": "http",
    "config": { "url": "https://api.example.com", "method": "GET" },
    "next": []
  }]
}
```
</details>

<details>
<summary>UWF Type Reference</summary>

```typescript
interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  triggers: Trigger[];  // webhook | schedule | manual
  actions: Action[];    // http | email | transform
  platformData?: unknown; // Preserves native format
}
```

**Triggers**: `webhook`, `schedule`, `manual`
**Actions**: `http`, `email`, `transform`
</details>

## Extend to New Platforms

Implement `WorkflowAdapter`:

```typescript
interface WorkflowAdapter {
  list(): Promise<Workflow[]>;
  get(id: string): Promise<Workflow>;
  create(workflow: Workflow): Promise<Workflow>;
  update(id: string, updates: Partial<Workflow>): Promise<Workflow>;
  delete(id: string): Promise<void>;
  activate(id: string): Promise<Workflow>;
  deactivate(id: string): Promise<Workflow>;
  execute(id: string, data?: unknown): Promise<{ id: string; status: string }>;
}
```

See `lib/uwf/n8n-adapter.ts` for reference.

## Development

```bash
bun test tests/api/workflows.test.ts  # Run tests
bunx tsc --noEmit                      # Typecheck
bun run lint                            # Lint
```

**Reset n8n**: `docker compose down -v && rm .env.local && bun run setup:n8n`
