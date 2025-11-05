# AsyncAgent WebApp - Quick Start Guide

## Prerequisites ✅

- [x] Node.js >= 18.0.0
- [x] pnpm >= 8.0.0
- [x] AsyncAgent backend running

## 3-Step Setup

### Step 1: Install Dependencies

```bash
cd /Users/ugmurthy/riding-amp/asyncAgent
pnpm install
```

### Step 2: Build API Client

```bash
pnpm --filter @async-agent/api-js-client build
```

### Step 3: Start WebApp

```bash
pnpm --filter @async-agent/webapp dev
```

The application will be available at: **http://localhost:5173**

## Verify Backend Connection

1. Make sure the backend is running:
   ```bash
   pnpm --filter backend dev
   ```
   Backend should be at: **http://localhost:3000**

2. Check backend health:
   ```bash
   curl http://localhost:3000/health
   ```

## What You'll See

- ✅ Responsive navigation bar
- ✅ Dashboard page with demo cards
- ✅ Goals, Runs, and Settings placeholder pages
- ✅ Beautiful Tailwind CSS styling
- ✅ Toast notifications (ready to use)

## Available Routes

| Route | Description |
|-------|-------------|
| `/` | Dashboard (coming in Phase 2) |
| `/goals` | Goals management (coming in Phase 3) |
| `/runs` | Runs monitoring (coming in Phase 4) |
| `/settings` | Settings (coming in Phase 5) |

## Development Commands

```bash
# Start dev server (with hot reload)
pnpm --filter @async-agent/webapp dev

# Type checking
pnpm --filter @async-agent/webapp check

# Build for production
pnpm --filter @async-agent/webapp build

# Preview production build
pnpm --filter @async-agent/webapp preview
```

## Project Structure

```
packages/webApp/
├── src/
│   ├── routes/          # Pages (file-based routing)
│   ├── lib/
│   │   ├── api/         # API client
│   │   ├── ui/          # shadcn components
│   │   ├── stores/      # State management
│   │   └── utils/       # Utilities
│   └── app.css          # Global styles
└── package.json
```

## Common Issues

### Issue: API client not found
**Solution**: Build the API client first
```bash
pnpm --filter @async-agent/api-js-client build
```

### Issue: Backend connection error
**Solution**: Make sure backend is running on port 3000
```bash
pnpm --filter backend dev
```

### Issue: Port 5173 already in use
**Solution**: The dev server will automatically use the next available port

## Environment Variables

Located at `packages/webApp/.env`:
```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
API_BASE_URL=http://localhost:3000/api/v1
```

## Next Steps

1. ✅ Phase 1 Complete - Foundation ready
2. ⏳ Phase 2 - Implement Dashboard
3. ⏳ Phase 3 - Goals Management
4. ⏳ Phase 4 - Runs Monitoring
5. ⏳ Phase 5 - Settings & Agents

## Need Help?

- 📖 See [WEBAPP_ARCHITECTURE.md](./WEBAPP_ARCHITECTURE.md) for detailed architecture
- 📖 See [packages/webApp/README.md](./packages/webApp/README.md) for webapp-specific docs
- 📖 See [PHASE1_COMPLETE.md](./PHASE1_COMPLETE.md) for Phase 1 details

## Success! 🎉

You now have a fully functional SvelteKit application ready for feature development!
