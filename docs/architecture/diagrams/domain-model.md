# Clases: modelo de dominio (features 002, 006 y 009)

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
        +accountId: AccountId
        +type: MovementType
        +date: String YYYY-MM-DD
        +concept: String
        +description: String?
        +amount: Money
        +nature: ExpenseNature?
        +tagIds: TagId[] congelada
        +createdAt: String ISO-8601 UTC
        +create(input)$ Movement
        +recreate(id, input, createdAt)$ Movement
        +rehydrate(persistence)$ Movement
    }

    class Account {
        +id: AccountId?
        +name: String
        +type: AccountType
        +memberId: MemberId?
        +create(input)$ Account
    }

    class AccountType {
        <<enum>>
        personal
        shared
    }

    class Member {
        +id: MemberId?
        +name: String
    }

    class Tag {
        +id: TagId?
        +name: String
        +slug: String
        +status: TagStatus
    }

    class TagStatus {
        <<enum>>
        active
        inactive
    }

    class DomainError {
        <<abstract>>
    }

    class InvalidMoneyError
    class InvalidMovementError {
        +field: MovementField
    }
    class MovementNotFoundError
    class DuplicateTagNameError
    class InactiveTagError

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
        <<record de 005>>
        +type MovementType
        +nature ExpenseNature?
        +amountCents number
        +tags ClosureTagRef[]
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

    Movement "*..>" Account : pertenece a
    Movement "1" *-- "1" Money : amount (céntimos enteros)
    Movement "1" *-- "1" MovementType : type
    Movement "1" o-- "0..1" ExpenseNature : solo si expense
    Movement "*" --o "*" Tag : tagIds (1..n tras default "Sin Clasificar")
    Member "1" --o "0..1" Account : solo cuentas personales
    Account "1" *-- "1" AccountType : type
    Tag "1" *-- "1" TagStatus : status
    DomainError <|-- InvalidMoneyError
    DomainError <|-- InvalidMovementError
    DomainError <|-- DuplicateTagNameError
    DomainError <|-- InactiveTagError
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
- **`Movement`**: inmutable tras la creación; `nature` obligatoria si `type = expense` y prohibida si `type = income` (FR-005); `tagIds` con mínimo 1 (la acción por defecto "Sin Clasificar" la garantiza el caso de uso, FR-006); fecha ISO de calendario real; concepto no vacío tras trim; `amount > 0` (los abonos se registran como ingresos, FR-003).
- **`Account`**: `memberId` obligatorio si `type = personal` y `null` si `type = shared`.
- **`Tag`**: nombre único ignorando mayúsculas/minúsculas (FR-007, índice `lower(name)` en BD); el estado `inactive` existe para no romper el histórico (gestión en feature 004).
- **Balance**: no es un campo de `Account`; query derivada `SUM` (ADR 0009).
- **`MonthlyClosure`**: `shared + personal = expenseTotal`; multi-tag computa en cada tag sin duplicar `expenseTotal`; mes vacío → ceros (ADR 0010).
- **`GlobalMonthlySummary`** (ADR 0012): compone `MonthlyClosure`, por lo que hereda sus invariantes y además **global = Σ cierres por cuenta, KPI a KPI** (FR-002, garantía estructural + test de invariante); Σ `memberBreakdown` (personal+shared) = `expenseTotal`; los ingresos no aparecen en ningún desglose; las filas del desglose por miembro se agrupan por `memberId` (homónimos → filas distintas; varias cuentas del mismo miembro → una fila), con `memberId: null` para los gastos pagados desde la cuenta común (la etiqueta "Cuenta común" vive solo en la UI).
- **`AnnualIncomeStatement`** (ADR 0013): compone 12 `GlobalMonthlySummary` (uno por mes Ene–Dic, vacíos incluidos), por lo que hereda sus invariantes y además **cada mes = resumen global de 006** (FR-006, garantía estructural + test de invariante); Σ `memberIncomeRows` mes a mes = `totalIncomeRow` (cada ingreso computa exactamente en la fila de la cuenta de registro; catálogo completo siempre presente con ceros, FR-002); `accumulatedBalanceRow.monthCells[m]` = Σ `balanceRow.monthCells[0..m]` y su total = total anual de «Saldo» (FR-012, sin media); `averageCents = Math.round(totalCents / 12)` en todas las filas salvo la acumulada (único redondeo de la feature, ADR 0007); año vacío → 12 resúmenes a ceros, filas completas a cero y `tagRows = []` (FR-007). La factory es total sobre inputs ya filtrados por el año (no re-valida el año: lo garantiza el llamador).
