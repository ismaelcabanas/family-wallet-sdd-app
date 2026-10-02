DELETE FROM `movements`;
--> statement-breakpoint
DROP TABLE `movement_tags`;--> statement-breakpoint
DROP TABLE `movements`;--> statement-breakpoint
CREATE TABLE `movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`note` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`nature` text,
	`tag_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_movements_account_date` ON `movements` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_movements_tag_id` ON `movements` (`tag_id`);
