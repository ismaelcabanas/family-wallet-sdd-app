PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`type` text NOT NULL,
	`member_id` integer,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_accounts`("id", "name", "type", "member_id") SELECT "id", CASE WHEN "type" = 'personal' THEN NULL ELSE "name" END, "type", "member_id" FROM `accounts`;--> statement-breakpoint
DROP TABLE `accounts`;--> statement-breakpoint
ALTER TABLE `__new_accounts` RENAME TO `accounts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_name_nocase_uq` ON `accounts` (lower("name"));--> statement-breakpoint
DROP INDEX `members_name_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `members_name_nocase_uq` ON `members` (lower("name"));