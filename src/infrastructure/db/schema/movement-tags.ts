import { integer, primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";

import { movements } from "./movements";
import { tags } from "./tags";

export const movementTags = sqliteTable(
  "movement_tags",
  {
    movementId: integer("movement_id")
      .notNull()
      .references(() => movements.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.movementId, table.tagId] })],
);

export type MovementTagRow = typeof movementTags.$inferSelect;
export type NewMovementTagRow = typeof movementTags.$inferInsert;
