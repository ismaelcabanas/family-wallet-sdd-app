CREATE TABLE `regular_income_months` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`regular_income_id` integer NOT NULL,
	`month` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`regular_income_id`) REFERENCES `regular_incomes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `regular_income_months_config_month_uq` ON `regular_income_months` (`regular_income_id`,`month`);--> statement-breakpoint
CREATE TABLE `regular_incomes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`day_of_month` integer NOT NULL,
	`note` text NOT NULL,
	`active` integer NOT NULL,
	`activated_at_month` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `regular_incomes_account_id_unique` ON `regular_incomes` (`account_id`);