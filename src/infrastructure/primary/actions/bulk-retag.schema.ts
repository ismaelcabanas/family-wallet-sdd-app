import { z } from "zod";

export const bulkRetagSchema = z.object({
  accountId: z.coerce.number().int().positive(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes no es válido."),
  targetTagId: z.coerce.number().int().positive(),
  movementIds: z
    .array(z.coerce.number().int().positive())
    .min(1, "Selecciona al menos un movimiento."),
});

export type BulkRetagActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };
