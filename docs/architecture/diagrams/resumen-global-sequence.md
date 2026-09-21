# Secuencia: resumen global mensual (feature 006)

Diagrama de secuencia del happy path de `GetGlobalMonthlySummary` sobre la vista `/summary` (ADR 0012). Base: diagrama de diseño de [plan.md](../../../specs/006-resumen-global-mensual/plan.md) de la feature.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant S as MonthSelector (client)
    participant R as "/summary page.tsx (server)"
    participant UC as GetGlobalMonthlySummary
    participant MR as "«port» MovementRepository"
    participant AR as "«port» AccountRepository"
    participant VO as GlobalMonthlySummary (VO)
    participant CL as MonthlyClosure (VO)

    U->>S: selecciona mes
    S->>R: GET /summary?month=YYYY-MM (router.replace)
    R->>R: valida month con Zod (default: mes actual)
    R->>UC: execute(month)
    UC->>UC: valida formato YYYY-MM
    UC->>MR: listByMonth(month)
    MR-->>UC: MovementDTO[] (todas las cuentas, tags incluidas)
    UC->>AR: findAll()
    AR-->>UC: AccountDTO[] (con memberId y memberName)
    UC->>VO: fromMovements(inputs, accounts)
    VO->>CL: fromMovements(inputs)
    CL-->>VO: KPIs agregados + tagBreakdown
    VO-->>UC: GlobalMonthlySummary (+ memberBreakdown)
    UC-->>R: GlobalMonthlySummaryDTO
    R-->>U: HTML con "Resumen global de {Mes YYYY}" (el panel solo formatea)
```

Notas:

- La entrada también puede llegar desde el enlace "Resumen global" de la pantalla principal (`/summary?month={mes activo}`).
- `GlobalMonthlySummary` **compone** `MonthlyClosure` para los KPIs agregados y el desglose por tag (única fuente de reglas, FR-002 estructural); el desglose por miembro se calcula en pasada propia agrupando por `memberId` (`null` = cuenta común).
- Nada se persiste: el resumen es una vista derivada recalculada en cada consulta (extensión del ADR 0009).
