CREATE TABLE `dags` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`result` text,
	`usage` text,
	`generation_stats` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
