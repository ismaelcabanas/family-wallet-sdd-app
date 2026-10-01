---
description: "Task list for feature 014 implementation"
---

# Tasks: Alta continua de movimientos con formulario simplificado (nota única, tag única y sin campo cuenta)

**Input**: Design documents from `/specs/014-formulario-nota-tags/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-007 los exige explícitamente (adaptación integral de suites manteniendo lo verificado + cobertura nueva de tanda/tag/intent/migración; constitución III). Tests primero en rojo donde la feature añade comportamiento nuevo (regla de tag por tipo, `expectedAccountId`, `intent`, tanda, migración); el resto son adaptaciones de fixtures/selectores que se ajustan junto a su SUT.

**Organization**: Feature de triple calado (dominio → aplicación → persistencia → actions → UI → e2e). Dos user stories agrupadas por decisión del propietario (excepción de granularidad, misma necesidad de captación por lotes; spec §Excepción): US1 (P1) captación continua, US2 (P2) formulario simplificado. El cambio de modelo atraviesa las capas en la dirección de dependencias (constitución VII): la regla nueva vive en `Movement`; la UI y las actions solo traducen. Diálogos siempre a nivel de `grouped-movement-list.tsx` (convención AGENTS.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js (App Router): `src/` en la raíz del repositorio; e2e en `e2e/`; migraciones en `drizzle/`; docs vivos en `docs/architecture/`; roadmap maestro en `specs/001-family-wallet/spec.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar línea base verde y el entorno de migración antes de tocar código (FR-007 parte de suites en verde).

- [ ] T001 Verificar línea base verde ejecutando `npm run lint && npm run typecheck && npm run test` (todo debe pasar antes de cualquier cambio)
- [ ] T002 Crear la rama `feature/014-formulario-nota-tags` a partir de `main` si aún no existe (worktree actualizado)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la fase fundacional.

---

## Phase 2: Foundational (Modelo de dominio y persistencia — bloquea ambas US)

**Purpose**: Cambio de modelo transversal (nota única, tag única 0..1, cuenta inmutable) que ambas user stories consumen. Se baja por las capas en orden: dominio → aplicación → migración/repositorio. Sin UI aquí.

**Nota**: US1 (captación continua) depende de la action `createMovement` con DTO nuevo (`note`, `tagId`) y de la UI simplificada de US2 para ser utilizable de extremo a extremo; por eso el cambio de modelo es fundacional y las dos historias se implementan sobre él. Cada tarea de esta fase pertenece conceptualmente a US2 (el modelo), pero no lleva label de historia: es prerrequisito compartido.

### Dominio

- [ ] T003 [P] Modificar la entidad `Movement` en `src/domain/movement/Movement.ts`: sustituir `concept: string` + `description: string | null` por `note: string` obligatoria (no vacía tras trim, guardada trimeada) y `tagIds: readonly TagId[]` por `tagId: TagId | null`; `buildValidatedState` valida nota no vacía («La nota es obligatoria.», sustituye a «El concepto es obligatorio.») y **tag según tipo** (gasto sin tag → `InvalidMovementError("tagId", "Selecciona una etiqueta para el gasto.")`; ingreso acepta `null`; la deduplicación desaparece); `MovementInput`/`MovementPersistence` replican la forma nueva (`note`, `tagId`); factories `create`/`recreate`/`rehydrate` conservan sus contratos (FR-002/FR-003, data-model §1.2)
- [ ] T004 [P] Modificar `src/domain/movement/MovementErrors.ts`: `MovementField` pasa a `"date" | "note" | "amount" | "accountId" | "type" | "nature" | "tagId"` (fuera `"concept"` y `"tagIds"`); mensajes renombrados según data-model §1.4 (FR-002/FR-003)
- [ ] T005 [P] [US2] Adaptar `src/domain/movement/Movement.test.ts` a la forma nueva: fixtures con `note`; gasto sin tag → error de campo `tagId`; ingreso sin tag → ok; ingreso con tag → ok; nota vacía/solo espacios → «La nota es obligatoria.»; fuera los casos de deduplicación multi-tag (research §6.1)

