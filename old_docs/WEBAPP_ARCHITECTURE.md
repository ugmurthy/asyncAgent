# AsyncAgent Monitoring System - Architecture & Implementation Plan

## 1. Executive Summary

This document outlines the architecture and implementation plan for a full-stack web application built with **SvelteKit**, **Tailwind CSS**, and **shadcn/svelte** components to monitor and manage the AsyncAgent system.

**Key Technologies:**
- Frontend: SvelteKit (SSR + SPA)
- Styling: Tailwind CSS
- Components: shadcn/svelte
- API Client: @async-agent/shared/js-client
- Package Manager: pnpm
- Location: `packages/webApp`

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Browser (Client)                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │           SvelteKit Application                    │  │
│  │  ┌──────────┬──────────┬──────────┬─────────────┐ │  │
│  │  │Dashboard │  Goals   │   Runs   │  Settings   │ │  │
│  │  │  Page    │   Pages  │  Pages   │   Pages     │ │  │
│  │  └──────────┴──────────┴──────────┴─────────────┘ │  │
│  │                                                    │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │      shadcn/svelte Components                │ │  │
│  │  │  (Tables, Cards, Dialogs, Forms, etc.)       │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  │                                                    │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │         Tailwind CSS Styling                 │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────┘
                         │
                         │ HTTP/REST
                         │
┌────────────────────────▼─────────────────────────────────┐
│              @async-agent/shared/js-client                │
│            (Auto-generated API Client)                    │
└────────────────────────┬─────────────────────────────────┘
                         │
                         │
┌────────────────────────▼─────────────────────────────────┐
│                  Backend API (Fastify)                    │
│              http://localhost:3000/api/v1                 │
│  ┌──────────┬──────────┬──────────┬─────────────────┐   │
│  │  Goals   │   Runs   │  Agents  │   Health        │   │
│  │  Service │ Service  │ Service  │   Service       │   │
│  └──────────┴──────────┴──────────┴─────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

### 2.2 Application Structure

