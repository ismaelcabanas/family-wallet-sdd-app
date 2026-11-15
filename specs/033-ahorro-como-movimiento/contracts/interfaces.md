# Interface Contracts: El ahorro mensual como movimiento editable (033)

**Feature**: 033-ahorro-como-movimiento | **Fecha**: 2026-11-15

---

## Resumen

La feature no introduce interfaces externas nuevas (API pública, CLI). Los contratos son **internos**: ampliaciones del puerto de ahorro, del esquema Zod de la frontera y de un DTO de KPI. Todos los símbolos referenciados existen en el código actual salvo los marcados `[nuevo]`.

---

## Puerto: SavingsAllocationRepository (ampliado)

**Ubicación**: `src/application/savings/SavingsAllocationRepository.ts`
**Implementación**: `src/infrastructure/db/DrizzleSavingsAllocationRepository.ts`

```typescript
export interface SavingsAllocationRepository {
  findByAccountId(accountId: AccountId): Promise<SavingsAllocation | null>;
  save(config: SavingsAllocation): Promise<SavingsAllocation>;

  isDeducted(allocationId: SavingsAllocationId, month: string): Promise<boolean>;

  // registerDeduction(config, month, amountCents) — JUBILADO (sustituido por el de abajo)

  // [nuevo] materializador: fila + movimiento en una tx; false = ya registrado (idempotente)
  registerMaterialization(
    config: SavingsAllocation, month: string, movement: Movement,
  ): Promise<boolean>;

  // [nuevo] vía manual: re-enlaza huérfana (sincroniza amount_cents) o devuelve null (unicidad)
  registerManualSavings(
    config: SavingsAllocation, month: string, movement: Movement,
  ): Promise<MovementId | null>;

  findDeductedAmount(allocationId: SavingsAllocationId, month: string): Promise<number | null>;

  // [nuevo] movimiento enlazado del mes (KPI); sin heurística lazy
  findDeductedMovement(
    allocationId: SavingsAllocationId, month: string,
  ): Promise<Movement | null>;

  // [nuevo] mes registrado que enlaza al movimiento (detección de identidad en edición)
  findDeductedMonthByMovement(movementId: MovementId): Promise<string | null>;

  // [nuevo] borrado uniforme: movimiento + fila en una tx; false = no era ahorro
  withdrawDeductionForMovement(movementId: MovementId): Promise<boolean>;
}
```

---

## Casos de uso

### RegisterManualSavings `[nuevo]`

**Ubicación**: `src/application/savings/RegisterManualSavings.ts`

```typescript
export interface RegisterManualSavingsDTO {
  accountId: number;
  date: string;      // YYYY-MM-DD
  note: string;      // opcional; vacía → "Ahorro"
  amountCents: number;
}

export class RegisterManualSavings {
  constructor(
    savingsAllocations: SavingsAllocationRepository,
    accounts: AccountRepository,
    tags: TagRepository,
  )
  execute(dto: RegisterManualSavingsDTO): Promise<MovementId> // id del movimiento creado
}
```

**Contrato de errores** (todos `DomainError` → `_form` en la action):

| Error | Mensaje por defecto | Causa |
|---|---|---|
| `SharedAccountSavingsError` | «La cuenta común no puede tener ahorro.» | Cuenta no personal |
| `SavingsAllocationNotFoundError` | «No existe ahorro configurado para esta cuenta.» | Config inexistente (**no** se exige activa) |
| `TagNotFoundError` | (existente) | Etiqueta «Ahorro» ausente (migración/seed no aplicados) |
| `SavingsAlreadyExistsError` `[nuevo]` | «Ya existe un ahorro registrado para este mes.» | Pre-check o guarda transaccional (0 filas del upsert) |
| `InvalidMovementError` / `InvalidMoneyError` | (existentes) | Importe ≤ 0, etc. |

**Invariante**: movimiento y fila se escriben en la misma transacción o no se escribe nada.

### MaterializeSavingsAllocations (ampliado)

**Ubicación**: `src/application/savings/MaterializeSavingsAllocations.ts`

- Constructor: `(savings, regularIncomes, tags)` — gana `TagRepository`.
- `ensureForAccountAndMonth(accountId, month, currentMonth): Promise<void>` — mismo contrato; internamente compone `Movement.create` (gasto, naturaleza propia, `${month}-01`, «Ahorro», % × ingreso) y persiste vía `registerMaterialization`.
- Guardas intactas (023): config activa, ventana `activatedAtMonth ≤ month ≤ currentMonth`, `isDeducted` corto-circuito, ingreso regular existente y activo, `amountCents ≥ 1`.
- Idempotencia: re-visitas nunca generan ni ajustan nada (`ON CONFLICT DO NOTHING`).

### GetMonthSavings (ampliado)

**Ubicación**: `src/application/savings/GetMonthSavings.ts`

```typescript
export interface MonthSavingsDTO {
  configured: boolean;        // existe config (activa o no)
  amountCents: number;        // movimiento enlazado ?? fila congelada ?? 0
  backedByMovement: boolean;  // [nuevo] la fila está respaldada por movimiento
}
```

### UpdateMovement / DeleteMovement (ampliados)

**Ubicación**: `src/application/movement/UpdateMovement.ts`, `DeleteMovement.ts`

