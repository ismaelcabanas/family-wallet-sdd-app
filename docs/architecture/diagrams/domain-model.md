# Clases: modelo de dominio (features 002, 006, 009, 014, 017, 018, 019, 023, 004 y 008)

Diagrama UML del modelo de dominio puro (`src/domain/`). El glosario ES↔EN vive en el [data-model de la feature](../../../specs/002-registro-movimientos/data-model.md).

```mermaid
classDiagram
    direction LR

    class Money {
        <<Value Object inmutable>>
        +amountCents: int
        +fromCents(cents)$ Money
        +fromCentsOrZero(cents)$ Money
        +add(other) Money
        +subtract(other) Money
    }

    class MovementType {
        <<enum>>
        expense
        income
    }

    class ExpenseNature {
        <<enum>>
        personal
        shared
    }

    class Movement {
        <<Entidad · raíz del agregado>>
        +id: MovementId?
        +accountId: AccountId (inmutable tras el alta, 014)
        +type: MovementType
        +date: String YYYY-MM-DD
        +note: String (fusiona concept+description, 014)
        +amount: Money
        +nature: ExpenseNature?
        +tagId: TagId? (obligatoria si expense, 014)
        +createdAt: String ISO-8601 UTC
        +create(input)$ Movement
        +recreate(id, input, createdAt)$ Movement
        +rehydrate(persistence)$ Movement
    }

    class Account {
        +id: AccountId?
        +name: String? (008: null en personales — el mostrado se deriva, ADR 0020)
        +type: AccountType
        +memberId: MemberId?
        +create(input)$ Account
        +rehydrate(id, name?, type, memberId?)$ Account
        +rename(name) Account (008: solo shared; personal → AccountNotRenamableError)
    }

    class AccountType {
        <<enum>>
        personal
        shared
    }

    class Member {
        +id: MemberId?
        +name: String
        +create(name)$ Member
        +rehydrate(id, name)$ Member
        +rename(name) Member (008: trimea, conserva id)
    }

    class Tag {
        +id: TagId?
        +name: String
        +slug: String (derivado por deriveTagSlug desde 017; inmutable tras la creación, 004)
        +status: TagStatus
        +create(input)$ Tag
        +rehydrate(id, name, slug, status)$ Tag
        +rename(name) Tag (004: trimea, conserva id/slug/status)
        +withStatus(status) Tag (004: desactivar/reactivar)
    }

    class TagStatus {
        <<enum>>
        active
        inactive
    }

    class SystemTags {
        <<Módulo puro de 004 · src/domain/tag/SystemTags.ts>>
        +CONTRIBUTION_TAG_SLUG$ String ("aportacion-comun"; único dueño, 019 lo importa)
        +SYSTEM_TAG_SLUGS$
        +isProtectedTagSlug(slug) boolean$
    }

    class deriveTagSlug {
        <<Función pura de 017>>
        +deriveTagSlug(name) String$
    }

    class lastDayOfMonth {
        <<Función pura de 018 · src/domain/shared/calendar.ts>>
        +lastDayOfMonth(month YYYY-MM) int$
    }

    class RegularIncome {
        <<Entidad de 018 · raíz del agregado>>
        +id: RegularIncomeId?
        +accountId: AccountId (cuenta personal, única por cuenta)
        +amount: Money
        +dayOfMonth: int (1–31, se conserva aunque el mes no lo tenga)
        +note: String (default «Ingreso regular de {miembro}» en el caso de uso)
        +active: boolean
        +activatedAtMonth: String YYYY-MM (solo (re)activación lo resetea)
        +create(input)$ RegularIncome
        +rehydrate(persistence)$ RegularIncome
        +update(amount?, dayOfMonth?, note?) RegularIncome
        +deactivate() RegularIncome
        +activate(currentMonth) RegularIncome
        +dueDateForMonth(month) String
    }

    class CommonContribution {
        <<Entidad de 019 · raíz del agregado · ADR 0017>>
        +id: CommonContributionId?
        +accountId: AccountId (cuenta personal, única por cuenta)
        +percentage: ContributionPercentage
        +active: boolean
        +activatedAtMonth: String YYYY-MM (solo (re)activación lo resetea)
        +create(input)$ CommonContribution
        +rehydrate(id, input)$ CommonContribution
        +update(percentage?) CommonContribution
        +deactivate() CommonContribution
        +activate(currentMonth) CommonContribution
        +dueDateForMonth(month) String (día 1 fijo)
    }

    class ContributionPercentage {
        <<Value Object de 019 · puntos base enteros · ADR 0017>>
        +basisPoints: int (1–10 000; 1 % = 100 bp)
        +fromBasisPoints(bp)$ ContributionPercentage
        +appliedToCents(amountCents) int (floor((cents×bp+5 000)/10 000), half-up entero)
        +netAppliedToCents(incomeCents, sharedExpenseCents) int (max(0, appliedToCents − gastos); 021, ADR 0019)
        +equals(other) boolean
    }

    class SavingsAllocation {
        <<Entidad de 023 · raíz del agregado · apartado informativo>>
        +id: SavingsAllocationId?
        +accountId: AccountId (cuenta personal, única por cuenta)
        +percentage: SavingsPercentage
        +active: boolean
        +activatedAtMonth: String YYYY-MM (solo (re)activación lo resetea)
        +create(input)$ SavingsAllocation
        +rehydrate(id, input)$ SavingsAllocation
        +update(percentage?) SavingsAllocation
        +deactivate() SavingsAllocation
        +activate(currentMonth) SavingsAllocation
    }

    class SavingsPercentage {
        <<Value Object de 023 · entero 1–100, sin puntos base>>
        +percent: int (1–100, sin decimales por construcción)
        +fromPercent(n)$ SavingsPercentage
        +appliedToCents(amountCents) int (floor((cents×pct+50)/100), half-up entero)
        +equals(other) boolean
    }

    class DomainError {
        <<abstract>>
    }

    class InvalidMoneyError
    class InvalidMovementError {
        +field: MovementField
    }
    class MovementNotFoundError
    class InvalidMemberError
    class DuplicateMemberNameError {
        <<008>>
    }
    class MemberNotFoundError {
        <<008>>
    }
    class InvalidAccountError
    class AccountNotFoundError
    class DuplicateAccountNameError {
        <<008>>
    }
    class AccountNotRenamableError {
        <<008>>
    }
    class DuplicateTagNameError
    class InactiveTagError
    class ProtectedTagError {
        <<004>>
    }
    class InvalidRegularIncomeError {
        <<018>>
        +field: RegularIncomeField
    }
    class SharedAccountIncomeError {
        <<018>>
    }
    class RegularIncomeNotFoundError {
        <<018>>
    }
    class InvalidCommonContributionError {
        <<019>>
        +field: CommonContributionField (percentage | activatedAtMonth)
    }
    class SharedAccountContributionError {
        <<019>>
    }
    class CommonContributionNotFoundError {
        <<019>>
    }
    class MissingRegularIncomeError {
        <<019 · y duplicada propia en savings (023), mismo literal>>
    }
    class InvalidSavingsAllocationError {
        <<023>>
        +field: SavingsAllocationField (percentage | activatedAtMonth)
    }
    class SharedAccountSavingsError {
        <<023>>
    }
    class SavingsAllocationNotFoundError {
        <<023>>
    }

    class MonthlyClosure {
        <<Value Object de 005 (reutilizado)>>
        +incomeTotal Money
        +expenseTotal Money
        +sharedExpenseTotal Money
        +personalExpenseTotal Money
        +monthBalance Money
        +tagBreakdown TagBreakdownEntry[]
        +fromMovements(inputs)$ MonthlyClosure
    }

    class GlobalMonthlySummary {
        <<Value Object de 006 (ADR 0012)>>
        +incomeTotal Money
        +expenseTotal Money
        +sharedExpenseTotal Money
        +personalExpenseTotal Money
        +monthBalance Money
        +tagBreakdown TagBreakdownEntry[]
        +memberBreakdown MemberBreakdownEntry[]
        +fromMovements(inputs, accounts)$ GlobalMonthlySummary
    }

    class AnnualIncomeStatement {
        <<Value Object de 009 (ADR 0013)>>
        +monthlySummaries GlobalMonthlySummary[12]
        +memberIncomeRows MemberIncomeRow[]
        +totalIncomeRow MonthlyTotalsRow
        +expenseRealRow MonthlyTotalsRow
        +noPersonalExpenseRow MonthlyTotalsRow
        +balanceRow MonthlyTotalsRow
        +accumulatedBalanceRow MonthlyTotalsRow
        +tagRows AnnualTagRow[]
        +fromMovements(inputs, accounts, members)$ AnnualIncomeStatement
    }

    class ClosureMovementInput {
        <<record de 005 (tag única desde 014)>>
        +type MovementType
        +nature ExpenseNature?
        +amountCents number
        +tag ClosureTagRef?
    }

    class GlobalSummaryMovementInput {
        <<record de 006>>
        +accountId number
    }

    class SummaryAccountRef {
        <<record de 006>>
        +id number
        +type AccountType
        +memberId number?
        +memberName string?
    }

    class AnnualStatementMovementInput {
        <<record de 009 (hereda GlobalSummaryMovementInput)>>
        +date string
    }

    class MemberRef {
        <<record de 009>>
        +id number
        +name string
    }

    class MemberIncomeRow {
        <<nuevo en 009>>
        +memberId number?
        +memberName string?
        +monthCells Money[12]
        +totalCents number
        +averageCents number
    }

    class MonthlyTotalsRow {
        <<nuevo en 009>>
        +monthCells Money[12]
        +totalCents number
        +averageCents number
    }

    class AnnualTagRow {
        <<nuevo en 009>>
        +tagId number
        +tagName string
        +monthCells Money[12]
        +totalCents number
        +averageCents number
    }

    class TagBreakdownEntry {
        +tagId number
        +tagName string
        +amount Money
    }

    class MemberBreakdownEntry {
        <<nuevo en 006>>
        +memberId number?
        +memberName string?
        +personal Money
        +shared Money
    }

    Movement "1" *-- "*" Account : pertenece a
    Movement "1" *-- "1" Money : amount (céntimos enteros)
    Movement "1" *-- "1" MovementType : type
    Movement "1" o-- "0..1" ExpenseNature : solo si expense
    Movement "0..1" --o "1" Tag : tagId (obligatoria en expense, 014)
    Member "1" --o "0..1" Account : solo cuentas personales
    Account "1" *-- "1" AccountType : type
    Tag "1" *-- "1" TagStatus : status
    DomainError <|-- InvalidMoneyError
    DomainError <|-- InvalidMovementError
    DomainError <|-- InvalidMemberError
    DomainError <|-- DuplicateMemberNameError
    DomainError <|-- MemberNotFoundError
    DomainError <|-- InvalidAccountError
    DomainError <|-- AccountNotFoundError
    DomainError <|-- DuplicateAccountNameError
    DomainError <|-- AccountNotRenamableError
    DomainError <|-- DuplicateTagNameError
    DomainError <|-- InactiveTagError
    DomainError <|-- ProtectedTagError
    DomainError <|-- InvalidRegularIncomeError
    DomainError <|-- SharedAccountIncomeError
    DomainError <|-- RegularIncomeNotFoundError
    DomainError <|-- InvalidCommonContributionError
    DomainError <|-- SharedAccountContributionError
    DomainError <|-- CommonContributionNotFoundError
    DomainError <|-- MissingRegularIncomeError
    DomainError <|-- InvalidSavingsAllocationError
    DomainError <|-- SharedAccountSavingsError
    DomainError <|-- SavingsAllocationNotFoundError
    deriveTagSlug ..> Tag : alimenta create(input.slug) vía CreateTag (017)
    SystemTags ..> Tag : isProtectedTagSlug protege rename/desactivar/fusionar (004)
    RegularIncome "1" *-- "1" Money : amount
    RegularIncome ..> lastDayOfMonth : dueDateForMonth clamp (018)
    RegularIncome --> Account : accountId (solo personal, SharedAccountIncomeError)
    CommonContribution "1" *-- "1" ContributionPercentage : percentage
    ContributionPercentage ..> Money : appliedToCents → fromCents (materialización)
    CommonContribution --> Account : accountId (solo personal, SharedAccountContributionError)
    CommonContribution ..> RegularIncome : base de cálculo vía puerto (solo lectura, FR-006)
    SavingsAllocation "1" *-- "1" SavingsPercentage : percentage
    SavingsPercentage ..> Money : appliedToCents (deducción informativa, 023)
    SavingsAllocation --> Account : accountId (solo personal, SharedAccountSavingsError)
    SavingsAllocation ..> RegularIncome : base plana vía puerto (solo lectura, FR-002 de 023)
    ClosureMovementInput <|-- GlobalSummaryMovementInput
    GlobalSummaryMovementInput <|-- AnnualStatementMovementInput
    GlobalMonthlySummary *-- MonthlyClosure : compone (KPIs agregados, ADR 0012)
    AnnualIncomeStatement *-- GlobalMonthlySummary : compone ×12 Ene–Dic (KPIs mensuales, ADR 0013)
    GlobalMonthlySummary ..> GlobalSummaryMovementInput : fromMovements
    GlobalMonthlySummary ..> SummaryAccountRef : fromMovements
    MonthlyClosure ..> ClosureMovementInput : fromMovements
    AnnualIncomeStatement ..> AnnualStatementMovementInput : fromMovements
    AnnualIncomeStatement ..> SummaryAccountRef : fromMovements
    AnnualIncomeStatement ..> MemberRef : fromMovements
    AnnualIncomeStatement o-- MemberIncomeRow
    AnnualIncomeStatement o-- MonthlyTotalsRow
    AnnualIncomeStatement o-- AnnualTagRow
    GlobalMonthlySummary o-- TagBreakdownEntry
    GlobalMonthlySummary o-- MemberBreakdownEntry
    MonthlyClosure o-- TagBreakdownEntry
    TagBreakdownEntry o-- Money
    MemberBreakdownEntry o-- Money
    MemberIncomeRow o-- Money
    MonthlyTotalsRow o-- Money
    AnnualTagRow o-- Money
```

