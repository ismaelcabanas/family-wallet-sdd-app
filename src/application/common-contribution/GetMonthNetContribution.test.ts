import { describe, expect, it } from "vitest";

import { AccountId } from "@/domain/account/AccountId";
import { CommonContribution } from "@/domain/common-contribution/CommonContribution";
import { CommonContributionId } from "@/domain/common-contribution/CommonContributionId";
import { ContributionPercentage } from "@/domain/common-contribution/ContributionPercentage";
import { TagId } from "@/domain/tag/TagId";
import { Movement } from "@/domain/movement/Movement";
import { Money } from "@/domain/movement/Money";

import { GetMonthNetContribution } from "./GetMonthNetContribution";
import type { CommonContributionRepository } from "./CommonContributionRepository";

class InMemoryCommonContributionRepository implements CommonContributionRepository {
  constructor(
    private config: CommonContribution | null,
    private materialized: Map<string, Movement | null> = new Map(),
  ) {}

  async findByAccountId(): Promise<CommonContribution | null> {
    return this.config;
  }

  async save(config: CommonContribution): Promise<CommonContribution> {
    this.config = config;
    return config;
  }

  async isMaterialized(): Promise<boolean> {
    return false;
  }

  async registerMaterialization(): Promise<boolean> {
    return false;
  }

  async findMaterializedMovement(
    contributionId: CommonContributionId,
    month: string,
  ): Promise<Movement | null> {
    return this.materialized.get(`${contributionId}:${month}`) ?? null;
  }

  async withdrawMaterialization(): Promise<boolean> {
    return false;
  }
}

const ACCOUNT_ID = AccountId(1);
const MONTH = "2026-10";

function persistedConfig() {
  return CommonContribution.rehydrate(CommonContributionId(4), {
    accountId: ACCOUNT_ID,
    percentage: ContributionPercentage.fromBasisPoints(2500),
    active: true,
    activatedAtMonth: "2026-10",
  });
}

function materializedContributionMovement(amountCents: number) {
  return Movement.rehydrate({
    id: 101,
    accountId: ACCOUNT_ID,
    type: "expense",
    date: "2026-10-01",
    note: "Aportación común de Miembro A",
    amount: Money.fromCents(amountCents),
    nature: "personal",
    tagId: TagId(20),
    createdAt: "2026-10-01T10:00:00.000Z",
  });
}

describe("GetMonthNetContribution", () => {
  it("sin fila de config → { configured: false, amountCents: 0 }", async () => {
    const useCase = new GetMonthNetContribution(
      new InMemoryCommonContributionRepository(null),
    );

    const dto = await useCase.execute(ACCOUNT_ID, MONTH);

    expect(dto).toEqual({ configured: false, amountCents: 0 });
  });

  it("config activa + movimiento enlazado → importe exacto del movimiento (37945)", async () => {
    const repository = new InMemoryCommonContributionRepository(persistedConfig(), new Map([["4:2026-10", materializedContributionMovement(37945)]]));
    const useCase = new GetMonthNetContribution(repository);

    const dto = await useCase.execute(ACCOUNT_ID, MONTH);

    expect(dto).toEqual({ configured: true, amountCents: 37945 });
  });

  it("config activa sin fila del registro (retirada por neto 0 / mes futuro) → { configured: true, amountCents: 0 }", async () => {
    const repository = new InMemoryCommonContributionRepository(persistedConfig());
    const useCase = new GetMonthNetContribution(repository);

    const dto = await useCase.execute(ACCOUNT_ID, MONTH);

    expect(dto).toEqual({ configured: true, amountCents: 0 });
  });

  it("config + fila con movimiento borrado por el usuario → { configured: true, amountCents: 0 }", async () => {
    const repository = new InMemoryCommonContributionRepository(
      persistedConfig(),
      new Map([["4:2026-10", null]]),
    );
    const useCase = new GetMonthNetContribution(repository);

    const dto = await useCase.execute(ACCOUNT_ID, MONTH);

    expect(dto).toEqual({ configured: true, amountCents: 0 });
  });

  it("mes inválido (no YYYY-MM) → throw Error", async () => {
    const useCase = new GetMonthNetContribution(
      new InMemoryCommonContributionRepository(persistedConfig()),
    );

    await expect(useCase.execute(ACCOUNT_ID, "2026-13")).rejects.toThrow(
      "Mes inválido: 2026-13 (se espera YYYY-MM)",
    );
  });
});