```
packages/webApp/
├── src/
│   ├── routes/                    # SvelteKit file-based routing
│   │   ├── +layout.svelte         # Root layout with nav
│   │   ├── +layout.ts             # Layout load function
│   │   ├── +page.svelte           # Dashboard (/)
│   │   ├── +page.ts               # Dashboard data loading
│   │   │
│   │   ├── goals/                 # Goals section
│   │   │   ├── +page.svelte       # Goals list
│   │   │   ├── +page.ts           # Goals list loader
│   │   │   ├── [id]/              # Goal detail page
│   │   │   │   ├── +page.svelte
│   │   │   │   └── +page.ts
│   │   │   └── new/               # Create goal page
│   │   │       ├── +page.svelte
│   │   │       └── +page.ts
│   │   │
│   │   ├── runs/                  # Runs section
│   │   │   ├── +page.svelte       # Runs list
│   │   │   ├── +page.ts           # Runs list loader
│   │   │   └── [id]/              # Run detail page
│   │   │       ├── +page.svelte
│   │   │       └── +page.ts
│   │   │
│   │   └── settings/              # Settings section
│   │       ├── +page.svelte       # Settings overview
│   │       ├── agents/            # Agent/prompt management
│   │       │   ├── +page.svelte
│   │       │   ├── +page.ts
│   │       │   └── [id]/
│   │       │       ├── +page.svelte
│   │       │       └── +page.ts
│   │       └── system/            # System settings
│   │           ├── +page.svelte
│   │           └── +page.ts
│   │
│   ├── lib/                       # Application library code
│   │   ├── api/                   # API client wrapper
│   │   │   └── client.ts          # AsyncAgentClient instance
│   │   │
│   │   ├── components/            # Custom components
│   │   │   ├── dashboard/
│   │   │   │   ├── StatsCard.svelte
│   │   │   │   ├── GoalStatusChart.svelte
│   │   │   │   ├── RunStatusChart.svelte
│   │   │   │   └── RecentActivity.svelte
│   │   │   │
│   │   │   ├── goals/
│   │   │   │   ├── GoalsList.svelte
│   │   │   │   ├── GoalCard.svelte
│   │   │   │   ├── GoalDetail.svelte
│   │   │   │   ├── CreateGoalDialog.svelte
│   │   │   │   └── GoalActions.svelte
│   │   │   │
│   │   │   ├── runs/
│   │   │   │   ├── RunsList.svelte
│   │   │   │   ├── RunCard.svelte
│   │   │   │   ├── RunDetail.svelte
│   │   │   │   ├── StepsList.svelte
│   │   │   │   └── StepCard.svelte
│   │   │   │
│   │   │   ├── agents/
│   │   │   │   ├── AgentsList.svelte
│   │   │   │   ├── AgentCard.svelte
│   │   │   │   ├── CreateAgentDialog.svelte
│   │   │   │   └── PromptEditor.svelte
│   │   │   │
│   │   │   └── common/
│   │   │       ├── StatusBadge.svelte
│   │   │       ├── LoadingSpinner.svelte
│   │   │       ├── ErrorAlert.svelte
│   │   │       └── EmptyState.svelte
│   │   │
│   │   ├── ui/                    # shadcn/svelte components
│   │   │   ├── button/
│   │   │   ├── card/
│   │   │   ├── dialog/
│   │   │   ├── table/
│   │   │   ├── form/
│   │   │   ├── input/
│   │   │   ├── select/
│   │   │   ├── badge/
│   │   │   ├── alert/
│   │   │   ├── tabs/
│   │   │   └── ...
│   │   │
│   │   ├── stores/                # Svelte stores
│   │   │   ├── goals.ts           # Goals state management
│   │   │   ├── runs.ts            # Runs state management
│   │   │   ├── agents.ts          # Agents state management
│   │   │   └── notifications.ts   # Toast notifications
│   │   │
│   │   └── utils/                 # Utility functions
│   │       ├── formatters.ts      # Date, status formatters
│   │       ├── validators.ts      # Form validation
│   │       └── constants.ts       # App constants
│   │
│   ├── app.css                    # Global Tailwind styles
│   └── app.html                   # HTML template
│
├── static/                        # Static assets
│   └── favicon.png
│
├── package.json
├── svelte.config.js               # SvelteKit config
├── tailwind.config.js             # Tailwind config
├── tsconfig.json                  # TypeScript config
├── vite.config.ts                 # Vite config
└── components.json                # shadcn/svelte config
```

---

## 3. Feature Breakdown

### 3.1 Dashboard Page (`/`)

**Purpose:** High-level overview of the AsyncAgent system

**Components:**
- **Stats Cards:**
  - Total Goals (with breakdown: active, paused, completed)
  - Total Runs (with breakdown: running, completed, failed, pending)
  - Active Schedules count
  - Recent Activity summary

- **Status Charts:**
  - Goals by Status (pie/donut chart)
  - Runs by Status (pie/donut chart)
  - Runs over Time (line/bar chart - last 7 days)

- **Recent Activity Feed:**
  - Last 10 runs with status
  - Quick links to goals/runs

- **System Health:**
  - LLM Provider status
  - Model info
  - Active schedules

**Data Loading:**
```typescript
// +page.ts
export async function load() {
  const [goals, runs, health] = await Promise.all([
    client.goals.listGoals(),
    client.runs.listRuns(),
    client.health.getHealthReady()
  ]);
  
  // Compute statistics
  return {
    stats: computeStats(goals, runs),
    recentRuns: runs.slice(0, 10),
    health
  };
}
```

---

### 3.2 Goals Management

#### 3.2.1 Goals List Page (`/goals`)

**Features:**
- Filterable table/grid of all goals
- Status filter (all, active, paused, completed)
- Search by objective
- Sort by: created date, updated date, status
- Quick actions: trigger run, pause/resume, delete
- "Create Goal" button

**Table Columns:**
- Status badge
- Objective (truncated with tooltip)
- Schedule (cron expression if exists)
- Last run (date/time)
- Next run (calculated from cron)
- Actions menu

