import { describe, expect, it } from "vitest";

import type { AccountRepository } from "../account/AccountRepository";
import type { AccountDTO, MovementDTO } from "../movement/dto";
import type { MovementRepository } from "../movement/MovementRepository";
import type { RegularIncomeRepository } from "../regular-income/RegularIncomeRepository";
import type { TagRepository } from "../tag/TagRepository";
import { AccountId } from "@/domain/account/AccountId";
import { Account } from "@/domain/account/Account";
import { Movement } from "@/domain/movement/Movement";
import type { ExpenseNature } from "@/domain/movement/ExpenseNature";
import { MovementId } from "@/domain/movement/MovementId";
import { Money } from "@/domain/movement/Money";
import { RegularIncome } from "@/domain/regular-income/RegularIncome";
import { RegularIncomeId } from "@/domain/regular-income/RegularIncomeId";
import { Tag } from "@/domain/tag/Tag";
import { TagId } from "@/domain/tag/TagId";
import { CommonContribution } from "@/domain/common-contribution/CommonContribution";
import { CommonContributionId } from "@/domain/common-contribution/CommonContributionId";
import { ContributionPercentage } from "@/domain/common-contribution/ContributionPercentage";

import { MaterializeCommonContributions } from "./MaterializeCommonContributions";
import type { CommonContributionRepository } from "./CommonContributionRepository";

class InMemoryCommonContributionRepository implements CommonContributionRepository {
  private readonly configsByAccountId = new Map<number, CommonContribution>();
  private readonly materializedMonths = new Map<string, Movement | null>();
  movements: Movement[] = [];
  withdrawCalls: Array<{ contributionId: number; month: string }> = [];
  private nextConfigId = 1;
  private nextMovementId = 1;

  async findByAccountId(accountId: AccountId): Promise<CommonContribution | null> {
    return this.configsByAccountId.get(accountId as number) ?? null;
  }

  async save(config: CommonContribution): Promise<CommonContribution> {
    let persisted = config;
    if (config.id === null) {
      persisted = CommonContribution.rehydrate(this.nextConfigId, {
        accountId: config.accountId,
        percentage: config.percentage,
        active: config.active,
        activatedAtMonth: config.activatedAtMonth,
      });
      this.nextConfigId += 1;
    }
    this.configsByAccountId.set(persisted.accountId as number, persisted);
    return persisted;
  }

  async isMaterialized(contributionId: CommonContributionId, month: string): Promise<boolean> {
    return this.materializedMonths.has(`${contributionId}:${month}`);
  }

  async findMaterializedMovement(
    contributionId: CommonContributionId,
    month: string,
  ): Promise<Movement | null> {
    return this.materializedMonths.get(`${contributionId}:${month}`) ?? null;
  }

  async withdrawMaterialization(
    contributionId: CommonContributionId,
    month: string,
  ): Promise<boolean> {
    this.withdrawCalls.push({ contributionId: contributionId as number, month });
    const key = `${contributionId}:${month}`;
    if (!this.materializedMonths.has(key)) {
      return false;
    }
    const movement = this.materializedMonths.get(key) ?? null;
    if (movement !== null) {
      this.movements = this.movements.filter(
        (candidate) => candidate.id !== movement.id,
      );
    }
    this.materializedMonths.delete(key);
    return true;
  }

  async registerMaterialization(
    config: CommonContribution,
    month: string,
    movement: Movement,
  ): Promise<boolean> {
    if (config.id === null) {
      throw new Error("registerMaterialization requiere una config persistida");
    }
    const key = `${config.id}:${month}`;
    if (this.materializedMonths.has(key)) {
      return false;
    }
    const persisted = Movement.recreate(
      MovementId(this.nextMovementId),
      {
        accountId: movement.accountId,
        type: movement.type,
        date: movement.date,
        note: movement.note,
        amount: movement.amount,
        nature: movement.nature,
        tagId: movement.tagId,
      },
      movement.createdAt,
    );
    this.materializedMonths.set(key, persisted);
    this.movements.push(persisted);
    this.nextMovementId += 1;
    return true;
  }
}

class InMemoryMovementRepository implements MovementRepository {
  updates: Movement[] = [];
  sharedExpenseCentsByMonth = new Map<string, number>();
  calls: Array<{ method: string; args: unknown[] }> = [];

  async create(): Promise<MovementId> {
    return MovementId(this.updates.length + 100);
  }

  async listByMonthAndAccount(): Promise<MovementDTO[]> {
    return [];
  }

  async listByMonth(): Promise<MovementDTO[]> {
    return [];
  }

