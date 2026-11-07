# Tasks: Reasignación masiva de etiquetas de movimientos

**Input**: Design documents from `/specs/029-retag-masivo/` (plan.md, spec.md, research.md, data-model.md, contracts/ui-contract.md, quickstart.md)

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-007 de la spec los exige explícitamente (unidad de aplicación del caso de uso con doble en memoria, repositorio contra libsql `:memory:`, action con Zod y mapeo de errores, componentes del modo selección y del diálogo, y e2e del flujo completo en combinación cuenta/mes propia; constitución III). En rojo primero donde la feature añade comportamiento nuevo (`BulkRetagMovements`, `retagMovements` del puerto/adaptador, action `bulkRetag`, modo de selección y `BulkRetagDialog`); las suites nuevas se escriben contra los contratos congelados de data-model/ui-contract.

**Organization**: Una única user story (US1, P1 — constitución II, sin excepción): reasignar la etiqueta de varios movimientos a la vez desde la página de cuenta. El cambio baja por las capas en la dirección de dependencias (VII): DTOs + puerto ampliado + caso de uso en aplicación → sentencia transaccional en `DrizzleMovementRepository` → Server Action con Zod → modo de selección + diálogo en UI → e2e. **Sin migraciones, cero dependencias nuevas**; dominio, `/tags`, formularios de movimiento, materializaciones y agregados intactos (FR-005).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Punto de partida verificable — el repo ya existe y está inicializado; solo se confirma la base en verde.

- [ ] T001 Ejecutar `npm run lint && npm run typecheck && npm run test` en `feature/029-retag-masivo` y confirmar verde antes de empezar (base limpia)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Vertical de aplicación + persistencia que la action y la UI de US1 consumen: DTOs, puerto ampliado, caso de uso y sentencia transaccional del repositorio (research §2, data-model §1–§2).

**⚠️ CRITICAL**: US1 (action/UI/e2e) no puede empezar hasta el checkpoint de esta fase.

- [ ] T002 [P] Crear `src/application/movement/BulkRetagMovements.test.ts` (rojo) con doble en memoria de `MovementRepository` (ampliado con `retagMovements` que simula el `WHERE` cuenta+mes) y `TagRepository` (findById): éxito devuelve `{ updatedCount, skippedCount }` con ids deduplicados; ids vacío tras deduplicar → `InvalidMovementError` «Selecciona al menos un movimiento.»; destino inexistente → `TagNotFoundError`; destino inactivo → error de etiqueta inactiva (semántica `resolveTagId`); destino protegido (slug `aportacion-comun`) → `ProtectedTagError`; ids ajenos a la cuenta/mes cuentan como `skippedCount` (decisión «ignorar con aviso» — spec Clarifications); un único id válido → `{ updatedCount: 1, skippedCount: 0 }`; ejecutar y confirmar rojo
- [ ] T003 [P] Ampliar `src/infrastructure/db/DrizzleRepositories.test.ts` (rojo, describe `DrizzleMovementRepository` contra `createTestDb` libsql `:memory:` con migraciones): `retagMovements` cambia `tag_id` solo de los ids dados **en la cuenta y mes indicados** (ids de otra cuenta o de otro mes quedan intactos), devuelve `{ updated }` con el recuento exacto (changes), actualiza `updated_at` de los reasignados y **no** el de los movimientos no tocados (diferencia deliberada con `mergeInto` de 004 — ADR 0023), ids inexistentes en la lista no dan error ni computan, la lista puede traer un único id, y un ingreso con `tag_id` null también recibe el destino; ejecutar y confirmar rojo
- [ ] T004 [P] Ampliar `src/application/movement/dto.ts` con `BulkRetagInputDTO { accountId: number; month: string; movementIds: number[]; targetTagId: number }` y `BulkRetagResultDTO { updatedCount: number; skippedCount: number }` (data-model §4)
- [ ] T005 Ampliar el puerto `src/application/movement/MovementRepository.ts` con `retagMovements(accountId: AccountId, month: string, movementIds: readonly MovementId[], targetTagId: TagId): Promise<{ updated: number }>` (data-model §2 — semántica: reasigna y actualiza `updated_at` solo en los ids que pertenecen a cuenta+mes; ids ajenos no dan error)
- [ ] T006 Crear `src/application/movement/BulkRetagMovements.ts`: deduplica y coerciona ids (vacío → `InvalidMovementError` §1 data-model), resuelve el destino con la semántica de alta/edición (`resolveTagId` de `movement-inputs.ts`: existe + activa) y rechaza el protegido con `isProtectedTagSlug` → `ProtectedTagError`, delega en `retagMovements` y devuelve `{ updatedCount: updated, skippedCount: ids.length − updated }`; verificar T002 en verde
- [ ] T007 Implementar `retagMovements` en `src/infrastructure/db/DrizzleMovementRepository.ts`: única `update(movements).set({ tagId, updatedAt: new Date().toISOString() }).where(and(inArray(id, ids), eq(accountId), gte(date, mes-01), lt(date, nextMonthFirstDay(mes))))` → `run.changes` como `{ updated }` (data-model §2.2); verificar T003 en verde