- `UpdateMovement`: nuevo colaborador `SavingsAllocationRepository`; si `findDeductedMonthByMovement(id) !== null` → identidad congelada (solo importe, nota y fecha; `type`/`nature`/`tagId` del existente). Un movimiento nunca es aportación y ahorro a la vez.
- `DeleteMovement`: nuevo colaborator `SavingsAllocationRepository`; orden: retirada de aportación (032) → `withdrawDeductionForMovement` (ahorro) → borrado ordinario. Borradо uniforme: movimiento + fila juntos.

---

## Contrato de frontera (Zod + Server Action)

### `movement-form.schema.ts` (ampliado)

**Ubicación**: `src/infrastructure/primary/actions/movement-form.schema.ts`

```typescript
export type MovementFormType = MovementType | "contribution" | "savings"; // [ampliado]

// type: refine acepta "expense" | "income" | "contribution" | "savings"
// superRefine — rama "savings" (espejo de "contribution"):
//   - nature presente → issue "El ahorro lleva naturaleza propia implícita."
//   - tagId no nulo   → issue "El ahorro lleva la etiqueta «Ahorro» implícita."
//   - nota OPCIONAL (return temprano; el caso de uso aplica "Ahorro" si llega vacía)
```

### `create-movement.action.ts` (ampliado)

```typescript
// rutado:
//   data.type === "contribution" → RegisterManualContribution  (sin cambios, 032)
//   data.type === "savings"      → RegisterManualSavings       [nuevo]
//       éxito → { status: "success", message: "Ahorro registrado", intent }
//               + revalidatePath("/", "layout")
//       SavingsAlreadyExistsError / SharedAccountSavingsError /
//       SavingsAllocationNotFoundError → errors._form (role="alert" en la UI)
//   resto → CreateMovement (sin cambios)
```

### `update-movement.action.ts` (ampliado)

```typescript
// mapeo de la rama "savings" (espejo de "contribution"):
//   type:   "expense"
//   nature: null
//   tagId:  null
```

---

## Contrato de UI

### `movement-form.tsx` (ampliado)

```typescript
export type ContributionOption = "off" | "available" | "locked"; // tipo reutilizado

interface MovementFormFieldsProps {
  // ...
  contributionOption?: ContributionOption; // sin cambios (032)
  savingsOption?: ContributionOption;      // [nuevo] "locked" mutuamente excluyente con contributionOption
}
```

- Radio «Ahorro» (`value="savings"`) solo con `savingsOption !== "off"`.
- `savingsOption === "locked"` → `<input type="hidden" name="type" value="savings">` + `RadioGroup disabled`.
- Con tipo «Ahorro» elegido: sin fieldset de naturaleza ni bloque «Etiqueta» (implícitos).
- Restauración ante el reset de Radix (familia SC-004/032) ampliada a `"savings"`.

### Disponibilidad del tipo (prop drilling)

```
page.tsx (accounts/[accountId])          savingsAvailable={savings.configured}   // existencia, no "activa"
  └─ GroupedMovementList                 savingsAvailable (passthrough)
       └─ CreateMovementDialog           savingsAvailable?: boolean
            └─ MovementFormFields        savingsOption={savingsAvailable ? "available" : "off"}
edit-movement-dialog.tsx                 movement.tag.slug === "ahorro" → savingsOption="locked"
```

### KPI — composición (page.tsx, sin cambios de componente)

```
personalExpenseCents  = closure.personalExpenseCents − netContribution.amountCents − savings.amountCents
netMonthBalanceCents  = closure.monthBalanceCents − (savings.backedByMovement ? 0 : savings.amountCents)
```

`AccountMonthKpis` mantiene su contrato (el DTO extendido fluye; sin nuevas props).

---

## Contrato de persistencia

### Migración `drizzle/0009_ahorro-movimiento.sql` `[nuevo]`

```sql
ALTER TABLE savings_allocation_months ADD COLUMN movement_id integer;--> statement-breakpoint
INSERT OR IGNORE INTO tags (id, name, slug, status, category_id)
VALUES (101, 'Ahorro', 'ahorro', 'active', (SELECT id FROM tag_categories WHERE slug = 'general'));
```

Sentencias exactas del adaptador (paridad `DrizzleCommonContributionRepository`):

```typescript
// registerManualSavings (tx):
//   nextId = coalesce(max(movements.id), 0) + 1
//   insert(savings_allocation_months).values({ config, month, amountCents, movementId: nextId })
//     .onConflictDoUpdate({ target: [savingsAllocationId, month],
//                           set: { movementId: nextId, amountCents },
//                           setWhere: movementId IS NULL })
//     .returning({ id })
//   0 filas → null (SavingsAlreadyExistsError)   |   filas → insert(movements) → MovementId
//
// registerMaterialization (tx):
//   insert(...).onConflictDoNothing({ target: [savingsAllocationId, month] }).returning({ id })
//   0 filas → false                              |   filas → insert(movements) → true
//
// withdrawDeductionForMovement (tx):
//   fila where movement_id = id → si no hay, false
//   delete(movements where id) + delete(fila) → true
```

---

## Referencias

- **Spec**: `specs/033-ahorro-como-movimiento/spec.md`
- **Data Model**: `specs/033-ahorro-como-movimiento/data-model.md`
- **Research**: `specs/033-ahorro-como-movimiento/research.md` (R1-R11)
- **ADR previo de la familia**: `docs/architecture/adr/0024-registro-manual-aportacion-comun.md`
- **Constitución**: `.specify/memory/constitution.md` (principios IV, VII)