  async listByYear(): Promise<MovementDTO[]> {
    return [];
  }

  async findById(): Promise<Movement | null> {
    return null;
  }

  async update(movement: Movement): Promise<void> {
    this.calls.push({ method: "update", args: [movement] });
    this.updates.push(movement);
  }

  async delete(): Promise<void> {}

  async sumSharedExpenseCents(accountId: AccountId, month: string): Promise<number> {
    this.calls.push({ method: "sumSharedExpenseCents", args: [accountId, month] });
    return this.sharedExpenseCentsByMonth.get(month) ?? 0;
  }
}

class InMemoryRegularIncomeRepository implements RegularIncomeRepository {
  constructor(private config: RegularIncome | null) {}

  async findByAccountId(): Promise<RegularIncome | null> {
    return this.config;
  }

  async save(config: RegularIncome): Promise<RegularIncome> {
    this.config = config;
    return config;
  }

  async isMaterialized(): Promise<boolean> {
    return false;
  }

  async registerMaterialization(): Promise<boolean> {
    return false;
  }
}

class InMemoryTagRepository implements TagRepository {
  savedTags: Tag[] = [];

  constructor(private tags: Tag[] = []) {}

  async findAllActive(): Promise<Tag[]> {
    return this.tags.filter((tag) => tag.status === "active");
  }

  async findByIds(): Promise<Tag[]> {
    return [];
  }

  async findBySlug(slug: string): Promise<Tag | null> {
    return this.tags.find((tag) => tag.slug === slug) ?? null;
  }

  async findByName(name: string): Promise<Tag | null> {
    return this.tags.find((tag) => tag.name === name) ?? null;
  }

  async save(tag: Tag): Promise<Tag> {
    let persisted = tag;
    if (tag.id === null) {
      persisted = Tag.rehydrate(TagId(this.tags.length + 1), tag.name, tag.slug, tag.status);
    }
    this.tags = [...this.tags.filter((candidate) => candidate.id !== persisted.id), persisted];
    this.savedTags.push(persisted);
    return persisted;
  }

  async findById(): Promise<Tag | null> {
    return null;
  }

  async findAll(): Promise<Tag[]> {
    return [...this.tags];
  }

  async update(tag: Tag): Promise<Tag> {
    return tag;
  }

  async mergeInto(): Promise<{ reassignedMovements: number }> {
    return { reassignedMovements: 0 };
  }
}

class InMemoryAccountRepository implements AccountRepository {
  constructor(private readonly rows: AccountDTO[]) {}

  async findAll(): Promise<AccountDTO[]> {
    return this.rows;
  }

  async findById(id: AccountId): Promise<Account | null> {
    const row = this.rows.find((candidate) => candidate.id === (id as number));
    return row
      ? Account.rehydrate(
          row.id,
          row.name,
          row.type,
          row.memberId === null ? null : (row.memberId as never),
        )
      : null;
  }

  async getBalance(): Promise<number> {
    return 0;
  }
}

const MEMBER_B_ACCOUNT: AccountDTO = {
  id: 2,
  name: "Cuenta de Miembro B",
  type: "personal",
  memberId: 2,
  memberName: "Miembro B",
};

const ACCOUNT_WITHOUT_MEMBER_NAME: AccountDTO = {
  id: 4,
  name: "Cuenta sin miembro",
  type: "personal",
  memberId: null,
  memberName: null,
};

const CONTRIBUTION_TAG = Tag.rehydrate(TagId(20), "Aportación Común", "aportacion-comun", "active");

const ACCOUNT_ID = AccountId(2);
const CURRENT_MONTH = "2026-10";

function regularIncome(overrides: Partial<Parameters<typeof RegularIncome.rehydrate>[0]> = {}) {
  return RegularIncome.rehydrate({
    id: RegularIncomeId(11),
    accountId: ACCOUNT_ID,
    amount: Money.fromCents(200_000),
    dayOfMonth: 1,
    note: "Ingreso regular de Miembro B",
    active: true,
    activatedAtMonth: CURRENT_MONTH,
    ...overrides,
  });
}

function activeConfig(overrides: Partial<Parameters<typeof CommonContribution.create>[0]> = {}) {
  return CommonContribution.create({
    accountId: ACCOUNT_ID,
    percentage: ContributionPercentage.fromBasisPoints(2500),
    active: true,
    activatedAtMonth: CURRENT_MONTH,
    ...overrides,
  });
}

