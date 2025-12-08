# Git Worktrees + Amp: Quick Start

## TL;DR

Use git worktrees to work on multiple issues simultaneously with full isolation.

### Quick Commands

```bash
# Create worktree for issue 101 (auto-assigns port 3101)
./scripts/create-issue-worktree.sh 101

# Start development
cd ../asyncAgent-worktrees/issue-101
pnpm dev              # Backend on port 3101

# In another terminal, use CLI with that issue's database
PORT=3101 pnpm --filter cli start

# Merge when done
cd /path/to/main-repo
git merge feature/issue-101
./scripts/cleanup-worktree.sh 101

# Check status
./scripts/worktree-status.sh
```

## Setup (One Time)

```bash
cd /path/to/asyncAgent
chmod +x scripts/create-issue-worktree.sh
chmod +x scripts/cleanup-worktree.sh
chmod +x scripts/worktree-status.sh
```

## Three-Issue Example (10 minutes total)

### 1. Create Worktrees (2 min)

```bash
cd /path/to/asyncAgent

./scripts/create-issue-worktree.sh 101
./scripts/create-issue-worktree.sh 102
./scripts/create-issue-worktree.sh 103
```

This creates:
- `/path/to/asyncAgent-worktrees/issue-101` (port 3101)
- `/path/to/asyncAgent-worktrees/issue-102` (port 3102)
- `/path/to/asyncAgent-worktrees/issue-103` (port 3103)

Each has isolated database + node_modules.

### 2. Start Development (5 min)

**Terminal 1 - Issue 101:**
```bash
cd ../asyncAgent-worktrees/issue-101
pnpm dev
```

**Terminal 2 - Issue 102:**
```bash
cd ../asyncAgent-worktrees/issue-102
pnpm dev
```

**Terminal 3 - Issue 103:**
```bash
cd ../asyncAgent-worktrees/issue-103
pnpm dev
```

**Terminal 4 - CLI for Issue 101:**
```bash
cd /path/to/asyncAgent
PORT=3101 pnpm --filter cli start
```

### 3. Work with Amp

Each issue has:
- ✅ Isolated database (`data/agent-issue-10X.db`)
- ✅ Separate git branch (`feature/issue-10X`)
- ✅ Separate port (3101, 3102, 3103)
- ✅ Independent runtime state

Run Amp agents, make changes, commit as normal.

```bash
# In worktree directory
git add .
git commit -m "feat: implement issue 101"
```

### 4. Merge and Cleanup (3 min)

```bash
# Back in main repo
cd /path/to/asyncAgent

# Merge issues one by one
git checkout main
git pull origin main
git merge feature/issue-101 --no-ff
git push origin main

./scripts/cleanup-worktree.sh 101

# Repeat for 102, 103
git merge feature/issue-102 --no-ff && git push origin main
./scripts/cleanup-worktree.sh 102

git merge feature/issue-103 --no-ff && git push origin main
./scripts/cleanup-worktree.sh 103
```

## Key Concepts

### Git Worktrees
- Creates multiple working directories from same repo
- Each has own branch, index, git state
- **Completely isolated** - changes in one don't affect others

### Isolated Databases
- Each worktree has `data/agent-issue-10X.db`
- Amp runs independently on each
- No data conflicts between issues
- Clean state per issue

### Independent Amp Execution
- Each worktree runs on different port
- Agents don't interfere with each other
- Test results are isolated
- Artifacts stored in each worktree

## When to Use

### ✅ Perfect For
- Multiple feature branches being developed in parallel
- Working on code while reviews/tests run on other issues
- Experimenting with Amp without affecting other work
- Complex changes requiring isolated databases

### ❌ Avoid When
- Issues have tight dependencies (need coordination)
- Require frequent syncing between issues
- Database schema conflicts between issues

## Merging Strategy

### Safe (Sequential)
```bash
# Merge one at a time, push to main, then cleanup
git merge feature/issue-101
git push
cleanup 101

git merge feature/issue-102
git push
cleanup 102
```

### With Conflicts
```bash
# If conflicts occur during merge:
# 1. Resolve manually
# 2. For database migrations: ensure sequential ordering
# 3. For pnpm-lock.yaml: use main version + reinstall

git merge feature/issue-101
# Conflicts appear
git add <resolved-files>
git commit -m "Resolve merge conflicts"
git push
```

## Troubleshooting

### Worktree already exists
```bash
git worktree list
git worktree prune  # Clean stale references
```

### Database locked
```bash
# Stop dev servers
kill %1 %2 %3

# Or use isolated databases (default with setup script)
```

### Can't remove worktree
```bash
./scripts/cleanup-worktree.sh <issue> --force
```

### Check worktree status
```bash
./scripts/worktree-status.sh
```

## Real-World Workflow

```bash
# Day 1: Start three features
./scripts/create-issue-worktree.sh 101
./scripts/create-issue-worktree.sh 102
./scripts/create-issue-worktree.sh 103

# Day 2-3: Develop in parallel
# (3 terminals, one per issue)

# Day 4: First feature review complete
cd ../asyncAgent-worktrees/issue-101
git rebase origin/main     # Handle any main changes
git push origin feature/issue-101

# Create PR, get approval

# Day 5: Merge first feature
git checkout main
git pull
git merge feature/issue-101
git push
./scripts/cleanup-worktree.sh 101

# Continue with 102, 103

# Issues 102/103 auto-merge on main
git merge feature/issue-102
git push
./scripts/cleanup-worktree.sh 102
```

## Performance Notes

- Each worktree has full copy of `node_modules` (minimal disk overhead with pnpm)
- Databases are separate SQLite files (negligible impact)
- Multiple Amp servers on different ports (fine - they're independent)
- No performance penalty compared to switching branches

## See Also

- [GIT_WORKTREES_FRAMEWORK.md](GIT_WORKTREES_FRAMEWORK.md) - Complete reference
- `git worktree --help` - Official documentation
