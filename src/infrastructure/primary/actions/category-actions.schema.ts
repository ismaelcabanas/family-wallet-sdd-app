import { z } from "zod";

export const renameCategorySchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "El nombre de la categoría es obligatorio."),
});

export const deleteCategorySchema = z.object({
  categoryId: z.coerce.number().int().positive(),
});

export const moveTagSchema = z.object({
  tagId: z.coerce.number().int().positive(),
  categoryId: z.coerce.number().int().positive(),
});

export type CategoryActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };
