---
description: "Task list for feature 022 implementation"
---

# Tasks: KPIs fijos y destacados en la página de cuenta personal

**Input**: Design documents from `/specs/022-kpis-fijos-cuenta/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-010 los exige explícitamente (tests de aplicación del caso de uso, tests de componente del bloque de KPIs con la tabla de casos congelada, y flujo e2e propio con aislamiento cuenta/mes; constitución III). En rojo primero donde la feature añade código nuevo (`GetMonthNetContribution`, `AccountMonthKpis`); la modificación de `pagina-cuenta` P1 se escribe contra el ui-contract congelado.

**Organization**: Una única user story pequeña (US1, P1 — constitución II, sin excepción): consultar de un vistazo y de forma continua la aportación neta del mes y el saldo del mes en la página de cuenta personal. El cambio baja por las capas en la dirección de dependencias (VII): caso de uso de lectura `GetMonthNetContribution` + `MonthNetContributionDTO` en aplicación (reusando puertos existentes, sin recálculo del neto) → componente servidor presentacional `AccountMonthKpis` (sticky CSS puro, sin selector dentro) → composición en la página (solo cuentas personales) → e2e en fichero propio. Dominio, esquema, puertos, repositorios, actions, formularios y agregados: **intactos** (FR-005/FR-008/FR-009).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js (App Router): `src/` en la raíz del repositorio; e2e en `e2e/`; docs vivos en `docs/architecture/`; roadmap maestro en `specs/001-family-wallet/spec.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar línea base verde y la rama feature antes de tocar código.

- [X] T001 Verificar línea base verde ejecutando `npm run lint && npm run typecheck && npm run test` (todo debe pasar antes de cualquier cambio)
- [X] T002 Confirmar la rama `feature/022-kpis-fijos-cuenta` activa y el árbol limpio (creada por la extensión git de Spec Kit)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la fase fundacional.

---

## Phase 2: Foundational (Aplicación — bloquea US1)

**Purpose**: Vertical del caso de uso de lectura: `GetMonthNetContribution` con `MonthNetContributionDTO { configured, amountCents }` sobre los puertos existentes (`findByAccountId`, `findMaterializedMovement` de 019/021), **sin recálculo del neto** — el importe es exactamente el del movimiento materializado enlazado (invariante FR-006). Sin puertos nuevos, sin dominio, sin esquema, sin repositorios: cero migraciones.

**Nota**: Conceptualmente estas tareas sirven solo a US1, pero no llevan label de historia: son prerrequisito compartido (aplicación) del componente UI y del enganche en la página.

### Test primero (en rojo)

- [X] T003 [P] Crear `src/application/common-contribution/GetMonthNetContribution.test.ts` (rojo, proyecto node, dobles in-memory del puerto `CommonContributionRepository` al estilo de `GetCommonContribution.test.ts`): tabla de casos congelada de data-model §1.2 — sin fila de config → `{ configured: false, amountCents: 0 }`; config activa + movimiento enlazado → importe exacto del movimiento (p. ej. 37945); config activa sin fila del registro (retirada por neto 0 / mes futuro / fuera de ventana) → `{ configured: true, amountCents: 0 }`; config + fila con movimiento borrado por el usuario → `{ configured: true, amountCents: 0 }`; mes inválido (no `YYYY-MM`) → throw `Error` (paridad con `GetMonthlyClosure`); ejecutar y confirmar rojo

### Implementación

- [X] T004 Implementar `src/application/common-contribution/GetMonthNetContribution.ts` exportando `MonthNetContributionDTO { configured: boolean; amountCents: number }` junto a la clase (data-model §1.2): flujo 0) validar `month` contra `/^\d{4}-(0[1-9]|1[0-2])$/` → `throw Error`; 1) `config = findByAccountId(accountId)`; 2) `config === null || config.id === null` → `{ configured: false, amountCents: 0 }`; 3) `movement = findMaterializedMovement(config.id, month)`; 4) → `{ configured: true, amountCents: movement?.amount.amountCents ?? 0 }` — sin recálculo del neto, sin nuevos puertos ni disparadores de materialización (FR-006/FR-008); verificar T003 en verde
- [X] T005 Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (cambio quirúrgico: aplicación es módulo puro, ninguna suite existente se toca)

