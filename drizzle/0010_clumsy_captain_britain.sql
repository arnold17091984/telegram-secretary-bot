CREATE TABLE `recurring_task_completions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recurring_task_id` int NOT NULL,
	`chat_id` varchar(64) NOT NULL,
	`completed_by` varchar(64) NOT NULL,
	`completed_by_name` varchar(128),
	`scheduled_at` timestamp NOT NULL,
	`completed_at` timestamp NOT NULL DEFAULT (now()),
	`note` text,
	CONSTRAINT `recurring_task_completions_id` PRIMARY KEY(`id`)
);
