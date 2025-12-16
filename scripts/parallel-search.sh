curl https://api.parallel.ai/v1beta/search \
  -H "Content-Type: application/json" \
  -H "x-api-key: $PARALLEL_API_KEY" \
  -H "parallel-beta: search-extract-2025-10-10" \
  -d '{
    "objective": "Find the most recent news on AI advancement in 2025",
    "mode": "agentic",
    "max_results": 10,
    "excerpts": {
      "max_chars_per_result": 10000
    }
  }'

  