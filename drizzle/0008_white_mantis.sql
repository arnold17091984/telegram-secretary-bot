CREATE TABLE `recurring_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chat_id` varchar(64) NOT NULL,
	`creator_id` varchar(64) NOT NULL,
	`assignee_id` varchar(64) NOT NULL,
	`assignee_mention` varchar(128),
	`task_title` text NOT NULL,
	`frequency` enum('daily','weekly','monthly') NOT NULL,
	`day_of_week` int,
	`day_of_month` int,
	`hour` int NOT NULL,
	`minute` int NOT NULL DEFAULT 0,
	`is_active` int NOT NULL DEFAULT 1,
	`last_sent_at` timestamp,
	`next_send_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurring_tasks_id` PRIMARY KEY(`id`)
);