#### 3.2.2 Goal Detail Page (`/goals/[id]`)

**Features:**
- Full objective display
- Goal parameters (step budget, allowed tools, constraints)
- Schedule details (cron, timezone, active status)
- Webhook URL
- Associated runs list (paginated)
- Action buttons: Trigger Run, Edit, Pause/Resume, Delete

**Tabs:**
- Overview
- Runs History
- Configuration
- Logs (if available)

#### 3.2.3 Create Goal Page (`/goals/new`)

**Form Fields:**
- Objective (textarea, required, 10-1000 chars)
- Step Budget (number input, default 20)
- Allowed Tools (multi-select)
- Constraints (key-value pairs)
- Webhook URL (optional)
- Schedule (optional):
  - Cron Expression (with helper/picker)
  - Timezone (dropdown)

**Validation:**
- Zod schema from shared package
- Real-time validation feedback
- Cron expression validation

---

### 3.3 Runs Management

#### 3.3.1 Runs List Page (`/runs`)

**Features:**
- Filterable table of all runs
- Status filter (all, pending, running, completed, failed)
- Search by goal objective
- Sort by: created date, status, duration
- Quick actions: view details, delete
- Auto-refresh for running runs (polling/SSE)

**Table Columns:**
- Status badge
- Run ID
- Goal objective
- Started At
- Ended At
- Duration
- Steps (executed/budget)
- Actions menu

#### 3.3.2 Run Detail Page (`/runs/[id]`)

**Features:**
- Run metadata (status, times, budget)
- Associated goal info
- Steps list with timeline visualization
- Working memory display (JSON viewer)
- Error details (if failed)
- Action: Delete run

**Steps Display:**
- Step number
- Thought/reasoning
- Tool used
- Tool input (collapsible JSON)
- Observation/result
- Duration
- Timestamp
- Error (if any)

**Visualization:**
- Timeline view of steps
- Success/failure indicators
- Expandable step details

---

### 3.4 Settings & Configuration

#### 3.4.1 Settings Overview (`/settings`)

**Sections:**
- System Configuration
- Agent Management
- Prompt Templates

#### 3.4.2 Agent Management (`/settings/agents`)

**Features:**
- List all agents (table)
- Show: name, version, active status, created/updated dates
- Create new agent
- Edit agent (update prompt template)
- Activate/deactivate agent versions
- Delete agent

**Table/List:**
- Agent name + version
- Active badge
- Metadata display
- Actions: View, Edit, Activate/Deactivate, Delete

#### 3.4.3 Agent Detail/Edit (`/settings/agents/[id]`)

**Features:**
- View/edit prompt template (code editor with syntax highlighting)
- Metadata editor (key-value pairs)
- Version history (if tracked)
- Test prompt (future enhancement)
- Save changes

**Components:**
- Code editor for prompt template (Monaco/CodeMirror)
- Metadata JSON editor
- Save/Cancel buttons

#### 3.4.4 System Settings (`/settings/system`)

**Features:**
- LLM Provider info (read-only from backend)
- Model configuration
- API base URL
- Health check
- Scheduler status

---

## 4. UI/UX Design Principles

### 4.1 Design System

**Color Palette:**
- Primary: Blue (actions, links)
- Success: Green (completed, active)
- Warning: Yellow/Orange (paused, pending)
- Error: Red (failed, errors)
- Neutral: Gray scale (text, backgrounds)

**Status Colors:**
- Goals:
  - `active`: green
  - `paused`: yellow
  - `completed`: blue
- Runs:
  - `pending`: gray
  - `running`: blue (animated)
  - `completed`: green
  - `failed`: red

**Typography:**
- Font: System font stack (Tailwind default)
- Headings: Bold, larger sizes
- Body: Regular weight
- Code/IDs: Monospace font

**Spacing:**
- Consistent padding/margins using Tailwind scale
- Card-based layouts with appropriate spacing

### 4.2 Component Library (shadcn/svelte)