function buildUseCase(options: {
  contributions: InMemoryCommonContributionRepository;
  regularIncome?: RegularIncome | null;
  tags?: Tag[];
  accounts?: AccountDTO[];
  movements?: InMemoryMovementRepository;
}) {
  const tagRepository = new InMemoryTagRepository(options.tags ?? [CONTRIBUTION_TAG]);
  const movementRepository = options.movements ?? new InMemoryMovementRepository();
  const useCase = new MaterializeCommonContributions(
    options.contributions,
    new InMemoryRegularIncomeRepository(options.regularIncome === undefined ? regularIncome() : options.regularIncome),
    movementRepository,
    tagRepository,
    new InMemoryAccountRepository(options.accounts ?? [MEMBER_B_ACCOUNT]),
  );
  return { useCase, tagRepository, movementRepository };
}

async function seededContributions(config: CommonContribution | null) {
  const repo = new InMemoryCommonContributionRepository();
  if (config) {
    await repo.save(config);
  }
  return repo;
}

describe("MaterializeCommonContributions", () => {
  it("la primera consulta del mes en curso materializa el gasto propio con día 1, nota del miembro y etiqueta resuelta por slug", async () => {
    const repo = await seededContributions(activeConfig());
    const { useCase } = buildUseCase({ contributions: repo });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(repo.movements).toHaveLength(1);
    const [movement] = repo.movements;
    expect(movement.accountId).toBe(ACCOUNT_ID);
    expect(movement.type).toBe("expense");
    expect(movement.date).toBe("2026-10-01");
    expect(movement.note).toBe("Aportación común de Miembro B");
    expect(movement.amount.amountCents).toBe(50_000);
    expect(movement.nature).toBe<ExpenseNature>("personal");
    expect(movement.tagId).toBe(CONTRIBUTION_TAG.id);
    expect(await repo.isMaterialized(CommonContributionId(1), CURRENT_MONTH)).toBe(true);
  });

  it("la consulta repetida del mismo mes no duplica", async () => {
    const repo = await seededContributions(activeConfig());
    const { useCase } = buildUseCase({ contributions: repo });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(repo.movements).toHaveLength(1);
  });

  it("un mes anterior a la activación nunca se materializa (sin retroactivo)", async () => {
    const repo = await seededContributions(activeConfig({ activatedAtMonth: "2026-08" }));
    const { useCase } = buildUseCase({ contributions: repo });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-07", CURRENT_MONTH);

    expect(repo.movements).toHaveLength(0);
  });

  it("un mes posterior al mes en curso (futuro) nunca se materializa", async () => {
    const repo = await seededContributions(activeConfig());
    const { useCase } = buildUseCase({ contributions: repo });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-11", CURRENT_MONTH);

    expect(repo.movements).toHaveLength(0);
  });

  it("un cambio de porcentaje no toca el mes ya registrado y aplica al pendiente", async () => {
    const repo = await seededContributions(activeConfig({ activatedAtMonth: "2026-08" }));
    const { useCase } = buildUseCase({ contributions: repo });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-09", "2026-12");

    const stored = await repo.findByAccountId(ACCOUNT_ID);
    await repo.save(
      stored!.update({ percentage: ContributionPercentage.fromBasisPoints(3000) }),
    );

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-09", "2026-12");
    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-10", "2026-12");

    expect(repo.movements).toHaveLength(2);
    const september = repo.movements.find((movement) => movement.date.startsWith("2026-09"));
    const october = repo.movements.find((movement) => movement.date.startsWith("2026-10"));
    expect(september?.amount.amountCents).toBe(50_000);
    expect(october?.amount.amountCents).toBe(60_000);
  });

  it("la base es el importe del ingreso regular al momento de generar", async () => {
    const repo = await seededContributions(activeConfig({ activatedAtMonth: "2026-08" }));
    const income = regularIncome({ amount: Money.fromCents(210_000) });
    const { useCase } = buildUseCase({ contributions: repo, regularIncome: income });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-09", "2026-12");

    expect(repo.movements).toHaveLength(1);
    expect(repo.movements[0].amount.amountCents).toBe(52_500);
  });

  it("sin config → no-op", async () => {
    const repo = await seededContributions(null);
    const { useCase } = buildUseCase({ contributions: repo });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(repo.movements).toHaveLength(0);
  });

  it("config inactiva → no-op", async () => {
    const repo = await seededContributions(activeConfig({ active: false }));
    const { useCase } = buildUseCase({ contributions: repo });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(repo.movements).toHaveLength(0);
  });

  it("sin ingreso regular → no-op (FR-006)", async () => {
    const repo = await seededContributions(activeConfig());
    const { useCase } = buildUseCase({ contributions: repo, regularIncome: null });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(repo.movements).toHaveLength(0);
  });

  it("ingreso regular inactivo → no-op (FR-006)", async () => {
    const repo = await seededContributions(activeConfig());
    const { useCase } = buildUseCase({
      contributions: repo,
      regularIncome: regularIncome({ active: false }),
    });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(repo.movements).toHaveLength(0);
  });

  it("cálculo < 1 céntimo → no-op sin registrar el mes (§7)", async () => {
    const repo = await seededContributions(
      activeConfig({ percentage: ContributionPercentage.fromBasisPoints(1) }),
    );
    const { useCase } = buildUseCase({
      contributions: repo,
      regularIncome: regularIncome({ amount: Money.fromCents(500) }),
    });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(repo.movements).toHaveLength(0);
    expect(await repo.isMaterialized(CommonContributionId(1), CURRENT_MONTH)).toBe(false);
  });

  it("etiqueta inexistente → la crea con slug fijo y la usa", async () => {
    const repo = await seededContributions(activeConfig());
    const { useCase, tagRepository } = buildUseCase({ contributions: repo, tags: [] });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(tagRepository.savedTags).toHaveLength(1);
    const [created] = tagRepository.savedTags;
    expect(created.name).toBe("Aportación Común");
    expect(created.slug).toBe("aportacion-comun");
    expect(repo.movements[0].tagId).toBe(created.id);
  });

  it("memberName ausente → nota «Aportación común de miembro»", async () => {
    const repo = new InMemoryCommonContributionRepository();
    await repo.save(
      activeConfig({ accountId: AccountId(4), activatedAtMonth: "2026-08" }),
    );
    const income = RegularIncome.rehydrate({
      id: RegularIncomeId(11),
      accountId: AccountId(4),
      amount: Money.fromCents(200_000),
      dayOfMonth: 1,
      note: "Ingreso regular",
      active: true,
      activatedAtMonth: "2026-08",
    });
    const { useCase } = buildUseCase({
      contributions: repo,
      regularIncome: income,
      accounts: [ACCOUNT_WITHOUT_MEMBER_NAME],
    });

    await useCase.ensureForAccountAndMonth(AccountId(4), "2026-09", "2026-12");

    expect(repo.movements).toHaveLength(1);
    expect(repo.movements[0].note).toBe("Aportación común de miembro");
  });

  describe("descuento de gastos comunes (021, guardas §1.2.1)", () => {
    it("escenario 7: la primera consulta ya materializa neta — nunca bruta y luego ajustada", async () => {
      const repo = await seededContributions(activeConfig());
      const movements = new InMemoryMovementRepository();
      movements.sharedExpenseCentsByMonth.set(CURRENT_MONTH, 12_055);
      const { useCase } = buildUseCase({ contributions: repo, movements });

      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      expect(repo.movements).toHaveLength(1);
      expect(repo.movements[0].amount.amountCents).toBe(37_945);
      expect(movements.updates).toHaveLength(0);
    });

    it("generación con neto 0 → no-op sin registrar el mes (FR-004)", async () => {
      const repo = await seededContributions(activeConfig());
      const movements = new InMemoryMovementRepository();
      movements.sharedExpenseCentsByMonth.set(CURRENT_MONTH, 50_000);
      const { useCase } = buildUseCase({ contributions: repo, movements });

      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      expect(repo.movements).toHaveLength(0);
      expect(await repo.isMaterialized(CommonContributionId(1), CURRENT_MONTH)).toBe(false);
    });

    it("re-sincroniza el mes en curso registrado: alta de gasto común ajusta el importe vía movements.update (4i)", async () => {
      const repo = await seededContributions(activeConfig());
      const movements = new InMemoryMovementRepository();
      const { useCase } = buildUseCase({ contributions: repo, movements });
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      movements.sharedExpenseCentsByMonth.set(CURRENT_MONTH, 12_000);
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      expect(repo.movements).toHaveLength(1);
      expect(movements.updates).toHaveLength(1);
      const [updated] = movements.updates;
      expect(updated.id).toBe(repo.movements[0].id);
      expect(updated.amount.amountCents).toBe(38_000);
      expect(updated.date).toBe(repo.movements[0].date);
      expect(updated.note).toBe(repo.movements[0].note);
      expect(updated.nature).toBe(repo.movements[0].nature);
      expect(updated.tagId).toBe(repo.movements[0].tagId);
      expect(updated.accountId).toBe(repo.movements[0].accountId);
      expect(updated.createdAt).toBe(repo.movements[0].createdAt);
    });

    it("idempotencia: neto igual al importe vigente → return sin escritura (4h)", async () => {
      const repo = await seededContributions(activeConfig());
      const movements = new InMemoryMovementRepository();
      const { useCase } = buildUseCase({ contributions: repo, movements });
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      expect(movements.updates).toHaveLength(0);
      expect(repo.movements).toHaveLength(1);
    });

    it("retirada: neto 0 en re-sincronización → withdrawMaterialization y regeneración posterior si bajan los gastos (4g)", async () => {
      const repo = await seededContributions(activeConfig());
      const movements = new InMemoryMovementRepository();
      const { useCase } = buildUseCase({ contributions: repo, movements });
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      movements.sharedExpenseCentsByMonth.set(CURRENT_MONTH, 50_000);
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      expect(repo.movements).toHaveLength(0);
      expect(repo.withdrawCalls).toEqual([{ contributionId: 1, month: CURRENT_MONTH }]);
      expect(await repo.isMaterialized(CommonContributionId(1), CURRENT_MONTH)).toBe(false);

      movements.sharedExpenseCentsByMonth.set(CURRENT_MONTH, 12_000);
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      expect(repo.movements).toHaveLength(1);
      expect(repo.movements[0].amount.amountCents).toBe(38_000);
    });

    it("borrado del usuario (fila presente, movimiento null) → no-op definitivo aunque cambie el neto (4c, FR-006)", async () => {
      const repo = await seededContributions(activeConfig());
      const movements = new InMemoryMovementRepository();
      const { useCase } = buildUseCase({ contributions: repo, movements });
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
      await repo["materializedMonths"].set("1:" + CURRENT_MONTH, null);

      movements.sharedExpenseCentsByMonth.set(CURRENT_MONTH, 12_000);
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      expect(movements.updates).toHaveLength(0);
      expect(repo.withdrawCalls).toHaveLength(0);
      expect(await repo.isMaterialized(CommonContributionId(1), CURRENT_MONTH)).toBe(true);
    });

    it("mes cerrado registrado → congelado (4a, FR-003)", async () => {
      const repo = await seededContributions(activeConfig({ activatedAtMonth: "2026-08" }));
      const movements = new InMemoryMovementRepository();
      const { useCase } = buildUseCase({ contributions: repo, movements });
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-09", "2026-12");
      const september = repo.movements[0];
      expect(september.amount.amountCents).toBe(50_000);

      movements.sharedExpenseCentsByMonth.set("2026-09", 20_000);
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-09", "2026-12");

      expect(movements.updates).toHaveLength(0);
      expect(repo.movements[0].amount.amountCents).toBe(50_000);
    });

    it("config desactivada re-sincroniza el mes en curso ya generado pero no genera meses nuevos (5a solo en generación, escenario 13)", async () => {
      const repo = await seededContributions(activeConfig());
      const movements = new InMemoryMovementRepository();
      const { useCase } = buildUseCase({ contributions: repo, movements });
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      const stored = await repo.findByAccountId(ACCOUNT_ID);
      await repo.save(stored!.deactivate());
      movements.sharedExpenseCentsByMonth.set(CURRENT_MONTH, 12_000);

      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      expect(movements.updates).toHaveLength(1);
      expect(movements.updates[0].amount.amountCents).toBe(38_000);
    });

    it("ingreso regular ausente o inactivo en re-sincronización → conserva el último importe (4e)", async () => {
      const repo = await seededContributions(activeConfig());
      const movements = new InMemoryMovementRepository();
      const { useCase } = buildUseCase({ contributions: repo, movements });
      await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      const stored = await repo.findByAccountId(ACCOUNT_ID);
      await repo.save(stored!.deactivate());
      const regularIncomes = new InMemoryRegularIncomeRepository(
        regularIncome({ active: false }),
      );
      const useCaseInactiveIncome = new MaterializeCommonContributions(
        repo,
        regularIncomes,
        movements,
        new InMemoryTagRepository([CONTRIBUTION_TAG]),
        new InMemoryAccountRepository([MEMBER_B_ACCOUNT]),
      );
      movements.sharedExpenseCentsByMonth.set(CURRENT_MONTH, 12_000);

      await useCaseInactiveIncome.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

      expect(movements.updates).toHaveLength(0);
      expect(repo.movements[0].amount.amountCents).toBe(50_000);
    });

    it("sin config o ventana fuera (activatedAtMonth > month) → no-op", async () => {
      const emptyRepo = await seededContributions(null);
      const movements = new InMemoryMovementRepository();
      const { useCase: withoutConfig } = buildUseCase({ contributions: emptyRepo, movements });

      await withoutConfig.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
      expect(movements.calls).toHaveLength(0);
      expect(emptyRepo.movements).toHaveLength(0);
    });
  });
});
