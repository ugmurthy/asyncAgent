#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <dbpath>"
  exit 1
fi

DBPATH="$1"

if [ ! -f "$DBPATH" ]; then
  echo "Error: Database file '$DBPATH' not found"
  exit 1
fi

sqlite3 "$DBPATH" <<EOF
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  cron_expr TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  active INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
EOF

if [ $? -eq 0 ]; then
  echo "schedules table created successfully in $DBPATH"
else
  echo "Error creating schedules table"
  exit 1
fi
