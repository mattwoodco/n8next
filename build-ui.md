# CRUD Workflow UI Build Plan

## Context Review

### Existing API Routes (CRUD Complete)
- `GET /api/workflows` - List all workflows
- `POST /api/workflows` - Create workflow
- `GET /api/workflows/[id]` - Get single workflow
- `PUT /api/workflows/[id]` - Update workflow
- `DELETE /api/workflows/[id]` - Delete workflow
- `PATCH /api/workflows/[id]` - Toggle enabled/disabled

### UWF Schema (from lib/uwf/types.ts)
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
  next: string[]; // action IDs
}

interface Action {
  id: string;
  type: "http" | "email" | "transform";
  config: { url?, method?, to?, subject? };
  next: string[];
}
```

### Available shadcn Components
- Input, Textarea, Label, Button, Switch
- Select, Separator, Badge, Skeleton
- Field (custom field wrapper)
- Sonner (toast notifications)

### Demo Workflows (from demos.md)
Target demo: **#6 Lead Capture & CRM Sync** (simplest, universal compatibility)
- 1 webhook trigger
- 4 actions (transform, http, 2x email)
- Perfect for demonstrating CRUD operations

---

## Strategic Plan: Minimal CRUD UI

### Phase 1: List & Create (Parallel Subagents)
**Agent 1: Workflow List Component**
- Create `components/workflow-list.tsx`
- Fetch workflows from `GET /api/workflows`
- Display: name, enabled status (badge), action buttons
- Empty state with "Create Workflow" CTA
- Loading state with Skeleton

**Agent 2: Create Workflow Form**
- Create `components/create-workflow-form.tsx`
- React Hook Form + Zod validation
- Fields: name (Input), enabled (Switch)
- Pre-populate with Demo #6 JSON structure for triggers/actions
- Submit to `POST /api/workflows`
- Toast success/error feedback

**Agent 3: Update Homepage**
- Convert `app/page.tsx` to client component
- Layout: Header + WorkflowList + CreateWorkflowForm (dialog/modal)
- Wire up state management (optimistic updates)

### Phase 2: Update & Delete (Sequential)
**Step 1: Add Action Buttons to List**
- Edit button → opens form with prefilled data
- Delete button → confirmation → DELETE request
- Toggle switch → PATCH request for enable/disable

**Step 2: Edit Workflow Form**
- Reuse CreateWorkflowForm component
- Add mode: "create" | "edit"
- Pre-populate form fields from selected workflow
- Submit to `PUT /api/workflows/[id]`

---

## Minimal Implementation Strategy

### What to Build
1. **Workflow List** (Read)
   - Table/grid with workflow cards
   - Shows: name, enabled badge, edit/delete buttons

2. **Create/Edit Form** (Create + Update)
   - Single form component with create/edit modes
   - Fields: name, enabled switch
   - Hidden fields: hardcoded Demo #6 structure for triggers/actions
   - React Hook Form + Zod schema

3. **Delete Confirmation** (Delete)
   - Simple confirmation dialog/toast
   - DELETE API call

4. **Toggle Enabled** (Update)
   - Switch component in list
   - PATCH API call

### What NOT to Build (Out of Scope)
- ❌ Visual workflow builder (complex, not needed for demo)
- ❌ Trigger/action editors (use hardcoded Demo #6)
- ❌ Workflow execution UI (API exists, UI later)
- ❌ Advanced validation (basic Zod schema only)
- ❌ Pagination (demo has few workflows)
- ❌ Search/filter (not needed for demo)

### Hardcoded Demo Workflow Template
```typescript
const DEMO_WORKFLOW_TEMPLATE = {
  triggers: [
    {
      id: "form-webhook",
      type: "webhook" as const,
      config: { path: "/webhooks/leads", method: "POST" as const },
      next: ["transform-lead"]
    }
  ],
  actions: [
    {
      id: "transform-lead",
      type: "transform" as const,
      config: {},
      next: ["post-to-crm", "send-welcome-email", "notify-sales-team"]
    },
    // ... rest from Demo #6
  ]
};
```

---

## File Structure

```
app/
  page.tsx                          # ← Update to client component

components/
  workflow-list.tsx                 # ← NEW: List component
  workflow-form.tsx                 # ← NEW: Create/Edit form
  workflow-card.tsx                 # ← NEW: Individual card

lib/
  workflow-template.ts              # ← NEW: Demo #6 template
  schemas/
    workflow-schema.ts              # ← NEW: Zod validation
```

---

## Parallel Subagent Tasks

### Agent 1: Foundation Setup
**Files:** `lib/workflow-template.ts`, `lib/schemas/workflow-schema.ts`
- Export Demo #6 workflow template constant
- Create Zod schema for form validation (name + enabled only)
- Export TypeScript types

### Agent 2: Workflow Card Component
**Files:** `components/workflow-card.tsx`
- Display workflow name, enabled badge
- Edit/Delete/Toggle buttons with icons
- Loading states for mutations

### Agent 3: Workflow Form Component
**Files:** `components/workflow-form.tsx`
- React Hook Form setup with Zod resolver
- Form fields: name (Input), enabled (Switch)
- Submit handler for create/edit modes
- Error handling with Sonner toasts

### Agent 4: Workflow List Component
**Files:** `components/workflow-list.tsx`
- Fetch workflows with React state
- Map to WorkflowCard components
- Empty state with "Create" button
- Loading skeleton

### Agent 5: Homepage Integration
**Files:** `app/page.tsx`
- Convert to "use client" component
- Layout with WorkflowList
- Create button → modal/dialog with WorkflowForm
- State management for CRUD operations

---

## Success Criteria

### Demo Flow
1. User loads homepage → sees workflow list (or empty state)
2. User clicks "Create Workflow" → form dialog opens
3. User enters name, toggles enabled, submits → workflow created with Demo #6 structure
4. User sees new workflow in list with badge
5. User toggles enabled switch → PATCH request updates status
6. User clicks edit → form prefills, user changes name, submits → PUT request updates
7. User clicks delete → confirmation → DELETE request removes workflow

### Code Quality
- ✅ TypeScript strict mode, no `any` casts
- ✅ Proper error handling with try/catch + toasts
- ✅ Loading states for all async operations
- ✅ Optimistic updates for better UX
- ✅ Accessible forms with proper labels
- ✅ Tailwind v4 styling (no inline styles)

---

## Dependencies (Already Installed)
- ✅ react-hook-form
- ✅ @hookform/resolvers (Zod)
- ✅ zod
- ✅ sonner (toasts)
- ✅ lucide-react (icons)
- ✅ All shadcn components

---

## Execution Strategy

### Phase 1 (Parallel - 5 agents)
Run Agents 1-5 concurrently to build all components simultaneously.

### Phase 2 (Sequential)
1. Test create workflow flow
2. Test update workflow flow
3. Test delete workflow flow
4. Test toggle enabled flow
5. Polish UX and error handling

### Phase 3 (Verification)
1. Check TypeScript compilation
2. Test with dev server
3. Verify n8n API integration
4. Document any issues

---

## Timeline Estimate
- Phase 1 (Parallel): ~15-20 minutes with 5 subagents
- Phase 2 (Sequential): ~10 minutes testing/polish
- Phase 3 (Verification): ~5 minutes
- **Total: ~30-35 minutes**

---

## Notes
- Focus on simplicity: only name + enabled fields visible
- Triggers/actions hardcoded from Demo #6
- No visual builder yet (future enhancement)
- Mobile-responsive design using Tailwind
- Dark mode support via next-themes (already configured)
