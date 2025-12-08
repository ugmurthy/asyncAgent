#!/bin/bash

# Display status of all active worktrees and their development status

MAIN_REPO="$(cd "$(dirname "$0")/.." && pwd)"

echo "════════════════════════════════════════════════════"
echo "Git Worktree Status"
echo "════════════════════════════════════════════════════"
echo ""

# Show all worktrees
echo "Active Worktrees:"
echo ""

git -C "$MAIN_REPO" worktree list | while IFS= read -r line; do
  # Parse worktree output
  path=$(echo "$line" | awk '{print $1}')
  commit=$(echo "$line" | awk '{print $2}')
  branch=$(echo "$line" | sed 's/.*\[\(.*\)\]/\1/')
  
  if [[ $path == *"issue-"* ]]; then
    issue=$(basename "$path" | sed 's/issue-//')
    
    # Get git status
    cd "$path" 2>/dev/null
    if [ $? -eq 0 ]; then
      changes=$(git status --short | wc -l)
      uncommitted=$(git diff --name-only | wc -l)
      
      echo "  Issue #$issue"
      echo "    Path:      $path"
      echo "    Branch:    $branch"
      echo "    Commit:    $commit"
      echo "    Changes:   $changes files modified"
      
      # Check if dev server likely running on default port
      port=$((3000 + $issue))
      if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "    Status:    🟢 Dev server running (PORT=$port)"
      else
        echo "    Status:    ⭕ Dev server not running"
      fi
      echo ""
    fi
  fi
done

# Show main repo status
echo ""
echo "Main Repository:"
cd "$MAIN_REPO"
echo "  Branch: $(git rev-parse --abbrev-ref HEAD)"
echo "  Remote: $(git config --get remote.origin.url || echo 'Not configured')"
echo ""

echo "════════════════════════════════════════════════════"
echo ""
echo "Useful Commands:"
echo "  Create worktree:  ./scripts/create-issue-worktree.sh <issue-num>"
echo "  Cleanup:          ./scripts/cleanup-worktree.sh <issue-num>"
echo "  List all:         git worktree list"
echo "  Prune stale:      git worktree prune"
echo ""
