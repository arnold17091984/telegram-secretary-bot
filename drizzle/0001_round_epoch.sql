CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(64),
	`action` varchar(64) NOT NULL,
	`object_type` varchar(64),
	`object_id` varchar(64),
	`payload` text,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bot_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`setting_key` varchar(128) NOT NULL,
	`setting_value` text,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bot_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bot_settings_setting_key_unique` UNIQUE(`setting_key`)
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` varchar(64) NOT NULL,
	`source_type` enum('ai_query','reply_generation') NOT NULL,
	`source_context` text,
	`draft_text` text NOT NULL,
	`target_group_chat_id` varchar(64),
	`status` enum('pending_approval','approved','rejected') NOT NULL DEFAULT 'pending_approval',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_chats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`group_chat_id` varchar(64) NOT NULL,
	`group_name` text,
	`responsible_user_id` varchar(64),
	`calendar_id` varchar(255),
	`is_active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `group_chats_id` PRIMARY KEY(`id`),
	CONSTRAINT `group_chats_group_chat_id_unique` UNIQUE(`group_chat_id`)
);
--> statement-breakpoint
CREATE TABLE `meeting_attendees` (
	`meeting_id` int NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`email` varchar(320)
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`group_chat_id` varchar(64) NOT NULL,
	`creator_id` varchar(64) NOT NULL,
	`title` text NOT NULL,
	`start_at` timestamp NOT NULL,
	`end_at` timestamp NOT NULL,
	`calendar_event_id` varchar(255),
	`meet_url` varchar(2048),
	`meeting_type` enum('google_meet','in_person','other') DEFAULT 'google_meet',
	`status` enum('draft','confirmed') NOT NULL DEFAULT 'draft',
	`reminder_sent` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminder_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`setting_key` varchar(128) NOT NULL,
	`setting_value` text NOT NULL,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reminder_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `reminder_settings_setting_key_unique` UNIQUE(`setting_key`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`group_chat_id` varchar(64) NOT NULL,
	`message_id` varchar(64) NOT NULL,
	`requester_id` varchar(64) NOT NULL,
	`assignee_id` varchar(64) NOT NULL,
	`title` text NOT NULL,
	`status` enum('pending_acceptance','in_progress','blocked','completed','rejected') NOT NULL DEFAULT 'pending_acceptance',
	`due_at` timestamp,
	`block_reason` text,
	`artifact_url` varchar(2048),
	`last_nudge_at` timestamp,
	`nudge_level` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
