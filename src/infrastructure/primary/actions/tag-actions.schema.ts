import { z } from "zod";

export const renameTagSchema = z.object({
  tagId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "El nombre de la etiqueta es obligatorio."),
});

export const mergeTagsSchema = z.object({
  absorbedId: z.coerce.number().int().positive(),
  targetId: z.coerce.number().int().positive(),
});

export const deactivateTagSchema = z.object({
  tagId: z.coerce.number().int().positive(),
});

export const reactivateTagSchema = z.object({
  tagId: z.coerce.number().int().positive(),
});

export type TagActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };
