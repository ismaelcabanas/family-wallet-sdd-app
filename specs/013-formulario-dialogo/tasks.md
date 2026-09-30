---
description: "Task list for feature 013 implementation"
---

# Tasks: Formulario de alta en diálogo desde el listado

**Input**: Design documents from `/specs/013-formulario-dialogo/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-006 los pide explícitamente (research §3): test RTL nuevo del diálogo (molde `edit-movement-dialog.test.tsx`), ampliación de las del listado (CTA en meses vacíos, apertura, copy) y re-point de las del wrapper eliminado; los 6 helpers e2e de alta abren el CTA+diálogo antes de rellenar + aserción e2e de ausencia del bloque embebido (FR-004). Sin specs e2e nuevas (research §3, alternativa rechazada).

**Organization**: Feature de presentación pura con una única user story (US1, P1). Sin cambios de dominio, aplicación, Server Actions, validación ni persistencia (FR-005); diálogos a nivel del listado, nunca en filas (convención AGENTS.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js (App Router): `src/` en la raíz del repositorio; e2e en `e2e/`; docs vivos en `docs/architecture/`; roadmap maestro en `specs/001-family-wallet/spec.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar línea base verde antes de tocar código (FR-006 parte de suites en verde).

- [ ] T001 Verificar línea base verde ejecutando `npm run lint && npm run typecheck && npm run test` (todo debe pasar antes de cualquier cambio)

**Checkpoint**: Repositorio en verde; se puede empezar US1.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prerrequisitos bloqueantes para las user stories.

**Sin tareas**: la feature es presentación pura (FR-005) — no hay infraestructura, esquemas ni dependencias nuevas; `MovementFormFields` ya existe y está diseñado para reutilizarse con `formAction` inyectado. US1 puede empezar tras Phase 1.

**Checkpoint**: US1 desbloqueada.

---

## Phase 3: User Story 1 - Registrar un movimiento desde un diálogo junto al listado (Priority: P1) 🎯 MVP

**Goal**: CTA **«Nuevo movimiento»** en la cabecera del listado y junto al estado vacío que abre un `CreateMovementDialog` (calco del patrón de 003 con `createMovement`, cuenta fijada, fecha hoy); el bloque `MovementForm` embebido desaparece de la página (FR-001–FR-004).

**Independent Test**: Abrir `/accounts/2?month=2026-04`, pulsar «Nuevo movimiento», rellenar el diálogo y verificar que el movimiento aparece en listado/balance/cierre tras cerrarse; en un mes vacío el CTA sigue disponible; la página ya no muestra el bloque «Registrar movimiento» embebido (quickstart Q1–Q5).

### Tests for User Story 1

> **NOTE: Escribir estos tests PRIMERO y verificar que FALLAN** (el diálogo y el CTA no existen todavía; el copy del vacío es el antiguo).

- [ ] T002 [P] [US1] Crear test RTL en `src/infrastructure/primary/ui/create-movement-dialog.test.tsx` (molde `src/infrastructure/primary/ui/edit-movement-dialog.test.tsx`, mockeando `createMovement` con `vi.mock`): apertura con defaults de alta (fecha hoy, «Gasto» marcado, cuenta fijada mostrada como texto sin selector, `DialogTitle` «Nuevo movimiento»); submit válido → llama la action y cierra (`onClose`) con toast «Movimiento guardado»; error de campo → diálogo abierto, `role="alert"` por campo y valores conservados; «Cancelar» → cierra sin llamar la action; con «Ingreso» la Naturaleza queda oculta; ejecutarlo y confirmar rojo
- [ ] T003 [P] [US1] Ampliar test RTL en `src/infrastructure/primary/ui/grouped-movement-list.test.tsx`: botón «Nuevo movimiento» visible con movimientos y también en estado vacío; al pulsarlo abre `dialog { name: "Nuevo movimiento" }`; el estado vacío ya no menciona «formulario superior» sino «Pulsa «Nuevo movimiento» para registrar el primero.»; cerrar el diálogo lo desmonta; ejecutarlo y confirmar rojo

### Implementation for User Story 1

