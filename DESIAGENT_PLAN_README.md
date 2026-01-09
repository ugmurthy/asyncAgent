# desiAgent Refactoring Plan - Complete Documentation

This folder contains comprehensive planning documents for refactoring the `@async-agent/backend` Fastify API server into a standalone, bun-compatible library called **desiAgent**.

## Documents Overview

### 📋 Core Planning Documents

1. **[DESIAGENT_PLAN_SUMMARY.md](./DESIAGENT_PLAN_SUMMARY.md)** ⭐ START HERE
   - Executive summary of the refactoring
   - High-level overview of what's being done
   - Architecture transformation (HTTP → Library)
   - Configuration example
   - Key decisions & questions
   - ~5 min read

2. **[DESIAGENT_REFACTORING_PLAN.md](./DESIAGENT_REFACTORING_PLAN.md)** - Detailed Plan
   - Complete inventory of routes (40+ APIs)
   - File mapping (what to create/modify/remove)
   - Dependency analysis
   - New library structure
   - Main entry point design
   - Configuration & initialization flow
   - Phases and timeline
   - Challenges & risks (high/medium/low)
   - Testing strategy
   - ~30 min read

3. **[DESIAGENT_IMPLEMENTATION_CHECKLIST.md](./DESIAGENT_IMPLEMENTATION_CHECKLIST.md)** - Execution Guide
   - Detailed week-by-week implementation tasks
   - Checkbox items for each phase
   - Risk mitigation strategies
   - Acceptance criteria
   - Weekly milestones
   - Sign-off section
   - ~40 min read

4. **[DESIAGENT_CODE_REFERENCE.md](./DESIAGENT_CODE_REFERENCE.md)** - Code Examples
   - 11 concrete code examples
   - Installation instructions
   - Setup & usage patterns
   - API examples (goals, agents, DAGs)
   - Error handling
   - HTTP wrapper for backend
   - CLI tool example
   - Configuration reference
   - ~20 min read

---

## Quick Navigation

### For Project Managers / Product Owners
👉 Read: [DESIAGENT_PLAN_SUMMARY.md](./DESIAGENT_PLAN_SUMMARY.md)
- What's being built?
- Why (benefits)?
- What are the risks?
- What's the timeline?

### For Architects / Tech Leads
👉 Read: [DESIAGENT_REFACTORING_PLAN.md](./DESIAGENT_REFACTORING_PLAN.md)
- Detailed architecture
- File structure
- Dependencies
- Implementation challenges
- Design decisions

### For Developers Implementing the Work
👉 Read: [DESIAGENT_IMPLEMENTATION_CHECKLIST.md](./DESIAGENT_IMPLEMENTATION_CHECKLIST.md)
- Phase-by-phase tasks
- What to build first
- Testing requirements
- Acceptance criteria

### For Code Reference & Examples
👉 Read: [DESIAGENT_CODE_REFERENCE.md](./DESIAGENT_CODE_REFERENCE.md)
- How to use the library
- Configuration examples
- API usage patterns
- Integration examples

---

## Key Concepts

### What is desiAgent?

**desiAgent** is a library-first refactoring of the async-agent backend:
- **Pure library**, not a web server
- **Function-based API** (no HTTP routes)
- **Configurable** via setup function
- **bun 1.3.5+** compatible
- Loads agent definitions from `.mdx` files
- Can be wrapped by HTTP servers, CLIs, scripts

### Transformation Example

**BEFORE** (HTTP API):
```bash
GET /api/v1/goals/:id → Route handler → Query DB → JSON response
```

**AFTER** (Library):
```typescript
const goal = await client.goals.get(id) → GoalService → Query DB → Goal object
```

### Core APIs Exported (~40+ functions organized into services)

```
client.goals.*     → Goal management
client.agents.*    → Agent management  
client.dags.*      → DAG creation & execution
client.executions.*→ Execution monitoring
client.runs.*      → Run management
client.tools.*     → Tool discovery
client.artifacts.* → File management
client.executeTask()→ Direct task execution
client.shutdown()  → Cleanup
```

---

## Implementation Timeline

| Phase | Duration | Focus | Risk |
|-------|----------|-------|------|
| **Pre-Implementation** | Week 1 | Setup, planning, dependency analysis | Low |
| **Phase 1-2** | Weeks 1-3 | Foundation, DB, utilities | Low-Medium |
| **Phase 3-4** | Weeks 3-5 | Service extraction, core logic | **HIGH** |
| **Phase 5-6** | Weeks 5-7 | Tools, schedulers, bun testing | **HIGH** |
| **Phase 7-8** | Weeks 7-9 | Testing, documentation, QA | Medium |
| **Phase 9-10** | Weeks 9-11 | Publishing, backend integration | Low |
| **TOTAL** | ~11 weeks | 54-70 hours | - |

