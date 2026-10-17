import { describe, expect, it } from "vitest";

import type { AccountRepository } from "../account/AccountRepository";
import type { AccountDTO } from "../movement/dto";
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
  private readonly materializedMonths = new Set<string>();
  movements: Movement[] = [];
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
    this.materializedMonths.add(key);
    this.movements.push(
      Movement.recreate(
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
      ),
    );
    this.nextMovementId += 1;
    return true;
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
}) {
  const tagRepository = new InMemoryTagRepository(options.tags ?? [CONTRIBUTION_TAG]);
  const useCase = new MaterializeCommonContributions(
    options.contributions,
    new InMemoryRegularIncomeRepository(options.regularIncome === undefined ? regularIncome() : options.regularIncome),
    tagRepository,
    new InMemoryAccountRepository(options.accounts ?? [MEMBER_B_ACCOUNT]),
  );
  return { useCase, tagRepository };
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
});
