-- Rename error column to suspended_reason
ALTER TABLE `dag_executions` RENAME COLUMN `error` TO `suspended_reason`;

-- Add suspended_at column
ALTER TABLE `dag_executions` ADD COLUMN `suspended_at` integer;

-- Add retry_count column with default 0
ALTER TABLE `dag_executions` ADD COLUMN `retry_count` integer DEFAULT 0 NOT NULL;

-- Add last_retry_at column
ALTER TABLE `dag_executions` ADD COLUMN `last_retry_at` integer;
