"use server";

import { BuildSheetImportPreview } from "@/application/import/BuildSheetImportPreview";
import { ConfirmSheetImport } from "@/application/import/ConfirmSheetImport";
import type { SheetImportPreviewDTO } from "@/application/import/dto";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { CategoryNotFoundError } from "@/domain/tag-category/TagCategoryErrors";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "../../db/client";
import { DrizzleAccountRepository } from "../../db/DrizzleAccountRepository";
import { DrizzleSheetImportRepository } from "../../db/DrizzleSheetImportRepository";
import { DrizzleTagCategoryRepository } from "../../db/DrizzleTagCategoryRepository";
import { DrizzleTagRepository } from "../../db/DrizzleTagRepository";
import { parseSheetCsv } from "./sheet-csv";

const MAX_FILE_SIZE_BYTES = 512 * 1024;

const INVALID_INTENT_MESSAGE = "No se ha podido procesar la importación. Inténtalo de nuevo.";
const STALE_PREVIEW_MESSAGE =
  "La previsualización ya no es válida (p. ej. una etiqueta ha cambiado). Revisa el fichero y vuelve a previsualizarlo.";

const inputSchema = z.object({
  accountId: z.string().regex(/^\d+$/, "Selecciona una cuenta."),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Selecciona un mes."),
  intent: z.enum(["preview", "confirm"]),
});

export type ImportSheetResult =
  | { status: "idle" }
  | { status: "preview"; preview: SheetImportPreviewDTO }
  | {
      status: "imported";
      movementsCreated: number;
      tagsCreated: number;
      accountId: number;
      month: string;
    }
  | { status: "error"; message: string };

export async function importSheetAction(input: {
  accountId: string;
  month: string;
  intent: "preview" | "confirm";
  file: File;
}): Promise<ImportSheetResult> {
  if (!(input.file instanceof File)) {
    return { status: "error", message: "Adjunta el fichero CSV de la hoja mensual." };
  }

  const parsed = inputSchema.safeParse({
    accountId: input.accountId,
    month: input.month,
    intent: input.intent,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: "error",
      message: issue.path[0] === "intent" ? INVALID_INTENT_MESSAGE : (issue.message ?? INVALID_INTENT_MESSAGE),
    };
  }

  if (input.file.size > MAX_FILE_SIZE_BYTES) {
    return { status: "error", message: "El fichero es demasiado grande (máximo 512 KB)." };
  }
  if (!input.file.name.toLowerCase().endsWith(".csv")) {
    return { status: "error", message: "El fichero debe ser un CSV exportado de Google Sheets." };
  }

  const sheet = parseSheetCsv(await input.file.text());
  if (!sheet.ok) {
    return { status: "error", message: sheet.message };
  }

  const accountId = Number(parsed.data.accountId);
  const useCaseInput = { accountId, month: parsed.data.month, rows: sheet.rows };

  try {
    if (parsed.data.intent === "preview") {
      const preview = await new BuildSheetImportPreview(
        new DrizzleAccountRepository(db),
        new DrizzleTagRepository(db),
        new DrizzleTagCategoryRepository(db),
      ).execute(useCaseInput);

      return { status: "preview", preview };
    }

    const confirmed = await new ConfirmSheetImport(
      new DrizzleAccountRepository(db),
      new DrizzleTagRepository(db),
      new DrizzleTagCategoryRepository(db),
      new DrizzleSheetImportRepository(db),
    ).execute(useCaseInput);

    if (confirmed.status === "invalid") {
      return { status: "error", message: STALE_PREVIEW_MESSAGE };
    }

    revalidatePath("/", "layout");

    return {
      status: "imported",
      movementsCreated: confirmed.movementsCreated,
      tagsCreated: confirmed.tagsCreated,
      accountId,
      month: parsed.data.month,
    };
  } catch (error) {
    if (error instanceof AccountNotFoundError) {
      return { status: "error", message: "Selecciona una cuenta." };
    }
    if (error instanceof CategoryNotFoundError) {
      return {
        status: "error",
        message: "No se ha podido preparar la importación (falta la categoría General). Inténtalo de nuevo.",
      };
    }
    return {
      status: "error",
      message: "No se ha podido importar. No se ha creado ningún movimiento; inténtalo de nuevo.",
    };
  }
}
