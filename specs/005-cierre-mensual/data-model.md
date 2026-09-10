# Data Model: Cierre Mensual por Cuenta

**Feature**: `005-cierre-mensual` | **Fecha**: 2026-09-10

Feature de solo lectura: **no hay cambios** en entidades, tablas ni migraciones. Se añade un VO de dominio calculado (`MonthlyClosure`), DTOs de aplicación y el mapeo entre ambos. Las entidades de 002 (Miembro, Cuenta, Movimiento, Tag) y su vista de persistencia ([data-model de 002](../002-registro-movimientos/data-model.md)) siguen siendo la única fuente de verdad del modelo.

---

## 1. Vista de Dominio

### 1.1 Value Object `MonthlyClosure` (src/domain/movement/MonthlyClosure.ts)

Cierre mensual de una cuenta: agregación inmutable calculada sobre los movimientos de UN mes y UNA cuenta (precondición: el llamante garantiza el ámbito; el VO no re-valida mes/cuenta).

**Factory**:

```text
MonthlyClosure.fromMovements(inputs: ClosureMovementInput[]): MonthlyClosure
```

**Input** (registro puro de dominio, definido junto al VO; la aplicación lo construye desde `MovementDTO`):

| Campo | Tipo | Regla |
|---|---|---|
| type | `MovementType` | `'expense' \| 'income'` (reutilizado de 002). |
| nature | `ExpenseNature \| null` | Solo aplica a gastos; **se ignora si type = 'income'** (defensivo). |
| amountCents | `number` | Entero > 0 (ya validado por `Money.fromCents` en la creación del movimiento). |
| tags | `ReadonlyArray<{ id: number; name: string }>` | 1..n (invariante de `Movement`, FR-006 de 002); los ingresos también las llevan pero no computan en el desglose. |

**Campos del VO** (todos `Money` salvo el desglose; inmutables):

| Campo | Tipo | Cálculo |
|---|---|---|
| incomeTotal | `Money` | Σ `amountCents` de type = `'income'`. |
| expenseTotal | `Money` | Σ `amountCents` de type = `'expense'`. |
| sharedExpenseTotal | `Money` | Σ de gastos con nature = `'shared'` — **con independencia de la cuenta** de la que se pagaron (FR-003). |
| personalExpenseTotal | `Money` | Σ de gastos con nature = `'personal'`. |
| monthBalance | `Money` | `incomeTotal − expenseTotal`; puede ser negativo (`Money.fromCentsOrZero`). |
| tagBreakdown | `ReadonlyArray<TagBreakdownEntry>` | Un gasto suma **una vez por cada tag que lleva**; solo gastos (FR-006); orden importe desc, desempate nombre asc con comparación localizada en español (`localeCompare(…, 'es')`). |

`TagBreakdownEntry` (dominio): `{ tagId: number; tagName: string; amount: Money }`.

**Invariantes** (verificados en tests del VO):
1. `sharedExpenseTotal + personalExpenseTotal = expenseTotal` (todo gasto lleva naturaleza, FR-005 de 002).
2. La Σ del desglose puede EXCEDER `expenseTotal` si hay multi-etiquetado (cada gasto computa en cada tag) — comportamiento esperado (escenario 5); NUNCA puede ser menor que el mayor gasto individual multi-etiquetado... formalmente: cada gasto contribuye íntegro a cada una de sus tags.
3. Mes sin movimientos → todos los totales `0` (`fromCentsOrZero(0)`) y `tagBreakdown = []`.
4. Sin floats: agregación con `Money.add` sobre céntimos enteros (ADR 0007).

### 1.2 Entidades y VOs reutilizados de 002 (sin cambios)

`Money`, `MovementType`, `ExpenseNature`, `Movement`, `Account`, `Tag`, `Member` e IDs: ver [data-model de 002 §1](../002-registro-movimientos/data-model.md).

### 1.3 Relaciones (dominio)

```text
Movement (del mes/cuenta) ──agrega──▶ MonthlyClosure   (n──1, cálculo unidireccional puro)
Tag ──se proyecta en──▶ MonthlyClosure.tagBreakdown    (por importe, no por referencia)
```

