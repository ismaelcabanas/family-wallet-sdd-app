# Tasks: KPI de ahorro acumulado del año en la página de cuenta personal

**Input**: Design documents from `/specs/035-kpi-ahorro-anual/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ (interfaces.md, ui-contract.md) ✅, quickstart.md ✅

**Tests**: Solicitados explícitamente por FR-008 (helper, caso de uso, repositorios, componente KPIs y flujo e2e propio con aislamiento cuenta/año).

**Organization**: Feature 035 = **una única user story** (US1, P1). Fase 1 setup, fase 2 fundamentales compartidos (helper + DTO + puertos/adaptadores de lectura), fase 3 US1 completa, fase 4 pulido/documentación (FR-009).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 para las tareas de la user story
- Rutas exactas en cada tarea; `src/` en la raíz del monolito (ajustado a plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Partir de una base verde y reproducible (proyecto existente; sin inicialización ni dependencias nuevas)

- [x] T001 Confirmar baseline en verde y prerrequisitos de BD según `specs/035-kpi-ahorro-anual/quickstart.md`: `npm run db:migrate && npm run db:seed` (idempotentes; 0009 es la última migración) y `npm run lint && npm run typecheck && npm run test` sin cambios de código

**Checkpoint**: Rama `feature/035-kpi-ahorro-anual` en verde antes de tocar código

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Helper compartido de la fórmula 033, DTO y puertos+adaptadores de lectura que US1 consume (data-model §1–§2, contracts/interfaces.md)

**⚠️ CRITICAL**: El caso de uso y la página de US1 no pueden empezar hasta que esta fase esté completa

- [x] T002 [P] Crear el helper puro `netMonthBalanceCents` (+ `NetMonthBalanceSavings`) en `src/application/movement/net-month-balance.ts`: `monthBalanceCents − (backedByMovement ? 0 : amountCents)` — única copia de la fórmula condicional 033 (data-model §1.2)
- [x] T003 [P] Test unitario del helper en `src/application/movement/net-month-balance.test.ts`: respaldado por movimiento → sin descuento; fila congelada legacy → descuenta `amountCents`; `MonthSavingsDTO` satisface estructuralmente `NetMonthBalanceSavings`
- [x] T004 [P] Añadir `AnnualAccumulatedSavingsDTO` (`{ accumulatedCents: number }`) en `src/application/movement/dto.ts` (data-model §1.1)
- [x] T005 Ampliar el puerto `MovementRepository.listByYearAndAccount(accountId, year)` en `src/application/movement/MovementRepository.ts` e implementarlo en `src/infrastructure/db/DrizzleMovementRepository.ts`: espejo de `listByYear` + `eq(movements.accountId)`, rango `date ∈ [${year}-01-01, ${Number(year)+1}-01-01)`, mismo `selectMonthRows` con join a tags y orden `date DESC, id DESC` (contracts §puertos) — port y adaptador en el mismo paso para mantener typecheck verde
- [x] T006 Test de repositorio para `listByYearAndAccount` en `src/infrastructure/db/DrizzleMovementRepository.test.ts` (libsql `:memory:` + migraciones de `drizzle/`): solo filas de la cuenta pedida, fronteras exactas del año (01-01 inclusivo, 01-01 del año siguiente exclusivo), DTO completo con tag unido y orden
- [x] T007 Ampliar el puerto `SavingsAllocationRepository.findDeductedMonthsOfYear(allocationId, year)` (+ `DeductedMonthEntry` `{ month, amountCents, backedByMovement }`) en `src/application/savings/SavingsAllocationRepository.ts` e implementarlo en `src/infrastructure/db/DrizzleSavingsAllocationRepository.ts`: `LEFT JOIN movements ON movement_id = movements.id`, `backedByMovement` = existencia del movimiento (fila huérfana computa como congelada, paridad `findDeductedMovement`), `month ∈ [${year}-01, ${year}-12]`, solo meses con fila (contracts §puertos)
- [x] T008 Test de repositorio para `findDeductedMonthsOfYear` en `src/infrastructure/db/DrizzleSavingsAllocationRepository.test.ts` (libsql `:memory:`): fila respaldada por movimiento existente (`backedByMovement: true`), fila huérfana (`movement_id` a movimiento borrado → `false`), filas de otros años/configs excluidas, config sin filas → array vacío

**Checkpoint**: Fundacionales listos — helper + DTO + 2 métodos de puerto con sus adaptadores Drizzle y tests en verde; el caso de uso de US1 ya puede consumirlos

---

## Phase 3: User Story 1 - Consultar el ahorro acumulado del año junto a los KPIs del mes (Priority: P1) 🎯 MVP

**Goal**: 5.ª métrica «Ahorro acumulado» (Σ con signo de los «Saldo del mes» del año natural del mes consultado) en el bloque sticky «KPIs del mes» de cuentas personales, con subtext «Año {year}» (FR-001–FR-007)

**Independent Test**: Registrar movimientos en varios meses de un año con saldos de signo mixto (positivos y negativos), abrir la cuenta personal en cualquier mes de ese año y verificar: bloque con 5 métricas, acumulado = suma de los «Saldo del mes» del año (visitando cada mes), estable al navegar meses del mismo año, distinto al cambiar de año, visible durante todo el scroll, 0,00 € en año vacío, y cuenta común sin bloque (AS-1–AS-7)

### Tests for User Story 1

> **NOTE**: Escribir primero; deben FALLAR antes de la implementación (T010, T011, T013)

- [x] T009 [P] [US1] Test del caso de uso en `src/application/movement/GetAnnualAccumulatedSavings.test.ts` (mocks de puertos): año con saldos mixtos → Σ exacta al céntimo; año vacío → `accumulatedCents: 0`; `year` fuera de `/^\d{4}$/` → `Error`; sin config de ahorro → cero deducciones; fila congelada legacy descuenta y respaldada por movimiento no descuenta (composición 033); cada mes computa como máximo una vez (FR-002/FR-003/FR-008)
- [x] T010 [P] [US1] Test del componente en `src/infrastructure/primary/ui/account-month-kpis.test.tsx` (jsdom): `dl` con 5 métricas en orden congelado (Aportación común · Gasto personal · Ahorro del mes · Saldo del mes · Ahorro acumulado), subtext «Año {year}» permanente, `0,00 €` sin estados en año vacío, acumulado negativo con signo «−» y `text-red-600`, celdas 1–4 intactas, `sm:grid-cols-5` con 5.ª celda `col-span-2 sm:col-span-1` (ui-contract §2)

### Implementation for User Story 1

- [x] T011 [US1] Crear el caso de uso `GetAnnualAccumulatedSavings` en `src/application/movement/GetAnnualAccumulatedSavings.ts`: valida `year` `/^\d{4}$/` (paridad `GetAnnualIncomeStatement`); lecturas en paralelo `listByYearAndAccount` + `findByAccountId` → `findDeductedMonthsOfYear` → mapa mes→entrada (sin fila → `{ amountCents: 0, backedByMovement: false }`); agrupa movimientos por `date.slice(0, 7)`; para `${year}-01`…`${year}-12` aplica `MonthlyClosure.fromMovements` (dominio intacto) + `netMonthBalanceCents`; devuelve `AnnualAccumulatedSavingsDTO`. Solo lectura: cero escrituras/materializaciones (FR-005) — depende de T002, T004, T005, T007; hace verde T009
- [x] T012 [US1] Añadir la 5.ª celda «Ahorro acumulado» en `src/infrastructure/primary/ui/account-month-kpis.tsx`: prop `accumulatedSavingsCents: number`, `dl` a `grid grid-cols-2 gap-3 sm:grid-cols-5`, celda nueva `col-span-2 sm:col-span-1` al final, `formatSignedCents` + `text-red-600` si < 0 (espejo «Saldo del mes»), subtext permanente `Año {month.slice(0, 4)}`; server component presentacional puro, sticky de 022 intacto, celdas 1–4 pixel-idénticas (ui-contract §2) — hace verde T010
- [x] T013 [US1] Cablear la composición en `src/app/accounts/[accountId]/page.tsx`: `year = month.slice(0, 4)`; 6.ª lectura del `Promise.all` (solo `account.type === "personal"`): `new GetAnnualAccumulatedSavings(movementRepository, savingsAllocationRepository).execute(account.id, year)`; sustituir la resta inline de la línea del «Saldo del mes» (`closure.monthBalanceCents - (savings.backedByMovement ? 0 : savings.amountCents)`) por el helper compartido `netMonthBalanceCents`; pasar `accumulatedSavingsCents={annualAccumulated.accumulatedCents}`. Los 3 awaits secuenciales de materialización quedan intactos y ANTES de las lecturas; cuenta común sin cambios (contracts §composición) — depende de T011, T012
- [x] T014 [US1] Crear el flujo e2e en `e2e/kpi-ahorro-anual.spec.ts` (serial, cuenta 2 «Cuenta de Miembro B» × **2025** + 2024-08, combinación que ningún otro spec escribe — research R7): año vacío → `0,00 €`; altas en 2025-03 y 2025-07 con saldos de signo opuesto → acumulado = suma exacta coherente con cada «Saldo del mes» visitado; estabilidad navegando meses del mismo año; cambio a 2024-08 → acumulado distinto en la misma visita; tanda de ≥ 12 movimientos + scroll a fondo → región «KPIs del mes» en viewport con el acumulado visible (SC-001); alta en otro mes del año → acumulado actualizado (FR-007); **limpieza total UI-driven final**: borrado de todos los movimientos creados y verificación de acumulado `0,00 €` (specs posteriores leen agregados de 2025) — depende de T013

**Checkpoint**: US1 completa — 5 métricas operativas, todas las suites en verde y flujo e2e determinista

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentación (FR-009, research R9) y verificación final end-to-end

- [ ] T015 [P] Actualizar documentación (FR-009): amend del bloque «Bloque KPIs sticky» de `AGENTS.md` (4 → 5 métricas, helper compartido `netMonthBalanceCents`, 6.ª lectura `GetAnnualAccumulatedSavings`), fila `035-kpi-ahorro-anual` → «Completada» en `specs/001-family-wallet/spec.md`, y `docs/architecture/overview.md` + `docs/architecture/diagrams/pagina-cuenta-sequence.md` (5.ª celda, nuevo caso de uso y métodos de puerto). Sin ADR nuevo (research R9)
- [ ] T016 Ejecutar la validación manual Q1–Q8 de `specs/035-kpi-ahorro-anual/quickstart.md` (año vacío, suma con signo, coherencia por mes, cambio de año, visibilidad continua, ciclo de actualización, lectura pura, fuera de alcance + limpieza) y los gates completos: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` (SC-005)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — primero
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEA US1
- **US1 (Phase 3)**: Depende de Phase 2 completa (helper T002, DTO T004, puertos T005/T007)
- **Polish (Phase 4)**: Depende de US1 completa (T015 puede arrancar en paralelo una vez T013 está hecho; T016 al final)

