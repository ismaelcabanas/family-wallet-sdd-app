CREATE TABLE `tag_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_categories_slug_unique` ON `tag_categories` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tag_categories_name_nocase_uq` ON `tag_categories` (lower("name"));--> statement-breakpoint
INSERT OR IGNORE INTO `tag_categories` ("name", "slug") VALUES ('General', 'general');--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text NOT NULL DEFAULT 'active',
	`category_id` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `tag_categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_tags` ("id", "name", "slug", "status", "category_id") SELECT "id", "name", "slug", "status", (SELECT "id" FROM "tag_categories" WHERE "slug" = 'general') FROM "tags";--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_nocase_uq` ON `tags` (lower("name"));
