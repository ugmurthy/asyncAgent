CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`prompt_template` text NOT NULL,
	`provider` text,
	`model` text,
	`active` integer DEFAULT false NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dag_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`dag_id` text,
	`original_request` text NOT NULL,
	`primary_intent` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`duration_ms` integer,
	`total_tasks` integer NOT NULL,
	`completed_tasks` integer DEFAULT 0 NOT NULL,
	`failed_tasks` integer DEFAULT 0 NOT NULL,
	`waiting_tasks` integer DEFAULT 0 NOT NULL,
	`final_result` text,
	`synthesis_result` text,
	`suspended_reason` text,
	`suspended_at` integer,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_retry_at` integer,
	`total_usage` text,
	`total_cost_usd` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`dag_id`) REFERENCES `dags`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `dags` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`result` text,
	`usage` text,
	`generation_stats` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`params` text,
	`agent_name` text,
	`dag_title` text,
	`cron_schedule` text,
	`schedule_active` integer DEFAULT 0 NOT NULL,
	`last_run_at` integer,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`planning_total_usage` text,
	`planning_total_cost_usd` text,
	`planning_attempts` text
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`objective` text NOT NULL,
	`params` text NOT NULL,
	`webhook_url` text,
	`agent_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`path_or_payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`working_memory` text DEFAULT '{}' NOT NULL,
	`step_budget` integer NOT NULL,
	`steps_executed` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`cron_expr` text NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_run_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `steps` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step_no` integer NOT NULL,
	`thought` text NOT NULL,
	`tool_name` text,
	`tool_input` text,
	`observation` text,
	`duration_ms` integer NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sub_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`execution_id` text NOT NULL,
	`task_id` text NOT NULL,
	`description` text NOT NULL,
	`thought` text NOT NULL,
	`action_type` text NOT NULL,
	`tool_or_prompt_name` text NOT NULL,
	`tool_or_prompt_params` text,
	`dependencies` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`duration_ms` integer,
	`result` text,
	`error` text,
	`usage` text,
	`cost_usd` text,
	`generation_stats` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`execution_id`) REFERENCES `dag_executions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_name_version` ON `agents` (`name`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_active_agent` ON `agents` (`name`) WHERE "agents"."active" = 1;