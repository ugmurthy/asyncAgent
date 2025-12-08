# Git Worktrees + Amp Parallel Development Framework

A framework for using git worktrees to work on multiple issues independently with Amp, then merge work together.

## Overview

- **git worktree**: Create isolated working directories from the same repo
- **Amp**: Work independently in each worktree
- **Workflow**: Branch per issue → worktree per issue → Amp work → merge strategy

## Setup

### Prerequisites
```bash
git version 2.36+ (recommended)
pnpm
Amp (configured)
```

### Initial Configuration

Create a base directory for worktrees (keep main repo separate):
```bash
mkdir -p ~/projects/asyncAgent-worktrees
cd ~/projects/asyncAgent-worktrees
git worktree list  # Verify main repo location
```

## Workflow: Single Issue

### 1. Create Worktree for Issue

```bash
# From main repo directory
git worktree add ../asyncAgent-worktrees/issue-[NUMBER] -b feature/issue-[NUMBER] main

# Example:
git worktree add ../asyncAgent-worktrees/issue-123 -b feature/issue-123 main
```

**Worktree naming**: `issue-[NUMBER]` for clarity (matches branch name concept)

### 2. Setup Amp Environment

```bash
cd ../asyncAgent-worktrees/issue-123

# Copy .env from main repo (or create fresh)
cp /original/path/.env .env

# Optional: Isolate database per worktree to avoid conflicts
# sed -i.bak 's/data\/agent.db/data\/agent-issue-123.db/' .env
```

### 3. Work with Amp

```bash
# Install dependencies (only first time per worktree)
pnpm install

# Start Amp work
pnpm dev

# Use Amp CLI/REPL in separate terminal
pnpm --filter cli start

# Make changes, test, commit
git add .
git commit -m "feat(issue-123): description"
```

### 4. Clean Up Worktree

```bash
# When done with issue (after PR review/merge)
cd /original/path

# Remove worktree
git worktree remove ../asyncAgent-worktrees/issue-123
```

## Workflow: Multiple Issues in Parallel

### Setup Multiple Worktrees

```bash
# Issue 1
git worktree add ../asyncAgent-worktrees/issue-101 -b feature/issue-101 main

# Issue 2
git worktree add ../asyncAgent-worktrees/issue-102 -b feature/issue-102 main

# Issue 3
git worktree add ../asyncAgent-worktrees/issue-103 -b feature/issue-103 main
```

### Isolated Development

Each worktree is **completely independent**:
- Separate git index
- Separate node_modules (if needed)
- Separate database (optional but recommended)
- Separate Amp runtime state

**Key**: Use different ports to avoid conflicts:
```bash
# issue-101 worktree
PORT=3001 pnpm dev

# issue-102 worktree (separate terminal)
PORT=3002 pnpm dev

# issue-103 worktree (separate terminal)
PORT=3003 pnpm dev
```

### Organize Terminals

Use tmux/screen or multiple terminal tabs:
```bash
# Terminal 1: issue-101
cd ../asyncAgent-worktrees/issue-101
PORT=3001 pnpm dev

# Terminal 2: issue-102
cd ../asyncAgent-worktrees/issue-102
PORT=3002 pnpm dev

# Terminal 3: issue-103
cd ../asyncAgent-worktrees/issue-103
PORT=3003 pnpm dev

# Terminal 4+: CLI/testing in main repo
cd /original/path
PORT=3001 pnpm --filter cli start  # Connect to issue-101 dev server
```

## Merge Strategy

### Option 1: Sequential Merges (Safe)

```bash
# Merge issue-101 first
cd /original/path
git checkout main
git pull origin main

# Merge worktree branch
git merge feature/issue-101 --no-ff -m "Merge issue-101"

# Resolve any conflicts
git push origin main

# Clean up worktree
git worktree remove ../asyncAgent-worktrees/issue-101

# Then merge issue-102
git merge feature/issue-102 --no-ff -m "Merge issue-102"
```

### Option 2: Rebase for Linear History

```bash
# In worktree
cd ../asyncAgent-worktrees/issue-101

# Rebase onto latest main
git fetch origin main
git rebase origin/main

# Handle conflicts if any
# git rebase --continue

# Force push to feature branch
git push origin feature/issue-101 --force-with-lease

# Create PR for review
```

