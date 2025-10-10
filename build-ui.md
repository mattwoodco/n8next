# Unified CRUD + Execution UI Build Plan

## Scope: Option B - CRUD + Basic Execution

This plan consolidates workflow CRUD operations with basic execution capabilities, optimized for parallel subagent execution.

---

## Context Review

### Existing Backend (Already Complete)
**CRUD Operations:**
- `GET /api/workflows` - List all workflows
- `POST /api/workflows` - Create workflow
- `GET /api/workflows/[id]` - Get single workflow
- `PUT /api/workflows/[id]` - Update workflow
- `DELETE /api/workflows/[id]` - Delete workflow
- `PATCH /api/workflows/[id]` - Toggle enabled/disabled

**Execution (Adapter only, needs routes):**
- `adapter.execute(id, data)` - Triggers workflow execution
- Returns: `{ id: string, status: "success" | "running" }`
- n8n API: `POST /api/v1/workflows/{id}/execute`
- n8n API: `GET /api/v1/executions/{id}` - Check execution status

### UWF Schema
```typescript
interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  triggers: Trigger[];
  actions: Action[];
}

interface Trigger {
  id: string;
  type: "webhook" | "schedule" | "manual";
  config: { path?, method?, cron? };
  next: string[];
}

interface Action {
  id: string;
  type: "http" | "email" | "transform";
  config: { url?, method?, to?, subject? };
  next: string[];
}
```

### Demo Workflow Template
**Target: Demo #6 (Lead Capture & CRM Sync)**
- 1 webhook trigger
- 4 actions (transform, http, 2x email)
- Simplest universal demo for CRUD testing

---

## What We're Building

### CRUD Features
1. ✅ **List Workflows** - Grid of workflow cards
2. ✅ **Create Workflow** - Form with name + enabled fields
3. ✅ **Update Workflow** - Edit name/enabled via same form
4. ✅ **Delete Workflow** - Confirmation + delete
5. ✅ **Toggle Enabled** - Switch in card

### Execution Features (NEW)
6. ✅ **Execute Workflow** - "Run" button triggers execution
7. ✅ **Execution Status** - Real-time polling with status badge
8. ✅ **Last Run Display** - Show last execution result in card

