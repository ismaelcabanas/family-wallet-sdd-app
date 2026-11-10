"use server";

import { BulkRetagMovements } from "@/application/movement/BulkRetagMovements";
import { InvalidMovementError } from "@/domain/movement/MovementErrors";
import { ProtectedTagError, TagNotFoundError } from "@/domain/tag/TagErrors";
import { revalidatePath } from "next/cache";

import { db } from "../../db/client";
import { DrizzleMovementRepository } from "../../db/DrizzleMovementRepository";
import { DrizzleTagRepository } from "../../db/DrizzleTagRepository";
import { bulkRetagSchema, type BulkRetagActionState } from "./bulk-retag.schema";

export type { BulkRetagActionState } from "./bulk-retag.schema";

const bulkRetagUseCase = new BulkRetagMovements(
  new DrizzleMovementRepository(db),
  new DrizzleTagRepository(db),
);

function mapErrorToMessage(error: unknown): string {
  if (
    error instanceof InvalidMovementError ||
    error instanceof ProtectedTagError ||
    error instanceof TagNotFoundError
  ) {
    return error.message;
  }
  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

function composeSuccessMessage(updatedCount: number, totalCount: number): string {
  if (updatedCount === totalCount) {
    return updatedCount === 1
      ? "1 movimiento actualizado"
      : `${updatedCount} movimientos actualizados`;
  }
  return `${updatedCount} de ${totalCount} movimientos actualizados`;
}

export async function bulkRetag(
  _prevState: BulkRetagActionState,
  formData: FormData,
): Promise<BulkRetagActionState> {
  const parsed = bulkRetagSchema.safeParse({
    accountId: formData.get("accountId"),
    month: formData.get("month"),
    targetTagId: formData.get("targetTagId"),
    movementIds: formData.getAll("movementIds"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  try {
    const { updatedCount, skippedCount } = await bulkRetagUseCase.execute(parsed.data);

    revalidatePath("/", "layout");

    return {
      status: "success",
      message: composeSuccessMessage(updatedCount, updatedCount + skippedCount),
    };
  } catch (error) {
    return { status: "error", message: mapErrorToMessage(error) };
  }
}
