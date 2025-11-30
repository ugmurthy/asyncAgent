#!/bin/bash

# Default database path or first argument
DB_PATH="${1:-data/async-agent.db}"

if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database file not found at $DB_PATH"
    echo "Usage: $0 [path_to_sqlite_db]"
    exit 1
fi

# Get directory and filename
DB_DIR=$(dirname "$DB_PATH")
DB_FILENAME=$(basename "$DB_PATH")
BACKUP_DIR="$DB_DIR/backup"

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
    echo "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
fi

# Generate timestamp DDMMYY-HHMM
TIMESTAMP=$(date +"%d%m%y-%H%M")
BACKUP_FILE="$BACKUP_DIR/$DB_FILENAME.$TIMESTAMP"

echo "Backing up $DB_PATH to $BACKUP_FILE..."

# Create backup
cp "$DB_PATH" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Backup created successfully."
else
    echo "Error: Failed to create backup."
    exit 1
fi

# Keep only last 3 generations
# List files matching the pattern, sort by modification time (newest first)
BACKUPS=$(ls -t "$BACKUP_DIR/$DB_FILENAME".* 2>/dev/null)
COUNT=$(echo "$BACKUPS" | wc -l | xargs) # xargs trims whitespace

if [ "$COUNT" -gt 3 ]; then
    echo "Cleaning up old backups (keeping last 3)..."
    echo "$BACKUPS" | tail -n +4 | xargs rm
    echo "Cleanup complete."
else
    echo "Total backups: $COUNT (limit: 3)"
fi
