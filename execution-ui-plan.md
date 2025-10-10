# Workflow Execution UI Plan

## Current State Analysis

### ✅ Already Implemented
- `adapter.execute(id, data)` - Triggers workflow execution
- Returns: `{ id: string, status: "success" | "running" }`
- n8n API: `POST /api/v1/workflows/{id}/execute`

### ❌ Missing for Real-Time Updates
1. **Execution status polling** - Need to check if execution finished
2. **Execution history** - List of past executions
3. **Execution details** - View logs, outputs, errors for each step
4. **Live progress** - Real-time updates as workflow executes

---

## What We Need to Add

### Backend: API Routes

#### 1. Execute Workflow (Already exists in adapter, need route)
```typescript
// POST /api/workflows/[id]/execute
// Body: { data?: unknown }
// Returns: { executionId: string, status: string }
```

#### 2. Get Execution Status
```typescript
// GET /api/executions/[executionId]
// Returns: {
//   id: string,
//   workflowId: string,
//   status: "running" | "success" | "error" | "waiting",
//   startedAt: string,
//   stoppedAt?: string,
//   data: {
//     resultData: { runData: {...} }, // Step-by-step results
//     executionData?: unknown
//   }
// }
```

#### 3. List Executions for Workflow
```typescript
// GET /api/workflows/[id]/executions
// Returns: {
//   data: Array<{
//     id: string,
//     finished: boolean,
//     mode: "manual" | "webhook" | "trigger",
//     startedAt: string,
//     stoppedAt?: string,
//     status: string
//   }>
// }
```

#### 4. Get Execution Details (Full logs)
```typescript
// GET /api/executions/[executionId]/details
// Returns full execution data including:
// - Each node's input/output
// - Timing information
// - Error details if failed
```

---

### Frontend: UI Components

#### Component 1: Execute Workflow Button
**File:** `components/execute-workflow-button.tsx`

```typescript
interface Props {
  workflowId: string;
  workflowName: string;
  onExecutionStart: (executionId: string) => void;
}

// Features:
// - "Run Workflow" button with play icon
// - Optional input form for webhook payload
// - Loading state during execution
// - Toast on success/error
// - Optimistic UI update
```

**Minimal Version:**
- Just a button that calls `POST /api/workflows/[id]/execute`
- Shows loading spinner
- Toast with execution ID on success

#### Component 2: Execution Status Badge
**File:** `components/execution-status.tsx`

```typescript
interface Props {
  status: "running" | "success" | "error" | "waiting";
  showIcon?: boolean;
}

// Visual:
// - Badge component with color coding
// - running: blue + spinner icon
// - success: green + checkmark
// - error: red + x icon
// - waiting: yellow + clock icon
```

#### Component 3: Execution History List
**File:** `components/execution-history.tsx`

```typescript
interface Props {
  workflowId: string;
  limit?: number; // default 10
}

// Features:
// - Fetch executions for workflow
// - Table/list with: status, started time, duration
// - Click row → opens execution details
// - Auto-refresh while executions running
// - Empty state: "No executions yet"
```

**Minimal Version:**
- Simple list of last 5 executions
- Status badge + timestamp
- No drill-down (future)

#### Component 4: Execution Detail View (Future)
**File:** `components/execution-details.tsx`

```typescript
interface Props {
  executionId: string;
}

// Features:
// - Node-by-node execution flow
// - Input/output for each step
// - Timing diagram
// - Error stack traces
// - JSON viewer for data
```

**Skip for MVP** - Too complex, focus on status only

#### Component 5: Live Execution Monitor
**File:** `components/execution-monitor.tsx`

```typescript
interface Props {
  executionId: string;
  onComplete: () => void;
}

// Features:
// - Polls execution status every 1-2 seconds
// - Shows progress: "Running step 2 of 4..."
// - Updates badge in real-time
// - Stops polling when complete
```

**Minimal Version:**
- Just poll status and show badge
- No step-by-step progress (future)

---

## Implementation Strategy

### Phase 1: Basic Execution (Minimal MVP)

**Backend:**
1. Add `POST /api/workflows/[id]/execute` route
2. Add `GET /api/executions/[executionId]` route

**Frontend:**
3. Create `ExecuteWorkflowButton` component
4. Create `ExecutionStatusBadge` component
5. Add execute button to workflow card
6. Show last execution status in workflow list

