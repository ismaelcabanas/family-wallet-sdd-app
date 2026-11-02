"use server";

import { CreateCategory } from "@/application/tag-category/CreateCategory";
import { DomainError } from "@/domain/shared/DomainError";
import {
  DuplicateCategoryNameError,
  InvalidCategoryError,
} from "@/domain/tag-category/TagCategoryErrors";
import { revalidatePath } from "next/cache";

import { db } from "../../db/client";
import { DrizzleTagCategoryRepository } from "../../db/DrizzleTagCategoryRepository";
import { createCategorySchema, type CategoryActionState } from "./category-actions.schema";

export type { CategoryActionState } from "./category-actions.schema";

const createCategoryUseCase = new CreateCategory(new DrizzleTagCategoryRepository(db));

function mapErrorToMessage(error: unknown): string {
  if (error instanceof InvalidCategoryError || error instanceof DuplicateCategoryNameError) {
    return error.message;
  }
  if (error instanceof DomainError) {
    return "No se ha podido completar la operación. Inténtalo de nuevo.";
  }
  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

export async function createCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { status: "error", message: "El nombre de la categoría es obligatorio." };
  }

  try {
    await createCategoryUseCase.execute({ name: parsed.data.name });

    revalidatePath("/tags");
    return { status: "success", message: "Categoría creada" };
  } catch (error) {
    return { status: "error", message: mapErrorToMessage(error) };
  }
}
