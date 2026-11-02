"use server";

import { RenameCategory } from "@/application/tag-category/RenameCategory";
import { DomainError } from "@/domain/shared/DomainError";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import {
  CategoryNotFoundError,
  DuplicateCategoryNameError,
  InvalidCategoryError,
} from "@/domain/tag-category/TagCategoryErrors";
import { revalidatePath } from "next/cache";

import { db } from "../../db/client";
import { DrizzleTagCategoryRepository } from "../../db/DrizzleTagCategoryRepository";
import { renameCategorySchema, type CategoryActionState } from "./category-actions.schema";

export type { CategoryActionState } from "./category-actions.schema";

const renameCategoryUseCase = new RenameCategory(new DrizzleTagCategoryRepository(db));

function mapErrorToMessage(error: unknown): string {
  if (
    error instanceof InvalidCategoryError ||
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

export async function renameCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const parsed = renameCategorySchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { status: "error", message: "El nombre de la categoría es obligatorio." };
  }

  try {
    await renameCategoryUseCase.execute({
      categoryId: TagCategoryId(parsed.data.categoryId),
      name: parsed.data.name,
    });

    revalidatePath("/tags");
    return { status: "success", message: "Categoría renombrada" };
  } catch (error) {
    return { status: "error", message: mapErrorToMessage(error) };
  }
}
