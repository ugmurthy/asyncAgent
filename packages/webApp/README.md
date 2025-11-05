# AsyncAgent Web Application

A modern web-based monitoring and management interface for the AsyncAgent system, built with SvelteKit, Tailwind CSS, and shadcn/svelte components.

## Features

- 📊 **Dashboard** - System overview with statistics and charts
- 🎯 **Goals Management** - Create, view, edit, and manage agent goals
- ▶️ **Runs Monitoring** - Track execution runs and view detailed step-by-step logs
- ⚙️ **Settings** - Configure agents and manage prompt templates
- 🎨 **Modern UI** - Beautiful, responsive interface with Tailwind CSS
- 🚀 **Fast** - Built on SvelteKit for optimal performance

## Tech Stack

- **Framework**: SvelteKit 2.x (with TypeScript)
- **Styling**: Tailwind CSS 3.x
- **Components**: shadcn/svelte (customizable component library)
- **API Client**: @async-agent/api-js-client (auto-generated from OpenAPI spec)
- **Package Manager**: pnpm

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- AsyncAgent backend running on `http://localhost:3000`

### Installation

From the root of the monorepo:

```bash
# Install dependencies
pnpm install

# Build the API client (required)
pnpm --filter @async-agent/api-js-client build
```

### Development

```bash
# Start development server
pnpm --filter @async-agent/webapp dev

# The app will be available at http://localhost:5173
```

### Build for Production

```bash
# Build the application
pnpm --filter @async-agent/webapp build

# Preview production build
pnpm --filter @async-agent/webapp preview
```

### Type Checking

```bash
# Run type checking
pnpm --filter @async-agent/webapp check

# Watch mode
pnpm --filter @async-agent/webapp check:watch
```

## Environment Variables

Create a `.env` file in the `packages/webApp` directory:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000/api/v1
API_BASE_URL=http://localhost:3000/api/v1
```

## Project Structure

```
packages/webApp/
├── src/
│   ├── routes/              # SvelteKit file-based routing
│   │   ├── +layout.svelte   # Root layout with navigation
│   │   ├── +page.svelte     # Dashboard page
│   │   ├── goals/           # Goals pages
│   │   ├── runs/            # Runs pages
│   │   └── settings/        # Settings pages
│   │
│   ├── lib/
│   │   ├── api/             # API client configuration
│   │   ├── components/      # Custom Svelte components
│   │   ├── ui/              # shadcn/svelte components
│   │   ├── stores/          # Svelte stores for state management
│   │   └── utils/           # Utility functions
│   │
│   ├── app.css              # Global Tailwind styles
│   └── app.html             # HTML template
│
├── static/                  # Static assets
├── package.json
├── svelte.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Available Routes

- `/` - Dashboard with system overview
- `/goals` - List and manage goals
- `/goals/[id]` - Goal details
- `/goals/new` - Create new goal
- `/runs` - List and monitor runs
- `/runs/[id]` - Run details with steps
- `/settings` - System settings
- `/settings/agents` - Agent and prompt management

## Development Workflow

1. **Start the backend**: Make sure the AsyncAgent backend is running
2. **Start the webapp**: Run `pnpm --filter @async-agent/webapp dev`
3. **Make changes**: Edit files in `src/`
4. **Hot reload**: Changes will automatically reload in the browser
5. **Check types**: Run `pnpm --filter @async-agent/webapp check` before committing

## UI Components

The app uses shadcn/svelte components, which are:

- **Accessible**: Built with accessibility in mind
- **Customizable**: Full control over styling with Tailwind
- **Type-safe**: Written in TypeScript
- **Modern**: Uses Svelte 5 features

Available components:
- Button
- Card (with Header, Title, Content)
- Badge
- More components to be added in future phases

## State Management

- **SvelteKit Load Functions**: Server-side data fetching
- **Svelte Stores**: Client-side state management
- **Notifications**: Toast notifications for user feedback

## API Integration

The app uses the auto-generated API client from `@async-agent/api-js-client`:

```typescript
import { apiClient, goals, runs, agents, health } from '$lib/api/client';

// Use in load functions or components
const goalsList = await goals.listGoals();
```

## Contributing

1. Follow the existing code style
2. Use TypeScript strictly
3. Keep components small and focused
4. Test your changes thoroughly
5. Run type checking before committing

## Roadmap

### Phase 1: Setup ✅ (Complete)
- SvelteKit project setup
- Tailwind CSS configuration
- shadcn/svelte components
- API client integration
- Basic layout and navigation

### Phase 2: Dashboard (In Progress)
- Statistics cards
- Status charts
- Recent activity feed
- System health display

### Phase 3: Goals Management
- Goals list with filtering
- Goal detail page
- Create/edit goal forms
- Goal actions (trigger, pause, delete)

### Phase 4: Runs Management
- Runs list with filtering
- Run detail page
- Steps timeline visualization
- Real-time updates

### Phase 5: Settings & Agents
- Agent management
- Prompt template editor
- System configuration

### Phase 6: Polish & Optimization
- Responsive design refinement
- Performance optimization
- Accessibility improvements
- Error handling

## License

MIT
