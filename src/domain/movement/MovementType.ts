export const MOVEMENT_TYPES = ["expense", "income"] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

export function isMovementType(value: unknown): value is MovementType {
  return typeof value === "string" && (MOVEMENT_TYPES as readonly string[]).includes(value);
}
