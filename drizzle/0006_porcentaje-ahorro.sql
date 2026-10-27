CREATE TABLE `savings_allocation_months` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`savings_allocation_id` integer NOT NULL,
	`month` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`savings_allocation_id`) REFERENCES `savings_allocations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `savings_allocation_months_config_month_uq` ON `savings_allocation_months` (`savings_allocation_id`,`month`);--> statement-breakpoint
CREATE TABLE `savings_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`percentage` integer NOT NULL,
	`active` integer NOT NULL,
	`activated_at_month` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `savings_allocations_account_id_unique` ON `savings_allocations` (`account_id`);