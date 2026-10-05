"use server";

import { CreateTag } from "@/application/tag/CreateTag";
import { DomainError } from "@/domain/shared/DomainError";
import { DuplicateTagNameError, InvalidTagError } from "@/domain/tag/TagErrors";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "../../db/client";
import { DrizzleTagRepository } from "../../db/DrizzleTagRepository";
import type { TagDTO } from "@/application/movement/dto";

const createTagSchema = z.string().trim().min(1, "El nombre de la etiqueta es obligatorio.");

export type CreateTagResult =
  | { ok: true; tag: TagDTO }
  | { ok: false; message: string };

const createTagUseCase = new CreateTag(new DrizzleTagRepository(db));

export async function createTag(name: string): Promise<CreateTagResult> {
  const parsed = createTagSchema.safeParse(name);

  if (!parsed.success) {
    return { ok: false, message: "El nombre de la etiqueta es obligatorio." };
  }

  try {
    const tag = await createTagUseCase.execute({ name: parsed.data });

    revalidatePath("/", "layout");

    return {
      ok: true,
      tag:
        tag.id === null
          ? { id: 0, name: tag.name, slug: tag.slug }
          : { id: tag.id, name: tag.name, slug: tag.slug },
    };
  } catch (error) {
    if (error instanceof InvalidTagError || error instanceof DuplicateTagNameError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof DomainError) {
      return { ok: false, message: "No se ha podido crear la etiqueta. Inténtalo de nuevo." };
    }
    return { ok: false, message: "No se ha podido crear la etiqueta. Inténtalo de nuevo." };
  }
}