### Dominio — cierres y resúmenes (composición con tag única)

- [ ] T006 [P] [US2] Modificar `src/domain/movement/MonthlyClosure.ts`: `ClosureMovementInput.tags` pasa a `tag: ClosureTagRef | null`; el cálculo no cambia (cada gasto computa íntegro en su única tag; fuera el reparto multi-tag) (data-model §2.4)
- [ ] T007 [P] [US2] Adaptar `src/domain/movement/MonthlyClosure.test.ts`: fixtures multi-tag → tag única; assertions de desglose sin cambios de aritmética (research §6.1)
- [ ] T008 [P] [US2] Modificar `src/domain/movement/GlobalMonthlySummary.ts` + `src/domain/movement/AnnualIncomeStatement.ts` (inputs de composición con tag única, análogo a T006) y adaptar sus tests `GlobalMonthlySummary.test.ts` + `AnnualIncomeStatement.test.ts` (fixtures tag única)

### Aplicación

- [ ] T009 Modificar `src/application/movement/dto.ts`: `CreateMovementDTO`/`UpdateMovementDTO` con `note` y `tagId: number | null` (fuera `concept`/`description`); `UpdateMovementDTO` sustituye `accountId` editable por `expectedAccountId: number` (check, no dato); `MovementDTO.tags: MovementTagDTO[]` pasa a `tag: MovementTagDTO | null` (data-model §4)
- [ ] T010 Modificar `src/application/movement/movement-inputs.ts`: `resolveTagIds` pasa a `resolveTagId(tags, rawTagId: number | null)` — valida (si llega id) existencia y estado activo (`TagNotFoundError`/`InactiveTagError` como hoy), **sin default**: eliminar `DEFAULT_TAG_SLUG` y la asignación automática de «Sin Clasificar» (FR-003, research §2)
- [ ] T011 [P] [US2] Modificar `src/application/movement/CreateMovement.ts` (+ test): DTO nuevo (`note`, `tagId`), `resolveTagId` sin default, sin re-export de `DEFAULT_TAG_SLUG`; adaptar tests (fuera los de default «Sin Clasificar»; nuevo: gasto sin tag → error de dominio propagado; tag inexistente/inactiva rechazada)
- [ ] T012 [P] [US2] Modificar `src/application/movement/UpdateMovement.ts` (+ test): `expectedAccountId` en el DTO — carga el movimiento, valida que su cuenta coincide con la esperada (desajuste → `InvalidMovementError("accountId", "El movimiento ya no pertenece a esta cuenta.")`) y `Movement.recreate` recibe el `accountId` persistido (la cuenta queda inmutable, FR-004, research §3); adaptar tests (fuera el recorrido de mover de cuenta; nuevo: desajuste de cuenta → error)
- [ ] T013 [P] [US2] Adaptar `src/application/movement/GetMonthlyClosure.ts`, `GetGlobalMonthlySummary.ts`, `GetAnnualIncomeStatement.ts` (+ tests): mapeo a `ClosureMovementInput.tag` única desde `MovementDTO.tag`
- [ ] T014 [P] [US2] Adaptar `src/application/movement/ListMovements.ts` y `DeleteMovement.ts` (+ tests): solo fixtures/tipos (`MovementDTO.tag` única); lo que verifican no cambia

### Persistencia

