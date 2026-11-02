# Tasks: Simplificación de la página de cuenta — retirada del balance acumulado y del panel de cierre

**Input**: Design documents from `/specs/025-simplificar-pagina-cuenta/` (spec.md, plan.md, research.md, data-model.md, contracts/ui-contract.md, quickstart.md)

**Prerequisites**: plan.md ✅ · spec.md ✅ (una única US P1) · research.md ✅ · data-model.md ✅ · contracts/ui-contract.md ✅

**Tests**: La feature es una retirada de presentación + barrido de código muerto; los tests existentes se re-anclan/eliminan como parte del propio cambio (FR-002/FR-004/FR-005, matriz research §8). No hay TDD: no se escribe código nuevo de producto.

**Organization**: Una única user story (US1, P1). Las fases siguen el orden del plan: cambio de página → jubilación de componentes/helper → jubilación del puerto `getBalance` + barrido de dobles → e2e → documentación → gates.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (única historia de la spec)
- Referencias a research.md §N y data-model.md §N para el detalle exacto fichero a fichero

---

## Phase 1: Setup (Baseline)

**Purpose**: Confirmar punto de partida verde antes de retirar nada.

- [X] T001 Verificar baseline en verde (`npm run lint && npm run typecheck && npm run test`) sobre la rama `feature/025-simplificar-pagina-cuenta` antes de cualquier cambio

**Checkpoint**: Base verde confirmada — se puede retirar con seguridad.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Sin tareas fundacionales**: la feature es una retirada sobre una base existente — sin esquema, sin migraciones, sin infraestructura nueva (data-model §3, FR-006). Tras T001, US1 puede empezar directamente.

---

## Phase 3: User Story 1 - Página de cuenta centrada en operar el mes, sin secciones redundantes (Priority: P1) 🎯 MVP

**Goal**: `/accounts/{id}` pasa a ser vista operativa en todas las cuentas: cabecera, stepper ‹ mes/año ›, bloque «KPIs del mes» (solo personales, contrato congelado intacto) y listado agrupado. Sin «Balance de {cuenta}» ni «Cierre de {mes}» (FR-001); barrido completo del código muerto resultante (FR-002/FR-004); e2e re-ancladas sin debilitar flujos (FR-005); documentación en el mismo cambio (FR-007).

**Independent Test**: Abrir la página de cualquier cuenta (personal y común) y verificar que no existen las regiones «Balance de {cuenta}» ni «Cierre de {mes}», que el bloque «KPIs del mes» de las personales conserva sus 4 métricas intactas y que registrar/editar/eliminar funciona igual que hoy (spec, Independent Test).

### 3.1 Retirada de secciones y lecturas condicionadas (FR-001, FR-003)

- [X] T002 [US1] Modificar `src/app/accounts/[accountId]/page.tsx`: eliminar imports de `AccountBalance` y `MonthlyClosurePanel` (`:21,27`), eliminar la lectura `accountRepository.getBalance(...)` del `Promise.all` (`:91`), eliminar los bloques de render de balance (`:138-142`) y cierre (`:144`); condicionar `GetMonthlyClosure` a `account.type === "personal" ? execute(...) : Promise.resolve(null)` (patrón de `netContribution`/`savings`, research §1) y ampliar la guarda del bloque KPI con `closure !== null`; conservar intactos los 3 awaits de materialización (`:70-87`) y las dos restas de composición 023/024 (`:122,124`) — el contrato UI resultante es `specs/025-simplificar-pagina-cuenta/contracts/ui-contract.md` §1–§3

### 3.2 Jubilación de componentes UI y helper colateral (FR-002; SC-004)

