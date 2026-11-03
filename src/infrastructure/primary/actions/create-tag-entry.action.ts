"use server";

import { CreateTag } from "@/application/tag/CreateTag";
import { CreateCategory } from "@/application/tag-category/CreateCategory";
import { DomainError } from "@/domain/shared/DomainError";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { DuplicateTagNameError } from "@/domain/tag/TagErrors";
import {
  CategoryNotFoundError,
  DuplicateCategoryNameError,
} from "@/domain/tag-category/TagCategoryErrors";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "../../db/client";
import { DrizzleTagCategoryRepository } from "../../db/DrizzleTagCategoryRepository";
import { DrizzleTagRepository } from "../../db/DrizzleTagRepository";

const tagEntrySchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  categoryId: z.coerce.number().int().positive().optional(),
});

export type TagEntryActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const createTagUseCase = new CreateTag(
  new DrizzleTagRepository(db),
  new DrizzleTagCategoryRepository(db),
);
const createCategoryUseCase = new CreateCategory(new DrizzleTagCategoryRepository(db));

function mapErrorToMessage(error: unknown): string {
  if (
    error instanceof DuplicateTagNameError ||
    error instanceof DuplicateCategoryNameError ||
    error instanceof CategoryNotFoundError
  ) {
    return error.message;
  }
  if (error instanceof DomainError) {
    return "No se ha podido completar la operación. Inténtalo de nuevo.";
  }
  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

export async function createTagEntry(
  _prevState: TagEntryActionState,
  formData: FormData,
): Promise<TagEntryActionState> {
  const rawCategoryId = formData.get("categoryId");
  const categoryId =
    rawCategoryId === null || rawCategoryId === "" ? undefined : rawCategoryId;

  const parsed = tagEntrySchema.safeParse({
    name: formData.get("name"),
    categoryId,
  });

  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "categoryId")) {
      return { status: "error", message: "La categoría seleccionada no es válida." };
    }
    return { status: "error", message: "El nombre es obligatorio." };
  }

  try {
    if (parsed.data.categoryId === undefined) {
      await createCategoryUseCase.execute({ name: parsed.data.name });

      revalidatePath("/", "layout");
      return { status: "success", message: "Categoría creada" };
    }

    await createTagUseCase.execute({
      name: parsed.data.name,
      categoryId: TagCategoryId(parsed.data.categoryId),
    });

    revalidatePath("/", "layout");
    return { status: "success", message: "Etiqueta creada" };
  } catch (error) {
    return { status: "error", message: mapErrorToMessage(error) };
  }
}