### Task Dependencies (grafo)

- T003 → tras T002 (importa el helper); T006 → tras T005; T008 → tras T007
- T011 → T002, T004, T005, T007 (consume helper, DTO y puertos) y hace verde T009
- T012 → independiente de T011 (la celda recibe el importe ya calculado); hace verde T010
- T013 → T011 + T012 (página consume caso de uso y componente)
- T014 → T013 (e2e contra la UI cableada)
- T016 → todas las demás

### User Story Dependencies

- **US1 (P1)**: Única historia; puede empezar tras Phase 2. Sin dependencias entre historias

### Parallel Opportunities

- T002, T003 [P], T004, T005 y T007 tocan ficheros distintos: T002/T004/T005/T007 en paralelo (T003 en cuanto T002 aterrice)
- T005+T006 y T007+T008 (un repositorio cada uno) son hilos independientes
- T009 y T010 (tests de US1) en paralelo: ficheros y proyectos vitest distintos (`node` vs `ui`)
- T011 y T012 en paralelo tras Phase 2 (caso de uso y celda UI no se tocan)

---

## Parallel Example: User Story 1

```bash
# Tras Phase 2, lanzar en paralelo los tests de US1 (ficheros distintos):
Task: "T009 [P] [US1] Test del caso de uso en src/application/movement/GetAnnualAccumulatedSavings.test.ts"
Task: "T010 [P] [US1] Test del componente en src/infrastructure/primary/ui/account-month-kpis.test.tsx"

# Y después sus implementaciones en paraleto (caso de uso ↔ celda UI):
Task: "T011 [US1] Crear GetAnnualAccumulatedSavings en src/application/movement/GetAnnualAccumulatedSavings.ts"
Task: "T012 [US1] 5.ª celda «Ahorro acumulado» en src/infrastructure/primary/ui/account-month-kpis.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline verde)
2. Complete Phase 2: Foundational (helper + DTO + puertos/adaptadores con tests)
3. Complete Phase 3: US1 (caso de uso → celda → página → e2e)
4. **STOP and VALIDATE**: quickstart Q1–Q8 + gates (SC-005)
5. Complete Phase 4: documentación (FR-009) y verificación final

### Incremental Delivery

1. Setup + Foundational → fundaciones listas y testeables
2. US1 → bloque KPIs a 5 métricas con e2e propio → **MVP entregable**
3. Polish → roadmap/AGENTS/docs al día → feature Done (constitución III, DoD)

---

## Notes

- [P] tasks = different files, no dependencies
- El dominio queda INTACTO: `MonthlyClosure`/`Money` se reutilizan tal cual (FR-004, constitución VII)
- La fórmula del «Saldo del mes» vive UNA vez (helper de aplicación): página y caso de uso la comparten — fin de la duplicación (FR-004, research R2)
- Cero migraciones, cero materialización, cero cambios en cuenta común/agregados/formularios (FR-005/FR-006)
- Commits Conventional Commits (`feat:`, `test:`, `docs:`) tras cada tarea o grupo lógico
- Verificar que los tests nuevos FALLAN antes de su implementación (T009→T011, T010→T012)