## Invariantes clave

- **`Money`**: `amountCents` entero; `fromCents` exige `0 < cents ≤ 99.999.999.999` (999.999.999,99 €); `fromCentsOrZero` admite ≤ 0 (balances); sin conversión a/from float (ADR 0007).
- **`Movement`**: inmutable tras la creación; `nature` obligatoria si `type = expense` y prohibida si `type = income` (FR-005); **`tagId` obligatoria si `type = expense` y opcional (`null`) si `type = income` (014, regla por tipo en la entidad)**; `accountId` inmutable tras el alta (014: la edición valida `expectedAccountId` en `UpdateMovement`, no mueve de cuenta); fecha ISO de calendario real; nota única no vacía tras trim (014, fusiona concepto+descripción); `amount > 0` (los abonos se registran como ingresos, FR-003).
- **`Account`**: `memberId` obligatorio si `type = personal` y `null` si `type = shared`. Desde 008 (ADR 0020): `name: string | null` — **`personal ⇒ name === null`** (el nombre mostrado se deriva siempre del miembro como «Cuenta de {miembro}» vía `personalAccountDisplayName`, aplicada en `findAll` del repositorio: `AccountDTO.name` = nombre mostrado) y **`shared ⇒ name` trimado no vacío**; `rename(name)` solo existe en `shared` (en `personal` lanza `AccountNotRenamableError`: no hay renombrado independiente) y conserva id/type/memberId (patrón ADR 0011). Unicidad de nombres almacenados ignorando mayúsculas en BD (`accounts_name_nocase_uq` sobre `lower(name)`; los NULL de las personales nunca colisionan) con check amable en `RenameAccount` (`findByName` autoexcluyéndose) y backstop de carrera traducido a `DuplicateAccountNameError` en el repositorio.
- **`Member`**: nombre único ignorando mayúsculas (índice `members_name_nocase_uq` sobre `lower(name)`, patrón tags); desde 008 `rename(name)` trimea, valida no vacío y devuelve nueva instancia congelada con el mismo id; el duplicado se valida en `RenameMember` con `findByName` autoexcluyéndose (el autorenombrado «luz»→«Luz» está permitido) y la carrera la traduce el repositorio a `DuplicateMemberNameError`. Renombrar un miembro no escribe nada fuera de `members` (las notas materializadas congelan el nombre del momento).
- **`Tag`**: nombre único ignorando mayúsculas/minúsculas (FR-007, índice `lower(name)` en BD); el estado `inactive` existe para no romper el histórico (gestión en feature 004). Desde 017 nace `active` por la vía de creación `CreateTag` (aplicación), que deriva el `slug` con `deriveTagSlug` (función pura del dominio: minúsculas, NFD sin diacríticos, no-alfanuméricos → guion) y resuelve colisiones con sufijos `-2`, `-3`, …; el duplicado case-insensitive (también de inactivas) lanza `DuplicateTagNameError` vía `TagRepository.findByName` (espejo del índice; ADR 0015). Desde 004 (ADR 0018): `rename` trimea y **conserva id/slug/status** (el slug es identidad estable — 019 localiza «Aportación Común» por slug); `withStatus` cubre desactivar/reactivar con nueva instancia congelada; el duplicado en renombrado/reactivación se valida en el caso de uso con `findByName` **autoexcluyéndose** (edge «luz»→«Luz» permitido); la protección de etiquetas de sistema es por slug en el dominio (`SystemTags.isProtectedTagSlug`, `ProtectedTagError` en los cuatro papeles: renombrar, desactivar, absorbida y resultante de fusión); el puerto gana `findById`/`findAll`/`update`/`mergeInto` (fusión transaccional: reasignar `movements.tag_id` → borrar la absorbida, sin tocar `updated_at`).
- **`RegularIncome`** (018, ADR 0016): anclada a la cuenta personal (`accountId` UNIQUE en BD; la cuenta común la rechaza `ConfigureRegularIncome` con `SharedAccountIncomeError`); `dayOfMonth` 1–31 se conserva tal cual y `dueDateForMonth` clampa al `lastDayOfMonth` del mes consultado (helper puro, el dominio no importa `ui/format.ts`); `update` nunca toca `active`/`activatedAtMonth` (solo-adelante), `activate(currentMonth)` resetea la activación (reactivación sin relleno retroactivo). La idempotencia de la materialización vive en `regular_income_months` (puerto `RegularIncomeRepository.isMaterialized`/`registerMaterialization` transaccional), **nunca** en la existencia del movimiento: el borrado físico no regenera el mes.
- **`CommonContribution`** (019, ADR 0017): espejo del ciclo de vida de `RegularIncome` (misma semántica de `activatedAtMonth` y `activate` con reset) anclada a la cuenta personal (UNIQUE por cuenta; `SharedAccountContributionError` en la común) pero **sin** importe/día/nota: el importe se deriva como `ContributionPercentage.appliedToCents(ingreso regular)` en el momento de materializar (solo-adelante). Requiere ingreso regular configurado (`MissingRegularIncomeError` al configurar; no-op al materializar si falta o está inactivo, FR-006). La idempotencia vive en `common_contribution_months` (`UNIQUE (config, mes)` + `ON CONFLICT DO NOTHING RETURNING` en la misma tx que el movimiento); el borrado del gasto generado es definitivo y la etiqueta «Aportación Común» se resuelve por slug en cada generación (triple garantía seed + migración + ensure).
- **`ContributionPercentage`** (019): `basisPoints` entero 1–10 000 (equivale a > 0 % y ≤ 100 % con ≤ 2 decimales); `appliedToCents` usa división entera pura `floor((amountCents × bp + 5_000)/10_000)` (half-up, extensión de ADR 0007, sin flotantes ni `Math.round`); el importe resultante < 1 céntimo se rechaza al configurar y es no-op sin registrar al materializar (edge §7 de la spec).
- **`SavingsAllocation`** (023): apartado de ahorro **informativo** por miembro — espejo del ciclo de vida de `CommonContribution` (misma semántica de `activatedAtMonth`, `activate` con reset y UNIQUE por cuenta personal; `SharedAccountSavingsError` en la común) pero **sin movimiento ni `dueDateForMonth`**: el importe se congela en la fila del registro `savings_allocation_months` (`amount_cents`, `UNIQUE (config, mes)` + `ON CONFLICT DO NOTHING RETURNING` en tx de un solo INSERT — variante sin movimiento del patrón ADR 0016/0017). Requiere ingreso regular por **existencia** al configurar (`MissingRegularIncomeError` propia del módulo) y por existencia **y estado activo** al deducir (no-op sin registrar el mes si no). **Sin re-sync del mes en curso** (base plana, diferencia con 021): un mes registrado nunca se recalcula ni se borra; `GetMonthSavings` lee la fila, nunca recalcula, y la página compone una única resta `netMonthBalanceCents = closure.monthBalanceCents − savings.amountCents`.
- **`SavingsPercentage`** (023): `percent` entero 1–100 — **sin puntos base**, decisión del propietario (2026-10-26): hace irrepresentables los decimales (12,5 % no existe) y desacopla el módulo `savings` de `common-contribution`; `appliedToCents` con división entera pura `floor((amountCents × percent + 50)/100)` (half-up solo al importe, nunca al porcentaje); importe < 1 céntimo rechazado al configurar y no-op sin registrar al deducir (paridad 019).
- **Balance**: no es un campo de `Account`; query derivada `SUM` (ADR 0009).
- **`MonthlyClosure`**: `shared + personal = expenseTotal`; cada gasto computa en su única tag (014: el desglose suma el total de gastos); mes vacío → ceros (ADR 0010).
- **`GlobalMonthlySummary`** (ADR 0012): compone `MonthlyClosure`, por lo que hereda sus invariantes y además **global = Σ cierres por cuenta, KPI a KPI** (FR-002, garantía estructural + test de invariante); Σ `memberBreakdown` (personal+shared) = `expenseTotal`; los ingresos no aparecen en ningún desglose; las filas del desglose por miembro se agrupan por `memberId` (homónimos → filas distintas; varias cuentas del mismo miembro → una fila), con `memberId: null` para los gastos pagados desde la cuenta común (la etiqueta "Cuenta común" vive solo en la UI).
- **`AnnualIncomeStatement`** (ADR 0013): compone 12 `GlobalMonthlySummary` (uno por mes Ene–Dic, vacíos incluidos), por lo que hereda sus invariantes y además **cada mes = resumen global de 006** (FR-006, garantía estructural + test de invariante); Σ `memberIncomeRows` mes a mes = `totalIncomeRow` (cada ingreso computa exactamente en la fila de la cuenta de registro; catálogo completo siempre presente con ceros, FR-002); `accumulatedBalanceRow.monthCells[m]` = Σ `balanceRow.monthCells[0..m]` y su total = total anual de «Saldo» (FR-012, sin media); `averageCents = Math.round(totalCents / 12)` en todas las filas salvo la acumulada (único redondeo de la feature, ADR 0007); año vacío → 12 resúmenes a ceros, filas completas a cero y `tagRows = []` (FR-007). La factory es total sobre inputs ya filtrados por el año (no re-valida el año: lo garantiza el llamador).