**Checkpoint**: Caso de uso de lectura completo y testeado: el DTO «configurada ⇔ importe» vive en aplicación; el componente UI puede consumirlo ya.

---

## Phase 3: User Story 1 - Consultar aportación neta y saldo del mes de forma continua (Priority: P1) 🎯 MVP

**Goal**: Cada página de **cuenta personal** muestra, entre el selector ‹ mes/año › y el listado, un bloque «KPIs del mes» sticky (CSS `position: sticky`, selector NO incluido) con la **aportación común** neta (`formatAmountCents`, «Sin aportación configurada» si `!configured`) y el **saldo del mes** (`formatSignedCents`, rojo si < 0) del mes consultado; la cuenta común no consulta el caso de uso ni renderiza el bloque (FR-001–FR-005). El saldo reutiliza `closure.monthBalanceCents` del mismo render (cero cálculo nuevo) y la aportación se lee tras la materialización intacta (FR-006/FR-008).

**Independent Test**: Quickstart Q1–Q8: sin aportación → «Sin aportación configurada» + 0,00 €; ingreso 2.000,00 + 25 % → KPI 500,00 € idéntico al movimiento del listado; gasto común 120,55 → 379,45 €; saldo del mes = fila «Saldo del mes» del cierre; 50+ movimientos con la barra fijada en todo el scroll; ‹ mes anterior → 0,00 € sin subtexto + › vuelta restaura valores; neta cero por gastos ≥ bruto → 0,00 € sin subtexto; mes vacío → saldo 0,00 €; cuenta común sin la región «KPIs del mes».

### Test primero (en rojo)

- [X] T006 [P] [US1] Crear `src/infrastructure/primary/ui/account-month-kpis.test.tsx` (rojo, proyecto ui/jsdom, render directo del server component como función, al estilo de `account-balance.test.tsx`): casos FR-010 — con aportación (`configured: true, amountCents: 37945`) → «Aportación común» 379,45 € sin subtexto; sin configuración (`configured: false`) → 0,00 € + subtexto «Sin aportación configurada»; neto cero con config (`amountCents: 0`) → 0,00 € **sin** subtexto; saldo negativo (`monthBalanceCents: -5120`) → «−51,20 €» con clase `text-red-600`; mes vacío (`monthBalanceCents: 0`) → saldo 0,00 €; etiqueta pasiva del mes consultado visible (`monthLabel("2026-10")` → «Octubre de 2026»); región accesible `section[aria-labelledby="account-month-kpis-title"]` con `h2` «KPIs del mes»; clases sticky (`sticky`, `top-0`, `z-20`) y grid de 2 columnas (`grid-cols-2`) en el `dl`; ejecutar y confirmar rojo

### Implementation para US1

- [X] T007 [US1] Implementar `src/infrastructure/primary/ui/account-month-kpis.tsx` (server component presentacional puro, props `{ netContribution: MonthNetContributionDTO; monthBalanceCents: number; month: string }`) según contracts/ui-contract §1–§4: `<section aria-labelledby="account-month-kpis-title">` con fondo sangrado `sticky top-0 z-20 -mx-4 bg-background px-4 sm:-mx-6 sm:px-6` y tarjeta interior `rounded-lg border bg-card p-4`; cabecera con `<h2>` «KPIs del mes» + etiqueta pasiva `monthLabel(month)` en `text-xs text-muted-foreground`; `dl` en `grid grid-cols-2 gap-3` con `dt text-xs text-muted-foreground` / `dd text-xl font-semibold tabular-nums`: «Aportación común» → `formatAmountCents(netContribution.amountCents)` + `p.text-xs.text-muted-foreground` «Sin aportación configurada» solo si `!netContribution.configured`; «Saldo del mes» → `formatSignedCents(monthBalanceCents)` con `text-red-600` si < 0; sin JS, sin estado cliente; verificar T006 en verde
- [X] T008 [US1] Modificar `src/app/accounts/[accountId]/page.tsx`: añadir al `Promise.all` (quinto elemento) `new GetMonthNetContribution(commonContributionRepository).execute(AccountId(account.id), month)` **solo si `account.type === "personal"`** (para `shared` ni se consulta ni se renderiza; FR-005) y renderizar `<AccountMonthKpis netContribution={…} monthBalanceCents={closure.monthBalanceCents} month={month} />` entre `<MonthStepper>` y `<GroupedMovementList>` únicamente en cuentas personales; el saldo viaja del `closure` ya obtenido (cero cálculo nuevo); los dos `await` de materialización y el resto del orden/lecturas quedan intactos (FR-007/FR-008)
- [X] T009 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde; con `npm run dev`, humo del flujo (cuenta personal con ingreso 2.000,00 + 25 % → KPIs 500,00 € / −500,00 €; gasto común 120,55 → 379,45 €; cuenta común sin bloque)

