# Secuencia: Página de Cuenta (`/accounts/[accountId]?month=YYYY-MM`)

Feature 011 (`specs/011-pagina-cuenta/`); composición list-first desde la feature 016 (`specs/016-movimientos-bajo-selector-fechas/`); alta en diálogo desde el listado desde la feature 013 (`specs/013-formulario-dialogo/`); bloque «KPIs del mes» sticky en cuentas personales desde la feature 022 (`specs/022-kpis-fijos-cuenta/`). Adaptador inbound fino que resuelve la cuenta por URL con 404 explícito y calcula el balance acumulado hasta el fin del mes consultado (corte `asOf` inclusive del puerto `AccountRepository.getBalance`, ADR 0009).

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
    participant LM as ListMovements
    participant AR as "«port» AccountRepository"
    participant GMC as GetMonthlyClosure
    participant GNC as GetMonthNetContribution
    participant CCR as "«port» CommonContributionRepository"
    participant DB as Drizzle* + libSQL

    U->>S: pulsa ‹ (mes anterior)
    S->>R: GET /accounts/{id}?month=YYYY-MM (router.replace + startTransition)
    R->>R: Zod: accountId válido + cuenta existe (si no → notFound() 404); month válido (si no → actual)
    R->>LA: execute()
    LA-->>R: AccountDTO[]
    R->>MRI: ensureForAccountAndMonth(id, month, currentMonth) [ADR 0016]
    R->>MCC: ensureForAccountAndMonth(id, month, currentMonth) [ADR 0017/0019, re-sincroniza el mes en curso]
    R->>LM: execute(accountId, month)
    LM-->>R: MovementDTO[] (date DESC, id DESC)
    R->>AR: getBalance(id, monthEndIsoDate(month))
    AR->>DB: sum(signo por type) where accountId and date <= asOf (inclusive)
    DB-->>R: céntimos (acumulado a fin de mes)
    R->>GMC: execute(accountId, month)
    GMC-->>R: MonthlyClosureDTO (monthBalanceCents = Σ ingresos − Σ gastos del mes)
    alt cuenta personal (account.type === "personal")
        R->>GNC: execute(AccountId, month) [022; no invoca materialización]
        GNC->>CCR: findByAccountId(accountId)
        CCR-->>GNC: CommonContribution | null
        GNC->>CCR: findMaterializedMovement(config.id, month)
        CCR-->>GNC: Movement | null (movimiento enlazado del registro)
        GNC-->>R: MonthNetContributionDTO { configured, amountCents } (importe del movimiento, sin recálculo)
    end
    R->>R: render: h1 + subtítulo, MonthStepper, [cuentas personales] AccountMonthKpis (sticky, entre selector y listado), listado con CTA «Nuevo movimiento», balance «Acumulado hasta …», cierre
    R->>U: HTML del mes, list-first (GroupedMovementList justo bajo los KPIs, agrupa por fecha en cliente)
    U->>U: recorre el listado → la barra «KPIs del mes» permanece fija arriba (CSS position: sticky, sin selector dentro)
    U->>L: pulsa CTA «Nuevo movimiento» (cabecera del listado o estado vacío) → setCreating(true)
    L->>D: monta CreateMovementDialog a nivel del listado (MovementFormFields modo alta: cuenta fijada, fecha hoy)
    U->>D: rellena importe/concepto/tipo/naturaleza/tags → «Registrar»
    D->>R: createMovement (Server Action) → CreateMovement + revalidatePath("/") + revalidatePath("/accounts/[accountId]", "page")
    R-->>D: CreateMovementState { status: "success" }
    D->>U: onClose() + toast «Movimiento guardado»; página revalidada recalcula listado/KPIs/balance/cierre
```

Notas:

- La agrupación por fecha es presentación (reduce en `GroupedMovementList` sobre el orden de `ListMovements`); no hay query ni lógica de dominio nuevas (FR-002/FR-009).
- Las Server Actions de 002/003 revalidan además `revalidatePath("/accounts/[accountId]", "page")` para que alta/edición/eliminación recalculen listado, cierre y balance en la propia vista.
- Desde 013 el alta vive solo en el diálogo del CTA (el bloque `MovementForm` embebido desaparece, FR-004 de 013); los diálogos de alta/edición/eliminación se montan a nivel de `GroupedMovementList` (nunca en filas) para sobrevivir a la revalidación. Tras guardar, el diálogo se cierra y se desmonta: cada reapertura es un formulario limpio.
- Desde 022 las cuentas **personales** muestran el bloque `AccountMonthKpis` (server component sticky, sin JS) entre `MonthStepper` y el listado: aportación neta leída del movimiento enlazado (`GetMonthNetContribution`, sin recálculo — coherencia con listado/cierre por construcción, FR-006 de 022) y saldo del mes reutilizado de `closure.monthBalanceCents` (cero cálculo nuevo). La cuenta común ni consulta el caso de uso ni renderiza el bloque; la materialización corre siempre antes de las lecturas (orden intacto).
- `movement-list.tsx` sigue alimentando `/` (congelado hasta `012-panel-cuentas`).