- [ ] T004 [US1] Crear `src/infrastructure/primary/ui/create-movement-dialog.tsx` (client): calco estructural de `src/infrastructure/primary/ui/edit-movement-dialog.tsx` con la Server Action `createMovement` (import de `../actions/create-movement.action`) — `Dialog` controlado `open` inicial `true` montado condicionalmente (sin `DialogTrigger`), `DialogTitle` «Nuevo movimiento», subcomponente `CreateMovementForm` con `useActionState(createMovement, { status: "idle" })`, `useEffect` éxito → `onClose()` + `toast.success("Movimiento guardado")` (errores de campo NO cierran; error `_form` se muestra en el pie), `MovementFormFields` en modo alta (`accountId`/`accountName`/`accountType`, sin `initialValues`, `submitLabel` por defecto «Registrar») con `secondaryActions` = `Button` outline «Cancelar»; props `accountId`, `accountName`, `accountType`, `tags`, `onClose` (FR-002/FR-003); verificar T002 en verde
- [ ] T005 [P] [US1] Ampliar `src/infrastructure/primary/ui/empty-state.tsx`: aceptar `children` (el CTA) manteniendo marco punteado y texto principal «Aún no hay movimientos en este mes.»; actualizar el texto de apoyo de «Registra el primero con el formulario superior.» a «Pulsa «Nuevo movimiento» para registrar el primero.» (FR-001, research §2)
- [ ] T006 [US1] Ampliar `src/infrastructure/primary/ui/grouped-movement-list.tsx`: nuevas props `accountName`/`accountType`; estado `creating` (`useState<boolean>`); CTA `<Button type="button" size="sm">Nuevo movimiento</Button>` en fila `flex` de la cabecera de la sección (junto al `h2` «Movimientos del mes») y junto al estado vacío (CTA como `children` de `EmptyState`); render condicional `{creating ? <CreateMovementDialog accountId={currentAccountId} accountName={accountName} accountType={accountType} tags={tags} onClose={() => setCreating(false)} /> : null}` **a nivel del listado**, nunca en una fila (FR-001, convención AGENTS.md); verificar T003 en verde
- [ ] T007 [US1] Modificar `src/app/accounts/[accountId]/page.tsx`: eliminar el bloque `<MovementForm … />` (líneas 94-99 actuales) y su import (FR-004, SC-002); pasar `accountName={account.name}` y `accountType={account.type}` a `GroupedMovementList`; el orden queda cabecera → subtítulo → `MonthStepper` → `GroupedMovementList` (con CTA) → `AccountBalance` → `MonthlyClosurePanel` (escenario 6)
- [ ] T008 [US1] Eliminar el wrapper `MovementForm` de `src/infrastructure/primary/ui/movement-form.tsx` (conservando `MovementFormFields`, `MovementFormInitialValues` y `MovementFormState`, usados por los diálogos) y re-apuntar los tests del wrapper en `src/infrastructure/primary/ui/movement-form.test.tsx` al diálogo de alta / a `MovementFormFields` en modo alta con `formAction` inyectada: defaults, errores de campo y mensajes intactos; la aserción de reset pasa a «cierre tras éxito + reapertura con formulario limpio»; los tests de modo edición quedan intactos (research §3)

### E2E para User Story 1 (FR-006, constitución III)

> **NOTE**: Cada helper añade `await page.getByRole("button", { name: "Nuevo movimiento" }).click()` + `await expect(page.getByRole("dialog", { name: "Nuevo movimiento" })).toBeVisible()` antes de rellenar por label; los labels/botones internos son idénticos («Registrar» sigue siendo el submit). No debilitar ninguna aserción existente; mantener el aislamiento cuenta/mes de cada spec.

- [ ] T009 [P] [US1] Actualizar el helper `registerMovement` en `e2e/registro-movimientos.spec.ts` (flujo crítico): abrir el CTA+diálogo antes de rellenar (E1–E4) y, tras guardar, verificar que el `dialog` desaparece; el caso encadenado reabre el CTA y encuentra el formulario limpio
- [ ] T010 [P] [US1] Actualizar el helper `registerMovement` en `e2e/pagina-cuenta.spec.ts` y añadir a P1 la aserción de ausencia del bloque embebido (la página no contiene `heading "Registrar movimiento"`) para congelar FR-004; la aserción de adyacencia stepper→listado sigue válida (el CTA vive dentro de la sección del listado)
- [ ] T011 [P] [US1] Actualizar el helper `registerMovement` (setup) en `e2e/edicion-movimientos.spec.ts`: abrir el CTA+diálogo antes de rellenar
- [ ] T012 [P] [US1] Actualizar el helper `registerMovement` en `e2e/cierre-mensual.spec.ts`: abrir el CTA+diálogo antes de rellenar (3 altas)
- [ ] T013 [P] [US1] Actualizar el helper `registerMovement` en `e2e/resumen-global.spec.ts`: abrir el CTA+diálogo antes de rellenar (altas múltiples)
- [ ] T014 [P] [US1] Actualizar el helper `registerMovement` en `e2e/cuenta-resultados-anual.spec.ts`: abrir el CTA+diálogo antes de rellenar (5 altas)

### Gates para User Story 1

- [ ] T015 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (FR-006)
- [ ] T016 [US1] Ejecutar `npm run test:e2e` y verificar las 7 specs en verde con los helpers actualizados y la aserción de ausencia del bloque embebido (`panel-cuentas.spec.ts` intacta: su ausencia de «Registrar» en `/` sigue siendo cierta)
- [ ] T017 [US1] Validar manualmente los escenarios Q1–Q5 de `specs/013-formulario-dialogo/quickstart.md` con `npm run dev` (CTA+diálogo con defaults, alta feliz cierra/tuesta/recalcula, errores mantienen abierto, cancelar descarta, mes vacío con CTA, fecha de otro mes no cambia la vista, composición final sin formulario embebido)

