# Next8n - Universal Workflow API

Next.js-based Universal Workflow API with platform-agnostic format and adapter pattern. Currently supports n8n, designed to extend to other platforms.

## Architecture

This project uses a **Universal Workflow Format (UWF)** with an adapter pattern:

- **UWF Types** (`lib/uwf/types.ts`) - Platform-agnostic workflow representation
- **Adapters** (`lib/uwf/n8n-adapter.ts`) - Convert between UWF ↔ platform-specific formats
- **API Routes** (`app/api/workflows/**`) - Unified RESTful API
- **Tests** (`tests/api/workflows.test.ts`) - Comprehensive test suite (9 tests)

## Quick Start

```bash
bun install
bun run setup:n8n
bun dev
bun test tests/api/workflows.test.ts
```

## Universal Workflow API

### List Workflows

`GET /api/workflows`

Returns all workflows in UWF format.

**Response:**
```json
[
  {
    "id": "abc123",
    "name": "My Workflow",
    "enabled": true,
    "triggers": [...],
    "actions": [...],
    "platformData": {...}
  }
]
```

### Create Workflow

`POST /api/workflows`

**Request body:**
```json
{
  "id": "uuid",
  "name": "My Workflow",
  "enabled": false,
  "triggers": [{
    "id": "t1",
    "type": "webhook",
    "config": {
      "path": "/my-webhook",
      "method": "POST"
    },
    "next": ["a1"]
  }],
  "actions": [{
    "id": "a1",
    "type": "http",
    "config": {
      "url": "https://api.example.com",
      "method": "GET"
    },
    "next": []
  }]
}
```

### Get Workflow

`GET /api/workflows/:id`

Returns single workflow in UWF format.

### Update Workflow

`PUT /api/workflows/:id`

Updates workflow properties. Preserves `platformData` for perfect round-trips.

**Request body:**
```json
{
  "name": "Updated Name",
  "enabled": false,
  "triggers": [...],
  "actions": [...],
  "platformData": {...}
}
```

### Activate/Deactivate Workflow

`PATCH /api/workflows/:id`

**Activate:**
```json
{ "enabled": true }
```

**Deactivate:**
```json
{ "enabled": false }
```

### Delete Workflow

`DELETE /api/workflows/:id`

Removes workflow permanently.

## UWF Type Reference

### Workflow
```typescript
interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  triggers: Trigger[];
  actions: Action[];
  platformData?: unknown; // Preserves platform-specific data
}
```

### Trigger Types
- `webhook` - HTTP webhook trigger
- `schedule` - Cron-based schedule
- `manual` - Manual execution

### Action Types
- `http` - HTTP request
- `email` - Email send
- `transform` - Data transformation

## Platform Support

### Current: n8n
- Adapter: `lib/uwf/n8n-adapter.ts`
- Full CRUD support
- Activation/deactivation
- Perfect round-trip with `platformData`

### Future: Extensible
Add new platforms by implementing the `WorkflowAdapter` interface:

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

## Development

### Run Tests
```bash
bun test tests/api/workflows.test.ts
```

### Typecheck
```bash
bunx tsc --noEmit
```

### Lint
```bash
bun run lint
```

## n8n Access

n8n UI: http://localhost:5678

Login: `admin@example.com` / `Admin123`

## Reset n8n

```bash
docker compose down -v
rm .env.local
bun run setup:n8n
```

## Project Structure

```
lib/
  uwf/
    types.ts           # UWF type definitions
    n8n-adapter.ts     # n8n adapter implementation
  n8n.ts               # n8n HTTP client & types
app/
  api/
    workflows/
      route.ts         # GET, POST /api/workflows
      [id]/route.ts    # GET, PUT, PATCH, DELETE /api/workflows/:id
tests/
  api/
    workflows.test.ts  # Comprehensive API tests
```