- [X] T003 [P] [US1] Eliminar `src/infrastructure/primary/ui/account-balance.tsx` y su test `src/infrastructure/primary/ui/account-balance.test.tsx` (4 tests)
- [X] T004 [P] [US1] Eliminar `src/infrastructure/primary/ui/monthly-closure-panel.tsx` y su test `src/infrastructure/primary/ui/monthly-closure-panel.test.tsx` (6 tests)
- [X] T005 [US1] Jubilar `monthEndIsoDate` de `src/infrastructure/primary/ui/format.ts` (`:55`) y sus 2 tests de `src/infrastructure/primary/ui/format.test.ts` (`:117-125`); conservar `shiftMonth` (lo usa `MonthStepper`) — research §3.5

### 3.3 Jubilación del puerto `getBalance` y barrido de dobles (FR-004; SC-004)

- [X] T006 [US1] Eliminar `getBalance(id, asOf?)` de `src/application/account/AccountRepository.ts` (`:10`) — el puerto queda con `findAll`, `findById`, `findByName`, `update` (data-model §1.2)
- [X] T007 [US1] Eliminar la implementación `getBalance` de `src/infrastructure/db/DrizzleAccountRepository.ts` (`:70-83`)
- [X] T008 [US1] Retirar los 5 tests de `getBalance` de `src/infrastructure/db/DrizzleRepositories.test.ts` (`:120-218`); el resto del fichero intacto
- [X] T009 [P] [US1] Re-anclar el test de visibilidad de `src/infrastructure/db/DrizzleRegularIncomeRepository.test.ts` (`:121-136`): conservar solo la mitad `listByMonthAndAccount` (retirar la aserción `getBalance` `:134-136`) y renombrar el test en consecuencia (research §3.3)
- [X] T010 [P] [US1] Re-anclar el test de visibilidad de `src/infrastructure/db/DrizzleCommonContributionRepository.test.ts` (`:133-148`): ídem T009 — solo `listByMonthAndAccount`, renombrado
- [X] T011 [US1] Retirar `getBalance` de los 10 dobles de `AccountRepository` en tests de aplicación: `src/application/account/ListAccounts.test.ts:15`, `src/application/account/RenameAccount.test.ts:21`, `src/application/movement/GetGlobalMonthlySummary.test.ts:73`, `src/application/movement/GetAnnualIncomeStatement.test.ts:106`, `src/application/movement/UpdateMovement.test.ts:86`, `src/application/movement/CreateMovement.test.ts:82`, `src/application/savings/ConfigureSavingsAllocation.test.ts:99-101`, `src/application/common-contribution/ConfigureCommonContribution.test.ts:103-105`, `src/application/common-contribution/MaterializeCommonContributions.test.ts:240-242`, `src/application/regular-income/ConfigureRegularIncome.test.ts:69-71` (research §3.4)
- [X] T012 [US1] Verificación intermedia del barrido: `npm run typecheck && npm run test` en verde y grep con 0 apariciones de `getBalance` en `src/` (la interfaz reducida fuerza el barrido completo; research §3)

**Checkpoint**: Página simplificada operativa; `GetMonthlyClosure` intacto (unit tests en verde, FR-003); 0 código muerto en `src/`.

### 3.4 E2E: retirada y re-anclaje sin debilitar flujos (FR-005; tabla research §4)