**Checkpoint**: Foundation ready — caso de uso y puerto funcionando contra SQLite real; la action y la UI pueden empezar.

---

## Phase 3: User Story 1 - Cambiar la etiqueta de varios movimientos a la vez (Priority: P1) 🎯 MVP

**Goal**: Desde `/accounts/{id}` (mes visible), seleccionar N movimientos (protegidas excluidas) y reasignarles una etiqueta activa con confirmación informada y recuento en el resultado (spec US1, FR-001–FR-006).

**Independent Test**: Quickstart Q1–Q7: entrar en una cuenta con movimientos, activar «Seleccionar», marcar subconjunto, «Cambiar etiqueta…» → destino → «Reasignar», y verificar filas/desgloses con la nueva etiqueta e importes idénticos; la protegida sin checkbox; e2e nueva en verde (B + 2026-02).

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T008 [P] [US1] Crear `src/infrastructure/primary/actions/bulk-retag.action.test.ts` (rojo, mock de `BulkRetagMovements`): Zod rechaza sin delegar `month` malformado, `movementIds` vacío y ids no numéricos (campos repetidos vía `formData.getAll`); éxito sin descartes → `{ status: "success", message: "3 movimientos actualizados" }` + `revalidatePath("/", "layout")`; singular → «1 movimiento actualizado»; con descartes → «2 de 3 movimientos actualizados»; `ProtectedTagError`/`TagNotFoundError`/`InvalidMovementError` → mensaje exacto del error; resto → «No se ha podido completar la operación. Inténtalo de nuevo.»; ejecutar y confirmar rojo
- [ ] T009 [P] [US1] Ampliar `src/infrastructure/primary/ui/grouped-movement-list.test.tsx` (rojo, actions mockeadas): botón «Seleccionar» visible con movimientos y ausente en el estado vacío; en modo selección cada fila muestra Checkbox con `aria-label="Seleccionar {nota}"` y la fila protegida (slug `aportacion-comun`) sin checkbox (hueco); «Seleccionar todo»/«Ninguno» marca/desmarca solo las seleccionables; «Cambiar etiqueta…» deshabilitado con 0 y abre `BulkRetagDialog` con n; éxito de la reasignación → toast con el mensaje + salida del modo + selección limpia; «Salir de la selección» limpia sin efectos; fuera del modo la fila es exactamente la de 025; ejecutar y confirmar rojo
- [ ] T010 [P] [US1] Crear `src/infrastructure/primary/ui/bulk-retag-dialog.test.tsx` (rojo, action mockeada): texto «Se cambiará la etiqueta de 3 movimientos.»; Select agrupado por categorías (`SelectGroup`/`SelectLabel`) **sin** protegidas ni «Sin etiqueta»; hidden inputs `accountId`, `month` y uno `movementIds` por seleccionado; «Reasignar» deshabilitado sin destino; `isPending` → «Reasignando…» y controles deshabilitados; error de dominio visible `role="alert"` conservando el valor del Select; «Cancelar»/Escape sin efectos; ejecutar y confirmar rojo

### Implementation for User Story 1

- [ ] T011 [US1] Crear `src/infrastructure/primary/actions/bulk-retag.schema.ts` (`bulkRetagSchema` y `BulkRetagActionState`, data-model §4) y `src/infrastructure/primary/actions/bulk-retag.action.ts` (patrón `rename-tag.action.ts`: use case en módulo, `formData.getAll("movementIds")`, mensajes congelados singular/plural/con-descartes, `revalidatePath("/", "layout")`, mapeo `mapErrorToMessage`); verificar T008 en verde
- [ ] T012 [US1] Crear `src/infrastructure/primary/ui/bulk-retag-dialog.tsx` (client, ui-contract §2): `<form>` con `useActionState(bulkRetag)`, hidden inputs, Select «Nueva etiqueta» **controlado con `useState`** + ref de última selección válida para restaurar tras error (paridad `create-tag-dialog.tsx`, SC-004), `[Cancelar] [Reasignar]`, guard de éxito blindado contra re-ejecuciones (flag por envío, patrón 014) → cierre + toast + callback de éxito; verificar T010 en verde
- [ ] T013 [US1] Ampliar `src/infrastructure/primary/ui/grouped-movement-list.tsx` con el modo de selección (ui-contract §1): estado `selectionMode`/`selectedIds: Set<number>`, botón «Seleccionar» junto al CTA, barra contextual («{n} seleccionados», «Seleccionar todo»/«Ninguno», «Cambiar etiqueta…», «Salir de la selección»), `Checkbox` shadcn por fila con área ≥ 44 px, filas protegidas sin checkbox vía `isProtectedTagSlug` del dominio (módulo puro compartido), montaje del diálogo a nivel del listado y salida limpia del modo al éxito; verificar T009 en verde
- [ ] T014 [US1] Crear `e2e/retag-masivo.spec.ts` (serial, helpers locales, **Cuenta de Miembro B + febrero 2026** — combinación verificada libre, última del orden alfabético, research §5; solo etiquetas del seed): preparar 3 gastos «Ocio» + 1 gasto «Aportación Común» + 1 ingreso sin etiqueta; G1 «Seleccionar» habilita el modo con checkboxes; G2 la fila protegida no tiene checkbox y «Seleccionar todo» la excluye (recuento n−1); G3 reasignar 2 de «Ocio» a «Hogar» → toast «2 movimientos actualizados», filas con «Hogar», resto intacto; G4 KPIs/saldo del mes idénticos tras la operación (SC-002); G5 no-op con destino igual al actual → «1 movimiento actualizado»; G6 `/summary?month=2026-02` con importes por etiqueta movidos y totales exactos; G7 «Salir de la selección» limpia sin efectos; ejecutar `npm run test:e2e` completo en verde