**Core Components to Use:**
- `Button`: Actions, navigation
- `Card`: Content containers
- `Table`: Data lists
- `Dialog/Modal`: Create/edit forms, confirmations
- `Badge`: Status indicators
- `Alert`: Error/success messages
- `Tabs`: Multi-view sections
- `Input/Textarea`: Form fields
- `Select/Combobox`: Dropdowns
- `Form`: Form handling with validation
- `Tooltip`: Additional info
- `Skeleton`: Loading states
- `Progress`: Loading indicators
- `Toast`: Notifications

### 4.3 Responsive Design

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

**Layout:**
- Mobile: Single column, hamburger nav
- Tablet: Adapted columns, collapsible sidebar
- Desktop: Multi-column, persistent sidebar

---

## 5. State Management

### 5.1 SvelteKit Load Functions

**Server-Side Rendering (SSR):**
- Use `+page.ts` load functions for data fetching
- Pre-render static content where possible
- Handle errors gracefully

**Client-Side:**
- Use `invalidate()` for data revalidation
- Optimistic UI updates
- Error boundaries

### 5.2 Svelte Stores

**Goals Store (`lib/stores/goals.ts`):**
```typescript
import { writable } from 'svelte/store';
import type { GoalWithSchedules } from '@async-agent/shared';

export const goalsStore = writable<GoalWithSchedules[]>([]);
export const selectedGoal = writable<GoalWithSchedules | null>(null);
```

**Runs Store (`lib/stores/runs.ts`):**
```typescript
import { writable } from 'svelte/store';
import type { RunWithGoal } from '@async-agent/shared';

export const runsStore = writable<RunWithGoal[]>([]);
export const selectedRun = writable<RunWithGoal | null>(null);
```

**Notifications Store (`lib/stores/notifications.ts`):**
```typescript
export const notifications = writable<Notification[]>([]);
export const addNotification = (message: string, type: 'success' | 'error') => {
  // Toast implementation
};
```

---

## 6. API Integration

### 6.1 API Client Setup

**File: `lib/api/client.ts`**
```typescript
import { AsyncAgentClient } from '@async-agent/shared/js-client';

// Get base URL from environment or default
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export const client = new AsyncAgentClient({
  BASE: BASE_URL
});

// Export individual services for convenience
export const { goals, runs, agents, health } = client;
```

### 6.2 Error Handling

**Centralized Error Handler:**
```typescript
export async function handleApiCall<T>(
  apiCall: Promise<T>,
  errorMessage: string = 'An error occurred'
): Promise<T> {
  try {
    return await apiCall;
  } catch (error) {
    console.error(errorMessage, error);
    addNotification(errorMessage, 'error');
    throw error;
  }
}
```

### 6.3 Data Fetching Patterns

**Load Function Pattern:**
```typescript
// +page.ts
import { goals } from '$lib/api/client';
import { error } from '@sveltejs/kit';

export async function load() {
  try {
    const goalsList = await goals.listGoals();
    return { goals: goalsList };
  } catch (err) {
    throw error(500, 'Failed to load goals');
  }
}
```

**Form Action Pattern:**
```typescript
// +page.server.ts (for form submissions)
import type { Actions } from './$types';
import { goals } from '$lib/api/client';

export const actions: Actions = {
  create: async ({ request }) => {
    const data = await request.formData();
    const objective = data.get('objective');
    
    try {
      await goals.createGoal({ objective, ... });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};
```

---

## 7. Real-Time Updates

### 7.1 Polling Strategy

**For Active Runs:**
- Poll `/api/v1/runs` every 3-5 seconds when viewing runs list
- Poll `/api/v1/runs/{id}/steps` when viewing run details
- Stop polling when run status is terminal (completed/failed)

**Implementation:**
```typescript
import { onMount, onDestroy } from 'svelte';

let interval: NodeJS.Timeout;

onMount(() => {
  interval = setInterval(async () => {
    if (hasActiveRuns) {
      await invalidate('runs:list');
    }
  }, 5000);
});

onDestroy(() => {
  clearInterval(interval);
});
```

### 7.2 Future: WebSocket/SSE

- Consider implementing Server-Sent Events (SSE) for real-time updates
- Backend would need to implement SSE endpoints