- [ ] T015 Modificar el schema Drizzle en `src/infrastructure/db/schema/movements.ts`: columnas `note: text notNull` (fuera `concept`/`description`) y `tagId integer references tags.id onDelete: restrict` (0..1); eliminar `src/infrastructure/db/schema/movement-tags.ts` y su export en `src/infrastructure/db/schema/index.ts` (data-model §2.1)
- [ ] T016 Generar la migración versionada `drizzle/0002_<nombre-generado>.sql` con drizzle-kit y verificar el journal `drizzle/meta/_journal.json` (idx 2): `DELETE FROM movements` (elimina movimientos de prueba; cascada virtual de relaciones) → recrear `movements` con el esquema nuevo (`note NOT NULL`, `tag_id FK RESTRICT`, sin `concept`/`description`) → `DROP TABLE movement_tags`; cuentas, miembros y catálogo de tags intactos (SC-003, research §5). Aplicarla en dev con `npm run db:migrate`
- [ ] T017 Modificar `src/infrastructure/db/DrizzleMovementRepository.ts`: `create` = INSERT de la fila única con `tag_id` (fuera `db.batch` de tags; `max(id)+1` manual se mantiene); `update` = UPDATE de la fila (`tag_id`, `updated_at`); `findById`/`selectMonthRows` con un único `leftJoin(movements.tagId → tags)` — 1 fila = 1 movimiento (research §5.2)
- [ ] T018 [P] Modificar `src/infrastructure/db/mappers/movement.mapper.ts`: fuera la agrupación multi-fila (`mapJoinedRowsToMovementDTOs` pasa a 1 fila = 1 DTO con `tag: MovementTagDTO | null`)
- [ ] T019 [US2] Adaptar y ampliar `src/infrastructure/db/DrizzleMovementRepository.test.ts` (contra `createTestDb` libsql `:memory:` con migraciones incluida `0002`): create/update con `tag_id` única; lecturas con DTO `tag` única; **nuevo test de migración/RESTRICT** — fixture del esquema 0001 con movimientos migrado a 0002 queda sin movimientos y con cuentas/miembros/tags intactos (SC-003), y borrar una tag con movimientos falla por FK (research §6.3)

**Checkpoint**: Modelo nuevo compilando y persistencia migrada; `npm run test` NO estará en verde global todavía (las capas superiores siguen usando la forma antigua) — se recupera al completar US2. Continuar en orden de fases, no parar aquí.

---

## Phase 3: User Story 2 - Formulario simplificado: nota única, tag única obligatoria en gastos y sin campo cuenta (Priority: P2, implementada primero por dependencia)

**Goal**: Formularios de alta y edición con los 6 controles congelados (fecha, importe, Nota, tipo, naturaleza cuando aplique, etiqueta única vía Select), sin descripción ni cuenta; acción de edición con `expectedAccountId`; vistas del movimiento mostrando nota + tag única (FR-002/FR-003/FR-004, SC-002/SC-005).

**Independent Test**: Registrar un gasto: el formulario pide fecha, importe, nota, tipo, naturaleza (si aplica) y una tag obligatoria; sin campo cuenta ni descripción; gasto sin tag → error «Selecciona una etiqueta para el gasto.»; ingreso sin tag se guarda. Editar un movimiento: mismos campos simplificados, sin selector de cuenta; guardar cierra el diálogo (FR-006) (quickstart Q1/Q2/Q5).

> **Orden dentro de la fase**: schema/action primero (frontera), luego formulario, luego diálogos y listado, después paneles, al final la página. Tests de componentes en rojo antes de su SUT.

### Tests para US2 (primero, en rojo)

