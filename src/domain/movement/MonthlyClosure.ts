import { ExpenseNature } from "./ExpenseNature";
import { Money } from "./Money";
import { MovementType } from "./MovementType";

export interface ClosureTagRef {
  id: number;
  name: string;
}

export interface ClosureMovementInput {
  type: MovementType;
  nature: ExpenseNature | null;
  amountCents: number;
  tags: readonly ClosureTagRef[];
}

export interface TagBreakdownEntry {
  tagId: number;
  tagName: string;
  amount: Money;
}

interface TagAccumulator {
  tagId: number;
  tagName: string;
  cents: number;
}

export class MonthlyClosure {
  readonly incomeTotal: Money;
  readonly expenseTotal: Money;
  readonly sharedExpenseTotal: Money;
  readonly personalExpenseTotal: Money;
  readonly monthBalance: Money;
  readonly tagBreakdown: readonly TagBreakdownEntry[];

  private constructor(
    incomeTotal: Money,
    expenseTotal: Money,
    sharedExpenseTotal: Money,
    personalExpenseTotal: Money,
    monthBalance: Money,
    tagBreakdown: TagBreakdownEntry[],
  ) {
    this.incomeTotal = incomeTotal;
    this.expenseTotal = expenseTotal;
    this.sharedExpenseTotal = sharedExpenseTotal;
    this.personalExpenseTotal = personalExpenseTotal;
    this.monthBalance = monthBalance;
    this.tagBreakdown = Object.freeze([...tagBreakdown]);
    Object.freeze(this);
  }

  static fromMovements(inputs: readonly ClosureMovementInput[]): MonthlyClosure {
    let incomeCents = 0;
    let expenseCents = 0;
    let sharedCents = 0;
    let personalCents = 0;
    const breakdownByTagId = new Map<number, TagAccumulator>();

    for (const input of inputs) {
      if (input.type === "income") {
        incomeCents += input.amountCents;
        continue;
      }

      expenseCents += input.amountCents;
      if (input.nature === "shared") {
        sharedCents += input.amountCents;
      } else if (input.nature === "personal") {
        personalCents += input.amountCents;
      }

      for (const tag of input.tags) {
        const entry = breakdownByTagId.get(tag.id) ?? { tagId: tag.id, tagName: tag.name, cents: 0 };
        entry.cents += input.amountCents;
        breakdownByTagId.set(tag.id, entry);
      }
    }

    const tagBreakdown = [...breakdownByTagId.values()]
      .sort(
        (a, b) => b.cents - a.cents || a.tagName.localeCompare(b.tagName, "es"),
      )
      .map((entry) =>
        Object.freeze({
          tagId: entry.tagId,
          tagName: entry.tagName,
          amount: Money.fromCentsOrZero(entry.cents),
        }),
      );

    return new MonthlyClosure(
      Money.fromCentsOrZero(incomeCents),
      Money.fromCentsOrZero(expenseCents),
      Money.fromCentsOrZero(sharedCents),
      Money.fromCentsOrZero(personalCents),
      Money.fromCentsOrZero(incomeCents - expenseCents),
      tagBreakdown,
    );
  }
}
