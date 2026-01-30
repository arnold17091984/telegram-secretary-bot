ALTER TABLE `reminders` ADD `repeat_type` enum('none','daily','weekly','monthly') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `reminders` ADD `repeat_days` varchar(64);--> statement-breakpoint
ALTER TABLE `reminders` ADD `repeat_end_date` timestamp;--> statement-breakpoint
ALTER TABLE `reminders` ADD `event_name` varchar(255);--> statement-breakpoint
ALTER TABLE `reminders` ADD `reminder_minutes_before` int DEFAULT 15;