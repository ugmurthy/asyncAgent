#!/bin/bash

AGENT_NAME="DecomposerV7"
GOAL_FILE=""

while getopts "f:" opt; do
  case $opt in
    f)
      GOAL_FILE="$OPTARG"
      ;;
    *)
      echo "Usage: $0 -f <goal-text-file>"
      echo "Example: $0 -f goal.txt"
      exit 1
      ;;
  esac
done

if [ -z "$GOAL_FILE" ]; then
  echo "Usage: $0 -f <goal-text-file>"
  echo "Example: $0 -f goal.txt"
  exit 1
fi

if [ ! -f "$GOAL_FILE" ]; then
  echo "Error: File '$GOAL_FILE' not found"
  exit 1
fi

GOAL_TEXT=$(cat "$GOAL_FILE")

PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}/api/v1"

echo "Creating and executing DAG with agent: $AGENT_NAME"
echo "Goal text from: $GOAL_FILE"
echo ""

JSON_PAYLOAD=$(jq -n \
  --arg goal "$GOAL_TEXT" \
  --arg agent "$AGENT_NAME" \
  '{"goal-text": $goal, "agentName": $agent}')

curl -X POST "$BASE_URL/create-and-execute-dag" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" | jq '.'