- [ ] T020 [P] [US2] Crear los tests de la frontera en `src/infrastructure/primary/actions/create-movement.action.test.ts` y `src/infrastructure/primary/actions/update-movement.action.test.ts` (adaptar los existentes + casos nuevos): FormData con `note` y `tagId` única (vacío→`null`); gasto sin tag → `errors.tagId` «Selecciona una etiqueta para el gasto.»; nota vacía → «La nota es obligatoria.»; `intent` en create (`continue` → estado success con `intent: "continue"`; ausente → `close`); update con `expectedAccountId` y notice sin rama de cuenta («Movimiento actualizado» + sufijo de mes movido si aplica); ejecutar y confirmar rojo
- [ ] T021 [P] [US2] Adaptar/ampliar `src/infrastructure/primary/ui/movement-form.test.tsx`: labels «Nota» y «Etiqueta»; Select con placeholder «Selecciona etiqueta» (combobox accesible), opción «Sin etiqueta» (`value=""`) solo con Ingreso, sin selección por defecto; error de tag en gasto; sin bloque informativo de cuenta en alta; modo edición sin Select de cuenta; fuera checkboxes y «Sin Clasificar» automático; ejecutar y confirmar rojo
- [ ] T022 [P] [US2] Adaptar `src/infrastructure/primary/ui/edit-movement-dialog.test.tsx`: prefill con `note` y `tagId`; sin selector de cuenta; submit «Guardar cambios» cierra en éxito (FR-006); ejecutar y confirmar rojo

### Frontera (schema + Server Actions)

- [ ] T023 Modificar `src/infrastructure/primary/actions/movement-form.schema.ts`: `movementFormSchema` con `note` (`.trim().min(1)`, «La nota es obligatoria.»), `tagId` vacío→`null` / entero si presente, `superRefine` cross-field gasto-sin-tag («Selecciona una etiqueta para el gasto.», análogo al de naturaleza) e `intent` (`"continue" | "close"`, default `"close"`); `MovementFormValues`/`MovementFieldKey` nuevas (`"note"`, `"tagId"`, sin `"concept"`/`"tagIds"`) (ui-contract §5)
- [ ] T024 Modificar `src/infrastructure/primary/actions/create-movement.action.ts`: parsear `intent` del FormData (default `"close"`), DTO `CreateMovementDTO` nuevo, estado success con `intent: "continue" | "close"`, revalidación intacta (`/` + `/accounts/[accountId]` page, FR-005); verificar T020 (create) en verde
- [ ] T025 [P] Modificar `src/infrastructure/primary/actions/update-movement.action.ts`: DTO `UpdateMovementDTO { movementId, expectedAccountId: currentAccountId, … }`; `buildMovedNotice` pierde la rama de cuenta («Movimiento actualizado» + «: ahora está en {Mes año}» si cambió de mes); fuera `ListAccounts`; verificar T020 (update) en verde

### UI — formulario y diálogos

- [ ] T026 Modificar `src/infrastructure/primary/ui/movement-form.tsx`: campo **Nota** (`name="note"`, placeholder «Mercadona», sin campo descripción) y **Etiqueta** como `Select` shadcn (`name="tagId"`, placeholder «Selecciona etiqueta», una opción por tag activa, sin selección por defecto, opción «Sin etiqueta» `value=""` solo visible con Ingreso, selección conservada al alternar tipo — máxima 1); fuera checkboxes múltiples, texto de «Sin Clasificar» automático, bloque informativo de cuenta en alta y `Select` de cuenta en edición (quedan `accountId`/`expectedAccountId` como hidden); orden congelado fecha → importe → Nota → tipo → naturaleza → Etiqueta (ui-contract §1); verificar T021 en verde
- [ ] T027 [P] [US2] Modificar `src/infrastructure/primary/ui/edit-movement-dialog.tsx`: pierde la prop `accounts`; `initialValues` con `note`/`tagId`; botonera `[Cancelar] [Guardar cambios]`; éxito cierra + toast (FR-006); verificar T022 en verde
- [ ] T028 Modificar `src/infrastructure/primary/ui/grouped-movement-list.tsx` (+ adaptar `grouped-movement-list.test.tsx`): fila con **nota** + chip de la **tag única** (si hay) + badge naturaleza + importe; `aria-label`/`title` «Editar {nota}»/«Eliminar {nota}»; deja de recibir/pasar `accounts` al diálogo de edición (SC-005, ui-contract §6)
- [ ] T029 [P] [US2] Modificar `src/infrastructure/primary/ui/delete-movement-dialog.tsx` (+ adaptar su test): muestra «Nota: …», Importe, Fecha (ui-contract §6)
- [ ] T030 [P] [US2] Modificar los tres paneles `src/infrastructure/primary/ui/monthly-closure-panel.tsx`, `global-summary-panel.tsx`, `annual-statement-panel.tsx` (+ adaptar sus tests): eliminar la constante `TAG_NOTE` y su render («Los gastos con varias tags computan en cada una…») de los tres ficheros; header sr-only «Concepto» del anual pasa a «Nota»; desgloses por tag sin cambios de cálculo

