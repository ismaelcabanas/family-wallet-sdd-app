# Tasks: Panel de Cuentas

**Input**: Design documents from `/specs/012-panel-cuentas/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/ui-contract.md, quickstart.md, `.specify/memory/constitution.md`

**Tests**: REQUERIDOS en esta feature (constitución, principio III): RTL jsdom de los 2 componentes nuevos (`global-nav.tsx`, `account-card-grid.tsx`, co-localizados) y e2e (6 specs existentes adaptadas **sin debilitar aserciones** — FR-005 — + `panel-cuentas.spec.ts` nueva). Sin tests de dominio/aplicación/infra: nada cambia en esas capas (FR-006).

**Organization**: 2 user stories (US1 P1 panel de cuentas, US2 P2 navegación global). **Sin fase de Setup**: feature de presentación sobre lo existente — cero dependencias, esquema, migraciones ni datos nuevos (FR-006). Fase Foundational mínima con `GlobalNav` (lo renderiza el panel de US1 y las 4 páginas de US2: bloquea ambas historias); después una fase por US en orden de prioridad. Las e2e se adaptan en la fase de la US que las habilita (research §6.2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js existente: `src/` (app, infrastructure/primary) conforme a [plan.md](./plan.md). `src/domain/` y `src/application/` NO se tocan (FR-006).
- Tests co-localizados junto a su SUT (`*.test.tsx`); e2e en `e2e/` (BD `e2e.sqlite`, `workers: 1`, orden alfabético — AGENTS.md).

---

## Phase 1: Foundational - `GlobalNav` compartido (bloquea US1 y US2)

**Goal**: el único componente nuevo que sirven ambas historias: `GlobalNav({ active, month? })` de servidor con enlaces Panel · Resumen global · Cuenta de resultados, estado activo accesible y propagación del mes (research §1/§2/§7, ui-contract §2).

- [X] T001 [P] Crear el componente de servidor `GlobalNav` en `src/infrastructure/primary/ui/global-nav.tsx` (sin `"use client"`, sin hooks) según contracts/ui-contract.md §2: props `{ active: "panel" | "summary" | "annual"; month?: string }`; `month` con fallback a `currentMonth()` de `src/infrastructure/primary/ui/format.ts`; `<nav aria-label="Navegación principal">` con exactamente 3 enlaces en orden — «Panel» → `/` (siempre sin query), «Resumen global» → `/summary?month=${month}`, «Cuenta de resultados» → `/annual?year=${month.slice(0, 4)}` — usando `Link` de `next/link`; enlace activo (`active` coincide) con `aria-current="page"` + `font-medium text-foreground`, inactivos con `text-sm text-muted-foreground underline-offset-4 hover:underline` (research §7)
- [X] T002 Crear `src/infrastructure/primary/ui/global-nav.test.tsx` (jsdom + RTL, patrón de `account-balance.test.tsx`): landmark `nav` «Navegación principal» con los 3 enlaces en orden y textos exactos (ui-contract §5); `aria-current="page"` SOLO en el enlace activo para cada valor de `active` (incluida la variante cuenta de cuenta: `active="panel"`); con `month="2026-03"` los hrefs son `/summary?month=2026-03` y `/annual?year=2026` y «Panel» es exactamente `/`; sin prop `month` cae a `currentMonth()` (asertar hrefs contra el valor calculado con el mismo helper) (depende de T001)

**Checkpoint**: componente verificable en jsdom; aún no se consume por ninguna página.

---

## Phase 2: User Story 1 - Panel de cuentas (Priority: P1) 🎯 MVP

**Goal**: `/` reescrito como panel lanzador puro: `await connection()` + `ListAccounts` → `GlobalNav` + `AccountCardGrid` (nombre + tipo, sin datos financieros); pasarela, selector y listado plano jubilados (FR-001, FR-002, research §3–§5).

**Independent Test**: abrir `/` → una tarjeta por cuenta con nombre y tipo exactos, sin importes ni selector ni formulario ni listado; cada tarjeta navega en un clic a `/accounts/[id]` en su mes actual (quickstart N1/N2/N4); specs e2e `registro`, `edicion`, `cierre` y `pagina-cuenta` adaptadas y en verde (checkpoint intermedio: las 2 restantes se adaptan en US2 porque aún usan la pasarela).

### Implementation for User Story 1

- [X] T003 [P] [US1] Crear el componente de servidor `AccountCardGrid` en `src/infrastructure/primary/ui/account-card-grid.tsx` (sin `"use client"`, sin estado) según contracts/ui-contract.md §1.3 y research §4: props `{ accounts: AccountDTO[] }` (de `@/application/movement/dto`); `<ul aria-label="Cuentas">` con rejilla responsiva `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`; un `<li>` por cuenta **en el orden recibido** (`ListAccounts`, id ascendente) cuyo contenido íntegro es un único `Link` a `/accounts/${account.id}` **sin `?month=`**; contenido: nombre de la cuenta en peso prominente + etiqueta de tipo — `type === "shared" ? "Cuenta común" : "Cuenta personal de ${memberName ?? "miembro"}` (misma expresión que el subtítulo de 011, data-model §1.2) — y **nada más**: sin balance, sin gasto del mes, sin estados de carga (lanzador puro, decisión del propietario 2026-09-29)
- [X] T004 [US1] Crear `src/infrastructure/primary/ui/account-card-grid.test.tsx` (jsdom + RTL): una tarjeta por cuenta en el orden de entrada con etiqueta de lista `aria-label="Cuentas"`; nombre exacto y tipo exacto («Cuenta personal de Miembro A», «Cuenta común») como nombre accesible del enlace; href `/accounts/{id}` sin query string; **ningún importe** (sin «€») ni datos derivados con cuentas con/sin movimientos (escenario US1-3: tarjetas equivalentes) (depende de T003)
- [X] T005 [US1] Reescribir `src/app/page.tsx` como panel según ui-contract §1 y research §3: server component que hace **`await connection()`** (`next/server`) antes de consultar — sin leer `searchParams` (query residual ignorada, FR-002/edge case); única lectura `new ListAccounts(new DrizzleAccountRepository(db)).execute()`; render `max-w-4xl` con h1 «Family Wallet», `<GlobalNav active="panel" />` (sin `month`: fallback interno a mes actual) y `<AccountCardGrid accounts={accounts} />`; eliminar TODO lo demás del fichero: schemas Zod de `account`/`month`, `firstParam`, repos de movimientos/tags, `GetMonthlyClosure`, `ListMovements`, `ListActiveTags`, `AccountId`, `AccountMonthSelector`, `AccountBalance`, `MovementForm`, `MonthlyClosurePanel`, `MovementList` (la página ya no muestra formulario, cierre ni listado — US1-4) (depende de T001, T003)
- [X] T006 [US1] Eliminar `src/infrastructure/primary/ui/movement-list.tsx`, `src/infrastructure/primary/ui/movement-list.test.tsx`, `src/infrastructure/primary/ui/account-month-selector.tsx` y `src/infrastructure/primary/ui/account-month-selector.test.tsx` (jubilados con la pasarela; su único consumía `src/app/page.tsx`, verificado en research §5 — `GroupedMovementList` queda como único listado); verificar con grep que no quedan importes huérfanos y que `npm run typecheck` compila (depende de T005)
- [X] T007 [P] [US1] Verificar —sin cambios de código— que `revalidatePath("/")` sigue presente en `src/infrastructure/primary/actions/create-movement.action.ts`, `update-movement.action.ts` y `delete-movement.action.ts` junto a `revalidatePath("/accounts/[accountId]", "page")` (excepción declarada en FR-006: mantiene el panel al día ante futuras altas de cuentas; los tests co-localizados ya asertan ambas llamadas)
- [X] T008 [P] [US1] Adaptar `e2e/registro-movimientos.spec.ts` (flujo crítico, FR-005): sustituir `selectAccount` por helper `openAccount(page, accountName)` — `goto("/")` → clic en `getByRole("link", { name: accountName })` → `expect(heading {accountName})` visible — usado en E1–E4; aserciones de fila alineadas con la fila de 011: retirar `toContainText("Gasto")`/`("Ingreso")`/`("Compartido")` (el tipo ya lo verifica el signo e importe «−850,00»/«+1500,00», asertados) y sustituir «Compartido» por el badge «Común»; conservar INTACTAS las aserciones de balance histórico («Balance de Cuenta común», `/^-850,00/`, `/^1379,50/`), toasts «Movimiento guardado», reset del formulario y E4 (importe inválido) — la región «Movimientos del mes» existe en la página de cuenta con el mismo nombre (depende de T005)
- [X] T009 [P] [US1] Adaptar `e2e/edicion-movimientos.spec.ts`: `openAccount(page, "Cuenta de Miembro B")` como puerta de entrada; el cambio de mes usa el helper `selectMonth` existente contra el stepper («Mes visible» + opción `monthLabel`, mismos nombres); diálogos de edición/eliminación, recuentos, toasts y E3 (estado vacío tras eliminar el último) sin debilitar (depende de T005)
- [X] T010 [P] [US1] Adaptar `e2e/cierre-mensual.spec.ts`: `openAccount(page, "Cuenta de Miembro B")` (mes actual, mismo combo cuenta/mes que hoy); E2 sigue saltando a 2025 con el picker «Mes visible»; KPIs exactos del cierre intactos (depende de T005)
- [X] T011 [P] [US1] Adaptar `e2e/pagina-cuenta.spec.ts`: retirar el test P8 («mantiene la pasarela / sin cambios», FR-007 de 011 — la pasarela que esta feature sustituye; su cobertura pasa a `panel-cuentas.spec.ts` en US2); P1–P7 intactos (entran por URL directa `/accounts/2`) (depende de T005)

