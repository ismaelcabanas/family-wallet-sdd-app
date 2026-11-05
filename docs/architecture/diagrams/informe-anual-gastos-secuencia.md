# Secuencia: informe anual de gastos por categorías (feature 015)

Diagrama de secuencia del happy path de `GetAnnualCategoryExpenseReport` sobre la vista `/reports/annual-expenses`. Base: diagrama de diseño de [plan.md](../../../specs/015-informe-anual-gastos/plan.md) de la feature.

```mermaid
sequenceDiagram
    autonumber
    actor U as Propietario
    participant Nav as ReportsNavMenu (client, GlobalNav)
    participant S as YearSelector (client, basePath propio)
    participant R as "/reports/annual-expenses page.tsx (server)"
    participant UC as GetAnnualCategoryExpenseReport
    participant MR as "«port» MovementRepository"
    participant TR as "«port» TagRepository"
    participant CR as "«port» CategoryRepository"
    participant AR as "«port» AccountRepository"
    participant Agg as AnnualCategoryExpenseReport (agregado)

    U->>Nav: abre «Informes» → «Gastos por categoría»
    Nav-->>R: GET /reports/annual-expenses (año actual por defecto)
    U->>S: selecciona año
    S-->>R: GET /reports/annual-expenses?year=YYYY (router.replace)
    R->>R: valida year con Zod (default: currentYear())
    R->>UC: execute(year)
    UC->>UC: valida año (4 dígitos, error de dominio)
    par lecturas en paralelo
        UC->>MR: listByYear(year)
        MR-->>UC: MovementDTO[] (todas las cuentas, tags incluidas)
        UC->>TR: findAll()
        TR-->>UC: Tag[] (incluye desactivadas: histórico íntegro)
        UC->>CR: findAll()
        CR-->>UC: TagCategory[] (todas las categorías)
        UC->>AR: findAll()
        AR-->>UC: AccountDTO[] (tipo de cuenta)
    end
    UC->>UC: join tag→categoría en memoria (Map tagId → categoryId);<br/>derivación accountKind personal/common
    UC->>Agg: fromMovements(year, inputs, categories)
    Agg->>Agg: excluye isProtectedTagSlug (CONTRIBUTION_TAG_SLUG);<br/>acumula celdas categoría×mes;<br/>«Gasto mensual» y gastos personales (own + cuenta personal);<br/>medias = total ÷ 12 (half-up); orden: genérica primero, resto es-ES
    Agg-->>UC: agregado (todas las categorías, 12 meses)
    UC-->>R: AnnualCategoryExpenseReportDTO
    R-->>U: HTML «Informe anual de gastos de {Año}» (GlobalNav active="reports" + YearSelector basePath="/reports/annual-expenses" + tabla; la UI solo formatea)
```

Notas:

- **Lectura pura**: sin materialización, sin persistencia nueva, sin puertos nuevos (FR-005). El join tag→categoría se resuelve **en memoria** en el caso de uso (`TagRepository.findAll()` → mapa `tagId → categoryId`) porque `MovementTagDTO` está congelado por 027.
- La **exclusión de la aportación común es declarativa por etiqueta protegida** (`isProtectedTagSlug`, R5 de research): el informe es agnóstico de la materialización 019/021 — un gasto manual con esa etiqueta también queda excluido.
- «Gasto personal» = `type = expense` AND `nature = "personal"` AND cuenta de tipo personal (misma semántica que el KPI de 022/024, R6).
- La media anual divide **siempre** por 12 (también en año en curso o con meses vacíos; decisión del propietario), `Math.round(total/12)` half-up en céntimos enteros (ADR 0007).
- `YearSelector` se reutiliza generalizado con `basePath` opcional (por defecto `"/annual"`: 009 intacto).
