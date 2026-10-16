import { AccountId } from "@/domain/account/AccountId";
import { Movement } from "@/domain/movement/Movement";
import { Money } from "@/domain/movement/Money";
import { TagId } from "@/domain/tag/TagId";
import { CommonContribution } from "@/domain/common-contribution/CommonContribution";
import { ContributionPercentage } from "@/domain/common-contribution/ContributionPercentage";
import { beforeEach, describe, expect, it } from "vitest";

import { DrizzleAccountRepository } from "./DrizzleAccountRepository";
import { DrizzleCommonContributionRepository } from "./DrizzleCommonContributionRepository";
import { DrizzleMovementRepository } from "./DrizzleMovementRepository";
import { accounts } from "./schema/accounts";
import { commonContributions } from "./schema/common-contributions";
import { members } from "./schema/members";
import { movements } from "./schema/movements";
import { tags } from "./schema/tags";
import { createTestDb, type TestDb } from "./test-support";

let testDb: TestDb;
let contributionTagId: TagId;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.insert(members).values({ id: 2, name: "Miembro B" });
  await testDb.db.insert(accounts).values([
    { id: 2, name: "Cuenta de Miembro B", type: "personal", memberId: 2 },
  ]);
  const [tagRow] = await testDb.db.select().from(tags).limit(100);
  const aportacionTag = (await testDb.db.select().from(tags)).find(
    (tag) => tag.slug === "aportacion-comun",
  );
  expect(aportacionTag).toBeDefined();
  expect(tagRow).toBeDefined();
  contributionTagId = TagId(aportacionTag!.id);
});

function buildConfig(overrides: Partial<Parameters<typeof CommonContribution.create>[0]> = {}) {
  return CommonContribution.create({
    accountId: AccountId(2),
    percentage: ContributionPercentage.fromBasisPoints(2500),
    active: true,
    activatedAtMonth: "2026-10",
    ...overrides,
  });
}

function buildMovement(overrides: Partial<Parameters<typeof Movement.create>[0]> = {}) {
  return Movement.create({
    accountId: AccountId(2),
    type: "expense",
    date: "2026-10-01",
    note: "Aportación común de Miembro B",
    amount: Money.fromCents(50_000),
    nature: "personal",
    tagId: contributionTagId,
    ...overrides,
  });
}

describe("DrizzleCommonContributionRepository", () => {
  it("save inserta y devuelve la entidad con id; findByAccountId la rehidrata", async () => {
    const repository = new DrizzleCommonContributionRepository(testDb.db);

    const saved = await repository.save(buildConfig());

    expect(saved.id).not.toBeNull();
    const found = await repository.findByAccountId(AccountId(2));
    expect(found).toEqual(saved);
  });

  it("save hace upsert por account_id y devuelve la entidad persistida", async () => {
    const repository = new DrizzleCommonContributionRepository(testDb.db);

    const created = await repository.save(buildConfig());
    const updated = await repository.save(
      created.update({ percentage: ContributionPercentage.fromBasisPoints(3000) }),
    );

    const found = await repository.findByAccountId(AccountId(2));
    expect(found?.percentage.basisPoints).toBe(3000);
    expect(found?.id).toBe(updated.id);
    const rows = await testDb.db.select().from(commonContributions);
    expect(rows).toHaveLength(1);
  });

  it("isMaterialized es falso antes y verdadero tras registerMaterialization", async () => {
    const repository = new DrizzleCommonContributionRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    expect(await repository.isMaterialized(saved.id!, "2026-10")).toBe(false);

    const registered = await repository.registerMaterialization(saved, "2026-10", buildMovement());
    expect(registered).toBe(true);
    expect(await repository.isMaterialized(saved.id!, "2026-10")).toBe(true);
    expect(await repository.isMaterialized(saved.id!, "2026-11")).toBe(false);
  });

  it("registerMaterialization inserta la fila y el movimiento en una tx", async () => {
    const repository = new DrizzleCommonContributionRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    const registered = await repository.registerMaterialization(saved, "2026-10", buildMovement());

    expect(registered).toBe(true);
    const [movementRow] = await testDb.db.select().from(movements);
    expect(movementRow.accountId).toBe(2);
    expect(movementRow.type).toBe("expense");
    expect(movementRow.date).toBe("2026-10-01");
    expect(movementRow.amountCents).toBe(50_000);
    expect(movementRow.nature).toBe("personal");
    expect(movementRow.tagId).toBe(contributionTagId as number);
  });

  it("la segunda inserción del mismo par (config, mes) devuelve false sin crear movimiento", async () => {
    const repository = new DrizzleCommonContributionRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    const first = await repository.registerMaterialization(saved, "2026-10", buildMovement());
    const second = await repository.registerMaterialization(
      saved,
      "2026-10",
      buildMovement({ amount: Money.fromCents(60_000) }),
    );

    expect(first).toBe(true);
    expect(second).toBe(false);
    const movementRows = await testDb.db.select().from(movements);
    expect(movementRows).toHaveLength(1);
    expect(movementRows[0].amountCents).toBe(50_000);
  });

  it("el movimiento creado es visible a listByMonthAndAccount y a getBalance", async () => {
    const repository = new DrizzleCommonContributionRepository(testDb.db);
    const movementRepository = new DrizzleMovementRepository(testDb.db);
    const accountRepository = new DrizzleAccountRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    await repository.registerMaterialization(saved, "2026-10", buildMovement());

    const listed = await movementRepository.listByMonthAndAccount(AccountId(2), "2026-10");
    expect(listed).toHaveLength(1);
    expect(listed[0].amountCents).toBe(50_000);
    expect(listed[0].note).toBe("Aportación común de Miembro B");

    const balance = await accountRepository.getBalance(AccountId(2), "2026-10-31");
    expect(balance).toBe(-50_000);
  });

  it("la migración sembró la etiqueta aportacion-comun", async () => {
    const rows = await testDb.db.select().from(tags);

    const tag = rows.find((candidate) => candidate.slug === "aportacion-comun");
    expect(tag?.name).toBe("Aportación Común");
    expect(tag?.status).toBe("active");
  });
});
