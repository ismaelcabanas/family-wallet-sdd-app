# Secuencia: Página de Cuenta (`/accounts/[accountId]?month=YYYY-MM`)

Feature 011 (`specs/011-pagina-cuenta/`); composición list-first desde la feature 016 (`specs/016-movimientos-bajo-selector-fechas/`); alta en diálogo desde el listado desde la feature 013 (`specs/013-formulario-dialogo/`). Adaptador inbound fino que resuelve la cuenta por URL con 404 explícito y calcula el balance acumulado hasta el fin del mes consultado (corte `asOf` inclusive del puerto `AccountRepository.getBalance`, ADR 0009).

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant S as MonthStepper (client)
    participant L as GroupedMovementList (client)
    participant D as CreateMovementDialog (client)
    participant R as "/accounts/[accountId] page.tsx (server)"
    participant LA as ListAccounts
    participant LM as ListMovements
    participant AR as "«port» AccountRepository"
    participant GMC as GetMonthlyClosure
    participant DB as DrizzleAccountRepository + libSQL

    U->>S: pulsa ‹ (mes anterior)
    S->>R: GET /accounts/{id}?month=YYYY-MM (router.replace + startTransition)
    R->>R: Zod: accountId válido + cuenta existe (si no → notFound() 404); month válido (si no → actual)
    R->>LA: execute()
    LA-->>R: AccountDTO[]
    R->>LM: execute(accountId, month)
    LM-->>R: MovementDTO[] (date DESC, id DESC)
    R->>AR: getBalance(id, monthEndIsoDate(month))
    AR->>DB: sum(signo por type) where accountId and date <= asOf (inclusive)
    DB-->>R: céntimos (acumulado a fin de mes)
    R->>GMC: execute(accountId, month)
    GMC-->>R: MonthlyClosureDTO
    R->>R: render: h1 + subtítulo, MonthStepper, listado con CTA «Nuevo movimiento», balance «Acumulado hasta …», cierre
    R->>U: HTML del mes, list-first (GroupedMovementList justo bajo el selector, agrupa por fecha en cliente)
    U->>L: pulsa CTA «Nuevo movimiento» (cabecera del listado o estado vacío) → setCreating(true)
    L->>D: monta CreateMovementDialog a nivel del listado (MovementFormFields modo alta: cuenta fijada, fecha hoy)
    U->>D: rellena importe/concepto/tipo/naturaleza/tags → «Registrar»
    D->>R: createMovement (Server Action) → CreateMovement + revalidatePath("/") + revalidatePath("/accounts/[accountId]", "page")
    R-->>D: CreateMovementState { status: "success" }
    D->>U: onClose() + toast «Movimiento guardado»; página revalidada recalcula listado/balance/cierre
```

Notas:

- La agrupación por fecha es presentación (reduce en `GroupedMovementList` sobre el orden de `ListMovements`); no hay query ni lógica de dominio nuevas (FR-002/FR-009).
- Las Server Actions de 002/003 revalidan además `revalidatePath("/accounts/[accountId]", "page")` para que alta/edición/eliminación recalculen listado, cierre y balance en la propia vista.
- Desde 013 el alta vive solo en el diálogo del CTA (el bloque `MovementForm` embebido desaparece, FR-004 de 013); los diálogos de alta/edición/eliminación se montan a nivel de `GroupedMovementList` (nunca en filas) para sobrevivir a la revalidación. Tras guardar, el diálogo se cierra y se desmonta: cada reapertura es un formulario limpio.
- `movement-list.tsx` sigue alimentando `/` (congelado hasta `012-panel-cuentas`).