**Checkpoint**: Alta de movimientos íntegra vía CTA+diálogo en cualquier mes; página de cuenta lectura por defecto; 100 % de la operativa previa y suites en verde (SC-001–SC-004).

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva y roadmap actualizados en el mismo cambio (constitución III, DoD; research §4).

- [ ] T018 [P] Actualizar `docs/architecture/diagrams/pagina-cuenta-sequence.md`: el alta pasa por CTA «Nuevo movimiento» → `CreateMovementDialog` en lugar del bloque embebido (base: el diagrama de secuencia de `specs/013-formulario-dialogo/plan.md`)
- [ ] T019 [P] Actualizar la composición de la página de cuenta (bloque UI de `/accounts/[id]`) en `docs/architecture/overview.md`: sin formulario embebido, listado con CTA y diálogo de alta montado a nivel del listado
- [ ] T020 [P] Marcar la fila `013-formulario-dialogo` como «Completada» en la tabla de features de `specs/001-family-wallet/spec.md`

**Checkpoint**: Documentación viva y roadmap sincronizados con la implementación.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Sin tareas (presentación pura, FR-005).
- **US1 (Phase 3)**: Depende de Phase 1 (línea base verde).
- **Polish (Phase 4)**: Depende de US1 completa (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US1 (P1)**: Única historia; sin dependencias entre historias. Internamente:
  - Tests primero y en rojo: T002, T003 (paralelos, ficheros distintos)
  - Implementación: T004 (diálogo → T002 verde) ∥ T005 (empty-state); después T006 (listado → T003 verde) → T007 (página, FR-004) → T008 (eliminar wrapper + re-point de sus tests)
  - E2E: T009–T014 (paralelos entre sí) tras T007/T008
  - Gates acumulativos: T015 → T016 → T017

### Within Each User Story

- Los tests RTL se escriben primero y FALLAN antes de implementar (T002/T003 → T004/T006).
- El diálogo antes del listado que lo monta; el listado antes de la página que le pasa props; la página antes de eliminar el wrapper (si no, el build rompe).
- Los helpers e2e se actualizan con la implementación ya en su sitio; gates al final.

### Parallel Opportunities

- T002 ∥ T003 (tests en ficheros distintos).
- T004 ∥ T005 (ficheros distintos; T005 no depende de ningún test).
- T009–T014: 6 specs e2e en ficheros distintos, paralelizables.
- T018 ∥ T019 ∥ T020 (Phase 4, ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Launch RTL tests together (red first):
Task: "Crear src/infrastructure/primary/ui/create-movement-dialog.test.tsx"
Task: "Ampliar src/infrastructure/primary/ui/grouped-movement-list.test.tsx"

# Launch implementation of independent files together:
Task: "Crear src/infrastructure/primary/ui/create-movement-dialog.tsx"
Task: "Ampliar src/infrastructure/primary/ui/empty-state.tsx"

# Launch e2e helper updates together:
Task: "Actualizar e2e/registro-movimientos.spec.ts"
Task: "Actualizar e2e/pagina-cuenta.spec.ts"
Task: "Actualizar e2e/edicion-movimientos.spec.ts"
Task: "Actualizar e2e/cierre-mensual.spec.ts"
Task: "Actualizar e2e/resumen-global.spec.ts"
Task: "Actualizar e2e/cuenta-resultados-anual.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: línea base verde
2. Complete Phase 3: US1 (tests rojos → diálogo + CTA + empty-state → página sin bloque embebido → eliminar wrapper → e2e → gates → quickstart)
3. **STOP and VALIDATE**: quickstart Q1–Q5 verificados; la feature entrega valor completo aquí (la única historia)
4. Complete Phase 4: documentación viva y roadmap

### Incremental Delivery

- Única historia: tras US1 el alta vive solo en el diálogo del CTA y la página queda lectura por defecto (SC-001/SC-002); Phase 4 cierra el DoD documental.

---

## Notes

- [P] tasks = different files, no dependencies
- Sin cambios de dominio, aplicación, Server Actions, `movementFormSchema`, repos ni migraciones (FR-005); el diálogo consume la action `createMovement` existente tal cual
- Los diálogos (alta/edición/eliminación) se montan a nivel de `grouped-movement-list.tsx` y el estado vacío dentro del propio listado (convención AGENTS.md); sin `formKey` de remonte: el diálogo se desmonta al cerrar y cada reapertura es un formulario limpio (edge case «registros consecutivos»)
- `e2e/panel-cuentas.spec.ts` no se toca: su aserción de ausencia de «Registrar» en `/` sigue siendo cierta
- `/`, `/summary`, `/annual` y la navegación global quedan intactos (FR-007)
- Commit after each task or logical group