### Option 3: Cherry-Pick Commits

If worktrees have overlapping changes:

```bash
# List commits in worktree branch
git log main..feature/issue-101

# Cherry-pick specific commits
git cherry-pick <commit-hash>
```

## Database Management

### Shared Database (Default - Risk Conflicts)

```bash
# All worktrees use same data/agent.db
# ✓ Simpler setup
# ✗ Risk of concurrent access issues
# ✗ Test data pollution between issues
```

### Isolated Databases (Recommended)

Create symlinks or use .env overrides:

```bash
# In each worktree setup script
# issue-101
mkdir -p data
ln -s $(pwd)/data/agent-101.db data/agent.db

# issue-102
mkdir -p data
ln -s $(pwd)/data/agent-102.db data/agent.db
```

Or in .env:
```bash
DATABASE_URL=file:./data/agent-issue-101.db
```

## Conflict Resolution Guide

### Type 1: File Conflicts

```bash
# When merging features with overlapping file changes
git status  # See conflicts

# Edit conflicted files, then:
git add <resolved-file>
git commit -m "Resolve merge conflicts"
```

### Type 2: Schema Changes (Database)

If multiple worktrees add migrations:

```bash
# Main repo - apply all pending migrations
pnpm --filter backend db:push

# Or manually merge migration files in schema order
# Rename migrations with timestamps to ensure order:
# 0001_initial.sql
# 0002_issue-101-changes.sql
# 0003_issue-102-changes.sql
```

### Type 3: Dependency Conflicts

```bash
# If two branches update package.json differently
# Merge conflict in pnpm-lock.yaml

# Resolve by reinstalling in main repo
git checkout --ours pnpm-lock.yaml  # or --theirs
pnpm install
pnpm install  # Run twice to regenerate lock file
git add pnpm-lock.yaml
git commit
```

## Automation Scripts

### Create Worktree Script

Save as `create-issue-worktree.sh`:

```bash
#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <issue-number>"
  exit 1
fi

ISSUE=$1
MAIN_REPO="$(cd "$(dirname "$0")" && pwd)"
WORKTREE_DIR="$MAIN_REPO/../asyncAgent-worktrees/issue-$ISSUE"

# Create worktree
git worktree add "$WORKTREE_DIR" -b "feature/issue-$ISSUE" main

cd "$WORKTREE_DIR"

# Setup environment
cp "$MAIN_REPO/.env" .env
sed -i.bak "s/agent.db/agent-issue-$ISSUE.db/" .env

# Install if first time
pnpm install

echo "✓ Worktree created: $WORKTREE_DIR"
echo "✓ Branch: feature/issue-$ISSUE"
echo "✓ Database: data/agent-issue-$ISSUE.db"
echo ""
echo "Next steps:"
echo "  cd $WORKTREE_DIR"
echo "  PORT=$((3000 + $ISSUE)) pnpm dev"
```

Usage:
```bash
./create-issue-worktree.sh 101
./create-issue-worktree.sh 102
```

### Cleanup Script

Save as `cleanup-worktree.sh`:

```bash
#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <issue-number>"
  exit 1
fi

ISSUE=$1
MAIN_REPO="$(cd "$(dirname "$0")" && pwd)"
WORKTREE_DIR="$MAIN_REPO/../asyncAgent-worktrees/issue-$ISSUE"

if [ ! -d "$WORKTREE_DIR" ]; then
  echo "Worktree not found: $WORKTREE_DIR"
  exit 1
fi

# Verify branch is merged
cd "$MAIN_REPO"
BRANCH="feature/issue-$ISSUE"
if git branch -v | grep -q "$BRANCH.*behind"; then
  echo "Branch '$BRANCH' has unmerged commits. Continue? (y/n)"
  read -r response
  if [ "$response" != "y" ]; then
    exit 1
  fi
fi

# Remove worktree and cleanup
git worktree remove "$WORKTREE_DIR"
rm -f "$MAIN_REPO/data/agent-issue-$ISSUE.db"

echo "✓ Worktree removed: $WORKTREE_DIR"
echo "✓ Database cleaned: data/agent-issue-$ISSUE.db"
```

Usage:
```bash
./cleanup-worktree.sh 101
```

## Best Practices

### Before Starting Work