**Checkpoint**: panel operativo (`npm run dev` → `/`): tarjeta por cuenta, un clic hasta `/accounts/[id]` en mes actual, `/?month=2025-01` sin error. `npm run test` en verde; `npm run test:e2e` con `registro`, `edicion`, `cierre` y `pagina-cuenta` en verde (`resumen-global` y `cuenta-resultados-anual` se adaptan en US2 — aún dependen de la pasarela retirada).

---

## Phase 3: User Story 2 - Navegación global persistente (Priority: P2)

**Goal**: `GlobalNav` renderizada por las 4 páginas sustituyendo los navs locales duplicados, con destino activo distinguible y mes visible conservado al navegar (FR-003, clarificación 2026-09-29, research §1/§2).

**Independent Test**: visitar `/`, `/accounts/2`, `/summary`, `/annual` → la misma navegación en las cuatro con el destino activo marcado (`aria-current="page"`); desde `/accounts/2?month=2026-03`, «Resumen global» → `/summary?month=2026-03` (quickstart N3/N4); suite e2e completa en verde.

### Implementation for User Story 2

- [X] T012 [P] [US2] Sustituir en `src/app/accounts/[accountId]/page.tsx` el bloque `<nav>` local (Links «Resumen global»/«Cuenta de resultados») por `<GlobalNav active="panel" month={month} />` (la página de cuenta computa como «Panel», ui-contract §2.3); retirar el import de `Link` si queda sin uso; el resto de la página sin cambios funcionales (FR-004: sin selectores de cuenta en la página; el del diálogo de edición de 003 se conserva) (depende de T001)
- [X] T013 [P] [US2] Sustituir en `src/app/summary/page.tsx` el bloque `<nav>` local (Links «Volver»/«Cuenta de resultados») por `<GlobalNav active="summary" month={month} />`; retirar el import de `Link` si queda sin uso; `MonthSelector` y `GlobalSummaryPanel` intactos (FR-003) (depende de T001)
- [X] T014 [P] [US2] Sustituir en `src/app/annual/page.tsx` el bloque `<nav>` local (Links «Volver»/«Resumen global») por `<GlobalNav active="annual" month={`${year}-01`} />` (paridad exacta con su nav local actual: hoy enlaza `/summary?month=${year}-01`, research §2); retirar el import de `Link` si queda sin uso; `YearSelector` y `AnnualStatementPanel` intactos (depende de T001)
- [X] T015 [P] [US2] Adaptar `e2e/resumen-global.spec.ts`: `selectAccount` → `openAccount(page, accountName)` por el panel y `selectMonth(page, "Junio de 2026")` **en cada cuenta** tras entrar (cada entrada cae al mes actual); el clic final «Resumen global» usa la navegación global de la página de cuenta conservando la aserción de URL `/summary\?month=2026-06$` (cubre la propagación de mes US2-4); registros, KPIs exactos (2100,00 / 1060,50 / +1039,50), desgloses por tag y por miembro y E4 intactos (depende de T005, T012)
- [X] T016 [P] [US2] Adaptar `e2e/cuenta-resultados-anual.spec.ts`: `openAccount(page, "Cuenta de Miembro B")` + `selectMonth` a enero/julio 2027 con el stepper (mismos nombres de opción); el clic «Cuenta de resultados» usa la navegación global (`/annual?year=2027`); tabla anual, desglose por tag y E5 (2028 por URL directa) intactos (depende de T005, T012)
- [X] T017 [US2] Crear `e2e/panel-cuentas.spec.ts` (nueva, de **lectura pura** — sin escrituras, posición alfabética irrelevante para el aislamiento) según research §6.3 y quickstart N1–N5: **N1** `/` muestra un enlace-tarjeta por cuenta del seed con nombre y tipo exactos («Cuenta personal de Miembro A/B», «Cuenta común»), sin «€» en la vista, sin combobox «Cuenta activa», sin botón «Registrar», sin regiones «Movimientos del mes»/«Cierre de» (FR-001, US1-1/1-3/1-4); **N2** clic en la tarjeta de Miembro B → URL `/accounts/2` exacta (sin `?month=`), h1 «Cuenta de Miembro B» visible, stepper en el mes actual real (› deshabilitado como proxy); **N3** nav global en `/` con los 3 enlaces y «Panel» con `aria-current="page"`; **N4** `/?month=2025-01` residual → panel normal, sin error; **N5** por atributos (sin escribir): en `/accounts/2?month=2026-03` los hrefs de «Resumen global»/«Cuenta de resultados» son `/summary?month=2026-03`/`/annual?year=2026` con «Panel» activo; en `/summary?month=2025-01`, «Cuenta de resultados» → `/annual?year=2025` y «Resumen global» activo; en `/annual?year=2028`, «Resumen global» → `/summary?month=2028-01` y «Cuenta de resultados» activo (depende de T005, T012, T013, T014)