**Checkpoint**: US1 funcional y verificable de forma independiente (quickstart Q1–Q7).

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva, roadmap y gates finales (FR-008, constitución DoD).

- [ ] T015 [P] Crear `docs/architecture/adr/0023-reasignacion-masiva-etiquetas.md`: `retagMovements` como operación masiva de puerto (paridad `mergeInto` de 004), `updated_at` actualizado con la diferencia razonada frente a 004 (decisión del propietario 2026-11-07), descarte de ids en el `WHERE` con aviso de recuento real, y el patrón UI «modo de selección» como primera superficie de edición masiva (research §7)
- [ ] T016 [P] Actualizar documentación viva: `docs/architecture/overview.md` (caso de uso y puerto ampliados) y `docs/architecture/diagrams/` (componentes y secuencia reutilizando los del plan; `domain-model.md` con `retagMovements`) + `AGENTS.md` con la convención «Modo de selección y acciones masivas sobre listados» (estado en `grouped-movement-list.tsx`, diálogos a nivel del listado, checkbox excluido en filas protegidas)
- [ ] T017 Preparar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-008): marcar la fila `029-retag-masivo` como «Completada» con nota de cierre (modo IA sigue como feature futura anotada)
- [ ] T018 Gates finales y validación manual: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` en verde + recorrido manual de quickstart Q1–Q7 (SC-004)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — base verde.
- **Foundational (Phase 2)**: tras Phase 1 — **bloquea US1** (la action consume `BulkRetagMovements` y el contrato de DTOs).
- **US1 (Phase 3)**: tras el checkpoint de Phase 2 (T004–T007); dentro de la fase: tests T008–T010 primero (paralelos, ficheros distintos) → T011 (usa T004–T006) → T012 → T013 (usa T012) → T014.
- **Polish (Phase 4)**: tras US1 completa (T015/T016 son [P] entre sí; T017/T018 al final).

### User Story Dependencies

- **US1 (P1)**: única historia — puede empezar tras Foundational; sin dependencias entre historias.

### Within Each User Story

- Tests (rojo) antes de implementación; contrato/DTOs antes de la action; action antes del diálogo (la consume); diálogo antes del modo de selección (lo monta); e2e al final del story.

### Parallel Opportunities

- T002 ∥ T003 (suites distintas) y T004 (DTOs, fichero distinto) — Phase 2.
- T008 ∥ T009 ∥ T010 — tests de US1 (ficheros distintos).
- T015 ∥ T016 — documentación (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "bulk-retag.action.test.ts (rojo) en src/infrastructure/primary/actions/"
Task: "grouped-movement-list.test.tsx (rojo) en src/infrastructure/primary/ui/"
Task: "bulk-retag-dialog.test.tsx (rojo) en src/infrastructure/primary/ui/"

# Then sequential implementation:
Task: "bulk-retag.schema.ts + bulk-retag.action.ts"
Task: "bulk-retag-dialog.tsx"
Task: "grouped-movement-list.tsx (modo de selección)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (base verde)
2. Complete Phase 2: Foundational (caso de uso + puerto + repositorio)
3. Complete Phase 3: US1 (action → diálogo → modo selección → e2e)
4. **STOP and VALIDATE**: quickstart Q1–Q7 + suites en verde
5. Polish (Phase 4): ADR, docs vivas, roadmap, gates finales

### Incremental Delivery

La feature es un único increment (US1) — el orden interno por capas garantiza que cada checkpoint compila y pasa sus tests (rojo → verde por tarea).

---

## Notes

- [P] tasks = different files, no dependencies
- Cada tarea de test exige «ejecutar y confirmar rojo» y su pareja de implementación «verificar T00X en verde» (flujo red-green del repo)
- Sin commits manuales: los auto-commits de Spec Kit (`before_implement`/`after_implement`) registran el progreso; commits Conventional si el flujo se interrumpe
- La e2e comparte BD determinista: respeta la combinación B + 2026-02 y el orden alfabético (corre última) — no requiere limpieza
