#!/bin/bash

# Script to get tool definitions from the async-agent backend
# Usage: ./get-tool.sh [toolname]
# If no toolname is provided, returns all tools

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api/v1}"
TOOL_NAME="${1:-}"

# Build the URL
if [ -z "$TOOL_NAME" ]; then
  URL="${API_BASE_URL}/tools"
else
  URL="${API_BASE_URL}/tools?name=${TOOL_NAME}"
fi

# Make the request
response=$(curl -s -w "\n%{http_code}" "$URL")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

# Check HTTP status
if [ "$http_code" -eq 200 ]; then
  echo "$body" | jq '.' 2>/dev/null || echo "$body"
elif [ "$http_code" -eq 404 ]; then
  echo "Error: Tool '${TOOL_NAME}' not found" >&2
  exit 1
else
  echo "Error: Request failed with status $http_code" >&2
  echo "$body" >&2
  exit 1
fi