**User Flow:**
1. User clicks "Run" button on workflow
2. Button shows loading spinner
3. Execution starts → toast with success message
4. Workflow card shows "Last run: Running..." badge
5. Poll status every 2 seconds
6. Badge updates to "Success" or "Error" when done

### Phase 2: Execution History

**Backend:**
7. Add `GET /api/workflows/[id]/executions` route

**Frontend:**
8. Create `ExecutionHistory` component
9. Add "View Executions" button to workflow card
10. Show modal/drawer with execution history
11. Display: status, time, duration

**User Flow:**
1. User clicks "View Executions" on workflow
2. Drawer slides out with list of executions
3. See status badges and timestamps
4. Auto-refresh if any are still running

### Phase 3: Execution Details (Future)
12. Add full execution details route
13. Create node-by-node visualization
14. JSON viewer for inputs/outputs
15. Error highlighting and debugging

---

## Minimal Files to Add

### Backend (2 files)
```
app/api/
  workflows/[id]/
    execute/
      route.ts          # ← NEW: Execute workflow
  executions/
    [id]/
      route.ts          # ← NEW: Get execution status
```

### Frontend (3 components)
```
components/
  execute-workflow-button.tsx    # ← NEW: Run button
  execution-status-badge.tsx     # ← NEW: Status display
  execution-monitor.tsx          # ← NEW: Poll status
```

### Library (1 file)
```
lib/
  hooks/
    use-execution-polling.ts     # ← NEW: React hook for polling
```

---

## n8n API Endpoints Needed

### Already Available in n8n:
- ✅ `POST /api/v1/workflows/{id}/execute` - Start execution
- ✅ `GET /api/v1/executions/{id}` - Get execution by ID
- ✅ `GET /api/v1/executions` - List all executions (filterable by workflowId)

### Adapter Methods to Add:
```typescript
// lib/uwf/n8n-adapter.ts

interface ExecutionResult {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  startedAt: Date;
  stoppedAt?: Date;
  status: "running" | "success" | "error" | "waiting";
  data?: unknown;
}

async getExecution(executionId: string): Promise<ExecutionResult>
async listExecutions(workflowId: string, limit?: number): Promise<ExecutionResult[]>
```

---

## Polling Strategy

### Option 1: Simple Polling (Recommended for MVP)
```typescript
// Poll every 2 seconds until complete
const pollExecution = async (executionId: string) => {
  const interval = setInterval(async () => {
    const result = await fetch(`/api/executions/${executionId}`);
    const data = await result.json();

    if (data.finished) {
      clearInterval(interval);
      // Update UI with final status
    }
  }, 2000);
};
```

**Pros:**
- Simple to implement
- Works everywhere
- No server complexity

**Cons:**
- Wasteful (polls even if nothing changed)
- 2-second delay on updates

### Option 2: Server-Sent Events (Future Enhancement)
```typescript
// Real-time updates via SSE
const eventSource = new EventSource(`/api/executions/${executionId}/stream`);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Update UI immediately
};
```

**Pros:**
- Real-time, no polling
- Efficient

**Cons:**
- More complex backend
- Requires SSE support

### Option 3: WebSocket (Overkill)
- Not needed for workflow executions
- Use SSE instead if needed

---

## UI Design (Minimal)

### Workflow Card Updates
```
┌─────────────────────────────────────┐
│ Lead Capture & CRM Sync             │
│ [Enabled ✓]                         │
│                                     │
│ Last run: 2 mins ago - Success ✓   │
│                                     │
│ [▶ Run] [History] [Edit] [Delete]  │
└─────────────────────────────────────┘
```

### Execute Button States
```
[▶ Run]                    # Idle
[⏳ Running...]            # Executing
[✓ Completed]              # Just finished
[✗ Failed]                 # Error
```

### Execution History Modal
```
┌─────────────────────────────────────┐
│ Execution History                   │
│ Lead Capture & CRM Sync             │
├─────────────────────────────────────┤
│ [✓] Success  2 mins ago   (3.2s)   │
│ [✓] Success  1 hour ago   (2.8s)   │
│ [✗] Error    3 hours ago  (1.2s)   │
│ [✓] Success  1 day ago    (3.5s)   │
│ [⏳] Running  2 days ago   (...)    │
├─────────────────────────────────────┤
│ [Load More]                [Close]  │
└─────────────────────────────────────┘
```

---

## Data Flow

