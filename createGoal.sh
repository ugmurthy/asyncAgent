#!/bin/bash

curl -X POST http://localhost:3000/api/v1/goals \
  -H "Content-Type: application/json" \
  -d '{
    "objective": "Get the latest news on AI in the last 24 hours",
    "schedule": {
      "cronExpr": "0 0 * * *",
      "timezone": "UTC"
    }
  }'