```bash
# Update main branch
git checkout main
git pull origin main

# Create clean worktree from latest
git worktree add ../asyncAgent-worktrees/issue-XYZ -b feature/issue-XYZ main
```

### During Development

- **Commit frequently**: Small, logical commits per issue
- **Test thoroughly**: Use Amp to test changes in isolation
- **Document assumptions**: Note any dependencies on other issues
- **Avoid cross-worktree dependencies**: Each issue should be independent

### Before Merging

```bash
# Ensure clean git status
git status  # Should be clean

# Rebase on latest main (optional but cleaner history)
git fetch origin main
git rebase origin/main

# Run full test suite
pnpm test

# Preview merge conflicts
git diff origin/main..HEAD
```

### Merge Checklist

- [ ] All tests pass
- [ ] Code review approved
- [ ] Database migrations ordered correctly
- [ ] No unresolved conflicts
- [ ] Commit messages are clear
- [ ] Related issues linked in commit

## Troubleshooting

### Worktree Already Exists

```bash
git worktree list
git worktree prune  # Remove stale worktree references
```

### Can't Delete Worktree (In Use)

```bash
# Kill all processes in that worktree directory
lsof | grep "/asyncAgent-worktrees/issue-123"
kill <pids>

# Then remove
git worktree remove ../asyncAgent-worktrees/issue-123 --force
```

### Merge Conflicts on Build Files

```bash
# Don't manually resolve node_modules or pnpm-lock.yaml
# Instead, take main version and reinstall
git checkout --ours pnpm-lock.yaml
pnpm install
pnpm install  # Run twice
```

### Database Locked Errors

If using shared database with parallel worktrees:

```bash
# Solution: Use isolated databases (recommended)
# Or: Only run one dev server at a time

# Stop all dev servers
kill %1 %2 %3  # Kill background jobs

# Use different databases
sed -i 's/agent.db/agent-issue-'$ISSUE'.db/' .env
```

## Example: Three Parallel Issues

### Setup (5 minutes)
```bash
./create-issue-worktree.sh 101
./create-issue-worktree.sh 102
./create-issue-worktree.sh 103
```

### Development (separate terminals)
```bash
# Terminal 1: Issue 101
cd ../asyncAgent-worktrees/issue-101 && PORT=3001 pnpm dev

# Terminal 2: Issue 102
cd ../asyncAgent-worktrees/issue-102 && PORT=3002 pnpm dev

# Terminal 3: Issue 103
cd ../asyncAgent-worktrees/issue-103 && PORT=3003 pnpm dev

# Terminal 4: Main repo (testing)
cd /original/path && pnpm test
```

### Merge (sequential)
```bash
# In main repo
git checkout main && git pull

# Merge and push
git merge feature/issue-101 && git push
git merge feature/issue-102 && git push
git merge feature/issue-103 && git push

# Cleanup
./cleanup-worktree.sh 101
./cleanup-worktree.sh 102
./cleanup-worktree.sh 103
```

## Integration with Amp

### Use Different Ports

```bash
# In each worktree terminal
PORT=300X pnpm dev  # X = 1, 2, 3, etc.

# In separate CLI terminal
curl -X GET http://localhost:300X/api/v1/goals
```

### Isolated Agent Runs

Each worktree has isolated:
- Database state
- Agent execution history
- Tool runs and artifacts
- Generated code

**Benefit**: Run Amp agents concurrently on different issues without interfering with each other.

### Merging Agent Artifacts

```bash
# If issues create artifacts
# Manual merge or use artifact version control

# Option: Tag artifacts with issue number
artifacts/
├── issue-101-build-output.json
├── issue-102-migration.sql
├── issue-103-generated-types.ts
```

## Monitoring Active Worktrees

```bash
# List all worktrees
git worktree list

# Output example:
# /path/to/main (bare)
# /path/to/asyncAgent-worktrees/issue-101  abcd123 [feature/issue-101]
# /path/to/asyncAgent-worktrees/issue-102  efgh456 [feature/issue-102]
```

## When to Use This Framework

### Good Use Cases
- ✓ Multiple independent feature work
- ✓ Parallel bug fixes on different areas
- ✓ Code review + new work simultaneously
- ✓ Long-running experiments without blocking other work

### Not Recommended For
- ✗ Tightly interdependent issues
- ✗ Massive schema changes affecting multiple areas
- ✗ Work requiring coordination during development
