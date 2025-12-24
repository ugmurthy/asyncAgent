-- Add timezone column to dags table
ALTER TABLE `dags` ADD COLUMN `timezone` text NOT NULL DEFAULT 'UTC';
