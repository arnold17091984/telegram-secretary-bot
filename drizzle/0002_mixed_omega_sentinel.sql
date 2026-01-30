CREATE TABLE `triggers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trigger_keyword` varchar(64) NOT NULL,
	`trigger_type` enum('task','meeting','ai_draft','reply_generation','custom') NOT NULL,
	`description` text,
	`enabled` int NOT NULL DEFAULT 1,
	`action_flow` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `triggers_id` PRIMARY KEY(`id`),
	CONSTRAINT `triggers_trigger_keyword_unique` UNIQUE(`trigger_keyword`)
);
