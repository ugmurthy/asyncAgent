#!/bin/bash

# Git Worktree Creation Script
# Usage: ./create-issue-worktree.sh <issue-number> [port]

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <issue-number> [port]"
  echo "Example: $0 101 3001"
  exit 1
fi

ISSUE=$1
PORT=${2:-$((3000 + $1))}

# Get main repo directory
MAIN_REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORKTREE_BASE="$MAIN_REPO/../asyncAgent-worktrees"
WORKTREE_DIR="$WORKTREE_BASE/issue-$ISSUE"

# Verify main repo
if [ ! -d "$MAIN_REPO/.git" ]; then
  echo "✗ Not in a git repository"
  exit 1
fi

# Create worktree base directory if needed
mkdir -p "$WORKTREE_BASE"

# Check if worktree already exists
if [ -d "$WORKTREE_DIR" ]; then
  echo "✗ Worktree already exists: $WORKTREE_DIR"
  echo "  To remove: git worktree remove $WORKTREE_DIR"
  exit 1
fi

echo "Creating worktree for issue #$ISSUE..."

# Create worktree
if ! git -C "$MAIN_REPO" worktree add "$WORKTREE_DIR" -b "feature/issue-$ISSUE" main; then
  echo "✗ Failed to create worktree"
  exit 1
fi

echo "✓ Worktree created at $WORKTREE_DIR"

# Setup environment
cd "$WORKTREE_DIR"

# Copy .env from main repo
if [ -f "$MAIN_REPO/.env" ]; then
  cp "$MAIN_REPO/.env" .env
  # Update database path if using isolated DB
  if [ "$(uname)" == "Darwin" ]; then
    sed -i '' "s/agent\.db/agent-issue-$ISSUE.db/" .env
  else
    sed -i "s/agent\.db/agent-issue-$ISSUE.db/" .env
  fi
  echo "✓ .env configured with isolated database"
else
  echo "⚠ .env not found in main repo, copy manually or use .env.example"
fi

# Setup port in .env if needed
if [ -f .env ]; then
  if grep -q "^PORT=" .env; then
    if [ "$(uname)" == "Darwin" ]; then
      sed -i '' "s/^PORT=.*/PORT=$PORT/" .env
    else
      sed -i "s/^PORT=.*/PORT=$PORT/" .env
    fi
  else
    echo "PORT=$PORT" >> .env
  fi
  echo "✓ PORT=$PORT configured"
fi

# Install dependencies
echo "Installing dependencies..."
if ! pnpm install; then
  echo "⚠ pnpm install had issues, but continuing..."
fi
echo "✓ Dependencies installed"

# Create data directory
mkdir -p data

echo ""
echo "════════════════════════════════════════════════════"
echo "✓ Worktree Setup Complete"
echo "════════════════════════════════════════════════════"
echo ""
echo "Location:  $WORKTREE_DIR"
echo "Branch:    feature/issue-$ISSUE"
echo "Database:  data/agent-issue-$ISSUE.db"
echo "Port:      $PORT"
echo ""
echo "Next steps:"
echo "  1. cd $WORKTREE_DIR"
echo "  2. pnpm dev              # Starts backend on PORT=$PORT"
echo "  3. In another terminal:"
echo "     PORT=$PORT pnpm --filter cli start"
echo ""
echo "To remove after merge:"
echo "  ./scripts/cleanup-worktree.sh $ISSUE"
echo "════════════════════════════════════════════════════"