---

## 8. Implementation Phases

### Phase 1: Project Setup & Foundation (Days 1-2)

**Tasks:**
1. Create `packages/webApp` directory
2. Initialize SvelteKit project with TypeScript
3. Install and configure Tailwind CSS
4. Install and configure shadcn/svelte
5. Set up API client integration
6. Create basic layout with navigation
7. Configure pnpm workspace
8. Set up environment variables

**Deliverables:**
- Working SvelteKit app with routing
- Tailwind CSS configured
- shadcn/svelte components installed
- API client accessible throughout app
- Basic layout with navigation

---

### Phase 2: Dashboard Implementation (Days 3-4)

**Tasks:**
1. Create dashboard page component
2. Implement stats cards (goals count, runs count)
3. Create status charts (goals/runs by status)
4. Build recent activity feed
5. Implement system health display
6. Add loading states and error handling

**Deliverables:**
- Functional dashboard with real data
- Visual stats and charts
- System health monitoring

---

### Phase 3: Goals Management (Days 5-7)

**Tasks:**
1. Create goals list page with table
2. Implement filtering and sorting
3. Build goal detail page
4. Create goal creation form with validation
5. Implement goal actions (trigger, pause, resume, delete)
6. Add confirmation dialogs
7. Implement success/error notifications

**Deliverables:**
- Complete goals CRUD functionality
- Working filters and search
- Goal triggering and status management

---

### Phase 4: Runs Management (Days 8-9)

**Tasks:**
1. Create runs list page with table
2. Implement filtering and sorting
3. Build run detail page
4. Create steps timeline visualization
5. Implement run deletion
6. Add polling for active runs
7. Display working memory and errors

**Deliverables:**
- Complete runs viewing functionality
- Real-time run status updates
- Detailed step execution view

---

### Phase 5: Settings & Agent Management (Days 10-11)

**Tasks:**
1. Create settings layout
2. Build agents list page
3. Implement agent creation form
4. Create agent detail/edit page with code editor
5. Build prompt template editor
6. Implement agent activation/deactivation
7. Add system settings view

**Deliverables:**
- Complete agent/prompt management
- Working code editor for prompts
- System configuration view

---

### Phase 6: Polish & Optimization (Days 12-13)

**Tasks:**
1. Responsive design refinement
2. Loading states and skeletons
3. Error boundary implementation
4. Performance optimization
5. Accessibility improvements (ARIA labels, keyboard nav)
6. Documentation
7. Testing critical flows

**Deliverables:**
- Polished, responsive UI
- Comprehensive error handling
- Performance optimizations
- User documentation

---

### Phase 7: Advanced Features (Days 14+)

**Optional Enhancements:**
1. Advanced filtering (date ranges, multiple criteria)
2. Bulk operations (delete multiple runs)
3. Export functionality (CSV, JSON)
4. Dark mode toggle
5. User preferences persistence
6. Advanced visualizations (D3.js charts)
7. Real-time updates via SSE/WebSockets

---

## 9. Technical Decisions

### 9.1 Why SvelteKit?

- **SSR + SPA:** Best of both worlds
- **File-based routing:** Intuitive structure
- **Performance:** Fast, small bundle sizes
- **Developer Experience:** Simple, less boilerplate
- **Built-in:** Form handling, data loading, routing

### 9.2 Why shadcn/svelte?

- **Copy-paste components:** Full control over code
- **Tailwind-based:** Consistent with design system
- **Accessible:** Built with accessibility in mind
- **Customizable:** Easy to modify and extend
- **No black box:** Components are part of your codebase

### 9.3 State Management Strategy

- **SvelteKit load functions:** For SSR data
- **Svelte stores:** For client-side state
- **No heavy state library needed:** Svelte's reactivity is sufficient
- **Invalidation:** Use SvelteKit's built-in invalidation for data refresh

### 9.4 Styling Approach

- **Tailwind CSS:** Utility-first for rapid development
- **shadcn components:** Pre-styled with Tailwind
- **Custom components:** Use Tailwind utilities
- **Responsive:** Mobile-first design
- **Dark mode ready:** Tailwind's dark mode support

