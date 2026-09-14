"use server";

import { DeleteMovement } from "@/application/movement/DeleteMovement";
import { MovementNotFoundError } from "@/domain/movement/MovementErrors";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "../../db/client";
import { DrizzleMovementRepository } from "../../db/DrizzleMovementRepository";

export type DeleteMovementState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const deleteSchema = z.object({
  movementId: z.coerce.number().int().positive(),
});

const UNEXPECTED_ERROR = "No se ha podido eliminar el movimiento. Inténtalo de nuevo.";

const deleteMovementUseCase = new DeleteMovement(new DrizzleMovementRepository(db));

export async function deleteMovement(
  _prevState: DeleteMovementState,
  formData: FormData,
): Promise<DeleteMovementState> {
  const parsed = deleteSchema.safeParse({ movementId: formData.get("movementId") });

  if (!parsed.success) {
    return { status: "error", message: UNEXPECTED_ERROR };
  }

  try {
    await deleteMovementUseCase.execute(parsed.data.movementId);

    revalidatePath("/");
    return { status: "success", message: "Movimiento eliminado" };
  } catch (error) {
    if (error instanceof MovementNotFoundError) {
      revalidatePath("/");
      return { status: "error", message: error.message };
    }
    return { status: "error", message: UNEXPECTED_ERROR };
  }
}