- [X] T013 [US1] Eliminar `e2e/cierre-mensual.spec.ts` (su sujeto UI desaparece; la aritmética del cierre sigue cubierta por unit tests de `GetMonthlyClosure` + e2e de KPIs 022-024, research §6)
- [X] T014 [P] [US1] Re-anclar `e2e/pagina-cuenta.spec.ts`: P1 → región «KPIs del mes» visible + etiqueta pasiva «Abril de 2026»; P2 (`:181` `/^-120,00/`) y P3 (`:195` `/^0,00/`) → celda KPI «Saldo del mes» (helper `balanceCell` estilo `kpis-fijos-cuenta.spec.ts:62-64`); recalcular índices del chequeo de orden `main > *` (`:138-150`) al desaparecer las secciones finales
- [X] T015 [P] [US1] Re-anclar `e2e/edicion-movimientos.spec.ts`: helper `selectMonth` (`:17-24`) → esperar al combobox «Mes visible» con `toContainText` (patrón `resumen-global.spec.ts:17-21`); E1 (`:108-110`) y E2 (`:138-142`) → celda KPI «Gasto personal» = **78,50** (mes exclusivo Agosto 2026, naturaleza personal); eliminar helper `closurePanel` (`:7-9`)
- [X] T016 [P] [US1] Re-anclar `e2e/gestion-tags.spec.ts`: `selectMonth` (`:21-28`) → combobox; totales 80,00 (G2 `:104-109,138-148`) → celda KPI «Gasto personal»; desglose por tag (G4 `:200-211`, supermercado 50,00) → filas del listado con importe firmado; G5 (`:249-251`) → conservar solo las aserciones de fila (`:243-248`); eliminar helper `closurePanel` (`:7-9`)
- [X] T017 [P] [US1] Re-anclar `e2e/creacion-tags.spec.ts`: `selectMonth` (`:13-20`) → combobox «Mes visible» (única referencia al cierre)
- [X] T018 [P] [US1] Re-anclar `e2e/ingresos-regulares.spec.ts`: R2 checksum de idempotencia (`:92-93,111-114`) → celda KPI «Saldo del mes» = **+2000,00 €** (cuenta A personal, mes solo con el ingreso materializado; sin ahorro → neto = bruto), patrón before/after conservado
- [X] T019 [P] [US1] Re-anclar `e2e/registro-movimientos.spec.ts`: E1 (`:143` balance histórico absoluto de la común) → conteo de filas `[data-testid="movement-item"]` = **4**; E2 (`:162`) → celda KPI saldo **−120,50 €** explícita; E3 (`:176` dd «Ingresos» del cierre) → celda KPI saldo **+1379,50 €** (determinista; la fila `+1500,00` ya se aserta en `:174`) — el flujo crítico de registro sigue cubierto end-to-end (constitución III)
- [X] T020 [P] [US1] Re-anclar `e2e/kpis-fijos-cuenta.spec.ts`: eliminar el contraste KPI ↔ panel de cierre de K2 (`:195-201`; la aserción KPI `:191-193` ya existe — coherencia por construcción tras 025) y borrar el helper muerto `kpiBalanceText`
- [X] T021 [P] [US1] Re-anclar `e2e/cuenta-kpi-gasto-personal.spec.ts`: eliminar la pierna del cierre de la identidad G2 (`:251-258`; KPI 200,55 y saldo +1299,45 ya asertados en `:245-249`); conservar **intactos** G1 (barrido defensivo) y G7 (restauración `:372-377`) — G7 alimenta a `porcentaje-ahorro.spec.ts` A2 (cadena de estado B, research §4)
- [X] T022 [P] [US1] Re-anclar `e2e/porcentaje-ahorro.spec.ts`: A2 (`:184-191`) → bruto = Σ importes firmados de las filas del listado del mes (parse con `parseEurCents` existente); neto esperado = bruto − 300,00 → celda KPI «Saldo del mes»; eliminar helper `closureRegion` (`:68-70`) — autónomo del estado upstream
- [X] T023 [P] [US1] Re-anclar `e2e/panel-cuentas.spec.ts`: N1 (`:57`) guarda negativa «Cierre de» count 0 en `/` → guarda equivalente región «KPIs del mes» count 0 en `/` (paridad con la guarda «Movimientos del mes» `:56`)
- [X] T024 [US1] Ejecutar la suite e2e completa (`npm run test:e2e`) y verificar verde con `workers: 1` y el flujo crítico de registro cubierto end-to-end (SC-002)

**Checkpoint**: Suite e2e re-anclada en verde conservando flujos, importes y combinaciones cuenta/mes.

### 3.5 Documentación en el mismo cambio (FR-007; research §7)

