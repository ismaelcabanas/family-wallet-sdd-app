import { describe, expect, it } from "vitest";

import { AccountId } from "../account/AccountId";
import { InvalidMoneyError } from "../movement/MovementErrors";
import { Money } from "../movement/Money";
import { InvalidRegularIncomeError } from "./RegularIncomeErrors";
import { RegularIncome } from "./RegularIncome";

const ACCOUNT_ID = AccountId(1);

interface RegularIncomeInputForTest {
  accountId: AccountId;
  amount: Money;
  dayOfMonth: number;
  note: string;
  active: boolean;
  activatedAtMonth: string;
}

function buildInput(overrides: Partial<RegularIncomeInputForTest> = {}): RegularIncomeInputForTest {
  return {
    accountId: ACCOUNT_ID,
    amount: Money.fromCents(200_000),
    dayOfMonth: 1,
    note: "Nómina",
    active: true,
    activatedAtMonth: "2026-10",
    ...overrides,
  };
}

describe("RegularIncome", () => {
  describe("create (validaciones)", () => {
    it.each([0, -100])("el importe %d se rechaza vía Money", (cents) => {
      expect(() => Money.fromCents(cents)).toThrowError(InvalidMoneyError);
    });

    it("el importe no entero se rechaza vía Money", () => {
      expect(() => Money.fromCents(500.5)).toThrowError(InvalidMoneyError);
    });

    it.each([0, 32])("rechaza el día del mes %d", (dayOfMonth) => {
      expect(() => RegularIncome.create(buildInput({ dayOfMonth }))).toThrowError(
        InvalidRegularIncomeError,
      );
    });

    it.each([1, 29, 31])("acepta el día del mes %d", (dayOfMonth) => {
      expect(RegularIncome.create(buildInput({ dayOfMonth })).dayOfMonth).toBe(dayOfMonth);
    });

    it("rechaza la nota vacía tras trim", () => {
      expect(() => RegularIncome.create(buildInput({ note: "   " }))).toThrowError(
        InvalidRegularIncomeError,
      );
      try {
        RegularIncome.create(buildInput({ note: "   " }));
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidRegularIncomeError);
        expect((error as InvalidRegularIncomeError).field).toBe("note");
      }
    });

    it.each(["2026-13", "2026-1", "26-10", "octubre"])(
      "rechaza el mes de activación mal formado %s",
      (activatedAtMonth) => {
        expect(() => RegularIncome.create(buildInput({ activatedAtMonth }))).toThrowError(
          InvalidRegularIncomeError,
        );
      },
    );

    it("nace activa con los valores dados", () => {
      const config = RegularIncome.create(buildInput());

      expect(config.id).toBeNull();
      expect(config.accountId).toBe(ACCOUNT_ID);
      expect(config.amount.amountCents).toBe(200_000);
      expect(config.dayOfMonth).toBe(1);
      expect(config.note).toBe("Nómina");
      expect(config.active).toBe(true);
      expect(config.activatedAtMonth).toBe("2026-10");
    });

    it("rehydrate conserva el id y los valores", () => {
      const config = RegularIncome.rehydrate({
        id: 7,
        accountId: ACCOUNT_ID,
        amount: Money.fromCents(150_000),
        dayOfMonth: 15,
        note: "Ingreso regular de Miembro A",
        active: false,
        activatedAtMonth: "2026-05",
      });

      expect(config.id).toBe(7);
      expect(config.amount.amountCents).toBe(150_000);
      expect(config.dayOfMonth).toBe(15);
      expect(config.active).toBe(false);
      expect(config.activatedAtMonth).toBe("2026-05");
    });
  });

  describe("dueDateForMonth (clamping)", () => {
    it("día 31 → 28 en febrero de 2026 y 29 en febrero bisiesto de 2028", () => {
      const config = RegularIncome.create(buildInput({ dayOfMonth: 31 }));

      expect(config.dueDateForMonth("2026-02")).toBe("2026-02-28");
      expect(config.dueDateForMonth("2028-02")).toBe("2028-02-29");
    });

    it("día 31 → 30 en abril", () => {
      const config = RegularIncome.create(buildInput({ dayOfMonth: 31 }));

      expect(config.dueDateForMonth("2026-04")).toBe("2026-04-30");
    });

    it("día 30 → 28/29 en febrero", () => {
      const config = RegularIncome.create(buildInput({ dayOfMonth: 30 }));

      expect(config.dueDateForMonth("2026-02")).toBe("2026-02-28");
      expect(config.dueDateForMonth("2028-02")).toBe("2028-02-29");
    });

    it("día 1 → 01 en cualquier mes", () => {
      const config = RegularIncome.create(buildInput({ dayOfMonth: 1 }));

      expect(config.dueDateForMonth("2026-02")).toBe("2026-02-01");
      expect(config.dueDateForMonth("2026-12")).toBe("2026-12-01");
    });

    it("día 29 en febrero bisiesto 2028 se conserva", () => {
      const config = RegularIncome.create(buildInput({ dayOfMonth: 29 }));

      expect(config.dueDateForMonth("2028-02")).toBe("2028-02-29");
      expect(config.dueDateForMonth("2026-02")).toBe("2026-02-28");
    });
  });

  describe("update", () => {
    it("actualiza importe, día y nota conservando active y activatedAtMonth", () => {
      const config = RegularIncome.create(buildInput());

      const updated = config.update({
        amount: Money.fromCents(210_000),
        dayOfMonth: 5,
        note: "Nómina actualizada",
      });

      expect(updated.amount.amountCents).toBe(210_000);
      expect(updated.dayOfMonth).toBe(5);
      expect(updated.note).toBe("Nómina actualizada");
      expect(updated.active).toBe(true);
      expect(updated.activatedAtMonth).toBe("2026-10");
      expect(updated.id).toBeNull();
    });

    it("también conserva active=false en una edición sobre config inactiva", () => {
      const config = RegularIncome.rehydrate({
        id: 3,
        accountId: ACCOUNT_ID,
        amount: Money.fromCents(200_000),
        dayOfMonth: 1,
        note: "Nómina",
        active: false,
        activatedAtMonth: "2026-05",
      });

      const updated = config.update({ dayOfMonth: 10 });

      expect(updated.active).toBe(false);
      expect(updated.activatedAtMonth).toBe("2026-05");
      expect(updated.dayOfMonth).toBe(10);
      expect(updated.id).toBe(3);
    });

    it.each([0, 32])("valida el día %d en update", (dayOfMonth) => {
      const config = RegularIncome.create(buildInput());

      expect(() => config.update({ dayOfMonth })).toThrowError(InvalidRegularIncomeError);
    });

    it("valida la nota vacía en update", () => {
      const config = RegularIncome.create(buildInput());

      expect(() => config.update({ note: "  " })).toThrowError(InvalidRegularIncomeError);
    });
  });

  describe("deactivate / activate", () => {
    it("deactivate pone active=false conservando el resto (incluida la activación)", () => {
      const config = RegularIncome.create(buildInput());

      const deactivated = config.deactivate();

      expect(deactivated.active).toBe(false);
      expect(deactivated.activatedAtMonth).toBe("2026-10");
      expect(deactivated.amount.amountCents).toBe(200_000);
      expect(deactivated.dayOfMonth).toBe(1);
      expect(deactivated.note).toBe("Nómina");
    });

    it("activate resetea activatedAtMonth al mes indicado", () => {
      const config = RegularIncome.create(buildInput());

      const reactivated = config.deactivate().activate("2027-01");

      expect(reactivated.active).toBe(true);
      expect(reactivated.activatedAtMonth).toBe("2027-01");
    });

    it("activate sobre una config ya activa también resetea la activación", () => {
      const config = RegularIncome.create(buildInput());

      const activated = config.activate("2026-12");

      expect(activated.active).toBe(true);
      expect(activated.activatedAtMonth).toBe("2026-12");
    });
  });
});
