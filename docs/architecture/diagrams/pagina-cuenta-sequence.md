# Secuencia: Página de Cuenta (`/accounts/[accountId]?month=YYYY-MM`)

Feature 011 (`specs/011-pagina-cuenta/`); composición list-first desde la feature 016 (`specs/016-movimientos-bajo-selector-fechas/`); alta en diálogo desde el listado desde la feature 013 (`specs/013-formulario-dialogo/`); bloque «KPIs del mes» sticky en cuentas personales desde la feature 022 (`specs/022-kpis-fijos-cuenta/`); tercera materialización perezosa (ahorro informativo) y KPIs de 3 métricas desde la feature 023 (`specs/023-porcentaje-ahorro/`); cuarta métrica «Gasto personal» desde la feature 024 (`specs/024-kpi-gasto-personal/`); vista operativa sin balance ni cierre desde la feature 025 (`specs/025-simplificar-pagina-cuenta/` — `AccountBalance`, `MonthlyClosurePanel` y el puerto `getBalance` jubilados); quinta métrica «Ahorro acumulado» del año desde la feature 035 (`specs/035-kpi-ahorro-anual/`). Adaptador inbound fino que resuelve la cuenta por URL con 404 explícito; `GetMonthlyClosure` se ejecuta con lectura condicionada solo en cuentas personales como fuente interna de composición de los KPIs.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant S as MonthStepper (client)
    participant K as AccountMonthKpis (server, sticky)
    participant L as GroupedMovementList (client)
    participant D as CreateMovementDialog (client)
    participant R as "/accounts/[accountId] page.tsx (server)"
    participant LA as ListAccounts
    participant MRI as MaterializeRegularIncomes
    participant MCC as MaterializeCommonContributions
    participant MSA as MaterializeSavingsAllocations
    participant LM as ListMovements
    participant GMC as GetMonthlyClosure
    participant GNC as GetMonthNetContribution
    participant GMS as GetMonthSavings
    participant GAA as GetAnnualAccumulatedSavings
    participant CCR as "«port» CommonContributionRepository"
    participant SAR as "«port» SavingsAllocationRepository"
    participant DB as Drizzle* + libSQL

    U->>S: pulsa ‹ (mes anterior)
    S->>R: GET /accounts/{id}?month=YYYY-MM (router.replace + startTransition)
    R->>R: Zod: accountId válido + cuenta existe (si no → notFound() 404); month válido (si no → actual)
    R->>LA: execute()
    LA-->>R: AccountDTO[]
    R->>MRI: ensureForAccountAndMonth(id, month, currentMonth) [ADR 0016]
    R->>MCC: ensureForAccountAndMonth(id, month, currentMonth) [ADR 0017/0019, re-sincroniza el mes en curso]
    R->>MSA: ensureForAccountAndMonth(id, month, currentMonth) [023: deducción informativa sin movimiento]
    R->>LM: execute(accountId, month)
    LM-->>R: MovementDTO[] (date DESC, id DESC)
    alt cuenta personal (account.type === "personal")
    R->>GMC: execute(accountId, month) [025: lectura condicionada, fuente interna de KPIs]
    GMC-->>R: MonthlyClosureDTO (monthBalanceCents = Σ ingresos − Σ gastos del mes)
        R->>GNC: execute(AccountId, month) [022; no invoca materialización]
        GNC->>CCR: findByAccountId(accountId)
        CCR-->>GNC: CommonContribution | null
        GNC->>CCR: findMaterializedMovement(config.id, month)
        CCR-->>GNC: Movement | null (movimiento enlazado del registro)
        GNC-->>R: MonthNetContributionDTO { configured, amountCents } (importe del movimiento, sin recálculo)
        R->>GMS: execute(AccountId, month) [023; lee la fila del registro, nunca recalcula]
        GMS->>SAR: findByAccountId + findDeductedAmount(config.id, month)
        SAR-->>GMS: SavingsAllocation | null, number | null (importe congelado)
        GMS-->>R: MonthSavingsDTO { configured, amountCents }
        R->>GAA: execute(accountId, year) [035: 6.ª lectura, year = month.slice(0, 4); solo lectura]
        GAA->>GAA: listByYearAndAccount + findByAccountId → findDeductedMonthsOfYear (2 queries)
        GAA->>GAA: 12× MonthlyClosure.fromMovements + netMonthBalanceCents → Σ con signo
        GAA-->>R: AnnualAccumulatedSavingsDTO { accumulatedCents }
        R->>R: netMonthBalanceCents = helper compartido (condicional 033: −0 si backedByMovement)
        R->>R: personalExpenseCents = closure.personalExpenseCents − netContribution.amountCents (resta única, 024: naturaleza propia excluida la aportación)
    end
    R->>R: render: h1 + subtítulo, MonthStepper, [cuentas personales] AccountMonthKpis (sticky, 5 métricas desde 035: aportación · gasto personal · ahorro · saldo neto · ahorro acumulado «Año {year}»), listado con CTA «Nuevo movimiento» [025: sin balance ni cierre]
    R->>U: HTML del mes, list-first (GroupedMovementList justo bajo los KPIs, agrupa por fecha en cliente)
    U->>U: recorre el listado → la barra «KPIs del mes» permanece fija arriba (CSS position: sticky, sin selector dentro)
    U->>L: pulsa CTA «Nuevo movimiento» (cabecera del listado o estado vacío) → setCreating(true)
    L->>D: monta CreateMovementDialog a nivel del listado (MovementFormFields modo alta: cuenta fijada, fecha hoy)
    U->>D: rellena importe/concepto/tipo/naturaleza/tags → «Registrar»
    D->>R: createMovement (Server Action) → CreateMovement + revalidatePath("/") + revalidatePath("/accounts/[accountId]", "page")
    R-->>D: CreateMovementState { status: "success" }
    D->>U: onClose() + toast «Movimiento guardado»; página revalidada recalcula listado/KPIs
