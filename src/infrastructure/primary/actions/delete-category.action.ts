"use server";

import { DeleteCategory } from "@/application/tag-category/DeleteCategory";
import { DomainError } from "@/domain/shared/DomainError";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import {
  CategoryNotFoundError,
  CategoryNotEmptyError,
  ProtectedCategoryError,
} from "@/domain/tag-category/TagCategoryErrors";
import { revalidatePath } from "next/cache";

import { db } from "../../db/client";
import { DrizzleTagCategoryRepository } from "../../db/DrizzleTagCategoryRepository";
import { deleteCategorySchema, type CategoryActionState } from "./category-actions.schema";

export type { CategoryActionState } from "./category-actions.schema";

const deleteCategoryUseCase = new DeleteCategory(new DrizzleTagCategoryRepository(db));

function mapErrorToMessage(error: unknown): string {
  if (
    error instanceof CategoryNotFoundError ||
    error instanceof CategoryNotEmptyError ||
    error instanceof ProtectedCategoryError
  ) {
    return error.message;
  }
  if (error instanceof DomainError) {
    return "No se ha podido completar la operación. Inténtalo de nuevo.";
  }
  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

export async function deleteCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const parsed = deleteCategorySchema.safeParse({
    categoryId: formData.get("categoryId"),
  });

  if (!parsed.success) {
    return { status: "error", message: "No se ha podido completar la operación. Inténtalo de nuevo." };
  }

  try {
    await deleteCategoryUseCase.execute({ categoryId: TagCategoryId(parsed.data.categoryId) });

    revalidatePath("/tags");
    return { status: "success", message: "Categoría eliminada" };
  } catch (error) {
    return { status: "error", message: mapErrorToMessage(error) };
  }
}
