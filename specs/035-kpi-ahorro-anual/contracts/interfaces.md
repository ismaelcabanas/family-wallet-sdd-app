# Interface Contracts: KPI de ahorro acumulado del año (035)

**Feature**: 035-kpi-ahorro-anual | **Fecha**: 2026-11-22

---

## Resumen

La feature no introduce interfaces externas nuevas (API pública, CLI, formularios ni actions). Los contratos son **internos**: un caso de uso de lectura con su DTO, un helper puro compartido, dos métodos de puerto de lectura y una prop de UI. Todos los símbolos referenciados existen en el código actual salvo los marcados `[nuevo]`.

---

## Caso de uso

### `GetAnnualAccumulatedSavings` `[nuevo]`

**Ubicación**: `src/application/movement/GetAnnualAccumulatedSavings.ts`

```typescript
import type { AnnualAccumulatedSavingsDTO } from "./dto";

export class GetAnnualAccumulatedSavings {
  constructor(
    movements: MovementRepository,
    savingsAllocations: SavingsAllocationRepository,
  )

  execute(accountId: number, year: string): Promise<AnnualAccumulatedSavingsDTO>
}
```

**Contrato**:

- `year` DEBE cumplir `/^\d{4}$/`; si no, lanza `Error("Año inválido: … (se espera YYYY)")` (paridad `GetAnnualIncomeStatement`).
- **Solo lectura**: jamás materializa ni escribe (FR-005).
- Devuelve `{ accumulatedCents }` = Σₘ netMonthBalance(m), m = `${year}-01`…`${year}-12`, donde cada mes computa `MonthlyClosure.fromMovements(movimientos del mes)` − deducción condicional de ahorro (ver helper). Cada mes computa como máximo una vez (FR-002).
- Determinismo: a igualdad de datos, el resultado es idéntico para cualquier mes del mismo año (FR-003); la visita a un mes no visitado materializa ANTES de la lectura (orden de la página) y el acumulado del render ya lo refleja.
- Cuenta inexistente: sin validación propia (paridad `GetMonthlyClosure`; la página ya resolvió la cuenta y solo consulta el caso de uso en cuentas personales).

### DTO `AnnualAccumulatedSavingsDTO` `[nuevo]`

**Ubicación**: `src/application/movement/dto.ts`

```typescript
export interface AnnualAccumulatedSavingsDTO {
  accumulatedCents: number; // céntimos EUR, con signo, puede ser negativo
}
```

## Helper compartido

### `netMonthBalanceCents` `[nuevo]`

**Ubicación**: `src/application/movement/net-month-balance.ts`

```typescript
export interface NetMonthBalanceSavings {
  amountCents: number;
  backedByMovement: boolean;
}

export function netMonthBalanceCents(
  monthBalanceCents: number,
  savings: NetMonthBalanceSavings,
): number;
```

**Contrato**: única copia de la fórmula condicional del «Saldo del mes» (033). `backedByMovement === true` → devuelve `monthBalanceCents` (el gasto de ahorro ya está en el cierre); `false` → `monthBalanceCents − amountCents`. Función pura. La consumen `page.tsx` (mes en curso) y `GetAnnualAccumulatedSavings` (12 meses); `MonthSavingsDTO` satisface estructuralmente `NetMonthBalanceSavings`.

## Puertos (ampliaciones)

### `MovementRepository` (ampliado)

**Ubicación**: `src/application/movement/MovementRepository.ts` · **Implementación**: `src/infrastructure/db/DrizzleMovementRepository.ts`

```typescript
// [nuevo] espejo de listByYear + filtro de cuenta
listByYearAndAccount(accountId: AccountId, year: string): Promise<MovementDTO[]>;
```

**Contrato**: movimientos de la cuenta con `date ∈ [${year}-01-01, ${year+1}-01-01)` (misma ventana y mismo join a tags que `listByYear`/`listByMonthAndAccount`); orden `date DESC, id DESC` (heredado del `selectMonthRows` compartido).

### `SavingsAllocationRepository` (ampliado)

**Ubicación**: `src/application/savings/SavingsAllocationRepository.ts` · **Implementación**: `src/infrastructure/db/DrizzleSavingsAllocationRepository.ts`

```typescript
export interface DeductedMonthEntry {
  month: string;             // "YYYY-MM"
  amountCents: number;       // amount_cents de la fila
  backedByMovement: boolean; // movement_id enlazado EXISTE en movements
}

// [nuevo] en la interfaz:
findDeductedMonthsOfYear(
  allocationId: SavingsAllocationId,
  year: string,
): Promise<readonly DeductedMonthEntry[]>;
```

**Contrato**: filas de `savings_allocation_months` de la config cuyo `month ∈ [${year}-01, ${year}-12]`; solo meses con fila (los demás no descuentan). `backedByMovement` se computa con `LEFT JOIN movements ON movement_id = movements.id` (`movement existente`) — paridad de existencia con `findDeductedMovement`: fila huérfana computa como congelada.

### Sentencias Drizzle de los adaptadores

```typescript
// DrizzleMovementRepository.listByYearAndAccount:
//   selectMonthRows().where(and(
//     eq(movements.accountId, accountId),
//     gte(movements.date, `${year}-01-01`),
//     lt(movements.date, `${Number(year) + 1}-01-01`),
//   ))

// DrizzleSavingsAllocationRepository.findDeductedMonthsOfYear:
//   select({ month, amountCents, backedByMovement: movements.id no es null })
//     .from(savingsAllocationMonths)
//     .leftJoin(movements, eq(movements.id, savingsAllocationMonths.movementId))
//     .where(and(
//       eq(savingsAllocationMonths.savingsAllocationId, allocationId),
//       gte(savingsAllocationMonths.month, `${year}-01`),
//       lte(savingsAllocationMonths.month, `${year}-12`),
//     ))
```

## Contrato de UI

### `AccountMonthKpis` (amend del contrato congelado 022 §2 / 023 §4 / 024 §2 / 033)

Ver detalle congelado en [ui-contract.md](./ui-contract.md): 5.ª métrica «Ahorro acumulado» con `accumulatedSavingsCents: number` ya calculado, subtext `Año {year}` y formato firmado (rojo si < 0); layout `grid-cols-2 sm:grid-cols-5` con la celda nueva `col-span-2 sm:col-span-1`.

### Composición de la página (`page.tsx`)

```typescript
const year = month.slice(0, 4);

// Promise.all (solo account.type === "personal"), 6.ª lectura:
new GetAnnualAccumulatedSavings(movementRepository, savingsAllocationRepository)
  .execute(account.id, year)

// fórmula del «Saldo del mes» vía helper único (antes resta inline):
netMonthBalanceCents={netMonthBalanceCents(closure.monthBalanceCents, savings)}
accumulatedSavingsCents={annualAccumulated.accumulatedCents}
```

Los 3 awaits secuenciales de materialización (018 → 019 → 033) quedan intactos y ANTES de las lecturas. La cuenta común no consulta el caso de uso ni renderiza el bloque (FR-006).

---

## Referencias

- **Spec**: `specs/035-kpi-ahorro-anual/spec.md`
- **Data Model**: `specs/035-kpi-ahorro-anual/data-model.md`
- **Research**: `specs/035-kpi-ahorro-anual/research.md` (R1–R9)
- **Precedentes**: `GetMonthlyClosure` (misma fuente), `GetAnnualIncomeStatement` (patrón año), `GetMonthSavings` (semántica `backedByMovement`)
- **Constitución**: `.specify/memory/constitution.md` (principios III, VII)