### Execute Workflow
```
User clicks "Run"
  ↓
POST /api/workflows/{id}/execute
  ↓
n8nAdapter.execute(id, {})
  ↓
n8n POST /api/v1/workflows/{id}/execute
  ↓
Returns: { executionId: "abc123", status: "running" }
  ↓
Start polling GET /api/executions/abc123
  ↓
Every 2s: Check if finished === true
  ↓
Update UI with final status
```

### View Execution History
```
User clicks "History"
  ↓
GET /api/workflows/{id}/executions
  ↓
n8nAdapter.listExecutions(id, 10)
  ↓
n8n GET /api/v1/executions?workflowId={id}&limit=10
  ↓
Returns: { data: [...executions] }
  ↓
Render list with status badges
  ↓
Auto-refresh if any are running
```

---

## Success Criteria

### Phase 1 (Basic Execution)
- ✅ User can click "Run" on workflow
- ✅ Execution starts and returns execution ID
- ✅ Status badge shows "Running" → "Success/Error"
- ✅ Toast notification on completion
- ✅ Polling stops when execution finishes

### Phase 2 (Execution History)
- ✅ User can view past executions
- ✅ List shows status, timestamp, duration
- ✅ Auto-refreshes if executions are running
- ✅ Handles empty state gracefully

### Phase 3 (Future - Details)
- ❌ Skip for MVP
- Node-by-node execution view
- Input/output inspection
- Error debugging

---

## Code Estimate

### Backend Routes
- `POST /api/workflows/[id]/execute/route.ts` - ~30 lines
- `GET /api/executions/[id]/route.ts` - ~25 lines
- `GET /api/workflows/[id]/executions/route.ts` - ~30 lines
- Adapter methods - ~50 lines

**Total Backend: ~135 lines**

### Frontend Components
- `execute-workflow-button.tsx` - ~80 lines
- `execution-status-badge.tsx` - ~40 lines
- `execution-monitor.tsx` - ~60 lines
- `execution-history.tsx` - ~120 lines
- `use-execution-polling.ts` - ~50 lines

**Total Frontend: ~350 lines**

### Total Addition: ~485 lines of code

---

## Timeline Estimate

### Phase 1 (Basic Execution)
- Backend routes: 20 mins
- Frontend components: 30 mins
- Integration + testing: 20 mins
- **Subtotal: ~70 mins**

### Phase 2 (Execution History)
- Backend route: 15 mins
- Frontend component: 35 mins
- Integration + testing: 15 mins
- **Subtotal: ~65 mins**

### **Total: ~2.25 hours**

---

## Recommendation

### Minimal Viable Execution UI (Phase 1 Only)
**Add to build-ui.md:**

1. **Execute Button** in workflow card
2. **Last Run Status** badge
3. **Polling** for status updates
4. **Toast notifications** on completion

**Skip for now:**
- Execution history list
- Detailed execution view
- Manual input forms for webhooks

This adds ~70 minutes to the build plan and gives users the ability to:
- Trigger workflows manually
- See if they succeed or fail
- Get real-time status updates

---

## Updated File Structure

```
app/api/
  workflows/[id]/
    execute/route.ts              # ← NEW
  executions/[id]/route.ts        # ← NEW

components/
  workflow-card.tsx               # ← UPDATE: Add execute button
  execute-workflow-button.tsx     # ← NEW
  execution-status-badge.tsx      # ← NEW

lib/
  hooks/
    use-execution-polling.ts      # ← NEW
  uwf/
    n8n-adapter.ts                # ← UPDATE: Add execution methods
    types.ts                      # ← UPDATE: Add execution types
```

**New file count: 4**
**Updated file count: 3**

---

## Summary

To enable workflow execution with real-time updates:

### Must Add:
1. ✅ Backend route to trigger execution
2. ✅ Backend route to check execution status
3. ✅ Execute button component
4. ✅ Status badge component
5. ✅ Polling hook for status updates

### Should Add (Phase 2):
6. Backend route for execution history
7. Execution history list component

### Could Add (Future):
8. Detailed execution view with logs
9. Input forms for manual triggers
10. WebSocket/SSE for real-time updates

---

## Decision Point

**For MVP, I recommend adding Phase 1 only:**
- Adds 4 files, ~485 lines of code
- ~70 minutes additional work
- Gives core execution capability
- Keeps scope focused and deliverable

Would you like me to update `build-ui.md` to include execution UI, or keep it focused on CRUD only?