### Página

- [ ] T031 [US2] Modificar `src/app/accounts/[accountId]/page.tsx`: `GroupedMovementList` deja de recibir `accounts` si ningún consumidor lo usa (verificar `currentAccountId`/`accountName`/`accountType` intactos); el resto de la composición sin cambios (FR-009); ejecutar `npm run lint && npm run typecheck && npm run test` — **en verde tras esta fase** (SC-004 parcial: unitarios + componentes)

**Checkpoint**: Formulario simplificado operativo en alta y edición; sin concepto/descripción ni multi-tag en ninguna vista; suites unitarias y de componentes en verde.

---

## Phase 4: User Story 1 - Registrar varios movimientos seguidos sin cerrar el diálogo (Priority: P1) 🎯 MVP

**Goal**: El diálogo de alta permanece abierto tras «Guardar y seguir» (primario), preparando la siguiente captura — nota/importe/etiqueta vacíos, fecha/tipo/naturaleza pegados del último guardado, foco en Nota, contador «Guardados: N» — con «Guardar y cerrar» como secundario y `intent` viajando por FormData/estado (FR-001, SC-001).

**Independent Test**: Abrir el diálogo de alta y registrar 3 movimientos seguidos: tras cada guardado el diálogo sigue abierto, los campos pegados conservan su valor, los variables quedan vacíos con el foco en Nota, cada movimiento aparece en el listado revalidado sin cerrar el diálogo; el cuarto se envía con «Guardar y cerrar» y el diálogo se cierra con la página recalculada (quickstart Q3/Q4).

### Tests para US1 (primero, en rojo)

- [ ] T032 [P] [US1] Ampliar `src/infrastructure/primary/ui/create-movement-dialog.test.tsx` (mockeando `createMovement` con `vi.mock`): guardado válido con `intent: "continue"` → diálogo **abierto**, toast «Movimiento guardado», contador «Guardados: 1», nota/importe/etiqueta vacíos, fecha/tipo/naturaleza pegados, foco en Nota; «Guardar y cerrar» (`intent: "close"`) → guarda y cierra; error de campo → diálogo abierto con valores y errores conservados (sin remonte); ambos botones disabled durante el envío; ejecutar y confirmar rojo

### Implementación para US1

- [ ] T033 Modificar `src/infrastructure/primary/ui/create-movement-dialog.tsx`: estado de tanda `savedCount` + `carry: { date, type, nature }` — en éxito `intent: "continue"` → `setSavedCount(n+1)`, `setCarry(último envío)`, toast, **sin cerrar**; `intent: "close"` → toast + `onClose()`; header con contador «Guardados: N» junto al título (oculto con 0, fuera del `DialogTitle`); botonera `[Cancelar] [Guardar y cerrar] [Guardar y seguir]` — primario submit con `name="intent" value="continue"`, secundario submit con `intent="close"`, ambos `disabled={isPending}` («Guardando…») (research §4, ui-contract §3/§4); verificar T032 en verde
- [ ] T034 Modificar `src/infrastructure/primary/ui/movement-form.tsx`: aceptar `carry` + `savedCount` de la tanda — remontar el `<form>` con `key={savedCount}` (nota/importe/tagId vacíos), `defaultValue` de fecha con `carry.date`, `chosenType` inicial con `carry.type` y naturaleza con `carry.nature` solo si `carry.type === "expense"`; `focus()` programático en el primer campo vacío (Nota) tras el remonte vía refs + `useEffect`; el Select de etiqueta vuelve solo a su placeholder (research §4.1, ui-contract §3)
- [ ] T035 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (FR-007, SC-004)