- [X] T025 [US1] Actualizar `AGENTS.md`: (1) párrafo **E2E** — re-justificar aislamiento (BD compartida determinista + cadenas de estado entre ficheros; desaparece el motivo «balance histórico absoluto», `workers: 1` y combinaciones cuenta/mes se mantienen); (2) párrafo **Materialización perezosa** — «cubren listado, cierre y balance» → «cubren listado y KPIs»; (3) párrafo **KPIs sticky 022/024** — re-expresar el cierre como fuente interna de composición (sin panel visible); (4) párrafo **023** — «(cierre/resumen/anual/balance intactos)» → «(resumen/anual intactos)»; (5) añadir convención corta «Página de cuenta = vista operativa (025)»: stepper + KPIs (personales) + listado; consulta agregada en `/summary` y `/annual`
- [X] T026 [P] [US1] Marcar fila `025` como **Completada** en el roadmap maestro `specs/001-family-wallet/spec.md` (las notas históricas 011/020 no se reescriben: la fila 025 es el registro de supersession)
- [X] T027 [P] [US1] Actualizar `docs/architecture/overview.md` (líneas 68, 103, 115, 145, 151, 160): puerto sin `getBalance`, composición de la página sin balance/cierre, componentes retirados, helper `monthEndIsoDate` jubilado, índice de diagramas
- [X] T028 [P] [US1] Actualizar `docs/architecture/diagrams/pagina-cuenta-sequence.md` (intro `:3`, pasos `getBalance` `:37-39`, render `:56`, revalidación `:64,70`, nota de coherencia `:72`) y `docs/architecture/diagrams/c4.md` (`:17` relación user, `:44` «SUM de balance», `:60` componente panel, `:76,114-115` página/puertos)
- [X] T029 [P] [US1] Actualizar notas de `docs/architecture/diagrams/panel-cuentas-sequence.md` (`:30,81`), `ingreso-regular-secuencia.md` (`:33,39`), `aportacion-comun-secuencia.md` (`:43,49`), `registro-movimiento-sequence.md` (`:74`) y `domain-model.md` (`:415` «Balance: query derivada»)
- [X] T030 [P] [US1] Añadir notas de jubilación (2026-11-02, feature 025) a `docs/architecture/adr/0009-balance-derivado-no-persistido.md` (puerto `getBalance` y UI del balance jubilados sin sustituto; el principio de vistas derivadas sigue vigente) y `docs/architecture/adr/0010-cierre-mensual-servicio-dominio.md` (panel UI retirado; `GetMonthlyClosure` sobrevive como fuente interna de KPIs) — sin reescribir los cuerpos ni crear ADR nuevo
- [X] T031 [P] [US1] Corregir `README.md:8`: retirar la mención caducada «balance acumulado por cuenta» en `/` (stale desde 012)

**Checkpoint**: US1 completa — documentación viva coherente con el código (DoD, constitución III.3).

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Gates finales y validación de los criterios de éxito.

