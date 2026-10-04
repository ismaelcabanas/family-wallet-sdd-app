---
description: "Task list for feature 017 implementation"
---

# Tasks: Creación de etiquetas desde el formulario de movimiento

**Input**: Design documents from `/specs/017-creacion-tags-formulario/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-009 los exige explícitamente (unidad dominio/aplicación/repositorio, action, componentes y e2e del flujo crítico; constitución III). En rojo primero donde la feature añade comportamiento nuevo (`deriveTagSlug`, `CreateTag`, `findByName`/`save`, action `createTag`, captación inline, tanda, edición); las suites nuevas se escriben contra los contratos congelados de data-model/ui-contract.

**Organization**: Una única user story pequeña (US1, P1 — constitución II, sin excepción): creación inline de etiquetas junto al Select «Etiqueta» en alta y edición. El cambio baja por las capas en la dirección de dependencias (VII): función pura en dominio → caso de uso + puerto en aplicación → repositorio Drizzle → Server Action → UI → e2e. **Todo aditivo**: sin migración, sin cambios de esquema, sin tocar el modelo de `Movement`, el seed ni «Sin Clasificar» (FR-007); `grouped-movement-list.tsx` y `page.tsx` intactos (ya bajan `tags` a los diálogos).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js (App Router): `src/` en la raíz del repositorio; e2e en `e2e/`; docs vivos en `docs/architecture/`; roadmap maestro en `specs/001-family-wallet/spec.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar línea base verde y la rama feature antes de tocar código.

- [ ] T001 Verificar línea base verde ejecutando `npm run lint && npm run typecheck && npm run test` (todo debe pasar antes de cualquier cambio)
- [ ] T002 Confirmar la rama `feature/017-creacion-tags-formulario` activa y el árbol limpio (creada por la extensión git de Spec Kit; worktree actualizado si se usa)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la fase fundacional.

---

## Phase 2: Foundational (Dominio → Aplicación → Persistencia — bloquea US1)

**Purpose**: Vertical del backend de creación de tags: función pura de slug, caso de uso `CreateTag` (duplicados case-insensitive, colisiones de slug, alta activa) y puerto/repositorio extendidos. Todo aditivo: ninguna capa superior consumía la forma anterior.

**Nota**: Conceptualmente estas tareas sirven solo a US1, pero no llevan label de historia: son prerrequisito compartido (backend) de todo lo que viene después (action + UI + e2e).

### Tests primero (en rojo)

- [ ] T003 [P] Crear `src/domain/tag/TagSlug.test.ts` (rojo): tabla de casos para `deriveTagSlug` — los 12 pares nombre→slug del seed copiados literalmente en el test (sin importar `seed-data`; p. ej. «Alimentación»→`alimentacion`, «Suscripciones online»→`suscripciones-online`), acentos («Café y té»→`cafe-y-te`), mayúsculas, espacios múltiples, runs y guiones de borde, solo símbolos («---»→`""`); ejecutar y confirmar rojo
- [ ] T004 [P] Crear `src/application/tag/CreateTag.test.ts` (rojo) con puerto falso en memoria: éxito (alta activa, nombre trimeado, slug derivado, `Tag` con id), duplicado exacto y case-insensitive («LUZ» con «Luz» existente → `DuplicateTagNameError`), duplicado de inactiva (también bloquea), colisión de slug («Alimentación» con «Alimentacion» existente → `alimentacion-2`, siguiente colisión → `-3`), nombre vacío/solo espacios → `InvalidTagError`; ejecutar y confirmar rojo
- [ ] T005 [P] Ampliar `src/infrastructure/db/DrizzleRepositories.test.ts` (rojo, contra `createTestDb` libsql `:memory:` con migraciones): `findByName` case-insensitive («LUZ» encuentra «Luz»), acentos sin colisionar («Alimentación» no encuentra «Alimentacion») e ignora estado (encuentra inactivas); `save` persiste y devuelve `Tag` con id; INSERT con nombre duplicado → `DuplicateTagNameError` (traducción del constraint); ejecutar y confirmar rojo

