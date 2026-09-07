import { InvalidMoneyError } from "./MovementErrors";

export const MAX_AMOUNT_CENTS = 99_999_999_999;

export class Money {
  private constructor(readonly amountCents: number) {
    Object.freeze(this);
  }

  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new InvalidMoneyError("El importe debe tener como máximo dos decimales.");
    }
    if (cents <= 0) {
      throw new InvalidMoneyError("El importe debe ser mayor que cero.");
    }
    if (cents > MAX_AMOUNT_CENTS) {
      throw new InvalidMoneyError("El importe supera el máximo permitido (999.999.999,99 €).");
    }
    return new Money(cents);
  }

  static fromCentsOrZero(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new InvalidMoneyError("El importe debe ser un número exacto de céntimos.");
    }
    if (Math.abs(cents) > MAX_AMOUNT_CENTS) {
      throw new InvalidMoneyError("El importe supera el máximo permitido (999.999.999,99 €).");
    }
    return new Money(cents);
  }

  add(other: Money): Money {
    return new Money(this.amountCents + other.amountCents);
  }

  subtract(other: Money): Money {
    return new Money(this.amountCents - other.amountCents);
  }

  equals(other: Money): boolean {
    return this.amountCents === other.amountCents;
  }
}