- [X] T032 Ejecutar gates completos en verde: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` (SC-002)
- [X] T033 Verificar SC-004 por grep: 0 apariciones de `AccountBalance`, `MonthlyClosurePanel`, `getBalance` y `monthEndIsoDate` en `src/` (research §8)
- [X] T034 Validar manualmente Q1–Q6 de `specs/025-simplificar-pagina-cuenta/quickstart.md` (`npm run db:migrate && npm run seed && npm run dev`): personal sin balance/cierre con 4 KPIs, común sin agregados, ciclo operativo intacto, mes vacío, materialización intacta, `/summary` y `/annual` idénticos

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — punto de partida verde obligatorio (T001).
- **Foundational (Phase 2)**: sin tareas (retirada sobre base existente).
- **US1 (Phase 3)**: depende de T001. **Orden estricto entre sub-fases**:
  - 3.1 (T002) **antes** de 3.2: los componentes solo se borran cuando `page.tsx` deja de importarlos.
  - 3.2 y 3.3 pueden intercalarse, pero T006–T011 (puerto + barrido) van juntos y cierran con T012.
  - 3.4 (e2e) después de 3.1–3.3: las anclas nuevas (celdas KPI, combobox, filas) solo existen tras el cambio de página.
  - 3.5 (docs) después de 3.4: documenta el estado final (incluida la re-justificación del aislamiento e2e).
- **Polish (Phase 4)**: depende de todo lo anterior.

### Within Each Sub-phase

- T002 es el único cambio de producto; todo lo demás son jubilaciones y re-anclajes derivados.
- T006 → T007 → T008 → T011: retirar el método del puerto, su implementación, sus tests y los 10 dobles en el mismo ciclo (el typecheck sobre la interfaz fuerza el barrido completo — research §3).
- T021 (G1/G7 de la cadena de estado B) se conserva intacto: `porcentaje-ahorro.spec.ts` (T022) depende del estado restaurado por G7.
- Eliminar `cierre-mensual.spec.ts` (T013) no altera el orden alfabético relativo de los demás ficheros.

### Parallel Opportunities

- T003 ∥ T004 (ficheros UI independientes).
- T009 ∥ T010 (ficheros de test de repositorio independientes).
- T014–T023: las 10 specs e2e re-ancladas son ficheros independientes ([P]); en este flujo single-agent se ejecutan en el orden listado.
- T026–T031: documentación en ficheros independientes ([P]).

---

## Parallel Example: User Story 1

```bash
# Jubilaciones de componentes (ficheros independientes):
Task: "Eliminar src/infrastructure/primary/ui/account-balance.tsx (+ test)"
Task: "Eliminar src/infrastructure/primary/ui/monthly-closure-panel.tsx (+ test)"

# Re-anclaje de tests de visibilidad (ficheros independientes):
Task: "Re-anclar DrizzleRegularIncomeRepository.test.ts a listByMonthAndAccount"
Task: "Re-anclar DrizzleCommonContributionRepository.test.ts a listByMonthAndAccount"

# Documentación (ficheros independientes):
Task: "Actualizar docs/architecture/overview.md"
Task: "Actualizar docs/architecture/diagrams/pagina-cuenta-sequence.md + c4.md"
Task: "Notas de jubilación en ADR 0009/0010"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: baseline verde.
2. Complete 3.1–3.3: página simplificada + barrido de código muerto (SC-001/SC-004 parcial).
3. Complete 3.4: suite e2e re-anclada en verde (SC-002).
4. Complete 3.5 + Phase 4: documentación + gates + quickstart.
5. **STOP and VALIDATE**: Q1–Q6 de quickstart.md + grep SC-004 — la feature es una única US, el MVP es la feature completa.

### Incremental Delivery (checkpoints de seguridad)

- Tras T012: la app ya es la vista operativa de 025 (e2e aún rojas por las anclas viejas — esperado).
- Tras T024: toda la suite en verde; commit lógico sugerido.
- Tras T034: feature entregable; `/speckit.finish` cierra el ciclo (PR → merge → fila 025 Completada ya marcada en T026).

---

## Notes

- [P] tasks = different files, no dependencies.
- **FR-006/invariantes**: `GetMonthlyClosure` queda **byte a byte igual** (FR-003); `/summary`, `/annual`, materializaciones (018/019/021/023), formularios y menús ⋮ no se tocan.
- Sin migraciones ni cambios de esquema (data-model §3); sin ficheros nuevos de producto.
- Commits Conventional Commits tras cada grupo lógico (`refactor:`, `test:`, `docs:`); auto-commits de Spec Kit habilitados (AGENTS.md).
- Verificar gates (`npm run lint`, `npm run typecheck`, `npm run test`) antes de dar por terminado cualquier cambio de código (AGENTS.md, regla 3).
