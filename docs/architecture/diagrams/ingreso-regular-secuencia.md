# Secuencia: ingreso regular — configurar → consultar mes → ingreso materializado (018)

Happy path de la feature 018: el miembro configura su ingreso regular y la siguiente consulta de la página de la cuenta del mes materializa el ingreso exactamente una vez (base: `specs/018-ingresos-regulares/plan.md` §Diagramas de diseño).

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario (miembro)
    participant P as /accounts/[accountId] page.tsx (server)
    participant RI as RegularIncomePanel + configureRegularIncome (client/action)
    participant CRI as ConfigureRegularIncome (aplicación)
    participant MRI as MaterializeRegularIncomes (aplicación)
    participant DOM as RegularIncome (dominio)
    participant RR as «port» RegularIncomeRepository
    participant DB as DrizzleRegularIncomeRepository + libSQL
    participant LM as ListMovements (intacto)

    U->>RI: «Configurar ingreso» → 2.000,00 € · día 1 · nota vacía → «Guardar»
    RI->>CRI: execute({ accountId, amountCents, dayOfMonth: 1, note: null, currentMonth })
    CRI->>RR: accounts.findAll() → cuenta personal ✓ (memberName)
    CRI->>DOM: RegularIncome.create({ …, activatedAtMonth: currentMonth, nota default })
    CRI->>RR: save(config) → activa
    CRI-->>RI: RegularIncomeDTO
    RI->>P: revalidatePath("/", "layout") + toast «Ingreso regular guardado»
    Note over P: re-render RSC de la página de cuenta
    P->>MRI: ensureForAccountAndMonth(accountId, month, currentMonth)
    MRI->>RR: findByAccountId → config (activación = mes en curso)
    MRI->>RR: isMaterialized(id, month) → false
    MRI->>DOM: Movement.create(ingreso · date = dueDateForMonth(month) con clamp)
    MRI->>RR: registerMaterialization(config, month, movement)
    DB->>DB: tx: INSERT regular_income_months ON CONFLICT DO NOTHING RETURNING → ok → INSERT movements (id max+1)
    P->>LM: execute(accountId, month) — el ingreso ya existe
    LM-->>P: MovementDTO[] con el ingreso (cierre y balance lo computan igual)
    P-->>U: listado del mes con el ingreso materializado — exactamente 1 (consultas repetidas: registro existente → no-op)
```

Notas:

- La materialización ocurre **antes del `Promise.all`** de lecturas de la página: listado, cierre y balance ven el mismo estado (ADR 0016).
- `/summary` y `/annual` no aparecen porque **no materializan** (decisión del propietario 2026-10-12): solo leen movimientos existentes.
- Si el par `(config, mes)` ya está registrado (reconsulta o carrera concurrente), `registerMaterialization` devuelve `false` sin escribir movimiento.