`MonthlyClosure` no referencia entidades: solo datos calculados (VO de salida).

### 1.4 Errores de dominio

Ninguno nuevo: la factory `fromMovements` es total sobre inputs bien formados (los movimientos ya validaron al crearse). El caso de uso no introduce excepciones propias (mes inválido sigue siendo error del llamante, ya validado por `ListMovements`/`page.tsx`).

### 1.5 Transiciones de estado

Ninguna: `MonthlyClosure` es inmutable y se recalcula en cada consulta (FR-009, ADR 0009/0010).

---

## 2. Vista de Persistencia (Drizzle, SQLite/Turso)

**Sin cambios** ([data-model de 002 §2](../002-registro-movimientos/data-model.md)): no hay DDL, ni migraciones, ni nuevos métodos de repositorio. El cierre obtiene el mes con la query existente `MovementRepository.listByMonthAndAccount(accountId, month)` (rango semicerrado sargable sobre índice `(account_id, date)`, tags incluidas vía `LEFT JOIN`), invocada por `GetMonthlyClosure` de forma independiente al listado.

---

## 3. Validación por capa (dónde vive cada regla)

| Regla | Frontera (Zod) | Aplicación | Dominio (VO `MonthlyClosure`) | DB |
|---|---|---|---|---|
| searchParams account/month (contexto de pantalla) | ✅ ya existe en `page.tsx` (002) | — | — | — |
| Σ ingresos / Σ gastos del mes | — | — | ✅ `fromMovements` | — |
| Desglose por naturaleza (shared/personal = expenseTotal) | — | — | ✅ invariante 1 | — |
| Saldo del mes = ingresos − gastos (admite negativo) | — | — | ✅ `Money.fromCentsOrZero` | — |
| Multi-etiquetado: una vez por tag, sin duplicar total de gastos | — | — | ✅ invariante 2 | — |
| Desglose solo de gastos; ingresos fuera | — | — | ✅ | — |
| Orden desglose (importe desc, nombre asc) | — | — | ✅ | — |
| Formato es-ES y signo del saldo | — | — | — | — (adaptador UI `format.ts`) |
| Mapeo `MovementDTO[]` → `ClosureMovementInput[]` → `MonthlyClosureDTO` (con lectura propia del mes vía puerto) | — | ✅ `GetMonthlyClosure` | — | — |

La UI **nunca** calcula: recibe `MonthlyClosureDTO` y formatea (constitución VII).

---

## 4. DTOs de aplicación (src/application/movement/dto.ts — ampliación)

```text
MonthlyClosureDTO
├── incomeTotalCents: number
├── expenseTotalCents: number
├── sharedExpenseCents: number
├── personalExpenseCents: number
├── monthBalanceCents: number          // puede ser negativo
└── tagBreakdown: TagBreakdownEntryDTO[]

TagBreakdownEntryDTO
├── tagId: number
├── tagName: string
└── amountCents: number
```

Céntimos enteros en DTO (mismo criterio que `MovementDTO` de 002); el formateo a EUR es exclusivo del adaptador UI.

---

## 5. Glosario ES ↔ EN (ampliación del glosario de 002)

| Español (UI/spec) | English (código) | Notas |
|---|---|---|
| Cierre mensual | `MonthlyClosure` | VO de dominio calculado (no persistido) |
| Total de ingresos (del mes) | `incomeTotal` | |
| Total de gastos (del mes) | `expenseTotal` | |
| Gastos compartidos / Gastos personales | `sharedExpenseTotal` / `personalExpenseTotal` | Por naturaleza, no por cuenta de pago |
| Saldo del mes | `monthBalance` | ingresos − gastos; admite negativo |
| Desglose por tag | `tagBreakdown` | Cada gasto computa una vez por cada tag |
| Panel de cierre | `MonthlyClosurePanel` | Componente servidor de UI |
| Sin gastos este mes | — (solo texto UI) | Estado vacío del desglose (contracts §3) |
