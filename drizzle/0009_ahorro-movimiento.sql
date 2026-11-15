ALTER TABLE `savings_allocation_months` ADD `movement_id` integer;--> statement-breakpoint
INSERT OR IGNORE INTO tags (id, name, slug, status, category_id)
VALUES (101, 'Ahorro', 'ahorro', 'active', (SELECT id FROM tag_categories WHERE slug = 'general'));
