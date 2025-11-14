#!/bin/bash

# Test the POST /dag-experiments route
# Usage: ./do-dag-experitments.sh -m "gpt-4o,gpt-4o-mini" -t "0.0,0.5,1.0" [-g "goal text"] [-s seed]

BASE_URL="http://localhost:3000/api/v1"

MODELS=""
TEMPERATURES=""
GOAL_TEXT="Create a simple web server that responds with hello world"
SEED=42
GOAL_FILE=""

while getopts "m:t:g:s:" opt; do
  case $opt in
    m) MODELS="$OPTARG" ;;
    t) TEMPERATURES="$OPTARG" ;;
    g) GOAL_FILE="$OPTARG" ;;
    s) SEED="$OPTARG" ;;
    *)
      echo "Usage: $0 -m models -t temperatures [-g goal-file] [-s seed]"
      echo "  -m: Comma-separated models (e.g., 'gpt-4o,gpt-4o-mini')"
      echo "  -t: Comma-separated temperatures (e.g., '0.0,0.5,1.0')"
      echo "  -g: File containing goal text (optional)"
      echo "  -s: Random seed (optional, default: 42)"
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

if [ -z "$MODELS" ] || [ -z "$TEMPERATURES" ]; then
  echo "Error: -m (models) and -t (temperatures) are required"
  exit 1
fi

IFS=',' read -ra MODEL_ARRAY <<< "$MODELS"
IFS=',' read -ra TEMP_ARRAY <<< "$TEMPERATURES"

MODELS_JSON=$(printf '"%s",' "${MODEL_ARRAY[@]}" | sed 's/,$//')
TEMPS_JSON=$(printf '%s,' "${TEMP_ARRAY[@]}" | sed 's/,$//')

echo "Testing POST /dag-experiments..."
curl -X POST "$BASE_URL/dag-experiments" \
  -H "Content-Type: application/json" \
  -d "{
    \"goal-text\": \"$GOAL_TEXT\",
    \"models\": [$MODELS_JSON],
    \"temperatures\": [$TEMPS_JSON],
    \"seed\": $SEED
  }" | jq '.'
