#!/bin/bash

# Test the POST /execute-dag route with a JSON file argument

BASE_URL="http://localhost:3000/api/v1"

if [ -z "$1" ]; then
  echo "Usage: $0 <json-file>"
  echo "Example: $0 res.json"
  exit 1
fi

JSON_FILE="$1"

if [ ! -f "$JSON_FILE" ]; then
  echo "Error: File '$JSON_FILE' not found"
  exit 1
fi

echo "Testing POST /execute-dag with $JSON_FILE..."
curl -X POST "$BASE_URL/execute-dag" \
  -H "Content-Type: application/json" \
  -d @"$JSON_FILE" | jq '.'
