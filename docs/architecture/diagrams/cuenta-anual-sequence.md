# Secuencia: cuenta de resultados anual (feature 009)

Diagrama de secuencia del happy path de `GetAnnualIncomeStatement` sobre la vista `/annual` (ADR 0013). Base: diagrama de diseño de [plan.md](../../../specs/009-cuenta-resultados-anual/plan.md) de la feature.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant S as YearSelector (client)
    participant R as "/annual page.tsx (server)"
    participant UC as GetAnnualIncomeStatement
    participant MR as "«port» MovementRepository"
    participant AR as "«port» AccountRepository"
    participant MemR as "«port» MemberRepository"
    participant VO as AnnualIncomeStatement (VO)
    participant GMS as GlobalMonthlySummary (VO)

    U->>S: selecciona año
    S->>R: GET /annual?year=YYYY (router.replace)
    R->>R: valida year con Zod (default: año actual)
    R->>UC: execute(year)
    UC->>UC: valida año (4 dígitos)
    UC->>MR: listByYear(year)
    MR-->>UC: MovementDTO[] (todas las cuentas del año, tags incluidas)
    UC->>AR: findAll()
    AR-->>UC: AccountDTO[] (con memberId)
    UC->>MemR: findAll()
    MemR-->>UC: Member[] (catálogo)
    UC->>VO: fromMovements(inputs, accounts, members)
    VO->>GMS: fromMovements(inputs del mes m) para m = 1..12
    GMS-->>VO: 12 resúmenes mensuales (KPIs + tagBreakdown)
    VO->>VO: ingresos por miembro, saldo acumulado, medias /12, fusión de tags
    VO-->>UC: AnnualIncomeStatement
    UC-->>R: AnnualIncomeStatementDTO
    R-->>U: HTML "Cuenta de resultados de {Año}" (el panel solo formatea)
```

Notas:

- La entrada también puede llegar desde el enlace "Cuenta de resultados" de la pantalla principal (`/annual?year={año del mes activo}`) o de `/summary` (`/annual?year={año del mes visible}`); `/annual` enlaza de cruce a "Resumen global" (`/summary?month={año}-01`).
- `AnnualIncomeStatement` **compone** 12 `GlobalMonthlySummary` (uno por mes, los vacíos incluidos): FR-006 (coherencia al céntimo con `/summary`) es una garantía estructural clavada con test de invariante. En pasadas propias añade la atribución de ingresos por miembro (dueño de la cuenta de registro; `null` = cuenta común), el saldo acumulado desde enero (FR-012, sin media) y las medias mensuales `total/12` con redondeo al céntimo (único punto de redondeo, ADR 0007).
- Nada se persiste: la cuenta anual es una vista derivada recalculada en cada consulta (extensión del ADR 0009).