**Checkpoint**: Tanda continua funcional contra la action real; suites unitarias/de componentes en verde.

---

## Phase 5: E2E (FR-007, constitución III) — tanda canónica y adaptación de helpers

**Purpose**: El flujo crítico de registro cubre la tanda continua y el error por tag ausente; los helpers migran a «Nota» + Select de etiqueta; `registro-movimientos.spec.ts` es la spec canónica de la tanda (research §6.6). Aislamiento cuenta/mes por spec y `workers: 1` intactos.

- [ ] T036 Ampliar `e2e/registro-movimientos.spec.ts` (flujo crítico, mantiene su combinación cuenta/mes): helpers rellenan «Nota» y etiqueta vía Select (`getByRole("combobox", …)` + opción por nombre); **tanda continua** — 1 apertura y N guardados con «Guardar y seguir» (verificando contador, campos vacíos/pegados y listado revalidado sin cerrar), cierre con «Guardar y cerrar»; **gasto sin tag** → error «Selecciona una etiqueta para el gasto.» con diálogo abierto y valores conservados; **ingreso sin tag** → se guarda (FR-001/FR-003, US1-1, US2-2/2-3)
- [ ] T037 [P] Adaptar `e2e/edicion-movimientos.spec.ts`: helpers Nota + Select de etiqueta; fuera el recorrido de cambio de cuenta (imposible, FR-004); editar mantiene cierre en éxito; mantener lo que la spec verifica
- [ ] T038 [P] Adaptar `e2e/cierre-mensual.spec.ts`: helpers Nota + selector de etiqueta única (3 altas); el alta permanece abierta tras «Guardar y seguir» → los helpers cierran tras guardar o usan «Guardar y cerrar» (y pueden encadenar altas con una sola apertura, SC-001)
- [ ] T039 [P] Adaptar `e2e/resumen-global.spec.ts`: ídem T038 (altas múltiples)
- [ ] T040 [P] Adaptar `e2e/cuenta-resultados-anual.spec.ts`: ídem T038 (5 altas)
- [ ] T041 [P] Adaptar `e2e/pagina-cuenta.spec.ts`: helpers Nota + selector de etiqueta única (alta con «Guardar y cerrar» o cierre tras guardar)
- [ ] T042 Verificar `e2e/panel-cuentas.spec.ts` intacta (sus literales siguen siendo ciertos; sin cambios esperados — solo ajustar si un literal afectado lo exige)
- [ ] T043 Ejecutar `npm run test:e2e` y verificar las 7 specs en verde (SC-004)

**Checkpoint**: Flujo crítico e2e cubriendo tanda + tag obligatoria; todas las specs e2e en verde.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva, ADRs y roadmap actualizados en el mismo cambio (constitución III DoD; research §7).

