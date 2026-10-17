"use server";

import { MergeTags } from "@/application/tag/MergeTags";
import { TagId } from "@/domain/tag/TagId";
import { DomainError } from "@/domain/shared/DomainError";
import {
  InvalidTagError,
  ProtectedTagError,
  TagNotFoundError,
} from "@/domain/tag/TagErrors";
import { revalidatePath } from "next/cache";

import { db } from "../../db/client";
import { DrizzleTagRepository } from "../../db/DrizzleTagRepository";
import { mergeTagsSchema, type TagActionState } from "./tag-actions.schema";

export type { TagActionState } from "./tag-actions.schema";

const mergeTagsUseCase = new MergeTags(new DrizzleTagRepository(db));

function mapErrorToMessage(error: unknown): string {
  if (
    error instanceof InvalidTagError ||
    error instanceof ProtectedTagError ||
    error instanceof TagNotFoundError
  ) {
    return error.message;
  }
  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

export async function mergeTags(
  _prevState: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  const parsed = mergeTagsSchema.safeParse({
    absorbedId: formData.get("absorbedId"),
    targetId: formData.get("targetId"),
  });

  if (!parsed.success) {
    return { status: "error", message: "No se ha podido completar la operación. Inténtalo de nuevo." };
  }

  try {
    await mergeTagsUseCase.execute({
      absorbedId: TagId(parsed.data.absorbedId),
      targetId: TagId(parsed.data.targetId),
    });

    revalidatePath("/", "layout");
    return { status: "success", message: "Etiquetas fusionadas" };
  } catch (error) {
    if (error instanceof DomainError || error instanceof Error) {
      return { status: "error", message: mapErrorToMessage(error) };
    }
    return { status: "error", message: "No se ha podido completar la operación. Inténtalo de nuevo." };
  }
}
