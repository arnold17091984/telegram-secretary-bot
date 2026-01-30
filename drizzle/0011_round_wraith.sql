CREATE TABLE `organization_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`user_id` int NOT NULL,
	`role` enum('owner','admin','member') NOT NULL DEFAULT 'member',
	`invited_at` timestamp NOT NULL DEFAULT (now()),
	`joined_at` timestamp,
	CONSTRAINT `organization_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`owner_id` int NOT NULL,
	`telegram_bot_token` text,
	`telegram_bot_username` varchar(128),
	`webhook_secret` varchar(64),
	`subscription_status` enum('trial','active','cancelled','expired') NOT NULL DEFAULT 'trial',
	`subscription_plan` enum('free','starter','pro','enterprise') NOT NULL DEFAULT 'free',
	`subscription_expires_at` timestamp,
	`stripe_customer_id` varchar(255),
	`stripe_subscription_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`amount` int NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'usd',
	`payment_method` enum('stripe','crypto') NOT NULL,
	`payment_status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`stripe_payment_intent_id` varchar(255),
	`crypto_transaction_hash` varchar(255),
	`crypto_currency` varchar(20),
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `google_id` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_url` varchar(512);--> statement-breakpoint
ALTER TABLE `users` ADD `current_organization_id` int;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_google_id_unique` UNIQUE(`google_id`);