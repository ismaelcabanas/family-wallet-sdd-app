import { Account } from "@/domain/account/Account";
import { AccountId } from "@/domain/account/AccountId";
import {
  AccountNotFoundError,
  AccountNotRenamableError,
  DuplicateAccountNameError,
} from "@/domain/account/AccountErrors";
import { MemberId } from "@/domain/member/MemberId";
import { describe, expect, it, vi } from "vitest";

import { RenameAccount } from "./RenameAccount";
import type { AccountRepository } from "./AccountRepository";

function buildRepository(
  overrides: Partial<Record<keyof AccountRepository, ReturnType<typeof vi.fn>>> = {},
): AccountRepository {
  return {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    getBalance: vi.fn(),
    update: vi.fn(),
    ...overrides,
  } as unknown as AccountRepository;
}

describe("RenameAccount", () => {
  it("renombra la cuenta común: update recibe la instancia exacta y devuelve su salida", async () => {
    const shared = Account.rehydrate(3, "Cuenta común", "shared", null);
    const expected = Account.rehydrate(3, "Cuenta conjunta", "shared", null);
    const update = vi.fn().mockResolvedValue(expected);
    const repository = buildRepository({
      findById: vi.fn().mockResolvedValue(shared),
      findByName: vi.fn().mockResolvedValue(null),
      update,
    });
    const useCase = new RenameAccount(repository);

    const result = await useCase.execute({ id: AccountId(3), name: "  Cuenta conjunta  " });

    expect(result).toEqual(expected);
    expect(update).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it("id inexistente lanza AccountNotFoundError", async () => {
    const repository = buildRepository({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new RenameAccount(repository);

    await expect(useCase.execute({ id: AccountId(999), name: "Otra" })).rejects.toThrowError(
      new AccountNotFoundError(),
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("cuenta personal lanza AccountNotRenamableError con el literal congelado", async () => {
    const personal = Account.rehydrate(1, null, "personal", MemberId(1));
    const repository = buildRepository({ findById: vi.fn().mockResolvedValue(personal) });
    const useCase = new RenameAccount(repository);

    await expect(useCase.execute({ id: AccountId(1), name: "Otro nombre" })).rejects.toThrowError(
      new AccountNotRenamableError(),
    );
    expect(repository.findByName).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("duplicado nocase con otra cuenta lanza DuplicateAccountNameError con el literal exacto", async () => {
    const shared = Account.rehydrate(3, "Cuenta común", "shared", null);
    const repository = buildRepository({
      findById: vi.fn().mockResolvedValue(shared),
      findByName: vi.fn().mockResolvedValue(Account.rehydrate(4, "Cuenta conjunta", "shared", null)),
    });
    const useCase = new RenameAccount(repository);

    await expect(
      useCase.execute({ id: AccountId(3), name: "CUENTA CONJUNTA" }),
    ).rejects.toThrowError(new DuplicateAccountNameError("CUENTA CONJUNTA"));
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("autorenombrado (la misma cuenta devuelta por findByName) no es duplicado", async () => {
    const shared = Account.rehydrate(3, "Cuenta común", "shared", null);
    const expected = Account.rehydrate(3, "Cuenta común 2027", "shared", null);
    const update = vi.fn().mockResolvedValue(expected);
    const repository = buildRepository({
      findById: vi.fn().mockResolvedValue(shared),
      findByName: vi.fn().mockResolvedValue(expected),
      update,
    });
    const useCase = new RenameAccount(repository);

    const result = await useCase.execute({ id: AccountId(3), name: "Cuenta común 2027" });

    expect(result).toEqual(expected);
    expect(update).toHaveBeenCalledExactlyOnceWith(expected);
  });
});