### Dominio y aplicación

- [ ] T006 [P] Crear `src/domain/tag/TagSlug.ts` con `deriveTagSlug(name: string): string` (función pura sin dependencias): trim + toLowerCase → NFD y strip de diacríticos (`\p{Diacritic}`) → cada carácter no alfanumérico (Unicode) a `-`, colapsar runs de guiones y recortar bordes (data-model §1.1); verificar T003 en verde
- [ ] T007 Extender el puerto `src/application/tag/TagRepository.ts` con `findByName(name: string): Promise<Tag | null>` (espejo del índice `lower(name)`, ignora estado) y `save(tag: Tag): Promise<Tag>` (INSERT → `Tag` persistida con id) (data-model §1.4)
- [ ] T008 Crear `src/application/tag/CreateTag.ts`: `execute({ name })` — trim → vacío → `InvalidTagError`; `findByName` existe → `DuplicateTagNameError(name)`; `slug = deriveTagSlug(name)` con colisiones `{slug}-2`, `{slug}-3`, … vía `findBySlug` hasta hueco; `save(Tag.create({ name, slug, status: "active" }))` → `Tag` con id (data-model §1.3, research §1–§3); verificar T004 en verde

### Persistencia

- [ ] T009 Modificar `src/infrastructure/db/DrizzleTagRepository.ts`: implementar `findByName` (predicado Drizzle `sql` con `lower(name) = lower(?)`, limit 1, ignora estado) y `save` (insert → `Tag.rehydrate` con id; violación de `tags_name_nocase_uq` → `DuplicateTagNameError(tag.name)` como red de seguridad ante carreras) (data-model §2.2); verificar T005 en verde
- [ ] T010 Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (cambio aditivo: las suites existentes no cambian de forma)

**Checkpoint**: Creación de tags operativa de dominio a BD (`CreateTag` usable); el resto de la app intacto.

---

## Phase 3: User Story 1 - Crear una etiqueta nueva desde el propio formulario del movimiento (Priority: P1) 🎯 MVP

**Goal**: Patrón «+ Nueva etiqueta» junto al Select «Etiqueta» en alta y edición: captación inline dentro del propio formulario (sin cerrar el diálogo), creación inmediata (persistida y seleccionada, movimiento sin guardar), duplicados case-insensitive y nombre vacío con mensaje claro sin perder datos, tanda continua de 014 intacta y misma vía en edición (FR-001–FR-006, SC-001–SC-004).

**Independent Test**: Quickstart Q1–Q6: registrar un gasto a medio rellenar creando su etiqueta inline (diálogo nunca cerrado, datos intactos, etiqueta seleccionada); duplicado «luz»/«LUZ» rechazado con nombre conservado; cancelación y nombre vacío sin efectos; etiqueta creada a mitad de tanda reutilizable en las capturas siguientes; edición con etiqueta creada al vuelo que cierra al guardar; acentos y trim.

### Tests para US1 (primero, en rojo)

- [ ] T011 [P] [US1] Crear `src/infrastructure/primary/actions/create-tag.action.test.ts` (rojo, mockeando dependencias con `vi.mock`/`vi.hoisted` como las actions de movimiento): nombre vacío → `{ ok: false, message: "El nombre de la etiqueta es obligatorio." }`; éxito → `{ ok: true, tag }` con `revalidatePath("/", "layout")` llamada (mock); `DuplicateTagNameError` → mensaje exacto del dominio; `InvalidTagError` → su mensaje; ejecutar y confirmar rojo
- [ ] T012 [P] [US1] Ampliar `src/infrastructure/primary/ui/movement-form.test.tsx` (rojo, mockeando `createTag`): abrir «+ Nueva etiqueta» y cancelar (y Escape) restaura el Select exacto como estaba; crear con éxito → toast «Etiqueta creada», captación colapsada, nueva etiqueta **seleccionada**, `onTagCreated(tag)` llamado y resto de campos intactos; duplicado → `role="alert"` con nombre tecleado conservado; vacío → «El nombre de la etiqueta es obligatorio.»; Enter en el input NO envía el formulario del movimiento; «Creando…» y disabled durante la creación y durante el guardado del movimiento; ejecutar y confirmar rojo
- [ ] T013 [P] [US1] Ampliar `src/infrastructure/primary/ui/create-movement-dialog.test.tsx` (rojo): etiqueta creada en la 2.ª captura de una tanda disponible en el Select de la 3.ª tras el remonte `key={savedCount}` (`extraTags`); ciclo guardado → siguiente captura intacto (campos estables pegados, variables vacíos, foco en Nota, «Guardados: N»); ejecutar y confirmar rojo
- [ ] T014 [P] [US1] Ampliar `src/infrastructure/primary/ui/edit-movement-dialog.test.tsx` (rojo): crear etiqueta inline en edición, queda seleccionada, «Guardar cambios» envía con su `tagId` y el diálogo cierra con su toast habitual; ejecutar y confirmar rojo

