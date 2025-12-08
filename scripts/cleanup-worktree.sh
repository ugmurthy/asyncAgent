#!/bin/bash

# Git Worktree Cleanup Script
# Usage: ./cleanup-worktree.sh <issue-number> [--force]

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <issue-number> [--force]"
  echo "Example: $0 101"
  exit 1
fi

ISSUE=$1
FORCE=${2:-}

# Get main repo directory
MAIN_REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORKTREE_BASE="$MAIN_REPO/../asyncAgent-worktrees"
WORKTREE_DIR="$WORKTREE_BASE/issue-$ISSUE"
BRANCH="feature/issue-$ISSUE"
DB_FILE="$MAIN_REPO/data/agent-issue-$ISSUE.db"

# Verify main repo
if [ ! -d "$MAIN_REPO/.git" ]; then
  echo "✗ Not in a git repository"
  exit 1
fi

# Check if worktree exists
if [ ! -d "$WORKTREE_DIR" ]; then
  echo "✗ Worktree not found: $WORKTREE_DIR"
  exit 1
fi

# Check if branch is merged (unless --force)
if [ "$FORCE" != "--force" ]; then
  echo "Checking if $BRANCH is merged..."
  
  # Get current branch and latest main
  cd "$MAIN_REPO"
  git fetch origin main --quiet 2>/dev/null || true
  
  # Check if branch has unmerged commits
  if git log origin/main.."$BRANCH" --oneline 2>/dev/null | grep -q .; then
    echo ""
    echo "⚠ Branch '$BRANCH' has unmerged commits:"
    git log origin/main.."$BRANCH" --oneline
    echo ""
    echo "Continue cleanup? Type 'yes' to confirm or press Ctrl+C to cancel:"
    read -r response
    if [ "$response" != "yes" ]; then
      echo "Cleanup cancelled"
      exit 0
    fi
  else
    echo "✓ Branch is merged"
  fi
fi

# Kill any processes using the worktree
echo "Cleaning up processes..."
PIDS=$(lsof "$WORKTREE_DIR" 2>/dev/null | awk 'NR>1 {print $2}' | sort -u || true)
if [ -n "$PIDS" ]; then
  echo "Killing processes using worktree:"
  echo "$PIDS" | xargs -I {} bash -c 'echo "  PID {}"; kill {} 2>/dev/null || true'
  sleep 1
fi

# Remove worktree
echo "Removing worktree..."
cd "$MAIN_REPO"

if [ "$FORCE" == "--force" ]; then
  git worktree remove "$WORKTREE_DIR" --force
  echo "✓ Worktree removed (forced)"
else
  git worktree remove "$WORKTREE_DIR"
  echo "✓ Worktree removed"
fi

# Remove isolated database if it exists
if [ -f "$DB_FILE" ]; then
  rm -f "$DB_FILE"
  echo "✓ Database cleaned: data/agent-issue-$ISSUE.db"
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "✓ Cleanup Complete"
echo "════════════════════════════════════════════════════"
echo ""
echo "Worktree:  $WORKTREE_DIR (removed)"
echo "Branch:    $BRANCH (still exists locally)"
echo ""
echo "To also delete the branch:"
echo "  git branch -d $BRANCH         # Safe delete (if merged)"
echo "  git branch -D $BRANCH         # Force delete"
echo ""
echo "To delete remote branch:"
echo "  git push origin --delete $BRANCH"
echo "════════════════════════════════════════════════════"