**Checkpoint**: US2 completa — suite e2e entera (7 specs) en verde; navegación presente y activa en el 100% de las páginas (SC-004).

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T018 [P] Actualizar la documentación de arquitectura en el mismo cambio reutilizando los diagramas del plan como base: `docs/architecture/overview.md` (árbol de estructura: `global-nav.tsx` y `account-card-grid.tsx` nuevos, `movement-list.tsx`/`account-month-selector.tsx` eliminados, `/` como panel con `connection()`, navs locales retirados) y `docs/architecture/diagrams/` (C4: `/` como panel de tarjetas; nuevo fichero de secuencia del happy path del panel reutilizando el diagrama de plan.md §Diagramas); actualizar la referencia a `movement-list.tsx` en la convención «Diálogos por fila» de `AGENTS.md` → `grouped-movement-list.tsx` (el ejemplo jubilado); README solo si surge otra convención nueva
- [X] T019 Ejecutar la verificación manual completa de `specs/012-panel-cuentas/quickstart.md` (N1–N7 + comprobación inicial + verificación adicional de rejilla responsiva) sobre `npm run dev` con BD migrada y sembrada (depende de T017)
- [X] T020 Verificar los gates finales: `npm run lint`, `npm run typecheck`, `npm run test` y `npm run test:e2e` en verde en local con las 7 specs e2e (6 adaptadas **sin aserciones debilitadas** + nueva), y CI de GitHub Actions en verde tras push (SC-005)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: sin dependencias — empezar por aquí. `GlobalNav` bloquea ambas US (el panel de US1 lo renderiza; US2 lo despliega en las 4 páginas).
- **US1 (Phase 2)**: depende de Phase 1 (T001). T003/T004 en paralelo con T001/T002 (ficheros distintos); T005 integra; T006 tras T005; T008–T011 (e2e) tras T005, en paralelo entre sí.
- **US2 (Phase 3)**: depende de Phase 1 (T001) y del panel vivo (T005 para las e2e). T012/T013/T014 en paralelo (ficheros distintos); T015/T016 tras T012 (nav global en página de cuenta); T017 tras T012–T014.
- **Polish (Phase 4)**: T018 tras las fases de código; T019 requiere T017; T020 siempre el último.

