"use server";

import { ReactivateTag } from "@/application/tag/ReactivateTag";
import { TagId } from "@/domain/tag/TagId";
import {
  DuplicateTagNameError,
  ProtectedTagError,
  TagNotFoundError,
} from "@/domain/tag/TagErrors";
import { revalidatePath } from "next/cache";

import { db } from "../../db/client";
import { DrizzleTagRepository } from "../../db/DrizzleTagRepository";
import { reactivateTagSchema } from "./tag-actions.schema";

export type ReactivateTagResult = { ok: true } | { ok: false; message: string };

const reactivateTagUseCase = new ReactivateTag(new DrizzleTagRepository(db));

function mapErrorToMessage(error: unknown): string {
  if (
    error instanceof DuplicateTagNameError ||
    error instanceof ProtectedTagError ||
    error instanceof TagNotFoundError
  ) {
    return error.message;
  }
  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

export async function reactivateTag(tagId: number): Promise<ReactivateTagResult> {
  const parsed = reactivateTagSchema.safeParse({ tagId });

  if (!parsed.success) {
    return { ok: false, message: "No se ha podido completar la operación. Inténtalo de nuevo." };
  }

  try {
    await reactivateTagUseCase.execute({ id: TagId(parsed.data.tagId) });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: mapErrorToMessage(error) };
  }
}
