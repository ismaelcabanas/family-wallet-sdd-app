import { describe, expect, it } from "vitest";

import { AccountId } from "../account/AccountId";
import { InvalidSavingsAllocationError } from "./SavingsAllocationErrors";
import { SavingsAllocation } from "./SavingsAllocation";
import { SavingsPercentage } from "./SavingsPercentage";

const CURRENT_MONTH = "2026-10";

function percentage(percent: number): SavingsPercentage {
  return SavingsPercentage.fromPercent(percent);
}

describe("SavingsAllocation", () => {
  it("create nace activa con activatedAtMonth = mes de alta", () => {
    const allocation = SavingsAllocation.create({
      accountId: AccountId(1),
      percentage: percentage(10),
      active: true,
      activatedAtMonth: CURRENT_MONTH,
    });

    expect(allocation.id).toBeNull();
    expect(allocation.accountId).toBe(AccountId(1));
    expect(allocation.percentage.equals(percentage(10))).toBe(true);
    expect(allocation.active).toBe(true);
    expect(allocation.activatedAtMonth).toBe(CURRENT_MONTH);
  });

  it("rehydrate conserva todos los campos (incluido el id)", () => {
    const allocation = SavingsAllocation.rehydrate(7, {
      accountId: AccountId(2),
      percentage: percentage(15),
      active: false,
      activatedAtMonth: "2026-06",
    });

    expect(allocation.id).toBe(7);
    expect(allocation.accountId).toBe(AccountId(2));
    expect(allocation.percentage.equals(percentage(15))).toBe(true);
    expect(allocation.active).toBe(false);
    expect(allocation.activatedAtMonth).toBe("2026-06");
  });

  it("update revalida el porcentaje y conserva active y activatedAtMonth", () => {
    const allocation = SavingsAllocation.rehydrate(7, {
      accountId: AccountId(2),
      percentage: percentage(10),
      active: true,
      activatedAtMonth: "2026-06",
    });

    const updated = allocation.update({ percentage: percentage(15) });

    expect(updated.id).toBe(7);
    expect(updated.percentage.equals(percentage(15))).toBe(true);
    expect(updated.active).toBe(true);
    expect(updated.activatedAtMonth).toBe("2026-06");
  });

  it("deactivate conserva activatedAtMonth", () => {
    const allocation = SavingsAllocation.rehydrate(7, {
      accountId: AccountId(2),
      percentage: percentage(10),
      active: true,
      activatedAtMonth: "2026-06",
    });

    const deactivated = allocation.deactivate();

    expect(deactivated.active).toBe(false);
    expect(deactivated.activatedAtMonth).toBe("2026-06");
  });

  it("activate resetea activatedAtMonth al mes en curso", () => {
    const allocation = SavingsAllocation.rehydrate(7, {
      accountId: AccountId(2),
      percentage: percentage(10),
      active: false,
      activatedAtMonth: "2026-05",
    });

    const reactivated = allocation.activate(CURRENT_MONTH);

    expect(reactivated.active).toBe(true);
    expect(reactivated.activatedAtMonth).toBe(CURRENT_MONTH);
  });

  it("porcentaje inválido en create y update → InvalidSavingsAllocationError(percentage)", () => {
    expect(() =>
      SavingsAllocation.create({
        accountId: AccountId(1),
        percentage: percentage(0),
        active: true,
        activatedAtMonth: CURRENT_MONTH,
      }),
    ).toThrowError(InvalidSavingsAllocationError);

    const allocation = SavingsAllocation.rehydrate(7, {
      accountId: AccountId(2),
      percentage: percentage(10),
      active: true,
      activatedAtMonth: "2026-06",
    });
    try {
      allocation.update({ percentage: percentage(101) });
      expect.unreachable("debía lanzar InvalidSavingsAllocationError");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidSavingsAllocationError);
      expect((error as InvalidSavingsAllocationError).field).toBe("percentage");
    }
  });

  it("activatedAtMonth malformado → InvalidSavingsAllocationError(activatedAtMonth)", () => {
    try {
      SavingsAllocation.create({
        accountId: AccountId(1),
        percentage: percentage(10),
        active: true,
        activatedAtMonth: "2026-13",
      });
      expect.unreachable("debía lanzar InvalidSavingsAllocationError");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidSavingsAllocationError);
      expect((error as InvalidSavingsAllocationError).field).toBe("activatedAtMonth");
      expect((error as Error).message).toBe("El mes de activación no es válido.");
    }
  });

  it("no expone método de fecha de materialización (sin movimiento)", () => {
    const allocation = SavingsAllocation.create({
      accountId: AccountId(1),
      percentage: percentage(10),
      active: true,
      activatedAtMonth: CURRENT_MONTH,
    });

    expect((allocation as unknown as Record<string, unknown>).dueDateForMonth).toBeUndefined();
  });

  it("es inmutable (Object.freeze)", () => {
    const allocation = SavingsAllocation.create({
      accountId: AccountId(1),
      percentage: percentage(10),
      active: true,
      activatedAtMonth: CURRENT_MONTH,
    });

    expect(Object.isFrozen(allocation)).toBe(true);
  });
});
