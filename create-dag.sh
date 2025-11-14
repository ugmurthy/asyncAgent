#!/bin/bash

if [ $# -lt 2 ] || [ $# -gt 7 ]; then
  echo "Usage: $0 <goal-text-file> <agentName> [provider] [model] [temperature] [seed] [maxtokens]"
  echo "Example: $0 goal.txt decomposer"
  echo "Example: $0 goal.txt decomposer openai gpt-4o"
  echo "Example: $0 goal.txt decomposer openai gpt-4o 0.7 42 2000"
  exit 1
fi

GOAL_FILE="$1"
AGENT_NAME="$2"
PROVIDER="${3:-}"
MODEL="${4:-}"
TEMPERATURE="${5:-}"
SEED="${6:-}"
MAXTOKENS="${7:-}"

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

if [ -n "$TEMPERATURE" ]; then
  if ! awk -v t="$TEMPERATURE" 'BEGIN { exit !(t >= 0 && t <= 2) }'; then
    echo "Error: temperature must be between 0 and 2"
    exit 1
  fi
  JSON_PAYLOAD=$(echo "$JSON_PAYLOAD" | jq --argjson t "$TEMPERATURE" '. + {temperature: $t}')
fi

if [ -n "$SEED" ]; then
  JSON_PAYLOAD=$(echo "$JSON_PAYLOAD" | jq --argjson s "$SEED" '. + {seed: $s}')
fi

if [ -n "$MAXTOKENS" ]; then
  JSON_PAYLOAD=$(echo "$JSON_PAYLOAD" | jq --argjson m "$MAXTOKENS" '. + {max_tokens: $m}')
fi

curl -X POST "$BASE_URL/create-dag" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" | jq '.'
