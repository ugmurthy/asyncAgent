#!/bin/bash

# Test the POST /dag-experiments route
# Usage: ./do-dag-experitments.sh -a agentName -m "gpt-4o,gpt-4o-mini" -t "0.0,0.5,1.0" [-p providerName] [-g "goal text"] [-s seed]

BASE_URL="http://localhost:3000/api/v1"

AGENT_NAME=""
PROVIDER_NAME="openrouter-fetch"
MODELS=""
TEMPERATURES=""
GOAL_TEXT="Create a simple web server that responds with hello world"
SEED=-1
GOAL_FILE=""

while getopts "a:p:m:t:g:s:" opt; do
  case $opt in
    a) AGENT_NAME="$OPTARG" ;;
    p) PROVIDER_NAME="$OPTARG" ;;
    m) MODELS="$OPTARG" ;;
    t) TEMPERATURES="$OPTARG" ;;
    g) GOAL_FILE="$OPTARG" ;;
    s) SEED="$OPTARG" ;;
    *)
      echo "Usage: $0 -a agentName -m models -t temperatures [-p providerName] [-g goal-file] [-s seed]"
      echo "  -a: Agent name (required)"
      echo "  -p: Provider name (optional, default: openrouter-fetch)"
      echo "  -m: Comma-separated models (e.g., 'gpt-4o,gpt-4o-mini')"
      echo "  -t: Comma-separated temperatures (e.g., '0.0,0.5,1.0')"
      echo "  -g: File containing goal text (optional)"
      echo "  -s: Random seed (optional, default: -1, excluded from request if -1)"
      exit 1
      ;;
  esac
done

if [ -n "$GOAL_FILE" ]; then
  if [ ! -f "$GOAL_FILE" ]; then
    echo "Error: Goal file '$GOAL_FILE' not found"
    exit 1
  fi
  GOAL_TEXT=$(cat "$GOAL_FILE")
fi

if [ -z "$AGENT_NAME" ] || [ -z "$MODELS" ] || [ -z "$TEMPERATURES" ]; then
  echo "Error: -a (agent name), -m (models), and -t (temperatures) are required"
  exit 1
fi

IFS=',' read -ra MODEL_ARRAY <<< "$MODELS"
IFS=',' read -ra TEMP_ARRAY <<< "$TEMPERATURES"

MODELS_JSON=$(printf '"%s",' "${MODEL_ARRAY[@]}" | sed 's/,$//')
TEMPS_JSON=$(printf '%s,' "${TEMP_ARRAY[@]}" | sed 's/,$//')

# Build the JSON payload
PAYLOAD="{
  \"agentName\": \"$AGENT_NAME\",
  \"provider\": \"$PROVIDER_NAME\",
  \"goal-text\": \"$GOAL_TEXT\",
  \"models\": [$MODELS_JSON],
  \"temperatures\": [$TEMPS_JSON]"

# Only include seed if it's not -1
if [ "$SEED" -ne -1 ]; then
  PAYLOAD="$PAYLOAD,
  \"seed\": $SEED"
fi

PAYLOAD="$PAYLOAD
}"

echo " POST /dag-experiments..."
curl -X POST "$BASE_URL/dag-experiments" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | jq '.'
 