### User Story Dependencies

- **US1 (P1)**: tras Phase 1 — independiente de US2 (el checkpoint de US1 se valida con las 4 specs adaptadas).
- **US2 (P2)**: tras Phase 1; sus e2e (T015–T017) requieren además el panel de US1 (T005) porque entran por él.

### Within Each User Story

- Componente antes que su test co-localizado (T001→T002, T003→T004).
- Página/integración después de sus componentes (T005 tras T001+T003; T012–T014 tras T001).
- E2E al final de cada US, tras la página que ejercitan.

### Parallel Opportunities

- Arranque: T001 y T003 en paralelo; después T002 y T004 en paralelo (tests de módulos distintos).
- Integración US1: T007 en paralelo con T005/T006; T008, T009, T010 y T011 en paralelo (specs distintas).
- US2: T012, T013 y T014 en paralelo; después T015 y T016 en paralelo.
- Polish: T018 en paralelo con T019 una vez T017 está en verde.

---

## Parallel Example: User Story 1

```bash
# Bloque inicial (en paralelo):
Task: "T001 [P] GlobalNav en src/infrastructure/primary/ui/global-nav.tsx"
Task: "T003 [P] [US1] AccountCardGrid en src/infrastructure/primary/ui/account-card-grid.tsx"

# Bloque tests UI (en paralelo, tras sus componentes):
Task: "T002 Tests de GlobalNav en global-nav.test.tsx"
Task: "T004 [US1] Tests de AccountCardGrid en account-card-grid.test.tsx"

# Bloque integración:
Task: "T005 [US1] Reescritura de src/app/page.tsx (connection() + panel)"
Task: "T007 [P] [US1] Verificación de revalidatePath('/') en las 3 acciones"

# Bloque e2e (en paralelo, tras T005):
Task: "T008 [P] [US1] e2e/registro-movimientos.spec.ts"
Task: "T009 [P] [US1] e2e/edicion-movimientos.spec.ts"
Task: "T010 [P] [US1] e2e/cierre-mensual.spec.ts"
Task: "T011 [P] [US1] e2e/pagina-cuenta.spec.ts (P8 retirado)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (`GlobalNav` + tests).
2. Complete Phase 2: US1 — panel en `/`, jubilaciones y 4 specs e2e adaptadas.
3. **STOP and VALIDAR**: quickstart N1/N2/N4/N7 manualmente + `npm run test` y las 4 specs adaptadas en verde.
4. Ojo: el verde del suite e2e COMPLETO requiere US2 (resumen/anual aún usan la pasarela) — al ser la feature corta (2 US de presentación), se recomienda completar ambas antes del push de cierre.

### Incremental Delivery

1. `GlobalNav` verificable en jsdom (Phase 1).
2. Panel de `/` + tarjetas + jubilaciones → US1 valorable en navegador (MVP).
3. Nav global en las 4 páginas → US2 completa (SC-004).
4. E2e restantes + spec nueva del panel → suite íntegra en verde (SC-005).
5. Polish: docs, quickstart manual y gates finales (Definition of Done).

---

## Notes

- [P] tasks = different files, no dependencies
- [US1]/[US2] mapean cada tarea a su user story para trazabilidad
- La feature NO crea dependencias, migraciones ni código de dominio/aplicación (FR-006): `src/domain/` y `src/application/` intactos; única lectura nueva en `/` es `ListAccounts` (ya existente)
- E2e sin debilitar aserciones (FR-005): los cambios de spec se limitan a la puerta de entrada (`openAccount` por el panel) y a la fila de 011 donde la spec asertaba textos de la fila antigua; balances históricos y KPIs exactos intactos
- Aislamiento e2e (AGENTS.md): `workers: 1`, orden alfabético sobre `e2e.sqlite`; `panel-cuentas.spec.ts` es de lectura pura → sin riesgo de colisión; las specs adaptadas conservan sus combinaciones cuenta/mes
- Commit tras cada tarea o grupo lógico (Conventional Commits, en español si aporta claridad)
- Verificar los checkpoints antes de avanzar de fase