---

## Critical Success Factors

✅ **Database Compatibility**: bun:sqlite or better-sqlite3 wrapper must work
✅ **Tool Refactoring**: All tools must adapt to bun subprocess API
✅ **Service Extraction**: Clean separation from HTTP context
✅ **Test Coverage**: 80%+ on core logic before publishing
✅ **Documentation**: Clear examples and API reference
✅ **Backward Compatibility**: Existing backend can wrap library without breaking

---

## High-Risk Areas (Addressed in Plan)

### 🔴 Bun SQLite Compatibility
- **Issue**: `better-sqlite3` is C++ native module
- **Solution**: Create abstraction layer, test bun:sqlite
- **Plan Section**: Phase 4, Database Layer

### 🔴 Tool Subprocess Integration  
- **Issue**: Tools use Node.js child_process API
- **Solution**: Test with bun, create adapters if needed
- **Plan Section**: Phase 5, Tool Refactoring

### 🟡 HTTP Context Removal
- **Issue**: Routes deeply coupled to Fastify request/response
- **Solution**: Automated refactoring + extensive testing
- **Plan Section**: Phase 3, Service Extraction

### 🟡 Agent Definition Format (.mdx)
- **Issue**: Need clear, extensible format for agent configs
- **Solution**: Define Zod schema, provide templates
- **Plan Section**: Phase 1, Configuration

---

## Key Decisions Required (From Plan)

Before starting, confirm:

1. **Repository Strategy**: Keep in monorepo or create separate repo?
2. **Bun Requirement**: Hard requirement or "nice to have"?
3. **API Compatibility**: Can break HTTP signatures or maintain backward compat?
4. **Scheduler Default**: Auto-start or require explicit call?
5. **Agent Schema**: Finalize .mdx frontmatter spec
6. **Package Name**: `@desiagent/core` or `desiagent`?
7. **Priority APIs**: Which 40+ functions are most critical?

---

## Deliverables Checklist

### Phase Deliverables
- [ ] Week 1: Repository setup, types/config, DB abstraction
- [ ] Week 3: Core services (Goals, Agents, Runs)
- [ ] Week 5: DAG service, tools, schedulers ready
- [ ] Week 7: 80%+ test coverage, docs drafted
- [ ] Week 9: Published to npm, QA complete
- [ ] Week 11: Backend integrated, fully tested

### Final Acceptance Criteria
- [ ] Builds/runs on bun 1.3.5+
- [ ] All 40+ APIs exported & documented
- [ ] 80%+ test coverage
- [ ] setupDesiAgent() configurable
- [ ] Agent definitions loadable from .mdx
- [ ] Published to npm
- [ ] Backward compatible with backend
- [ ] Complete documentation & examples

---

## File Structure After Refactoring

```
desiAgent/                           # New library (separate repo)
├── src/
│   ├── index.ts                     # setupDesiAgent() export
│   ├── types/                       # Type definitions
│   ├── errors/                      # Custom error classes
│   ├── core/
│   │   ├── agent/                   # Agent logic (copy from backend)
│   │   ├── execution/               # Goal, Agent, DAG, Run services
│   │   ├── tools/                   # Tool implementations
│   │   └── scheduler/               # Cron & DAG schedulers
│   ├── db/
│   │   ├── schema.ts                # Database schema
│   │   ├── client.ts                # DB initialization
│   │   └── migrations/              # DB migrations
│   └── util/
│       ├── logger.ts
│       ├── env.ts
│       └── mdx-loader.ts            # .mdx agent parser
├── dist/                            # Built output (ES modules)
├── package.json                     # npm/bun config
├── bunfig.toml                      # Bun config
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── LICENSE
└── CHANGELOG.md

packages/backend/                    # Existing backend
├── src/
│   ├── app/
│   │   ├── server.ts                # Thin Fastify wrapper
│   │   └── routes/                  # HTTP route wrappers (rewritten)
│   ├── ... (rest stays same, imports desiAgent)
```

---

## Configuration Example

```typescript
const client = await setupDesiAgent({
  // Required
  llmProvider: 'openai',
  openaiApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-4o',
  
  // Optional (sensible defaults provided)
  databasePath: '~/.desiAgent/data/agent.db',
  agentDefinitionsPath: '~/.desiAgent/agents',
  logLevel: 'info',
});

// Use client.goals.*, client.agents.*, etc.
```

---

## Agent Definition Format

