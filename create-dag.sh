#!/bin/bash

if [ $# -lt 2 ] || [ $# -gt 4 ]; then
  echo "Usage: $0 <goal-text-file> <agentName> [provider] [model]"
  echo "Example: $0 goal.txt decomposer"
  echo "Example: $0 goal.txt decomposer openai gpt-4o"
  exit 1
fi

GOAL_FILE="$1"
AGENT_NAME="$2"
PROVIDER="${3:-}"
MODEL="${4:-}"

if [ ! -f "$GOAL_FILE" ]; then
  echo "Error: File '$GOAL_FILE' not found"
  exit 1
fi

GOAL_TEXT=$(cat "$GOAL_FILE")

PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}/api/v1"

echo "Creating DAG with agent: $AGENT_NAME"
echo "Goal text from: $GOAL_FILE"
echo ""

JSON_PAYLOAD=$(cat <<EOF
{
  "goal-text": $(echo "$GOAL_TEXT" | jq -Rs .),
  "agentName": "$AGENT_NAME"
}
EOF
)

if [ -n "$PROVIDER" ]; then
  JSON_PAYLOAD=$(echo "$JSON_PAYLOAD" | jq --arg p "$PROVIDER" '. + {provider: $p}')
fi

if [ -n "$MODEL" ]; then
  JSON_PAYLOAD=$(echo "$JSON_PAYLOAD" | jq --arg m "$MODEL" '. + {model: $m}')
fi

curl -X POST "$BASE_URL/create-dag" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" | jq '.'
