export const TAG_STATUSES = ["active", "inactive"] as const;

export type TagStatus = (typeof TAG_STATUSES)[number];

export function isTagStatus(value: unknown): value is TagStatus {
  return typeof value === "string" && (TAG_STATUSES as readonly string[]).includes(value);
}
