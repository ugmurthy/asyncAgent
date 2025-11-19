# WebApp - Developer Guide

SvelteKit 5 web application for managing and monitoring async agents.

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Backend server running (see [backend AGENTS.md](../backend/AGENTS.md))

### Development

```bash
# From monorepo root
pnpm --filter @async-agent/webapp dev

# Or from this directory
pnpm dev
```

Application runs on `http://localhost:5173` (default Vite port)

## Commands

### Development & Build

```bash
# Development mode with hot reload
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Type Checking

```bash
# Run type checker
pnpm check

# Run type checker in watch mode
pnpm check:watch
```

## Environment Setup

Create a `.env` file in the `packages/webApp` directory:

```bash
# Backend API URL (default: http://localhost:3000)
PUBLIC_API_URL=http://localhost:3000

# Optional: Public app configuration
PUBLIC_APP_NAME=Async Agent
```

See `.env.example` for all available options.

## Project Structure

```
webApp/
├── src/
│   ├── routes/              # SvelteKit routes (file-based routing)
│   │   ├── +page.svelte    # Homepage
│   │   ├── goals/          # Goal management pages
│   │   ├── runs/           # Run monitoring pages
│   │   └── agents/         # Agent management pages
│   ├── lib/
│   │   ├── components/     # Reusable Svelte components
│   │   ├── stores/         # Svelte stores for state management
│   │   └── utils/          # Utility functions
│   └── app.html            # HTML template
├── static/                 # Static assets
├── build/                  # Production build output
├── svelte.config.js        # SvelteKit configuration
├── tailwind.config.js      # TailwindCSS configuration
├── vite.config.ts          # Vite configuration
└── tsconfig.json           # TypeScript configuration
```

## Technology Stack

### Core
- **SvelteKit 5** - Full-stack framework
- **Svelte 5** - Reactive UI framework
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety

### UI & Styling
- **TailwindCSS** - Utility-first CSS framework
- **bits-ui** - Headless UI components
- **Lucide Svelte** - Icon library
- **tailwind-variants** - Component variants
- **@tailwindcss/typography** - Typography plugin

### API Integration
- **@async-agent/api-js-client** - Auto-generated API client
- **@async-agent/shared** - Shared types and schemas

## Development Workflow

### Adding New Pages

SvelteKit uses file-based routing. Create files in `src/routes/`:

- `src/routes/example/+page.svelte` → `/example`
- `src/routes/example/[id]/+page.svelte` → `/example/:id`

### Creating Components

1. Create component in `src/lib/components/`
2. Use TypeScript for props
3. Follow existing component patterns
4. Use TailwindCSS for styling

Example:
```svelte
<script lang="ts">
  interface Props {
    title: string;
    description?: string;
  }

  let { title, description }: Props = $props();
</script>

<div class="p-4">
  <h2 class="text-xl font-bold">{title}</h2>
  {#if description}
    <p class="text-gray-600">{description}</p>
  {/if}
</div>
```

### Using the API Client

```typescript
import { ApiClient } from '@async-agent/api-js-client';

const client = new ApiClient({ baseUrl: 'http://localhost:3000' });

// Fetch goals
const goals = await client.goals.list();

// Create goal
const newGoal = await client.goals.create({
  objective: 'Monitor repository',
  params: { stepBudget: 20 }
});
```

### State Management

Use Svelte 5's runes for reactive state:

```typescript
// In component
let count = $state(0);
let doubled = $derived(count * 2);

// In stores
import { writable } from 'svelte/store';

export const goals = writable([]);
```

## Styling Guidelines

### TailwindCSS

- Use utility classes for styling
- Follow mobile-first responsive design
- Use design tokens from `tailwind.config.js`

### Component Library

- Use `bits-ui` for accessible headless components
- Use `tailwind-variants` for component variants
- Icons from `lucide-svelte`

Example:
```svelte
<script lang="ts">
  import { Button } from 'bits-ui';
  import { Calendar } from 'lucide-svelte';
</script>

<Button.Root class="flex items-center gap-2">
  <Calendar size={16} />
  Schedule
</Button.Root>
```

## Type Safety

### Generated Types

API types are auto-generated from OpenAPI spec:

```bash
# Regenerate API client (from monorepo root)
pnpm generate
```

### Component Props

Always define TypeScript interfaces for component props:

```typescript
interface Props {
  id: string;
  status: 'active' | 'paused' | 'archived';
  onClick?: () => void;
}

let { id, status, onClick }: Props = $props();
```

## Common Patterns

### Loading States

```svelte
<script lang="ts">
  let loading = $state(true);
  let data = $state(null);

  async function fetchData() {
    loading = true;
    try {
      data = await client.goals.list();
    } finally {
      loading = false;
    }
  }
</script>

{#if loading}
  <p>Loading...</p>
{:else if data}
  <ul>
    {#each data as item}
      <li>{item.name}</li>
    {/each}
  </ul>
{/if}
```

### Error Handling

```svelte
<script lang="ts">
  let error = $state<string | null>(null);

  async function handleSubmit() {
    error = null;
    try {
      await client.goals.create({ ... });
    } catch (err) {
      error = err.message;
    }
  }
</script>

{#if error}
  <div class="bg-red-50 text-red-600 p-4 rounded">
    {error}
  </div>
{/if}
```

## Production Build

### Build Process

```bash
# Build for production
pnpm build

# Preview production build locally
pnpm preview
```

### Deployment

The webapp uses `@sveltejs/adapter-node` for Node.js deployment:

1. Build the application:
   ```bash
   pnpm build
   ```

2. The build output is in `build/` directory

3. Deploy as a Node.js application:
   ```bash
   node build/index.js
   ```

4. Set environment variables in production:
   ```bash
   PUBLIC_API_URL=https://api.yourdomain.com
   ```

## Common Issues

### API Connection Failed

- Verify backend is running on `http://localhost:3000`
- Check `PUBLIC_API_URL` in `.env`
- Check CORS settings in backend

### Type Errors After API Changes

```bash
# Regenerate API client
pnpm --filter @async-agent/api-js-client run generate
```

### Build Errors

```bash
# Clean and rebuild
rm -rf .svelte-kit build
pnpm build
```

### Hot Reload Not Working

- Restart dev server: `pnpm dev`
- Check for TypeScript errors: `pnpm check`
- Clear browser cache

## Dependencies

### Production
- `@async-agent/api-js-client` - Generated API client
- `@async-agent/shared` - Shared utilities
- `svelte-markdown` - Markdown rendering

### Development
- `@sveltejs/kit` - SvelteKit framework
- `@sveltejs/adapter-node` - Node.js adapter
- `vite` - Build tool
- `svelte-check` - Type checking
- `tailwindcss` - CSS framework
- `bits-ui` - Component library
- `lucide-svelte` - Icons

## Resources

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Svelte 5 Documentation](https://svelte-5-preview.vercel.app/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [bits-ui Components](https://bits-ui.com/)
