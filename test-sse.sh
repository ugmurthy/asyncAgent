#!/bin/bash

# Test SSE Stream for DAG Execution Tracking

BASE_URL="http://localhost:3000/api/v1"

echo "=== Testing SSE Stream for DAG Execution ===" 
echo ""

# Step 1: Create a DAG
echo "Step 1: Creating DAG..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/create-dag" \
  -H "Content-Type: application/json" \
  -d '{
    "goal-text": "What is the current weather in London?",
    "agentName": "DecomposerV5"
  }')

echo "$CREATE_RESPONSE" | jq '.'
echo ""

# Extract the DAG job
DAG_JOB=$(echo "$CREATE_RESPONSE" | jq '.result')

# Step 2: Start execution (non-blocking)
echo "Step 2: Starting DAG execution (async)..."
EXEC_RESPONSE=$(curl -s -X POST "$BASE_URL/execute-dag" \
  -H "Content-Type: application/json" \
  -d "$DAG_JOB")

echo "$EXEC_RESPONSE" | jq '.'
echo ""

EXECUTION_ID=$(echo "$EXEC_RESPONSE" | jq -r '.executionId')
echo "Execution ID: $EXECUTION_ID"
echo ""

# Step 3: Connect to SSE stream immediately (run for 30 seconds or until done)
echo "Step 3: Connecting to SSE stream for live updates..."
echo "Events received:"
echo "---"

timeout 30s curl -N -s "$BASE_URL/dag-executions/$EXECUTION_ID/events" || true

echo ""
echo "---"
echo ""

# Step 4: Get final execution state
echo "Step 4: Getting final execution state..."
FINAL_STATE=$(curl -s "$BASE_URL/dag-executions/$EXECUTION_ID")
echo "$FINAL_STATE" | jq '{
  id,
  status,
  totalTasks,
  completedTasks,
  failedTasks,
  durationMs
}'

echo ""
echo "=== Test Complete ==="
