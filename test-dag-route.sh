#!/bin/bash

# Test the POST /execute-dag route

BASE_URL="http://localhost:3000/api/v1"

echo "Testing POST /execute-dag with clarification needed..."
curl -X POST "$BASE_URL/execute-dag" \
  -H "Content-Type: application/json" \
  -d '{
    "original_request": "Test request",
    "intent": {
      "primary": "test",
      "sub_intents": ["test"]
    },
    "entities": [],
    "sub_tasks": [],
    "synthesis_plan": "Test plan",
    "validation": {
      "coverage": "high",
      "gaps": [],
      "iteration_triggers": []
    },
    "clarification_needed": true,
    "clarification_query": "Please provide more details"
  }' | jq '.'

echo -e "\n\nTesting POST /execute-dag with actual job (using res.json)..."
curl -X POST "$BASE_URL/execute-dag" \
  -H "Content-Type: application/json" \
  -d @res.json | jq '.'