### Frontera (Server Action)

- [ ] T015 [US1] Crear `src/infrastructure/primary/actions/create-tag.action.ts`: `createTagSchema` (`z.string().trim().min(1, "El nombre de la etiqueta es obligatorio.")`), tipo `CreateTagResult` unión discriminada (`{ ok: true; tag: TagDTO } | { ok: false; message: string }`), llamada a `CreateTag`, mapeo de `InvalidTagError`/`DuplicateTagNameError` a su mensaje exacto (otro `DomainError` → genérico; nunca lanzar al cliente) y `revalidatePath("/", "layout")` solo en éxito — el movimiento NO se guarda (data-model §4, ui-contract §5, FR-004); verificar T011 en verde

### UI — captación inline junto al Select

- [ ] T016 [US1] Modificar `src/infrastructure/primary/ui/movement-form.tsx`: botón «+ Nueva etiqueta» junto al Label «Etiqueta» (estilo link/ghost, en alta y edición); estados `creatingTag`/`newTagName` + `useTransition` con llamada directa a `createTag` (sin `<form>` anidado ni `useActionState`, research §4.2); captación con Input «Nombre de la etiqueta» (placeholder «Mascotas») + `[Cancelar] [Crear]` (`type="button"`, Crear primario) sustituyendo visualmente al Select; Enter interceptado (`onKeyDown` → crear, no enviar); éxito → toast «Etiqueta creada», captación colapsada, `selectedTagId = tag.id`, foco devuelto al Select y `onTagCreated(tag)`; errores `role="alert"` + `aria-describedby` con nombre conservado; cancelar/Escape restaura el Select exacto; disabled con `isPending` de la creación («Creando…») y del movimiento; captación permanece abierta e íntegra al cambiar Gasto↔Ingreso; prop nueva `onTagCreated?: (tag: TagDTO) => void` (ui-contract §1/§2/§7, research §4); verificar T012 en verde
- [ ] T017 [P] [US1] Modificar `src/infrastructure/primary/ui/create-movement-dialog.tsx`: estado `extraTags: TagDTO[]` a nivel de diálogo (sobrevive al remonte `key={savedCount}` de la tanda), Select alimentado con `[...tags, ...extraTags]` ordenado por nombre y `onTagCreated` cableado al formulario (research §4.4/§5, ui-contract §3/§6, FR-005); verificar T013 en verde
- [ ] T018 [P] [US1] Modificar `src/infrastructure/primary/ui/edit-movement-dialog.tsx`: mismo patrón `extraTags`/`onTagCreated` que T017; el diálogo sigue cerrando tras el guardado con su toast habitual (ui-contract §4, FR-006); verificar T014 en verde
- [ ] T019 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (SC-005 parcial)

**Checkpoint**: Creación inline operativa en alta y edición; tanda de 014 intacta; suites unitarias y de componentes en verde.

---

## Phase 4: E2E del flujo crítico (FR-009, constitución III)

**Purpose**: Spec nueva en fichero propio con combinación cuenta/mes exclusiva (Cuenta de Miembro B + mayo 2026, verificada frente a las 7 specs existentes y su orden alfabético efectivo con `workers: 1` — research §6.6). Las specs existentes quedan intactas.

