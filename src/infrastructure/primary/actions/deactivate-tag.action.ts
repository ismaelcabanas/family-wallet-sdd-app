"use server";

import { DeactivateTag } from "@/application/tag/DeactivateTag";
import { TagId } from "@/domain/tag/TagId";
import {
  ProtectedTagError,
  TagNotFoundError,
} from "@/domain/tag/TagErrors";
import { revalidatePath } from "next/cache";

import { db } from "../../db/client";
import { DrizzleTagRepository } from "../../db/DrizzleTagRepository";
import { deactivateTagSchema, type TagActionState } from "./tag-actions.schema";

export type { TagActionState } from "./tag-actions.schema";

const deactivateTagUseCase = new DeactivateTag(new DrizzleTagRepository(db));

function mapErrorToMessage(error: unknown): string {
  if (error instanceof ProtectedTagError || error instanceof TagNotFoundError) {
    return error.message;
  }
  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

export async function deactivateTag(
  _prevState: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  const parsed = deactivateTagSchema.safeParse({ tagId: formData.get("tagId") });

  if (!parsed.success) {
    return { status: "error", message: "No se ha podido completar la operación. Inténtalo de nuevo." };
  }

  try {
    await deactivateTagUseCase.execute({ id: TagId(parsed.data.tagId) });

    revalidatePath("/", "layout");
    return { status: "success", message: "Etiqueta desactivada" };
  } catch (error) {
    return { status: "error", message: mapErrorToMessage(error) };
  }
}
