---
description: "Task list for feature 016 implementation"
---

# Tasks: Listado de movimientos bajo el selector de fechas

**Input**: Design documents from `/specs/016-movimientos-bajo-selector-fechas/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos solo los que el plan pide explícitamente (research §3): una aserción e2e de adyacencia selector→listado añadida a `pagina-cuenta.spec.ts` P1. Sin specs e2e nuevas ni tests unitarios/RTL nuevos (los existentes son agnósticos del orden de la página).

**Organization**: Feature de presentación pura con una única user story (US1, P1). Sin cambios de dominio, aplicación, persistencia ni datos (FR-003); convenciones del listado intactas (FR-004).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js (App Router): `src/` en la raíz del repositorio; e2e en `e2e/`; docs vivos en `docs/architecture/`; roadmap maestro en `specs/001-family-wallet/spec.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar línea base verde antes de tocar código (FR-005 parte de suites en verde).

- [x] T001 Verificar línea base verde ejecutando `npm run lint && npm run typecheck && npm run test` (todo debe pasar antes de cualquier cambio)

**Checkpoint**: Repositorio en verde; se puede empezar US1.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prerrequisitos bloqueantes para las user stories.

**Sin tareas**: la feature es una reordenación de JSX en un único fichero (`src/app/accounts/[accountId]/page.tsx`); no hay infraestructura, esquemas ni componentes nuevos (FR-003). US1 puede empezar tras Phase 1.

**Checkpoint**: US1 desbloqueada.

---

## Phase 3: User Story 1 - Leer el mes de la cuenta sin desplazarme (Priority: P1) 🎯 MVP

**Goal**: En `/accounts/[accountId]?month=`, el listado de movimientos del mes (o su estado vacío) aparece inmediatamente debajo de `MonthStepper`; balance, formulario y cierre quedan debajo conservando su orden relativo (FR-001/FR-002).

**Independent Test**: Abrir `/accounts/2?month=2026-04` y verificar que entre el selector de mes/año y `region "Movimientos del mes"` no hay ningún bloque, y que balance/formulario/cierre siguen presentes y operativos más abajo (quickstart Q1–Q5).

### Tests for User Story 1

> **NOTE: Escribir la aserción PRIMERO y verificar que FALLA contra el orden actual** (balance, formulario y cierre hoy intermedios entre selector y listado). Refuerza FR-001; no debilitar ninguna aserción existente (FR-005).

- [x] T002 [US1] Añadir aserción de adyacencia y viewport a P1 en `e2e/pagina-cuenta.spec.ts`: sobre los hijos directos de `main`, verificar que entre `MonthStepper` (`combobox "Mes visible"`) y `region "Movimientos del mes"` no se interpone ningún bloque (balance/formulario/cierre), y que el primer `heading level 3` del listado está en el mismo viewport que el stepper (`toBeInViewport`, SC-002); ejecutarla y confirmar que falla (roja) contra la composición actual

### Implementation for User Story 1

- [x] T003 [US1] Reordenar el JSX de `src/app/accounts/[accountId]/page.tsx`: mover el bloque `<GroupedMovementList …>` (líneas 95-101 actuales) a la posición inmediatamente posterior a `<MonthStepper … />`, dejando el orden `h1`+`GlobalNav` → subtítulo de tipo → `MonthStepper` → `GroupedMovementList` → `AccountBalance` → `MovementForm` → `MonthlyClosurePanel`; sin cambiar props, componentes hijos, acciones ni consultas (FR-003/FR-004)
- [x] T004 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (suites unitarias/RTL intactas: no dependen del orden de la página)
- [x] T005 [US1] Ejecutar `npm run test:e2e` y verificar todas las specs existentes en verde, incluida la nueva aserción de adyacencia de P1 (T002 ahora verde sobre el orden list-first)
- [x] T006 [US1] Validar manualmente los escenarios Q1–Q5 de `specs/016-movimientos-bajo-selector-fechas/quickstart.md` con `npm run dev` (orden de bloques, cambio de mes, alta/edición/eliminación operativas, mes vacío dentro del listado, `/`+`/summary`+`/annual` intactas)

**Checkpoint**: Página de cuenta list-first funcional con el 100 % de la operativa previa y pruebas en verde (SC-001–SC-004).

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva y roadmap actualizados en el mismo cambio (constitución III, DoD; research §4).

- [x] T007 [P] Actualizar la línea de render (línea 29) en `docs/architecture/diagrams/pagina-cuenta-sequence.md` al nuevo orden (h1 + subtítulo, MonthStepper, GroupedMovementList, AccountBalance, MovementForm, cierre), reutilizando como base el diagrama de secuencia de `specs/016-movimientos-bajo-selector-fechas/plan.md`
- [x] T008 [P] Actualizar la composición de la página de cuenta (bloque UI de `/accounts/[id]`) en `docs/architecture/overview.md` para reflejar el orden list-first (selector → listado → balance → formulario → cierre)
- [x] T009 [P] Marcar la fila `016-movimientos-bajo-selector-fechas` como «Completada» en la tabla de features de `specs/001-family-wallet/spec.md` (la fila 013 ya está reducida al CTA con diálogo; sin cambios de texto en ella)

**Checkpoint**: Documentación viva y roadmap sincronizados con la implementación.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Sin tareas (presentación pura, FR-003).
- **US1 (Phase 3)**: Depende de Phase 1 (línea base verde).
- **Polish (Phase 4)**: Depende de US1 completa (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US1 (P1)**: Única historia; sin dependencias entre historias. Internamente: T002 (roja) → T003 (verde) → T004 → T005 → T006.

### Within Each User Story

- La aserción e2e se escribe primero y FALLA contra el orden actual (T002) antes de reordenar (T003).
- Reordenación antes de ejecutar gates (T004/T005).
- Validación manual (T006) al final, con la funcionalidad completa.

### Parallel Opportunities

- T007, T008 y T009 (Phase 4) son ficheros distintos: paralelizables.
- El resto de la feature es secuencial por diseño (un único fichero de código y gates acumulativos).

---

## Parallel Example: Polish

```bash
# Launch documentation updates together:
Task: "Actualizar docs/architecture/diagrams/pagina-cuenta-sequence.md"
Task: "Actualizar docs/architecture/overview.md"
Task: "Marcar fila 016 Completada en specs/001-family-wallet/spec.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: línea base verde
2. Complete Phase 3: US1 (aserción roja → reordenación → gates → e2e → quickstart)
3. **STOP and VALIDATE**: quickstart Q1–Q5 verificados; la feature entrega valor completo aquí
4. Complete Phase 4: documentación viva y roadmap

### Incremental Delivery

- Única historia: tras US1 la página ya es list-first con toda la operativa previa (SC-003/SC-004); Phase 4 cierra el DoD documental.

---

## Notes

- [P] tasks = different files, no dependencies
- Solo se toca un fichero de código (`src/app/accounts/[accountId]/page.tsx`) y uno de e2e (`e2e/pagina-cuenta.spec.ts`): cero componentes nuevos/eliminados, cero dependencias (FR-003)
- Los diálogos de editar/eliminar siguen montados a nivel de `grouped-movement-list.tsx` y el estado vacío dentro del propio listado (FR-004, AGENTS.md)
- `/`, `/summary`, `/annual` y la navegación global quedan intactos (FR-006)
- Commit after each task or logical group
