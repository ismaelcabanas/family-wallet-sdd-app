# Secuencia — Panel de cuentas (feature 012)

Happy path: abrir `/` y entrar a una cuenta desde el panel de tarjetas. `/` es un lanzador puro (nombre + tipo, sin datos financieros) renderizado dinámicamente por petición (`await connection()`), única lectura `ListAccounts`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant P as "/ page.tsx (server)"
    participant LA as ListAccounts
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
    P->>P: render: GlobalNav(active=panel) + AccountCardGrid(nombre+tipo por cuenta)
    P-->>U: HTML del panel (sin datos financieros)
    U->>P: clic en la tarjeta «Cuenta de Miembro B»
    P-->>U: navegación a /accounts/2 (Link, sin ?month=)
    U->>A: GET /accounts/2 (mes actual por defecto, 011)
    A-->>U: página de la cuenta (stepper, balance a mes, cierre, listado agrupado) con GlobalNav(active=panel, month)
```

Notas (decisiones de 012, `specs/012-panel-cuentas/research.md`):

- **`await connection()`**: sin ella, Next 16 prerenderizaría el panel en build y congelaría las cuentas (research §3). La página no lee `searchParams`: `/?month=` residual se ignora por diseño.
- **`GlobalNav({ active, month? })` de servidor renderizada por cada página** (no en `layout.tsx`): los layouts no reciben `searchParams` y la variante cliente exigiría `<Suspense>` (research §1). Propaga el mes visible; `/annual` pasa `${year}-01` (paridad con su antiguo nav local).
- **`AccountCardGrid`**: proyección pura de `AccountDTO` sin cálculo (FR-002); el destino `/accounts/{id}` va sin `?month=` porque la página de cuenta aplica su mes actual por defecto.
