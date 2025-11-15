#!/bin/bash

# Script to trigger a DAG run
# Usage: ./run-dag.sh <dagId>

if [ -z "$1" ]; then
  echo "Error: dagId is required"
  echo "Usage: ./run-dag.sh <dagId>"
  exit 1
fi

DAG_ID="$1"
BASE_URL="http://localhost:3000/api/v1"

echo "Triggering DAG run for dagId: $DAG_ID"
curl -X POST "$BASE_URL/dag-run" \
  -H "Content-Type: application/json" \
  -d "{\"dagId\": \"$DAG_ID\"}" | jq '.'
