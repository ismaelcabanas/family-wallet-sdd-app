# Secuencia — Panel de cuentas (feature 012)

Happy path: abrir `/` y entrar a una cuenta desde el panel de tarjetas. `/` es un lanzador (nombre + tipo, sin datos financieros) renderizado dinámicamente por petición (`await connection()`); lee `ListAccounts` y, desde 020, `GetRegularIncome` por cada cuenta personal para hidratar el estado del ítem del menú ⋮ de configuración.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant P as "/ page.tsx (server)"
    participant LA as ListAccounts
    participant GRI as GetRegularIncome (018)
    participant AR as "«port» AccountRepository"
    participant DB as DrizzleAccountRepository + libSQL
    participant A as "/accounts/[accountId] page.tsx (server, 011)"

    U->>P: GET / (p. ej. ?month= residual ignorado)
    P->>P: await connection() (cuentas actuales por petición)
    P->>LA: execute()
    LA->>AR: findAll()
    AR->>DB: select accounts join members order by id
    DB-->>LA: AccountDTO[]
    LA-->>P: AccountDTO[]
    P->>GRI: execute(AccountId) por cada cuenta personal (020)
    GRI-->>P: RegularIncomeDTO | null
    P->>P: render: GlobalNav(active=panel) + AccountCardGrid(accounts, regularIncomes)
    P-->>U: HTML del panel (sin datos financieros; ⋮ solo en personales desde 020)
    U->>P: clic en la tarjeta «Cuenta de Miembro B»
    P-->>U: navegación a /accounts/2 (Link, sin ?month=)
    U->>A: GET /accounts/2 (mes actual por defecto, 011)
    A-->>U: página de la cuenta (stepper, balance a mes, cierre, listado agrupado) con GlobalNav(active=panel, month)
```

Notas (decisiones de 012, `specs/012-panel-cuentas/research.md`):

- **`await connection()`**: sin ella, Next 16 prerenderizaría el panel en build y congelaría las cuentas (research §3). La página no lee `searchParams`: `/?month=` residual se ignora por diseño.
- **`GlobalNav({ active, month? })` de servidor renderizada por cada página** (no en `layout.tsx`): los layouts no reciben `searchParams` y la variante cliente exigiría `<Suspense>` (research §1). Propaga el mes visible; `/annual` pasa `${year}-01` (paridad con su antiguo nav local).
- **`AccountCardGrid`**: proyección de `AccountDTO` sin cálculo (FR-002); el destino `/accounts/{id}` va sin `?month=` porque la página de cuenta aplica su mes actual por defecto. Desde 020 es client component: el estado del ítem del menú se deriva del prop `regularIncomes` (función pura `regularIncomeMenuStatus`), nunca se consulta desde el cliente.

## Variante — configurar el ingreso regular desde la tarjeta (feature 020)

Happy path de 020: el menú ⋮ de la tarjeta de una cuenta personal abre el diálogo de configuración del ingreso regular (el mismo de 018) y la posterior consulta de la página de la cuenta materializa el ingreso exactamente una vez (base: `specs/020-menu-configuracion-cuenta/plan.md` §Diagramas de diseño).

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario (miembro)
    participant P as "/ page.tsx (server)"
    participant G as AccountCardGrid (client)
    participant M as Menú ⋮ (Radix)
    participant D as RegularIncomeConfigDialog (client)
    participant A as configureRegularIncome (action)
    participant UC as ConfigureRegularIncome (aplicación, intacto)
    participant AP as "/accounts/[accountId] page.tsx"
    participant MRI as MaterializeRegularIncomes (intacto)

    U->>P: GET /
    P->>UC2: GetRegularIncome por cada cuenta personal (2 SELECT)
    P-->>G: accounts + regularIncomes (props)
    U->>M: ⋮ «Configuración de Cuenta de Miembro A»
    M-->>U: ítem «Ingreso regular · Sin configurar»
    U->>M: selecciona el ítem (menú cierra; no navega)
    G->>D: monta {configOpen ? diálogo : null} — instancia fresca de useActionState
    U->>D: 2.000,00 € · día 1 · nota vacía → «Guardar» (intent save)
    D->>A: FormData { accountId, amount, dayOfMonth, note, intent }
    A->>UC: execute({ …, currentMonth })
    UC-->>A: RegularIncomeDTO (activa)
    A->>A: revalidatePath("/", "layout") → re-render RSC de /
    A-->>D: { status: "success", message: "Ingreso regular guardado" }
    D-->>U: toast «Ingreso regular guardado» + cierre
    Note over G: al reabrir ⋮, el ítem muestra «Activa» (prop revalidado)
    U->>AP: GET /accounts/1 (mes en curso)
    AP->>MRI: ensureForAccountAndMonth(accountId, month, currentMonth) — antes de leer (ADR 0016)
    AP-->>U: listado del mes con el ingreso materializado exactamente 1 (comportamiento 018 intacto)
```

Notas de la variante (decisiones de 020, `specs/020-menu-configuracion-cuenta/research.md`):

- **Patrón stretched-link**: el `<Link>` de la tarjeta se estira con `after:inset-0` y el trigger ⋮ queda por encima (`relative z-10`): el clic en ⋮ nunca navega y el resto de la tarjeta sí; HTML válido (el botón no está dentro del `<a>`).
- **El menú solo donde hay opciones**: hoy únicamente cuentas personales (ítem «Ingreso regular»); es el hogar de las opciones de cuenta (la aportación % de 019 añadirá ahí su entrada).
- **Diálogo por tarjeta** (excepción consciente de «diálogos por fila»): el catálogo de cuentas es estable, no desaparece tras `revalidatePath`; instancia fresca de `useActionState` por apertura (patrón 014/018).
- **La página de cuenta queda en movimientos + cierre + balance**: la materialización sigue disparándose solo allí, antes del `Promise.all` (ADR 0016); la configuración ya no vive en ella.