### Out of Scope
- ❌ Visual workflow builder
- ❌ Trigger/action editors (hardcoded Demo #6)
- ❌ Execution history list (Phase 2)
- ❌ Detailed execution logs (Phase 3)
- ❌ Manual webhook payload input

---

## Complete File Structure

```
app/
  page.tsx                                # ← UPDATE: Client component + layout
  api/
    workflows/[id]/
      execute/
        route.ts                          # ← NEW: Execute workflow endpoint
    executions/
      [id]/
        route.ts                          # ← NEW: Poll execution status

components/
  workflow-list.tsx                       # ← NEW: Main list component
  workflow-card.tsx                       # ← NEW: Individual workflow card
  workflow-form.tsx                       # ← NEW: Create/Edit form
  execute-workflow-button.tsx             # ← NEW: Run button with status
  execution-status-badge.tsx              # ← NEW: Status indicator

lib/
  workflow-template.ts                    # ← NEW: Demo #6 template
  schemas/
    workflow-schema.ts                    # ← NEW: Zod validation
  hooks/
    use-execution-polling.ts              # ← NEW: Poll execution status
  uwf/
    n8n-adapter.ts                        # ← UPDATE: Add execution methods
    types.ts                              # ← UPDATE: Add execution types
```

**New files: 10**
**Updated files: 3**

---

## Optimized Parallel Subagent Strategy

### Key Insight: Dependency Analysis
After analyzing all components, I've identified **3 dependency layers**:

**Layer 0 (No dependencies):**
- Foundation files (schemas, templates, types)
- Backend API routes

**Layer 1 (Depends on Layer 0):**
- Atomic components (badge, button)
- Hooks (polling)

**Layer 2 (Depends on Layer 0 + 1):**
- Composite components (card, form, list)
- Page integration

### Optimal Execution: 3 Parallel Waves

---

## Wave 1: Foundation (6 agents in parallel)

### Agent 1A: Workflow Template
**File:** `lib/workflow-template.ts`

**Task:**
```typescript
// Export Demo #6 workflow structure as constant
// Include all triggers and actions from demos.md
// Type: Omit<Workflow, 'id' | 'name' | 'enabled'>
```

**Dependencies:** None
**Estimated time:** 5 mins

---

### Agent 1B: Zod Schema
**File:** `lib/schemas/workflow-schema.ts`

**Task:**
```typescript
// Create form validation schema
// Fields: name (string, min 3 chars), enabled (boolean)
// Export formSchema and inferred FormData type
```

**Dependencies:** None
**Estimated time:** 5 mins

---

### Agent 1C: Execution Types
**Files:** `lib/uwf/types.ts` (update), `lib/uwf/n8n-adapter.ts` (update)

**Task:**
```typescript
// Add to types.ts:
interface ExecutionResult {
  id: string;
  workflowId: string;
  finished: boolean;
  status: "running" | "success" | "error";
  startedAt: Date;
  stoppedAt?: Date;
}

// Add to n8n-adapter.ts:
async getExecution(executionId: string): Promise<ExecutionResult>
```

**Dependencies:** None
**Estimated time:** 10 mins

---

### Agent 1D: Execute API Route
**File:** `app/api/workflows/[id]/execute/route.ts`

**Task:**
```typescript
// POST handler
// Call adapter.execute(id, {})
// Return { executionId, status }
// Error handling with 500 response
```

**Dependencies:** None (uses existing adapter)
**Estimated time:** 8 mins

---

### Agent 1E: Execution Status API Route
**File:** `app/api/executions/[id]/route.ts`

**Task:**
```typescript
// GET handler
// Call adapter.getExecution(id)
// Return execution result with status
// Error handling with 404/500 responses
```

**Dependencies:** Agent 1C (for types, but can work concurrently)
**Estimated time:** 8 mins

---

### Agent 1F: Execution Polling Hook
**File:** `lib/hooks/use-execution-polling.ts`

**Task:**
```typescript
// Custom React hook
// Polls GET /api/executions/[id] every 2 seconds
// Returns { status, isPolling, error }
// Stops polling when finished === true
// Cleanup on unmount
```

**Dependencies:** None
**Estimated time:** 12 mins

---

## Wave 2: Atomic Components (3 agents in parallel)

**Wait for:** Wave 1 completion (especially schemas and types)

### Agent 2A: Execution Status Badge
**File:** `components/execution-status-badge.tsx`

**Task:**
```tsx
// Badge component with status prop
// Color coding: running (blue), success (green), error (red)
// Icons: Loader2 (spinning), CheckCircle2, XCircle
// Props: status, showIcon, className
```

**Dependencies:** Wave 1 (types)
**Estimated time:** 8 mins

---

### Agent 2B: Execute Workflow Button
**File:** `components/execute-workflow-button.tsx`

**Task:**
```tsx
// "Run" button component
// Props: workflowId, workflowName, onExecutionStart
// POST to /api/workflows/[id]/execute
// Loading state during execution
// Toast on success/error
// Returns executionId to parent
```

**Dependencies:** Wave 1 (types, polling hook)
**Estimated time:** 15 mins

---

### Agent 2C: Workflow Form
**File:** `components/workflow-form.tsx`

**Task:**
```tsx
// React Hook Form with Zod resolver
// Props: mode ("create" | "edit"), workflow?, onSuccess
// Fields: name (Input), enabled (Switch)
// Submit: POST /api/workflows or PUT /api/workflows/[id]
// Merge workflow-template.ts with form data
// Toast notifications
```

**Dependencies:** Wave 1 (schema, template)
**Estimated time:** 20 mins

---

## Wave 3: Composite Components + Integration (3 agents in parallel)

**Wait for:** Wave 2 completion

### Agent 3A: Workflow Card
**File:** `components/workflow-card.tsx`

**Task:**
```tsx
// Card component displaying single workflow
// Props: workflow, onEdit, onDelete, onToggle, onExecute
// Shows: name, enabled badge, last execution status
// Buttons: Run, Edit, Delete
// Toggle: enabled switch
// Uses: ExecuteWorkflowButton, ExecutionStatusBadge
// Integrates: use-execution-polling for last run
```

**Dependencies:** Wave 2 (button, badge components)
**Estimated time:** 25 mins

---

### Agent 3B: Workflow List
**File:** `components/workflow-list.tsx`

**Task:**
```tsx
// Main list component
// Fetch: GET /api/workflows
// Map to WorkflowCard components
// Empty state: "No workflows" + Create button
// Loading state: Skeleton components
// Handles: delete, toggle, execute actions
// Optimistic updates for better UX
```

**Dependencies:** Wave 2 (form), Wave 3A (card)
**Estimated time:** 25 mins

---

### Agent 3C: Homepage Integration
**File:** `app/page.tsx`

**Task:**
```tsx
// "use client" component
// Layout: Header + WorkflowList
// "Create Workflow" button → modal/dialog
// State management for CRUD operations
// Responsive design (Tailwind v4)
// Dark mode support
```

**Dependencies:** Wave 3B (list component)
**Estimated time:** 20 mins

---

## Execution Timeline

### Wave 1 (Parallel: 6 agents)
- Duration: ~12 minutes (longest agent: 1F)
- Blockers: None
- Output: Foundation complete

### Wave 2 (Parallel: 3 agents)
- Duration: ~20 minutes (longest agent: 2C)
- Blockers: Wave 1
- Output: Atomic components ready

### Wave 3 (Parallel: 3 agents)
- Duration: ~25 minutes (longest agents: 3A, 3B)
- Blockers: Wave 2
- Output: Full UI complete

### Testing & Polish
- Duration: ~15 minutes
- Tasks: TypeScript check, dev server test, bug fixes

### **Total Estimated Time: ~72 minutes (~1.2 hours)**

---

## Detailed Agent Instructions

### Wave 1A: Workflow Template
```markdown
Create `lib/workflow-template.ts`

Export a constant `DEMO_WORKFLOW_TEMPLATE` with the complete Demo #6
structure from demos.md (Lead Capture & CRM Sync).

Include:
- 1 webhook trigger (form-webhook)
- 4 actions (transform-lead, post-to-crm, send-welcome-email, notify-sales-team)

Type: `Omit<Workflow, 'id' | 'name' | 'enabled'>`

Full structure with proper next[] connections.
```

---

### Wave 1B: Zod Schema
```markdown
Create `lib/schemas/workflow-schema.ts`

Export:
1. `formSchema` - Zod object with:
   - name: z.string().min(3, "Name must be at least 3 characters")
   - enabled: z.boolean().default(true)

2. `FormData` type inferred from schema

Use zod v4 syntax (already installed).
```

---

### Wave 1C: Execution Types
```markdown
Update `lib/uwf/types.ts`:
Add ExecutionResult interface with fields:
- id, workflowId, finished, status, startedAt, stoppedAt

Update `lib/uwf/n8n-adapter.ts`:
Add method:
```typescript
async getExecution(executionId: string): Promise<ExecutionResult> {
  const result = await n8nFetch(`/api/v1/executions/${executionId}`);
  return {
    id: result.id,
    workflowId: result.workflowId,
    finished: result.finished,
    status: result.finished
      ? (result.data.resultData?.error ? 'error' : 'success')
      : 'running',
    startedAt: new Date(result.startedAt),
    stoppedAt: result.stoppedAt ? new Date(result.stoppedAt) : undefined
  };
}
```
```

---

### Wave 1D: Execute API Route
```markdown
Create `app/api/workflows/[id]/execute/route.ts`

POST handler:
- Import N8nAdapter
- Call adapter.execute(id, {})
- Return JSON: { executionId: result.id, status: result.status }
- Error handling with try/catch, 500 status
- Type Context = { params: Promise<{ id: string }> }
```

---

### Wave 1E: Execution Status API Route
```markdown
Create `app/api/executions/[id]/route.ts`

GET handler:
- Import N8nAdapter
- Call adapter.getExecution(id)
- Return JSON: execution result
- Error handling: 404 if not found, 500 on error
- Type Context = { params: Promise<{ id: string }> }
```

---

### Wave 1F: Execution Polling Hook
```markdown
Create `lib/hooks/use-execution-polling.ts`

Custom React hook: `useExecutionPolling(executionId: string | null)`

Returns: { status, isPolling, error }

Logic:
- Poll GET /api/executions/[id] every 2 seconds
- Stop polling when finished === true or executionId is null
- useEffect with interval and cleanup
- Handle errors gracefully
```

---

### Wave 2A: Execution Status Badge
```markdown
Create `components/execution-status-badge.tsx`

Props: { status: "running" | "success" | "error", showIcon?: boolean }

Use @/components/ui/badge
Colors:
- running: blue variant
- success: green variant (or default)
- error: red/destructive variant

Icons from lucide-react:
- running: Loader2 (with animate-spin)
- success: CheckCircle2
- error: XCircle

Small, compact design.
```

---

### Wave 2B: Execute Workflow Button
```markdown
Create `components/execute-workflow-button.tsx`

Props: { workflowId: string, workflowName: string, onExecutionStart?: (id: string) => void }

Features:
- Button with Play icon from lucide-react
- onClick: POST to /api/workflows/[id]/execute
- Loading state while executing
- Toast from sonner on success/error
- Return executionId to parent via callback

States:
- Idle: "Run"
- Loading: "Running..." with spinner
- Success: Toast "Workflow started"
```

---

### Wave 2C: Workflow Form
```markdown
Create `components/workflow-form.tsx`

Props: {
  mode: "create" | "edit",
  workflow?: Workflow,
  onSuccess: () => void
}

Use:
- react-hook-form with zodResolver
- @/lib/schemas/workflow-schema
- @/lib/workflow-template (merge with form data)
- @/components/ui/input, switch, label, button
- sonner for toasts

Form fields:
1. Name (Input)
2. Enabled (Switch)

Submit logic:
- CREATE: POST /api/workflows with { ...formData, ...DEMO_WORKFLOW_TEMPLATE }
- EDIT: PUT /api/workflows/[id] with { ...workflow, ...formData }

Error handling with toast.
```

---

### Wave 3A: Workflow Card
```markdown
Create `components/workflow-card.tsx`

Props: {
  workflow: Workflow,
  onEdit: () => void,
  onDelete: () => void,
  onToggle: () => void,
  onExecutionStart?: (id: string) => void
}

Layout:
- Card with workflow name (heading)
- Enabled badge
- Last execution status (use ExecutionStatusBadge)
- Buttons: ExecuteWorkflowButton, Edit, Delete
- Switch for enabled/disabled (calls onToggle)

Use:
- @/components/execute-workflow-button
- @/components/execution-status-badge
- @/lib/hooks/use-execution-polling (track last execution)
- lucide-react icons (Pencil, Trash2)
- @/components/ui/button, badge, switch

Responsive, compact design.
```

---

### Wave 3B: Workflow List
```markdown
Create `components/workflow-list.tsx`

Functionality:
- Fetch GET /api/workflows on mount
- Map to WorkflowCard components
- Empty state: "No workflows yet" + Create button
- Loading state: Skeleton components
- Handle CRUD operations:
  - Delete: confirmation toast → DELETE /api/workflows/[id]
  - Toggle: PATCH /api/workflows/[id]
  - Edit: open WorkflowForm in dialog
  - Create: WorkflowForm dialog

Use:
- @/components/workflow-card
- @/components/workflow-form
- @/components/ui/skeleton
- @/components/ui/button
- sonner for confirmations
- React state for workflows

Optimistic updates for better UX.
Grid layout, responsive.
```

---

### Wave 3C: Homepage Integration
```markdown
Update `app/page.tsx`

Convert to client component ("use client")

Layout:
- Header: "Next8n - Workflow Builder"
- "Create Workflow" button (opens dialog)
- WorkflowList component

Use:
- @/components/workflow-list
- Tailwind v4 styling
- Responsive padding, gap, grid

Clean, modern design.
Dark mode compatible (next-themes already configured).
```

---

## Success Criteria

### CRUD Operations
- ✅ List workflows with loading/empty states
- ✅ Create workflow with Demo #6 template
- ✅ Edit workflow name and enabled status
- ✅ Delete workflow with confirmation
- ✅ Toggle enabled/disabled status

### Execution Operations
- ✅ Execute workflow via "Run" button
- ✅ Show real-time status (running → success/error)
- ✅ Poll execution status every 2 seconds
- ✅ Display last execution result in card
- ✅ Toast notifications on execution events

### Code Quality
- ✅ TypeScript strict mode, no `any` casts
- ✅ Proper error handling with try/catch
- ✅ Loading states for all async operations
- ✅ Optimistic updates where applicable
- ✅ Accessible forms and buttons
- ✅ Tailwind v4 styling, responsive design
- ✅ Dark mode support

---

## User Flow

1. **Load Page** → See workflow list or empty state
2. **Click "Create"** → Form dialog opens
3. **Enter name, toggle enabled** → Submit
4. **Workflow created** → Appears in list with Demo #6 structure
5. **Click "Run"** → Execution starts
6. **Status badge shows "Running..."** → Polls every 2s
7. **Execution completes** → Badge shows "Success ✓" or "Error ✗"
8. **Click toggle** → Enabled/disabled status updates
9. **Click "Edit"** → Form prefills, user updates, submits
10. **Click "Delete"** → Confirmation → Workflow removed

---

## Dependencies (Already Installed)

- ✅ react-hook-form
- ✅ @hookform/resolvers (Zod)
- ✅ zod v4
- ✅ sonner (toasts)
- ✅ lucide-react (icons)
- ✅ All shadcn components (button, badge, input, etc.)

---

## Deployment Checklist

### Before Starting
- [ ] n8n instance running on localhost:5678
- [ ] N8N_API_KEY environment variable set
- [ ] Dev server available (or will start on :3000)

### Wave 1 Completion
- [ ] All foundation files created
- [ ] TypeScript compiles without errors
- [ ] API routes respond to test calls

### Wave 2 Completion
- [ ] Atomic components render in isolation
- [ ] No TypeScript errors
- [ ] Components accept correct props

### Wave 3 Completion
- [ ] Homepage renders without errors
- [ ] Can create workflow via form
- [ ] Can execute workflow and see status
- [ ] All CRUD operations work

### Final Polish
- [ ] No console errors or warnings
- [ ] Responsive design tested (mobile/desktop)
- [ ] Dark mode works correctly
- [ ] Error states display properly
- [ ] Loading states smooth
- [ ] Toast notifications work

---

## Parallel Execution Command

When ready to execute, launch agents in waves:

**Wave 1 (6 agents):**
```
Agent 1A: lib/workflow-template.ts
Agent 1B: lib/schemas/workflow-schema.ts
Agent 1C: lib/uwf/types.ts + n8n-adapter.ts
Agent 1D: app/api/workflows/[id]/execute/route.ts
Agent 1E: app/api/executions/[id]/route.ts
Agent 1F: lib/hooks/use-execution-polling.ts
```

**Wave 2 (3 agents):**
```
Agent 2A: components/execution-status-badge.tsx
Agent 2B: components/execute-workflow-button.tsx
Agent 2C: components/workflow-form.tsx
```

**Wave 3 (3 agents):**
```
Agent 3A: components/workflow-card.tsx
Agent 3B: components/workflow-list.tsx
Agent 3C: app/page.tsx
```

---

## Notes

- Hardcoded Demo #6 template keeps scope minimal
- No visual workflow builder (future enhancement)
- No execution history list (Phase 2 feature)
- No detailed logs viewer (Phase 3 feature)
- Polling strategy is simple but effective
- Can upgrade to SSE/WebSocket later if needed

---

**Total Files:** 13 (10 new, 3 updated)
**Total Time:** ~72 minutes with parallel execution
**Phases:** 3 waves of parallel agents