**Checkpoint**: US1 funcional end-to-end: los dos KPIs visibles, sticky y exactos en cada cuenta personal; suites de aplicación y componentes en verde.

---

## Phase 4: E2E del flujo crítico (FR-010, constitución III)

**Purpose**: Spec nueva en fichero propio con la única combinación viable verificada contra la matriz de ocupación e2e (**Cuenta de Miembro A (`/accounts/1`) + mes en curso real**, research §6): «k» corre tras `ingresos-regulares` (que limpia A) y antes de `pagina-cuenta`; la **limpieza total UI-driven** al final (desactivar aportación → desactivar ingreso regular → borrar todos los movimientos → listado vacío) restaura el baseline 0,00 de A que `registro-movimientos` aserta después. Además, el único cambio contractual del layout: `pagina-cuenta` P1 actualiza su aserción de orden (selector → KPIs → listado).

- [X] T010 [US1] Crear `e2e/kpis-fijos-cuenta.spec.ts` (serial, helpers locales al estilo de 019/021) con el flujo congelado K0–K7 de research §6: K0 estado inicial de A sin config → región «KPIs del mes» visible, «Sin aportación configurada» + 0,00 € y saldo 0,00 €; K1 configurar ingreso regular **2.000,00 (rellenado explícito: 018-R3 deja 2.100 pre-rellenado)** + aportación 25 % → KPIs 500,00 € / −500,00 €; K2 gasto común 120,55 → 379,45 € / −500,00 € + coherencia textual de ambos KPIs con el cierre del mes; K3 ‹ al mes anterior → aportación 0,00 € **sin** subtexto (fuera de ventana) y saldo 0,00 € con etiqueta del mes anterior, › vuelta → valores del mes en curso restaurados (SC-004); K4 tanda continua de ≥ 12 movimientos + scroll a fondo con la región de KPIs en viewport (visibilidad continua); K5 gasto común 400,00 (Σ 520,55 ≥ 500) → aportación retirada del listado y KPI 0,00 € sin subtexto; K6 `/accounts/3` (cuenta común) sin la región «KPIs del mes» (FR-005); K7 limpieza total UI-driven (desactivar aportación → desactivar ingreso regular → borrar todos los movimientos creados → listado vacío, configs desactivadas)
- [X] T011 [US1] Actualizar la aserción de orden de P1 en `e2e/pagina-cuenta.spec.ts` (líneas ~138-148): el bloque KPIs (`aria-labelledby="account-month-kpis-title"`) queda entre selector y listado en la cuenta personal B — extender `evaluateAll` con `kpiIndex` y asertar `listIndex === stepperIndex + 2` y `kpiIndex === stepperIndex + 1` (único cambio contractual del layout; research §4)
- [X] T012 [US1] Ejecutar `npm run test:e2e` y verificar las 13 specs en verde (las 12 existentes sin cambios de comportamiento esperados — solo P1 ajustada; orden alfabético y `workers: 1` intactos)

**Checkpoint**: Flujo crítico «cuenta personal con aportación y gastos comunes → KPIs visibles y exactos al recorrer el listado → cambio de mes actualiza los KPIs → cuenta común sin bloque» cubierto end-to-end (SC-001/SC-004/SC-005).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva y cierre de la feature en el mismo cambio (constitución III DoD, FR-011, research §8).

