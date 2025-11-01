# async-agent-client

Python client for the Async Agent API.

## Installation

```bash
pip install async-agent-client
```

## Usage

```python
from async_agent_client import Client

client = Client(base_url="http://localhost:3000")

# List all goals
goals = client.goals.list_goals()

# Create a goal
goal = client.goals.create_goal(json_body={
    "objective": "Monitor GitHub repository for new issues",
    "params": {
        "stepBudget": 20
    }
})

# Trigger a run
run = client.goals.trigger_goal_run(id=goal.id, json_body={})
```

## Development

This client is auto-generated from the OpenAPI specification.

To regenerate:
```bash
npm run generate
```

## Requirements

- Python >= 3.8
- httpx >= 0.23.0
- attrs >= 21.3.0
- python-dateutil >= 2.8.0