---

## 10. Development Guidelines

### 10.1 Code Organization

- Keep components small and focused
- Separate concerns (presentation vs logic)
- Use TypeScript strictly
- Leverage shared types from `@async-agent/shared`
- Write reusable utility functions

### 10.2 Naming Conventions

- Components: PascalCase (e.g., `GoalCard.svelte`)
- Files: kebab-case for routes (e.g., `+page.svelte`)
- Stores: camelCase (e.g., `goalsStore`)
- Constants: UPPER_SNAKE_CASE

### 10.3 Error Handling

- Always handle API errors gracefully
- Show user-friendly error messages
- Log errors for debugging
- Provide fallback UI for errors
- Use try-catch in load functions

### 10.4 Performance

- Lazy load heavy components
- Use `{#await}` for async data
- Optimize re-renders with Svelte's reactivity
- Debounce search/filter inputs
- Paginate large lists
- Use skeleton loaders for better UX

### 10.5 Accessibility

- Use semantic HTML
- Add ARIA labels where needed
- Ensure keyboard navigation works
- Maintain good color contrast
- Test with screen readers

---

## 11. Testing Strategy

### 11.1 Component Testing

- Use Vitest + Testing Library
- Test user interactions
- Test edge cases
- Mock API calls

### 11.2 Integration Testing

- Test complete user flows
- Test error scenarios
- Test real API integration (optional)

### 11.3 E2E Testing

- Use Playwright (optional for critical flows)
- Test main user journeys
- Test across browsers

---

## 12. Deployment Considerations

### 12.1 Build Configuration

**SvelteKit Adapter:**
- Use `@sveltejs/adapter-node` for Node.js deployment
- Or `@sveltejs/adapter-static` for static hosting

**Environment Variables:**
```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### 12.2 Production Checklist

- [ ] Environment variables configured
- [ ] API base URL points to production backend
- [ ] Error tracking setup (Sentry, etc.)
- [ ] Analytics integration (optional)
- [ ] Performance monitoring
- [ ] SEO optimization (meta tags, sitemap)
- [ ] Security headers configured

---

## 13. Future Enhancements

### 13.1 Short-term

- Dark mode toggle
- User authentication/authorization
- Advanced search and filtering
- Bulk operations
- Export data functionality
- Keyboard shortcuts

### 13.2 Long-term

- Real-time updates via WebSockets/SSE
- Advanced analytics and insights
- Custom dashboards
- Scheduled reports
- Webhook event viewer
- Artifact viewer (files created by agents)
- Multi-user support with roles
- Audit logs

---

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API client compatibility issues | High | Test thoroughly, use TypeScript for type safety |
| shadcn/svelte setup complexity | Medium | Follow official docs, use CLI for setup |
| Real-time updates performance | Medium | Implement polling wisely, consider SSE later |
| Large data sets slow UI | Medium | Implement pagination, virtual scrolling |
| Browser compatibility | Low | Use modern browsers, add polyfills if needed |

---

## 15. Success Metrics

- **Functionality:** All CRUD operations working correctly
- **Performance:** Page loads < 2 seconds, smooth interactions
- **Usability:** Intuitive navigation, clear feedback
- **Accessibility:** WCAG 2.1 AA compliance
- **Responsiveness:** Works well on mobile, tablet, desktop
- **Reliability:** Graceful error handling, no crashes

---

## 16. Conclusion

This architecture provides a solid foundation for building a comprehensive AsyncAgent monitoring system. The use of SvelteKit, Tailwind CSS, and shadcn/svelte ensures a modern, performant, and maintainable web application. The phased implementation approach allows for iterative development and testing, ensuring each feature is robust before moving to the next.

**Estimated Timeline:** 12-14 days for core functionality, with additional time for polish and advanced features.

**Next Steps:**
1. Get approval on architecture
2. Set up project structure
3. Begin Phase 1 implementation
4. Iterate based on feedback

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-03  
**Author:** AsyncAgent Development Team
