# Secuencia: aportación común — configurar porcentaje → consultar mes → gasto materializado (019)

Happy path de la feature 019: el miembro configura qué porcentaje de su ingreso regular (018) aporta a la cuenta común y la siguiente consulta de la página de la cuenta del mes materializa el gasto propio exactamente una vez (base: `specs/019-aportacion-comun/plan.md` §Diagramas de diseño). La entrada es el ítem «Aportación» del menú ⋮ de la tarjeta en `/`, bajo «Ingreso regular», y solo se habilita si el miembro tiene ingreso regular configurado (FR-006).

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario (miembro)
    participant P as /accounts/[accountId] page.tsx (server)
    participant AP as CommonContributionConfigDialog + configureCommonContribution (client/action)
    participant CCC as ConfigureCommonContribution (aplicación)
    participant MCC as MaterializeCommonContributions (aplicación)
    participant MRI as MaterializeRegularIncomes (018, intacto)
    participant DOM as CommonContribution + ContributionPercentage (dominio)
    participant RCR as «port» CommonContributionRepository
    participant RIR as «port» RegularIncomeRepository
    participant TR as «port» TagRepository
    participant DB as DrizzleCommonContributionRepository + libSQL
    participant LM as ListMovements (intacto)

    U->>AP: ⋮ «Configuración de Cuenta de …» → ítem «Aportación» → 25 % → «Guardar»
    AP->>AP: Zod: patrón ^\\d{1,3}([.,]\\d{1,2})?$ → parsePercentageToBasisPoints = 2500 bp
    AP->>CCC: execute({ accountId, percentageBasisPoints: 2500, currentMonth })
    CCC->>RIR: findByAccountId → ingreso regular ✓ (dependencia FR-006)
    CCC->>DOM: ContributionPercentage.fromBasisPoints(2500) + appliedToCents(ingreso) ≥ 1 ✓
    CCC->>RCR: save(CommonContribution.create({ …, activatedAtMonth: currentMonth })) → activa
    CCC-->>AP: CommonContributionDTO
    AP->>P: revalidatePath("/", "layout") + toast «Aportación guardada»
    Note over P: re-render RSC de la página de cuenta
    P->>MRI: ensureForAccountAndMonth(accountId, month, currentMonth) — 018, intacto
    P->>MCC: ensureForAccountAndMonth(accountId, month, currentMonth)
    MCC->>RCR: findByAccountId → config activa ✓ · ventana activatedAtMonth ≤ month ≤ currentMonth ✓
    MCC->>RCR: isMaterialized(id, month) → false
    MCC->>RIR: findByAccountId → ingreso activo (base al momento de generar)
    MCC->>DOM: appliedToCents(income.amountCents) = floor((cents×2500+5000)/10000) half-up
    MCC->>TR: findBySlug("aportacion-comun") ?? Tag.create + save (ensure por slug)
    MCC->>DOM: Movement.create(gasto · naturaleza propia · date ${month}-01 · nota «Aportación común de {miembro}» · etiqueta)
    MCC->>RCR: registerMaterialization(config, month, movement)
    DB->>DB: tx: INSERT common_contribution_months ON CONFLICT DO NOTHING RETURNING → ok → INSERT movements (id max+1)
    P->>LM: execute(accountId, month) — la aportación ya existe
    LM-->>P: MovementDTO[] con el gasto (cierre y balance lo computan igual)
    P-->>U: listado del mes con −500,00 € «Aportación común de {miembro}» — exactamente 1
```

Notas:

- La materialización de la aportación corre **inmediatamente después** de la de 018 y antes del `Promise.all` (dos awaits secuenciales): listado, cierre y balance ven el mismo estado (ADR 0016/0017).
- `/summary` y `/annual` no materializan (decisión del propietario 2026-10-12): solo leen movimientos existentes.
- Si el par `(config, mes)` ya está registrado (reconsulta o carrera concurrente), `registerMaterialization` devuelve `false` sin escribir movimiento; el borrado del gasto generado es definitivo.
- Sin ingreso regular (o inactivo): el ítem del menú queda deshabilitado con «Requiere ingreso regular» y la materialización es no-op (FR-006).
- La cuenta común no recibe contrapartida automática (decisión del propietario; Out of Scope de 019).