- [ ] T044 [P] Actualizar `docs/architecture/diagrams/domain-model.md`: `Movement` con `note`/`tagId` (fuera `concept`/`description`/`tagIds`), relación 0..1 con `Tag`, invariante tag-por-tipo y cuenta inmutable (base: data-model §1.5)
- [ ] T045 [P] Actualizar `docs/architecture/diagrams/registro-movimiento-sequence.md`: tanda continua con `intent` (base: plan.md §Secuencia)
- [ ] T046 [P] Actualizar `docs/architecture/overview.md` si menciona concepto/descripción, multi-tag, `movement_tags` o la edición con cambio de cuenta (§42 `movement-inputs`, §67 schema, §79 notice «movido», §85 formulario)
- [ ] T047 [P] Añadir nota a `docs/architecture/adr/0011-edicion-reconstruccion-validada.md` (la edición ya no permite mover de cuenta; `expectedAccountId`) y crear `docs/architecture/adr/0014-tag-unica-fk-movements.md` registrando: tag única como FK `tag_id` (RESTRICT) en `movements` en sustitución de la N:M de 002, DROP de `movement_tags` y migración `0002` destructiva sin migración de datos (decisión del propietario 2026-10-01)
- [ ] T048 Actualizar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-008): fila `014-formulario-nota-tags` a «Completada» y enmiendas en su tabla de notas — FR-004 del maestro (tag única obligatoria en gastos/opcional en ingresos en sustitución de múltiples), asunción «Concepto/Descripción» (nota única), edge case de edición entre cuentas (ya no posible) y eliminación de movimientos de prueba en la migración
- [ ] T049 Documentar en `AGENTS.md` la convención del patrón de remonte por `key={savedCount}` + `carry` en diálogos de captación continua si la implementación lo fija como patrón del proyecto (regla de oro 6)
- [ ] T050 Validar manualmente los escenarios Q1–Q5 de `specs/014-formulario-nota-tags/quickstart.md` con `npm run dev` sobre BD migrada (`npm run db:migrate && npm run db:seed`): formulario simplificado, tag obligatoria en gasto/opcional en ingreso, tanda de 3+1 con 1 apertura, cancelación a mitad, edición sin cuenta y sin TAG_NOTE en los paneles
- [ ] T051 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-004, DoD)

