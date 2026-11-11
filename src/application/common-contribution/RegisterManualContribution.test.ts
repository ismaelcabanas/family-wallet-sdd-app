import { describe, expect, it } from "vitest";

import { Account } from "@/domain/account/Account";
import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { MemberId } from "@/domain/member/MemberId";
import {
  CommonContributionNotFoundError,
  ContributionAlreadyExistsError,
  SharedAccountContributionError,
} from "@/domain/common-contribution/CommonContributionErrors";
import { CommonContribution } from "@/domain/common-contribution/CommonContribution";
import { CommonContributionId } from "@/domain/common-contribution/CommonContributionId";
import { ContributionPercentage } from "@/domain/common-contribution/ContributionPercentage";
import { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import { Money } from "@/domain/movement/Money";
import { Tag } from "@/domain/tag/Tag";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { TagId } from "@/domain/tag/TagId";

import type { AccountRepository } from "../account/AccountRepository";
import type { TagRepository } from "../tag/TagRepository";
import { RegisterManualContribution } from "./RegisterManualContribution";

const ACCOUNT_ID = AccountId(1);
const CONTRIBUTION_TAG = Tag.rehydrate(100, "Aportación Común", "aportacion-comun", "active", TagCategoryId(1));

class StubCommonContributionRepository {
  existingByMonth = new Map<string, Movement | null>();
  registered: Array<{ configId: number; month: string; movement: Movement }> = [];
  registerResult: MovementId | null = null;

  config: CommonContribution | null = CommonContribution.rehydrate(CommonContributionId(4), {
    accountId: ACCOUNT_ID,
    percentage: ContributionPercentage.fromBasisPoints(2500),
    active: true,
    activatedAtMonth: "2026-11",
  });

  async findByAccountId(): Promise<CommonContribution | null> {
    return this.config;
  }

  async save(config: CommonContribution): Promise<CommonContribution> {
    return config;
  }

  async isMaterialized(): Promise<boolean> {
    return false;
  }

  async registerMaterialization(): Promise<boolean> {
    return false;
  }

  async registerManualContribution(
    config: CommonContribution,
    month: string,
    movement: Movement,
  ): Promise<MovementId | null> {
    this.registered.push({ configId: config.id as number, month, movement });
    return this.registerResult;
  }

  async findMaterializedMovement(
    _contributionId: unknown,
    month: string,
  ): Promise<Movement | null> {
    return this.existingByMonth.get(month) ?? null;
  }

  async findMaterializedMonthByMovement(): Promise<string | null> {
    return null;
  }

  async withdrawMaterialization(): Promise<boolean> {
    return false;
  }

  async withdrawMaterializationForMovement(): Promise<boolean> {
    return false;
  }
}

function buildTags(): TagRepository {
  return {
    findAllActive: async () => [],
    findByIds: async () => [],
    findBySlug: async (slug) => (slug === "aportacion-comun" ? CONTRIBUTION_TAG : null),
    findByName: async () => null,
    save: async (tag) => tag,
    findById: async () => null,
    findAll: async () => [],
    update: async (tag) => tag,
    mergeInto: async () => ({ reassignedMovements: 0 }),
  };
}

describe("RegisterManualContribution", () => {
  const personalAccount = Account.rehydrate(1, "Cuenta de Miembro A", "personal", MemberId(1));
  const sharedAccount = Account.rehydrate(3, "Cuenta común", "shared", null);

  function buildAccounts(account: Account | null): AccountRepository {
    return {
      findAll: async () => [],
      findById: async () => account,
      findByName: async () => null,
      update: async (current) => current,
    };
  }

  it("crea el movimiento de aportación y escribe la fila del registro en la misma llamada", async () => {
    const commonContributions = new StubCommonContributionRepository();
    commonContributions.registerResult = MovementId(11);
    const useCase = new RegisterManualContribution(
      commonContributions,
      buildAccounts(personalAccount),
      buildTags(),
    );

    const movementId = await useCase.execute({
      accountId: 1,
      date: "2026-09-14",
      note: "Aportación septiembre",
      amountCents: 30_000,
    });

    expect(movementId).toBe(11);
    expect(commonContributions.registered).toHaveLength(1);
    const { configId, month, movement } = commonContributions.registered[0];
    expect(configId).toBe(4);
    expect(month).toBe("2026-09");
    expect(movement.type).toBe("expense");
    expect(movement.nature).toBe("personal");
    expect(movement.tagId).toBe(TagId(100));
    expect(movement.amount).toEqual(Money.fromCents(30_000));
    expect(movement.note).toBe("Aportación septiembre");
    expect(movement.date).toBe("2026-09-14");
  });

  it("deriva la nota por defecto «Aportación común» cuando el usuario no teclea ninguna", async () => {
    const commonContributions = new StubCommonContributionRepository();
    commonContributions.registerResult = MovementId(12);
    const useCase = new RegisterManualContribution(
      commonContributions,
      buildAccounts(personalAccount),
      buildTags(),
    );

    await useCase.execute({ accountId: 1, date: "2026-09-14", note: "", amountCents: 5_000 });

    expect(commonContributions.registered[0].movement.note).toBe("Aportación común");
  });

  it("rechaza el duplicado si el mes ya tiene movimiento de aportación enlazado (FR-001)", async () => {
    const commonContributions = new StubCommonContributionRepository();
    commonContributions.existingByMonth.set("2026-09", Movement.rehydrate({
      id: 10,
      accountId: ACCOUNT_ID,
      type: "expense",
      date: "2026-09-01",
      note: "Aportación común de Miembro A",
      amount: Money.fromCents(25_000),
      nature: "personal",
      tagId: TagId(100),
      createdAt: "2026-09-01T08:00:00.000Z",
    }));
    const useCase = new RegisterManualContribution(
      commonContributions,
      buildAccounts(personalAccount),
      buildTags(),
    );

    await expect(
      useCase.execute({ accountId: 1, date: "2026-09-20", note: "Otra", amountCents: 1_000 }),
    ).rejects.toThrowError(ContributionAlreadyExistsError);
    expect(commonContributions.registered).toHaveLength(0);
  });

  it("admite el registro en un mes con fila huérfana (sin movimiento enlazado)", async () => {
    const commonContributions = new StubCommonContributionRepository();
    commonContributions.existingByMonth.set("2026-09", null);
    commonContributions.registerResult = MovementId(13);
    const useCase = new RegisterManualContribution(
      commonContributions,
      buildAccounts(personalAccount),
      buildTags(),
    );

    const movementId = await useCase.execute({
      accountId: 1,
      date: "2026-09-14",
      note: "Reposición",
      amountCents: 20_000,
    });

    expect(movementId).toBe(13);
    expect(commonContributions.registered).toHaveLength(1);
  });

  it("rechaza con ContributionAlreadyExistsError si la escritura atómica detecta conflicto", async () => {
    const commonContributions = new StubCommonContributionRepository();
    commonContributions.registerResult = null;
    const useCase = new RegisterManualContribution(
      commonContributions,
      buildAccounts(personalAccount),
      buildTags(),
    );

    await expect(
      useCase.execute({ accountId: 1, date: "2026-09-14", note: "Carrera", amountCents: 1_000 }),
    ).rejects.toThrowError(ContributionAlreadyExistsError);
  });

  it("rechaza si la cuenta no tiene config de aportación activa", async () => {
    const commonContributions = new StubCommonContributionRepository();
    commonContributions.config = null;
    const useCase = new RegisterManualContribution(
      commonContributions,
      buildAccounts(personalAccount),
      buildTags(),
    );

    await expect(
      useCase.execute({ accountId: 1, date: "2026-09-14", note: "X", amountCents: 1_000 }),
    ).rejects.toThrowError(CommonContributionNotFoundError);
  });

  it("rechaza si la config está desactivada", async () => {
    const commonContributions = new StubCommonContributionRepository();
    commonContributions.config = CommonContribution.rehydrate(CommonContributionId(4), {
      accountId: ACCOUNT_ID,
      percentage: ContributionPercentage.fromBasisPoints(2500),
      active: false,
      activatedAtMonth: "2026-11",
    });
    const useCase = new RegisterManualContribution(
      commonContributions,
      buildAccounts(personalAccount),
      buildTags(),
    );

    await expect(
      useCase.execute({ accountId: 1, date: "2026-09-14", note: "X", amountCents: 1_000 }),
    ).rejects.toThrowError(CommonContributionNotFoundError);
  });

  it("rechaza en la cuenta común (paridad del materializador)", async () => {
    const useCase = new RegisterManualContribution(
      new StubCommonContributionRepository(),
      buildAccounts(sharedAccount),
      buildTags(),
    );

    await expect(
      useCase.execute({ accountId: 3, date: "2026-09-14", note: "X", amountCents: 1_000 }),
    ).rejects.toThrowError(SharedAccountContributionError);
  });

  it("rechaza si la cuenta no existe", async () => {
    const useCase = new RegisterManualContribution(
      new StubCommonContributionRepository(),
      buildAccounts(null),
      buildTags(),
    );

    await expect(
      useCase.execute({ accountId: 99, date: "2026-09-14", note: "X", amountCents: 1_000 }),
    ).rejects.toThrowError(AccountNotFoundError);
  });
});