```

Notas:

- La agrupación por fecha es presentación (reduce en `GroupedMovementList` sobre el orden de `ListMovements`); no hay query ni lógica de dominio nuevas (FR-002/FR-009).
- Las Server Actions de 002/003 revalidan además `revalidatePath("/accounts/[accountId]", "page")` para que alta/edición/eliminación recalculen listado y KPIs en la propia vista.
- Desde 013 el alta vive solo en el diálogo del CTA (el bloque `MovementForm` embebido desaparece, FR-004 de 013); los diálogos de alta/edición/eliminación se montan a nivel de `GroupedMovementList` (nunca en filas) para sobrevivir a la revalidación. Tras guardar, el diálogo se cierra y desmonta: cada reapertura es un formulario limpio.
- Desde 022 las cuentas **personales** muestran el bloque `AccountMonthKpis` (server component sticky, sin JS) entre `MonthStepper` y el listado; desde 035 el `dl` tiene **5 métricas** (aportación común · gasto personal · ahorro del mes · saldo del mes · ahorro acumulado, `grid grid-cols-2 sm:grid-cols-5`, 5.ª celda `col-span-2 sm:col-span-1` con subtext permanente «Año {year}»): la aportación neta se lee del movimiento enlazado (`GetMonthNetContribution`, sin recálculo), el ahorro de la fila del registro (`GetMonthSavings`, sin recálculo), el saldo es **neto del ahorro** — la página compone las restas de composición `netMonthBalanceCents` (desde 035 vía el helper compartido `net-month-balance.ts`, fórmula condicional 033: respaldado por movimiento no descuenta) y `personalExpenseCents = closure.personalExpenseCents − netContribution.amountCents` (gasto personal del mes: naturaleza propia **excluida la aportación común**, 024) — y desde 035 el acumulado del año llega calculado de `GetAnnualAccumulatedSavings` (Σ con signo de los 12 saldos netos; la UI jamás suma). La cuenta común ni consulta los casos de uso ni renderiza el bloque; la materialización corre siempre antes de las lecturas (tres awaits secuenciales: 018 → 019 → 023).
- La deducción de ahorro (023) no toca `movements`: la fila de `savings_allocation_months` congela el importe en la primera consulta del mes y jamás se recalcula (sin re-sync del mes en curso, diferencia con 021).
- `movement-list.tsx` sigue alimentando `/` (congelado hasta `012-panel-cuentas`).
