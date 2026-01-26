#!/bin/bash
# Download agents table as CSV

API_URL="${API_URL:-http://localhost:3000/api/v1}"
OUTPUT_FILE="${1:-agents.csv}"

# Fetch agents and convert to CSV using jq
curl -s "$API_URL/agents" | jq -r '
  # CSV header
  ["id","name","version","promptTemplate","provider","model","active","metadata","createdAt","updatedAt"],
  # CSV rows
  (.[] | [.id, .name, .version, .promptTemplate, (.provider // ""), (.model // ""), .active, (.metadata | tostring), .createdAt, .updatedAt])
  | @csv
' > "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
  echo "Saved to $OUTPUT_FILE"
  echo "$(tail -n +2 "$OUTPUT_FILE" | wc -l | tr -d ' ') agents exported"
else
  echo "Error: Failed to fetch agents" >&2
  exit 1
fi
