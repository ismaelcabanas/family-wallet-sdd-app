"use server";

import { RenameTag } from "@/application/tag/RenameTag";
import { TagId } from "@/domain/tag/TagId";
import { DomainError } from "@/domain/shared/DomainError";
import {
  DuplicateTagNameError,
  InvalidTagError,
  ProtectedTagError,
  TagNotFoundError,
} from "@/domain/tag/TagErrors";
import { revalidatePath } from "next/cache";

import { db } from "../../db/client";
import { DrizzleTagRepository } from "../../db/DrizzleTagRepository";
import { renameTagSchema, type TagActionState } from "./tag-actions.schema";

export type { TagActionState } from "./tag-actions.schema";

const renameTagUseCase = new RenameTag(new DrizzleTagRepository(db));

function mapErrorToMessage(error: unknown): string {
  if (
    error instanceof InvalidTagError ||
    error instanceof DuplicateTagNameError ||
    error instanceof ProtectedTagError ||
    error instanceof TagNotFoundError
  ) {
    return error.message;
  }
  if (error instanceof DomainError) {
    return "No se ha podido completar la operación. Inténtalo de nuevo.";
  }
  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

export async function renameTag(
  _prevState: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  const parsed = renameTagSchema.safeParse({
    tagId: formData.get("tagId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { status: "error", message: "El nombre de la etiqueta es obligatorio." };
  }

  try {
    await renameTagUseCase.execute({ id: TagId(parsed.data.tagId), name: parsed.data.name });

    revalidatePath("/", "layout");
    return { status: "success", message: "Etiqueta renombrada" };
  } catch (error) {
    return { status: "error", message: mapErrorToMessage(error) };
  }
}
