import { Member } from "@/domain/member/Member";
import { MemberId } from "@/domain/member/MemberId";
import {
  DuplicateMemberNameError,
  InvalidMemberError,
  MemberNotFoundError,
} from "@/domain/member/MemberErrors";
import { describe, expect, it, vi } from "vitest";

import { RenameMember } from "./RenameMember";
import type { MemberRepository } from "./MemberRepository";

function buildRepository(
  overrides: Partial<Record<keyof MemberRepository, ReturnType<typeof vi.fn>>> = {},
): MemberRepository {
  return {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    update: vi.fn(),
    ...overrides,
  } as unknown as MemberRepository;
}

describe("RenameMember", () => {
  it("renombra: findById → rename → update con la instancia exacta y devuelve su salida", async () => {
    const member = Member.rehydrate(1, "Miembro A");
    const expected = Member.rehydrate(1, "Isma");
    const update = vi.fn().mockResolvedValue(expected);
    const repository = buildRepository({
      findById: vi.fn().mockResolvedValue(member),
      findByName: vi.fn().mockResolvedValue(null),
      update,
    });
    const useCase = new RenameMember(repository);

    const result = await useCase.execute({ id: MemberId(1), name: "  Isma  " });

    expect(result).toEqual(expected);
    expect(update).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it("id inexistente lanza MemberNotFoundError con el literal congelado", async () => {
    const repository = buildRepository({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new RenameMember(repository);

    await expect(useCase.execute({ id: MemberId(999), name: "Isma" })).rejects.toThrowError(
      new MemberNotFoundError(),
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("nombre vacío tras trim lanza InvalidMemberError antes de tocar el puerto de duplicados", async () => {
    const member = Member.rehydrate(1, "Miembro A");
    const repository = buildRepository({ findById: vi.fn().mockResolvedValue(member) });
    const useCase = new RenameMember(repository);

    await expect(useCase.execute({ id: MemberId(1), name: "   " })).rejects.toThrowError(
      new InvalidMemberError("El nombre del miembro es obligatorio."),
    );
    expect(repository.findByName).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("duplicado nocase con otro miembro lanza DuplicateMemberNameError con el literal exacto", async () => {
    const member = Member.rehydrate(1, "Miembro A");
    const repository = buildRepository({
      findById: vi.fn().mockResolvedValue(member),
      findByName: vi.fn().mockResolvedValue(Member.rehydrate(2, "Isma")),
    });
    const useCase = new RenameMember(repository);

    await expect(useCase.execute({ id: MemberId(1), name: "ISMA" })).rejects.toThrowError(
      new DuplicateMemberNameError("ISMA"),
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("autorenombrado (mismo id devuelto por findByName) no es duplicado", async () => {
    const member = Member.rehydrate(1, "Miembro A");
    const expected = Member.rehydrate(1, "Isma");
    const update = vi.fn().mockResolvedValue(expected);
    const repository = buildRepository({
      findById: vi.fn().mockResolvedValue(member),
      findByName: vi.fn().mockResolvedValue(expected),
      update,
    });
    const useCase = new RenameMember(repository);

    const result = await useCase.execute({ id: MemberId(1), name: "Isma" });

    expect(result).toEqual(expected);
    expect(update).toHaveBeenCalledExactlyOnceWith(expected);
  });
});
