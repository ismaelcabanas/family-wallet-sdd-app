# Clases: modelo de dominio (feature 002)

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
    class DuplicateTagNameError
    class InactiveTagError

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
```

## Invariantes clave

- **`Money`**: `amountCents` entero; `fromCents` exige `0 < cents ≤ 99.999.999.999` (999.999.999,99 €); `fromCentsOrZero` admite ≤ 0 (balances); sin conversión a/from float (ADR 0007).
- **`Movement`**: inmutable tras la creación; `nature` obligatoria si `type = expense` y prohibida si `type = income` (FR-005); `tagIds` con mínimo 1 (la acción por defecto "Sin Clasificar" la garantiza el caso de uso, FR-006); fecha ISO de calendario real; concepto no vacío tras trim; `amount > 0` (los abonos se registran como ingresos, FR-003).
- **`Account`**: `memberId` obligatorio si `type = personal` y `null` si `type = shared`.
- **`Tag`**: nombre único ignorando mayúsculas/minúsculas (FR-007, índice `lower(name)` en BD); el estado `inactive` existe para no romper el histórico (gestión en feature 004).
- **Balance**: no es un campo de `Account`; query derivada `SUM` (ADR 0009).
