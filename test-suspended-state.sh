#!/bin/bash

# Test script for suspended state and resume functionality

BASE_URL="http://localhost:3000/api/v1"

echo "=== Testing Suspended State and Resume Functionality ==="
echo ""

# Step 1: Create a DAG that will fail
echo "1. Creating a DAG with an invalid tool to trigger suspension..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/create-dag" \
  -H "Content-Type: application/json" \
  -d '{
    "goal-text": "Use invalid_tool to fetch some data",
    "agentName": "testAgent",
    "provider": "openrouter",
    "model": "anthropic/claude-3.5-sonnet",
    "temperature": 0.7
  }')

echo "$CREATE_RESPONSE" | jq .
DAG_ID=$(echo "$CREATE_RESPONSE" | jq -r '.dagId')

if [ "$DAG_ID" = "null" ] || [ -z "$DAG_ID" ]; then
  echo "Failed to create DAG. Exiting."
  exit 1
fi

echo ""
echo "Created DAG: $DAG_ID"
echo ""

# Step 2: Execute the DAG (this should fail and suspend)
echo "2. Executing DAG (expecting it to suspend on error)..."
EXECUTE_RESPONSE=$(curl -s -X POST "$BASE_URL/execute-dag" \
  -H "Content-Type: application/json" \
  -d "{\"dagId\": \"$DAG_ID\"}")

echo "$EXECUTE_RESPONSE" | jq .
EXECUTION_ID=$(echo "$EXECUTE_RESPONSE" | jq -r '.executionId')

if [ "$EXECUTION_ID" = "null" ] || [ -z "$EXECUTION_ID" ]; then
  echo "Failed to start execution. Exiting."
  exit 1
fi

echo ""
echo "Started execution: $EXECUTION_ID"
echo ""

# Step 3: Wait for execution to complete/fail
echo "3. Waiting for execution to suspend (5 seconds)..."
sleep 5

# Step 4: Check execution status
echo "4. Checking execution status..."
STATUS_RESPONSE=$(curl -s "$BASE_URL/dag-execution/$EXECUTION_ID")
echo "$STATUS_RESPONSE" | jq .

STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
echo ""
echo "Current status: $STATUS"
echo ""

# Step 5: Try to resume if suspended
if [ "$STATUS" = "suspended" ] || [ "$STATUS" = "failed" ]; then
  echo "5. Execution is $STATUS. Attempting to resume..."
  RESUME_RESPONSE=$(curl -s -X POST "$BASE_URL/resume-dag/$EXECUTION_ID")
  echo "$RESUME_RESPONSE" | jq .
  
  echo ""
  echo "Waiting for resumed execution (5 seconds)..."
  sleep 5
  
  echo "6. Checking status after resume..."
  FINAL_STATUS=$(curl -s "$BASE_URL/dag-execution/$EXECUTION_ID")
  echo "$FINAL_STATUS" | jq .
else
  echo "Execution is not in suspended/failed state. Current status: $STATUS"
fi

echo ""
echo "=== Test Complete ==="
