CREATE TABLE `common_contribution_months` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`common_contribution_id` integer NOT NULL,
	`month` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`common_contribution_id`) REFERENCES `common_contributions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `common_contribution_months_config_month_uq` ON `common_contribution_months` (`common_contribution_id`,`month`);--> statement-breakpoint
CREATE TABLE `common_contributions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`percentage_basis_points` integer NOT NULL,
	`active` integer NOT NULL,
	`activated_at_month` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `common_contributions_account_id_unique` ON `common_contributions` (`account_id`);--> statement-breakpoint
INSERT OR IGNORE INTO tags (id, name, slug, status) VALUES (100, 'Aportación Común', 'aportacion-comun', 'active');