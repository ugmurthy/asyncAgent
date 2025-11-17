#!/bin/bash

# Test DAG execution tracking

BASE_URL="http://localhost:3000/api/v1"

echo "=== Testing DAG Execution Tracking ==="
echo ""

# First, create and execute a simple DAG
echo "1. Creating and executing a simple DAG..."
RESPONSE=$(curl -s -X POST "$BASE_URL/create-dag" \
  -H "Content-Type: application/json" \
  -d '{
    "goal-text": "Get the current weather in London",
    "agentName": "DecomposerV5"
  }')

echo "$RESPONSE" | jq '.'

# Extract the DAG job
DAG_JOB=$(echo "$RESPONSE" | jq -c '.result')

if [ "$DAG_JOB" == "null" ]; then
  echo "Failed to create DAG. Exiting."
  exit 1
fi

echo ""
echo "2. Executing the DAG..."
EXEC_RESPONSE=$(curl -s -X POST "$BASE_URL/execute-dag" \
  -H "Content-Type: application/json" \
  -d "$DAG_JOB")

echo "$EXEC_RESPONSE" | jq '.'

# Extract execution ID
EXEC_ID=$(echo "$EXEC_RESPONSE" | jq -r '.executionId')

if [ "$EXEC_ID" == "null" ] || [ -z "$EXEC_ID" ]; then
  echo "Failed to get execution ID. Exiting."
  exit 1
fi

echo ""
echo "Execution ID: $EXEC_ID"

# Wait a moment for database writes
sleep 2

echo ""
echo "3. Retrieving execution details..."
curl -s -X GET "$BASE_URL/dag-executions/$EXEC_ID" | jq '.'

echo ""
echo "4. Retrieving sub-steps..."
curl -s -X GET "$BASE_URL/dag-executions/$EXEC_ID/sub-steps" | jq '.'

echo ""
echo "5. Listing all executions..."
curl -s -X GET "$BASE_URL/dag-executions?limit=5" | jq '.'

echo ""
echo "=== Test Complete ==="
