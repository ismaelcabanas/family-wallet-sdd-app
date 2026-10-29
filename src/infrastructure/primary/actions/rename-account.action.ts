"use server";

import { RenameAccount } from "@/application/account/RenameAccount";
import {
  AccountNotFoundError,
  AccountNotRenamableError,
  DuplicateAccountNameError,
  InvalidAccountError,
} from "@/domain/account/AccountErrors";
import { AccountId } from "@/domain/account/AccountId";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "../../db/client";
import { DrizzleAccountRepository } from "../../db/DrizzleAccountRepository";

export type AccountActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; values: { name: string } };

const renameAccountSchema = z.object({
  accountId: z.string().regex(/^\d+$/, "No se ha podido renombrar la cuenta."),
  name: z.string().trim().min(1, "El nombre de la cuenta es obligatorio."),
});

const renameAccountUseCase = new RenameAccount(new DrizzleAccountRepository(db));

function mapErrorToMessage(error: unknown): string {
  if (
    error instanceof InvalidAccountError ||
    error instanceof DuplicateAccountNameError ||
    error instanceof AccountNotRenamableError ||
    error instanceof AccountNotFoundError
  ) {
    return error.message;
  }
  return "No se ha podido renombrar la cuenta.";
}

export async function renameAccount(
  _prevState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const rawName = formData.get("name");
  const values = { name: typeof rawName === "string" ? rawName : "" };

  const parsed = renameAccountSchema.safeParse({
    accountId: formData.get("accountId"),
    name: rawName,
  });

  if (!parsed.success) {
    const nameError = parsed.error.issues.find((issue) => issue.path[0] === "name");
    return {
      status: "error",
      message: nameError?.message ?? "No se ha podido renombrar la cuenta.",
      values,
    };
  }

  try {
    await renameAccountUseCase.execute({
      id: AccountId(Number(parsed.data.accountId)),
      name: parsed.data.name,
    });

    revalidatePath("/", "layout");
    return { status: "success", message: "Cuenta renombrada" };
  } catch (error) {
    return { status: "error", message: mapErrorToMessage(error), values };
  }
}