Agents are defined as `.mdx` files in `~/.desiAgent/agents/`:

```mdx
---
name: "DataAnalyzer"
version: "1.0.0"
description: "Analyzes CSV data"
provider: "openai"
model: "gpt-4o"
tags: ["data", "analysis"]
---

# Data Analysis Agent

This agent specializes in analyzing data files...

## Capabilities
- Parse CSV
- Validate data
- Generate reports
```

---

## Testing Strategy

### Unit Tests (Phase 7)
- Services: Goals, Agents, DAGs, Runs
- Tools: Each tool independently
- Utilities: Logger, env, MDX loader
- Target: 80%+ coverage

### Integration Tests (Phase 7)
- Full goal execution flow
- DAG creation and execution
- Agent activation and usage
- Event streaming

### Bun Compatibility Tests (Phase 8)
- Library imports in bun
- Tool execution with bun subprocess
- Database operations
- Module loading

---

## Success Metrics

✅ **Functionality**: All 40+ APIs work identically to current routes
✅ **Code Quality**: ESLint + TypeScript strict mode passing
✅ **Test Coverage**: 80%+ on core logic
✅ **Documentation**: Complete README, API docs, examples
✅ **Publishing**: Published to npm, installable via `npm install desiagent`
✅ **Compatibility**: Works with bun 1.3.5+
✅ **Integration**: Backend successfully uses library

---

## Next Steps

### Immediate (Day 1)
1. ✅ Review all 4 planning documents
2. ✅ Clarify key decisions with team
3. ⏳ Get approvals from:
   - Project Lead
   - Tech Lead
   - QA Lead
   - Product Owner

### Week 1
4. ⏳ Create new repository (if not in monorepo)
5. ⏳ Set up development environment
6. ⏳ Test bun 1.3.5+ compatibility
7. ⏳ Begin Phase 1 (foundation)

### Weeks 2-11
8. ⏳ Follow implementation checklist
9. ⏳ Weekly status updates
10. ⏳ Risk mitigation as needed
11. ⏳ Final QA and publishing

---

## Document Relationships

```
┌─────────────────────────────────────────┐
│  PLAN_SUMMARY.md (Executive)            │
│  "What are we building?"                │
└──────────────┬──────────────────────────┘
               │
         ┌─────┴──────┐
         │            │
   ┌─────▼──────┐  ┌──▼───────────┐
   │ REFACTORING│  │  CHECKLIST   │
   │  PLAN.md   │  │   .md        │
   │ "Details"  │  │ "How to"     │
   └─────┬──────┘  └──┬───────────┘
         │            │
         └────────┬───┘
                  │
            ┌─────▼──────────┐
            │ CODE_REFERENCE │
            │    .md         │
            │ "Examples"     │
            └────────────────┘
```

---

## FAQ

**Q: When do we start?**
A: After approvals from all stakeholders. Estimated Week 1 once approved.

**Q: Can we run in parallel?**
A: Only after Phase 1 (foundation) is complete. Service extraction can parallelize by service (one person per service).

**Q: What if bun:sqlite doesn't work?**
A: We fallback to better-sqlite3 with Node.js runtime. Document as "bun-compatible but requires Node for database layer."

**Q: Can we start with P0 APIs only?**
A: Yes. Plan supports phased rollout. Implement P0 first, add P1/P2 later.

**Q: What about backward compatibility?**
A: HTTP route signatures don't change. Backend wraps library functions with thin adapters.

**Q: How long before we can use it?**
A: MVP (all P0 APIs) in ~6 weeks. Full feature parity in ~11 weeks.

**Q: Do we need to migrate the backend immediately?**
A: No. Backend can stay on old routes while library is developed in parallel. Migration happens in final phase.

---

## Contact & Questions

For questions about the plan:
- Clarifications → Review the 4 planning documents
- Technical concerns → Raise in tech lead discussion
- Timeline questions → Reference Phase breakdown in checklist
- Implementation details → Check code reference examples

---

## Summary

This comprehensive refactoring transforms the Fastify HTTP backend into a pure, bun-compatible library that can be:
- Used directly in scripts/CLIs
- Wrapped by HTTP servers (including existing backend)
- Integrated with any runtime (bun, Node.js, etc.)
- Published to npm for community use

The plan addresses all technical risks, provides detailed checklists, concrete examples, and success criteria.

**Ready to proceed?** Start with [PLAN_SUMMARY.md](./DESIAGENT_PLAN_SUMMARY.md) and follow the checklist in [IMPLEMENTATION_CHECKLIST.md](./DESIAGENT_IMPLEMENTATION_CHECKLIST.md).
