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

# Create backup of main database file
cp "$DB_PATH" "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    echo "Error: Failed to create backup."
    exit 1
fi

# Backup WAL file if it exists
if [ -f "$DB_PATH-wal" ]; then
    cp "$DB_PATH-wal" "$BACKUP_FILE-wal"
    if [ $? -eq 0 ]; then
        echo "Backed up WAL file: $BACKUP_FILE-wal"
    else
        echo "Warning: Failed to backup WAL file"
    fi
fi

# Backup SHM file if it exists
if [ -f "$DB_PATH-shm" ]; then
    cp "$DB_PATH-shm" "$BACKUP_FILE-shm"
    if [ $? -eq 0 ]; then
        echo "Backed up SHM file: $BACKUP_FILE-shm"
    else
        echo "Warning: Failed to backup SHM file"
    fi
fi

echo "Backup created successfully."

# Keep only last 3 generations
# List files matching the pattern, sort by modification time (newest first)
BACKUPS=$(ls -t "$BACKUP_DIR/$DB_FILENAME".* 2>/dev/null | grep -v '\-wal$' | grep -v '\-shm$')
COUNT=$(echo "$BACKUPS" | wc -l | xargs) # xargs trims whitespace

if [ "$COUNT" -gt 3 ]; then
    echo "Cleaning up old backups (keeping last 3)..."
    echo "$BACKUPS" | tail -n +4 | while read backup_file; do
        rm "$backup_file"
        rm -f "$backup_file-wal"
        rm -f "$backup_file-shm"
    done
    echo "Cleanup complete."
else
    echo "Total backups: $COUNT (limit: 3)"
fi