**Checkpoint**: Documentación viva, ADRs, roadmap y quickstart sincronizados con la implementación; feature entregada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Depende de Phase 1. **Bloquea ambas US** (el cambio de modelo atraviesa todo el stack). Dentro de la fase: dominio (T003–T008) → aplicación (T009–T014) → persistencia (T015–T019); la dirección de dependencias es hacia abajo, nunca al revés (constitución VII).
- **US2 (Phase 3)**: Depende de Phase 2 completa (consume DTOs/schema nuevos). Se implementa **antes** que US1 aunque es P2: US1 (tanda) necesita el formulario simplificado y la action con DTO nuevo para ser demostrable de extremo a extremo (la agrupación de la spec comparte formulario y recorrido UI).
- **US1 (Phase 4)**: Depende de Phase 3 (movement-form con Select, action con `intent`).
- **E2E (Phase 5)**: Depende de Phase 4 (tanda operativa) — `registro-movimientos` cubre tanda + tag obligatoria.
- **Polish (Phase 6)**: Depende de todas las anteriores (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US2 (P2, formulario simplificado)**: Tras Phase 2. Independientemente testable (quickstart Q1/Q2/Q5) — la tanda no es necesaria para verificarla.
- **US1 (P1, captación continua)**: Tras Phase 3/US2 (comparte formulario y action). Independientemente testable (quickstart Q3/Q4) sobre el formulario simplificado.
- Ambas comparten el modelo fundacional: el despliegue incremental entrega el valor completo solo con las dos (motivo de la agrupación decidida por el propietario).

### Within Each User Story

- Tests primero y en rojo antes de su SUT (T020–T022 → T023–T030; T032 → T033–T034).
- Frontera (schema/actions) antes que UI; formulario antes que diálogos; diálogos antes que listado/página.
- La migración (T016) se genera tras el cambio de schema (T015) y antes del repositorio (T017).
- E2E tras la UI completa; gates acumulativos al final de cada fase.

### Parallel Opportunities

- Dominio fundacional: T003 ∥ T004 ∥ T005; T006 ∥ T008 (ficheros distintos; T007 junto a T006 al ser su test).
- Aplicación: T011 ∥ T012 ∥ T013 ∥ T014 tras T009–T010 (ficheros distintos).
- Tests US2: T020 ∥ T021 ∥ T022 (ficheros distintos).
- UI US2: T025 ∥ T027 ∥ T029 ∥ T030 tras el schema/formulario; T028 tras T026/T027.
- E2E: T037–T041 en paralelo (specs en ficheros distintos; el runner ya serializa con `workers: 1`).
- Docs: T044 ∥ T045 ∥ T046 ∥ T047 (ficheros distintos).

---

## Parallel Example: User Story 2

```bash
# Launch red tests together:
Task: "Adaptar create/update action tests (src/infrastructure/primary/actions/*.test.ts)"
Task: "Adaptar movement-form.test.tsx"
Task: "Adaptar edit-movement-dialog.test.tsx"

# Launch independent UI files together (tras el schema):
Task: "Modificar update-movement.action.ts"
Task: "Modificar edit-movement-dialog.tsx"
Task: "Modificar delete-movement-dialog.tsx"
Task: "Modificar los tres paneles (TAG_NOTE fuera)"
```

## Parallel Example: User Story 1

```bash
# Red test first, luego implementación en dos ficheros:
Task: "Ampliar create-movement-dialog.test.tsx (tanda)"
# tras el rojo:
Task: "Modificar create-movement-dialog.tsx (savedCount/carry/intent)"
Task: "Extender movement-form.tsx (remonte key={savedCount} + foco)"
```

---

## Implementation Strategy

### MVP First (US2 + US1 = feature completa)

1. Complete Phase 1: línea base verde
2. Complete Phase 2: modelo fundacional (dominio → aplicación → persistencia + migración)
3. Complete Phase 3: US2 — formulario simplificado verificado independiente (quickstart Q1/Q2/Q5); `lint/typecheck/test` en verde
4. Complete Phase 4: US1 — tanda continua sobre el formulario simplificado (quickstart Q3/Q4)
5. Complete Phase 5: e2e — tanda canónica + tag obligatoria en `registro-movimientos`
6. **STOP and VALIDATE**: gates completos + quickstart Q1–Q5
7. Complete Phase 6: documentación viva, ADRs y roadmap (FR-008)

### Incremental Delivery

- La feature es indivisible de cara a usuario (agrupación del propietario): el valor real (tanda ágil) surge de US1+US2 juntas. Los checkpoints intermedios (Phase 3 y Phase 4) son puntos de validación técnica, no despliegues de valor parcial.

### Parallel Team Strategy

Con varios desarrolladores tras Phase 2: US2 (frontera+UI) y los tests/adaptaciones de dominio-paralelo pueden avanzar en ficheros distintos; US1 y E2E son secuenciales respecto a US2. Para 1 desarrollador (real): estrictamente secuencial por fases.

---

## Notes

- [P] tasks = different files, no dependencies
- La regla «tag obligatoria en gastos / opcional en ingresos» y la nota única viven en `Movement` (dominio puro); la UI nunca decide negocio, lee `state` (constitución VII)
- Diálogos montados a nivel de `grouped-movement-list.tsx` y estado vacío dentro del propio listado (convención AGENTS.md); el remonte por `key={savedCount}` ocurre dentro del diálogo de alta, que sobrevive a `revalidatePath` (demostrado por 013)
- La migración `0002` es destructiva por decisión del propietario (clarificación 2026-10-01): elimina movimientos de prueba; no hay backfill ni datos que preservar; `pretest:e2e` ya recrea `e2e.sqlite` (sin cambios)
- Seed y catálogo intactos: «Sin Clasificar» sigue en el catálogo como opción seleccionable a mano (asunción de la spec); la asignación automática desaparece
- `/`, `/summary`, `/annual`, navegación, cierre y cuadre intactos (FR-009); `panel-cuentas.spec.ts` no se toca (T042 solo verificación)
- Solo el alta es continua: el diálogo de edición cierra en éxito como hoy (FR-006)
- Commit after each task or logical group (Conventional Commits, en español el enunciado cuando aporte claridad)