- [ ] T020 [US1] Crear `e2e/creacion-tags.spec.ts` (Cuenta de Miembro B, mayo 2026): tanda — 1.ª captura normal con «Guardar y seguir», 2.ª captura crea su etiqueta inline («Mascotas») y guarda con ella, 3.ª captura reutiliza la etiqueta del Select y cierra con «Guardar y cerrar»; duplicado case-insensitive («luz» con «Luz» del seed) rechazado con mensaje y datos intactos; cancelación de la captación sin efectos; creación en el diálogo de edición con guardado (quickstart Q1–Q5, SC-001–SC-004)
- [ ] T021 [US1] Ejecutar `npm run test:e2e` y verificar las 8 specs en verde (las 7 existentes sin cambios esperados — ajustar solo si un literal afectado lo exige)

**Checkpoint**: Flujo crítico «registrar gasto creando su etiqueta en línea dentro de una tanda» cubierto end-to-end (SC-005).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva, ADR y roadmap maestro actualizados en el mismo cambio (constitución III DoD, research §7).

- [ ] T022 [P] Crear `docs/architecture/adr/0015-creacion-tags-inline-action-propia.md`: Server Action propia frente a creación en el envío del movimiento; `deriveTagSlug` en dominio + resolución de colisiones `-2/-3` en aplicación; `findByName` espejo del índice `lower(name)`; `extraTags` + `revalidatePath("/", "layout")` (research §1–§5, §7)
- [ ] T023 [P] Actualizar `docs/architecture/diagrams/domain-model.md`: `deriveTagSlug`, puerto `TagRepository` con `findByName`/`save` y vía de creación `CreateTag` del catálogo (base: data-model §1.5)
- [ ] T024 [P] Actualizar `docs/architecture/diagrams/registro-movimiento-sequence.md`: paso opcional de creación inline de etiqueta junto al Select antes del envío (base: plan.md §Diagramas de diseño)
- [ ] T025 [P] Actualizar `docs/architecture/overview.md`: vía de creación de tags existente (`CreateTag` + action `createTag`), `findByName`/`save` en el repositorio, `DuplicateTagNameError` pasa de definido a lanzado
- [ ] T026 Actualizar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-008): fila `017-creacion-tags-formulario` «Completada» y reducción de la fila `004-gestion-tags` a mantenimiento de catálogo (renombrar, fusionar, desactivar), dejando constancia de que la creación de tags queda cubierta por 017 (decisión del propietario 2026-10-04)
- [ ] T027 Documentar en `AGENTS.md` la convención de captación inline (action directa + `useTransition` + `extraTags` en el diálogo padre del remonte) si la implementación la fija como patrón del proyecto (regla de oro 6)
- [ ] T028 Validar manualmente los escenarios Q1–Q6 de `specs/017-creacion-tags-formulario/quickstart.md` con `npm run dev` sobre BD migrada y sembrada (`npm run db:migrate && npm run db:seed`): creación sin pérdidas, duplicado, cancelación/vacío, tanda con reutilización, edición, acentos y trim
- [ ] T029 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-005, DoD)