- [X] T013 [P] Actualizar `AGENTS.md`: nueva convención de UI «bloque KPIs sticky en cuentas personales» junto a las existentes (diálogos por fila, tarjetas lanzaderas): primer uso de `position: sticky` del repo — componente servidor presentacional puro, `sticky top-0 z-20` con fondo sangrado, sin selector dentro, fuente de datos exclusivamente casos de uso (`GetMonthNetContribution` + `closure.monthBalanceCents`, nunca recálculo en UI)
- [X] T014 [P] Actualizar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-011): fila `022-kpis-fijos-cuenta` → **Completada** con nota datada 2026-10 resumiendo el resultado (bloque sticky de aportación neta y saldo del mes en cuentas personales; lectura del movimiento enlazado, sin recálculo; cuenta común y agregados intactos)
- [X] T015 [P] Ampliar `docs/architecture/diagrams/pagina-cuenta-sequence.md` con el bloque KPIs reutilizando los diagramas de diseño del plan (§Diagramas) como base (regla anti-drift; research §8)
- [X] T016 Validar manualmente los escenarios Q1–Q8 de `specs/022-kpis-fijos-cuenta/quickstart.md` con `npm run dev` sobre BD migrada y sembrada (`npm run db:migrate && npm run db:seed`)
- [X] T017 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-005, DoD)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — se empieza inmediatamente.
- **Foundational (Phase 2)**: Depende de Setup — **BLOQUEA** US1 (el componente consume `MonthNetContributionDTO`).
- **User Story 1 (Phase 3)**: Depende de Phase 2 completa (T003–T005).
- **E2E (Phase 4)**: Depende de Phase 3 completa (el flujo ejercita la UI integrada).
- **Polish (Phase 5)**: Depende de todas las fases anteriores con la feature funcional.

### User Story Dependencies

- **US1 (P1)**: Única historia de la feature (constitución II). Su vertical completa es Fase 2 (aplicación) + Fase 3 (UI/página) + Fase 4 (e2e). Sin dependencias entre historias.

### Within Each User Story

- Tests en rojo antes de la implementación que los cumple (T003 → T004; T006 → T007).
- Aplicación antes que UI (dirección de dependencias, constitución VII): T004 antes de T007/T008.
- Componente antes que composición en página (T007 antes de T008).
- E2e nuevo (T010) y ajuste contractual (T011) tras la integración (T008).

### Parallel Opportunities

- T003 (test de aplicación) y T006 (test de componente) pueden escribirse en paralelo una vez T001/T002 en verde: ficheros distintos, rojos independientes (el test de componente importa el tipo `MonthNetContributionDTO` que T004 define; si se adelanta, basta con declarar el tipo esperado en el test — el contrato está congelado en data-model §1.2).
- T013, T014 y T015 (documentación) son paralelos entre sí: ficheros distintos.
- T010 y T011 tocan ficheros e2e distintos, pero se validan juntos en T012.

---

## Parallel Example: User Story 1

```bash
# Tests en rojo en paralelo (ficheros distintos, contratos congelados):
Task: T003 "Crear src/application/common-contribution/GetMonthNetContribution.test.ts (rojo)"
Task: T006 "Crear src/infrastructure/primary/ui/account-month-kpis.test.tsx (rojo)"

# Documentación en paralelo al final:
Task: T013 "Actualizar AGENTS.md"
Task: T014 "Actualizar specs/001-family-wallet/spec.md"
Task: T015 "Ampliar docs/architecture/diagrams/pagina-cuenta-sequence.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (línea base verde)
2. Complete Phase 2: Foundational (`GetMonthNetContribution` + DTO testeados)
3. Complete Phase 3: User Story 1 (bloque sticky visible y exacto)
4. **STOP and VALIDATE**: Quickstart Q1–Q8 + gates en verde
5. Deploy/demo si procede

### Incremental Delivery

1. Setup + Foundational → caso de uso de lectura listo
2. US1 (UI + página) → **MVP**: KPIs destacados y continuos en cuentas personales
3. E2e (K0–K7 + P1) → flujo crítico cubierto (SC-005)
4. Polish (AGENTS.md, roadmap, diagramas, quickstart, gates) → feature cerrada (FR-011, DoD)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to US1 for traceability
- Sin migraciones, sin puertos nuevos, sin actions: si la implementación cree necesitarlos, ALTO y revalidar contra plan.md (la feature es lectura/UI pura)
- Verificar que los tests fallan antes de implementar (T003, T006)
- Commit tras cada tarea o grupo lógico (Conventional Commits; hooks de Spec Kit activos)
- Los gates `npm run lint && npm run typecheck && npm run test` deben quedar en verde antes de dar por terminado cualquier cambio de código (AGENTS.md regla 3)
