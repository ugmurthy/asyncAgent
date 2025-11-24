#!/bin/bash

# task.sh - Execute an agent task with optional file attachments
# Usage: ./task.sh <taskName> <prompt> [file1 file2 ...]

# Check required arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <taskName> <prompt> [file1 file2 ...]"
    echo "Example: $0 code-reviewer 'Review this code' main.ts utils.ts"
    exit 1
fi

TASK_NAME="$1"
PROMPT="$2"
shift 2
FILES=("$@")

API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api/v1}"
ENDPOINT="${API_BASE_URL}/task"

# Build curl command with form data
CURL_CMD="curl -X POST \"$ENDPOINT\""
CURL_CMD="$CURL_CMD -F \"taskName=$TASK_NAME\""
CURL_CMD="$CURL_CMD -F \"prompt=$PROMPT\""

# Add files if provided
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        CURL_CMD="$CURL_CMD -F \"files=@$file\""
    else
        echo "Warning: File not found: $file (skipping)"
    fi
done

# Execute the request
eval "$CURL_CMD"