**Checkpoint**: Documentación viva, ADR, roadmap y quickstart sincronizados con la implementación; feature entregada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Depende de Phase 1. **Bloquea US1** (la action y la UI consumen `CreateTag` y el puerto extendido). Dentro de la fase: tests rojos (T003–T005) → dominio/aplicación (T006–T008) → persistencia (T009) → gate (T010); la dirección de dependencias es hacia abajo, nunca al revés (constitución VII).
- **US1 (Phase 3)**: Depende de Phase 2 completa. Tests rojos primero (T011–T014) → action (T015) → formulario (T016) → diálogos (T017–T018) → gate (T019).
- **E2E (Phase 4)**: Depende de Phase 3 (UI completa operativa).
- **Polish (Phase 5)**: Depende de todas las anteriores (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US1 (P1, única)**: Tras Phase 2. Independientemente testable vía quickstart Q1–Q6 y las suites por capa; el MVP de la feature es la propia US1 completa (Phase 1–4).

### Within Each User Story

- Tests primero y en rojo antes de su SUT (T003–T005 → T006–T009; T011–T014 → T015–T018).
- Dominio (T006) y puerto (T007) antes del caso de uso (T008 los consume); puerto (T007) antes del repositorio (T009 lo implementa).
- Action (T015) antes del formulario (T016 la llama); formulario (T016 define `onTagCreated`) antes de los diálogos (T017/T018 la cablean).
- E2E tras la UI completa; gates acumulativos al final de cada fase.

### Parallel Opportunities

- Phase 2: T003 ∥ T004 ∥ T005 (ficheros distintos, en rojo); luego T006 ∥ T007 (ficheros distintos).
- Phase 3: T011 ∥ T012 ∥ T013 ∥ T014 (ficheros distintos, en rojo); luego T017 ∥ T018 tras T016 (ficheros distintos).
- Phase 5: T022 ∥ T023 ∥ T024 ∥ T025 (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Launch red tests together:
Task: "Create create-tag.action.test.ts (src/infrastructure/primary/actions/)"
Task: "Amplify movement-form.test.tsx (captación inline)"
Task: "Amplify create-movement-dialog.test.tsx (extraTags en tanda)"
Task: "Amplify edit-movement-dialog.test.tsx (creación en edición)"

# Tras el rojo, la action y el formulario (secuenciales):
Task: "Create create-tag.action.ts (Zod + CreateTagResult + revalidación)"
Task: "Modify movement-form.tsx (captación «+ Nueva etiqueta»)"
# y después, en paralelo (ficheros distintos):
Task: "Modify create-movement-dialog.tsx (extraTags + onTagCreated)"
Task: "Modify edit-movement-dialog.tsx (extraTags + onTagCreated)"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Complete Phase 1: línea base verde
2. Complete Phase 2: backend fundacional (dominio → aplicación → persistencia, aditivo)
3. Complete Phase 3: US1 — captación inline en alta y edición, tanda intacta (quickstart Q1–Q6)
4. **STOP and VALIDATE**: `npm run lint && npm run typecheck && npm run test` + validación manual Q1–Q6
5. Complete Phase 4: e2e del flujo crítico (`creacion-tags.spec.ts`)
6. Complete Phase 5: ADR 0015, docs vivas, roadmap (FR-008) y gates completos (SC-005)

### Incremental Delivery

- Feature de una sola US (constitución II): el valor de usuario llega con Phase 3. Phase 2 es un checkpoint técnico (creación utilizable solo vía action, sin UI), no un despliegue parcial.

### Parallel Team Strategy

- Para 1 desarrollador (real): estrictamente secuencial por fases. Con varios: tras los tests rojos de Phase 2, dominio/aplicación/persistencia avanzan en ficheros distintos; tras T016, los dos diálogos en paralelo; docs de Phase 5 en paralelo.

---

## Notes

- [P] tasks = different files, no dependencies
- El negocio vive en dominio/aplicación (`deriveTagSlug`, duplicados, colisiones, alta activa); la UI solo captura un nombre y pinta el resultado; la unicidad case-insensitive queda respaldada por el índice `lower(name)` de BD (constitución VII)
- Sin migración ni cambios de esquema: la tabla `tags` y su índice soportan la creación desde 0000 (principio V); seed, catálogo del Excel y «Sin Clasificar» intactos (FR-007)
- `grouped-movement-list.tsx`, `page.tsx`, actions de movimiento y `movement-form.schema.ts` intactos: la etiqueta nueva llega al envío como un `tagId` ya persistido
- `extraTags` vive en el diálogo (padre del remonte `key={savedCount}`), como `savedCount`/`carry` en 014 (convención AGENTS.md); `revalidatePath("/", "layout")` cubre aperturas futuras con la página montada (SC-004)
- E2e en fichero propio (Miembro B + mayo 2026, combinación verificada — research §6.6); `workers: 1` y aislamiento cuenta/mes por spec intactos
- Commit after each task or logical group (Conventional Commits, en español el enunciado cuando aporte claridad)
