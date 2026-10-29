"use server";

import { RenameMember } from "@/application/member/RenameMember";
import { MemberId } from "@/domain/member/MemberId";
import {
  DuplicateMemberNameError,
  InvalidMemberError,
  MemberNotFoundError,
} from "@/domain/member/MemberErrors";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "../../db/client";
import { DrizzleMemberRepository } from "../../db/DrizzleMemberRepository";

export type MemberActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; values: { name: string } };

const renameMemberSchema = z.object({
  memberId: z.string().regex(/^\d+$/, "No se ha podido renombrar el miembro."),
  name: z.string().trim().min(1, "El nombre del miembro es obligatorio."),
});

const renameMemberUseCase = new RenameMember(new DrizzleMemberRepository(db));

function mapErrorToMessage(error: unknown): string {
  if (
    error instanceof InvalidMemberError ||
    error instanceof DuplicateMemberNameError ||
    error instanceof MemberNotFoundError
  ) {
    return error.message;
  }
  return "No se ha podido renombrar el miembro.";
}

export async function renameMember(
  _prevState: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const rawName = formData.get("name");
  const values = { name: typeof rawName === "string" ? rawName : "" };

  const parsed = renameMemberSchema.safeParse({
    memberId: formData.get("memberId"),
    name: rawName,
  });

  if (!parsed.success) {
    const nameError = parsed.error.issues.find((issue) => issue.path[0] === "name");
    return {
      status: "error",
      message: nameError?.message ?? "No se ha podido renombrar el miembro.",
      values,
    };
  }

  try {
    await renameMemberUseCase.execute({
      id: MemberId(Number(parsed.data.memberId)),
      name: parsed.data.name,
    });

    revalidatePath("/", "layout");
    return { status: "success", message: "Miembro renombrado" };
  } catch (error) {
    return { status: "error", message: mapErrorToMessage(error), values };
  }
}
