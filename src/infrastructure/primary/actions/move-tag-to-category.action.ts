"use server";

import { MoveTagToCategory } from "@/application/tag/MoveTagToCategory";
import { DomainError } from "@/domain/shared/DomainError";
import { TagId } from "@/domain/tag/TagId";
import { TagNotFoundError } from "@/domain/tag/TagErrors";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { CategoryNotFoundError } from "@/domain/tag-category/TagCategoryErrors";
import { revalidatePath } from "next/cache";

import { db } from "../../db/client";
import { DrizzleTagCategoryRepository } from "../../db/DrizzleTagCategoryRepository";
import { DrizzleTagRepository } from "../../db/DrizzleTagRepository";
import { moveTagSchema, type CategoryActionState } from "./category-actions.schema";

export type { CategoryActionState } from "./category-actions.schema";

const moveTagUseCase = new MoveTagToCategory(
  new DrizzleTagRepository(db),
  new DrizzleTagCategoryRepository(db),
);

function mapErrorToMessage(error: unknown): string {
  if (error instanceof TagNotFoundError || error instanceof CategoryNotFoundError) {
    return error.message;
  }
  if (error instanceof DomainError) {
    return "No se ha podido completar la operación. Inténtalo de nuevo.";
  }
  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

export async function moveTagToCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const parsed = moveTagSchema.safeParse({
    tagId: formData.get("tagId"),
    categoryId: formData.get("categoryId"),
  });

  if (!parsed.success) {
    return { status: "error", message: "No se ha podido completar la operación. Inténtalo de nuevo." };
  }

  try {
    const result = await moveTagUseCase.execute({
      tagId: TagId(parsed.data.tagId),
      categoryId: TagCategoryId(parsed.data.categoryId),
    });

    revalidatePath("/tags");
    return { status: "success", message: `Etiqueta movida a ${result.category.name}` };
  } catch (error) {
    return { status: "error", message: mapErrorToMessage(error) };
  }
}
