CREATE TABLE `google_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`token_expiry` timestamp,
	`is_connected` int NOT NULL DEFAULT 0,
	`connected_email` varchar(320),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_credentials_id` PRIMARY KEY(`id`)
);
