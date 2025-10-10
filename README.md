# Next8n Starter

Next.js API layer for n8n workflow management. Create, update, activate, and delete workflows programmatically.

## Installation

```bash
bun install
bun run setup:n8n
bun dev
./scripts/test-n8n-api.sh
```

## Validated APIs

### Health Check

`GET /api/n8n/health`

Verifies n8n connection.

### List Workflows

`GET /api/n8n/workflows`

Retrieves workflows with pagination (`?limit=N`).

### Create Workflow

`POST /api/n8n/workflows`

Creates workflows with nodes, connections, and webhook triggers.

### Get Workflow

`GET /api/n8n/workflows/:id`

Retrieves workflow details, sharing, and permissions.

### Update Workflow

`PUT /api/n8n/workflows/:id`

Updates workflow configuration.

### Activate Workflow

`POST /api/n8n/workflows/:id?action=activate`

Enables workflow execution. Returns `active: true`.

### Deactivate Workflow

`POST /api/n8n/workflows/:id?action=deactivate`

Disables workflow execution. Returns `active: false`.

### Delete Workflow

`DELETE /api/n8n/workflows/:id`

Removes workflow.

## Access

n8n UI: <http://localhost:5678>

Login: `admin@example.com` / `Admin123`

## Reset

```bash
docker compose down -v
rm .env.local
bun run setup:n8n
```
