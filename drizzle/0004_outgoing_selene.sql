CREATE TABLE `reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chat_id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`remind_at` timestamp NOT NULL,
	`status` enum('pending','sent','cancelled') NOT NULL DEFAULT 'pending',
	`original_message_id` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reminders_id` PRIMARY KEY(`id`)
);
