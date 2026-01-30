CREATE TABLE `translation_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chat_id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`is_active` int NOT NULL DEFAULT 1,
	`target_language` varchar(32) NOT NULL,
	`my_language` varchar(32) NOT NULL DEFAULT 'ja',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `translation_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `translation_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`setting_key` varchar(128) NOT NULL,
	`setting_value` text,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `translation_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `translation_settings_setting_key_unique` UNIQUE(`setting_key`)
);
