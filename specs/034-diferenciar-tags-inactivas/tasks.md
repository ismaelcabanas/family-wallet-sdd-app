---

description: "Task list for feature implementation"

---

# Tasks: Etiquetas inactivas visibles en el listado de movimientos

**Input**: Design documents from `specs/034-diferenciar-tags-inactivas/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos — FR-005 los exige (repositorio, componentes y e2e). No se pide TDD: cada test acompaña a su implementación en orden de ejecución.

**Organization**: Feature de lectura pura con una única user story (US1, P1). La fundación es la vía de datos (amend de `MovementTagDTO` + columna en el SELECT existente + mapper — research R1 / contracts §4); US1 la presenta en los tres componentes UI de la página de cuenta. Sin cambios de dominio, actions, esquema, migraciones ni seed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (única historia de la feature)
- Caminos exactos en cada tarea

## Path Conventions

- Monolito único: `src/` en la raíz (`domain/`, `application/`, `app/`, `infrastructure/`) + `e2e/` — estructura existente del plan

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Punto de partida limpio. Sin inicialización: no hay dependencias, esquema ni migraciones nuevas (la columna `tags.status` existe desde 004).

- [ ] T001 Verificar rama `feature/034-diferenciar-tags-inactivas` activa con árbol limpio y baseline en verde (`npm run lint && npm run typecheck && npm run test`) antes de tocar código

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Hacer que el estado `active|inactive` de la etiqueta viaje con la lectura del mes hasta `MovementDTO.tag` (FR-003: una columna más en el SELECT existente; la UI no consultará nada por su cuenta). Bloquea toda la UI de US1.

- [ ] T002 Amend de `MovementTagDTO` con `status: TagStatus` (import del tipo de dominio existente `src/domain/tag/TagStatus.ts`, paridad `ExpenseNature`/`MovementType`) en `src/application/movement/dto.ts` — excepción consciente y documentada del congelamiento de 027 (research R1, data-model)
- [ ] T003 Extender `MovementJoinedRow` con `tagStatus: string | null`, exigirlo en la guarda `hasTag` (paridad de `tagName`/`tagSlug`) y componer `tag: { id, name, slug, status: tagStatus as TagStatus }` en `mapJoinedRowToMovementDTO` en `src/infrastructure/db/mappers/movement.mapper.ts` (depende de T002)
- [ ] T004 Añadir `tagStatus: tags.status` al SELECT del `leftJoin(tags)` existente en `selectMonthRows()` de `src/infrastructure/db/DrizzleMovementRepository.ts` — misma query, una columna más; cubre `listByMonthAndAccount`, `listByMonth` y `listByYear` sin cambiar firmas (depende de T003)
- [ ] T005 Actualizar todos los fixtures de tests que construyen `MovementTagDTO` añadiendo `status: "active"` por defecto (≈12 sitios señalados por `npm run typecheck`: `src/infrastructure/primary/ui/grouped-movement-list.test.tsx`, `edit-movement-dialog.test.tsx`, `movement-form.test.tsx`, `src/infrastructure/db/DrizzleMovementRepository.test.ts` y demás afectados) — actualización mecánica sin cambios de semántica (depende de T002-T004)
- [ ] T006 Tests de repositorio: `tag.status` servido por las tres lecturas del builder compartido (fila con inactiva → `"inactive"`, activa → `"active"`, sin etiqueta → `tag === null`) contra libsql `:memory:` con las migraciones de `drizzle/` en `src/infrastructure/db/DrizzleMovementRepository.test.ts` (depende de T005; paridad de las tres lecturas, research R6)

**Checkpoint**: `npm run lint && npm run typecheck && npm run test` en verde; el estado viaja con la lectura del mes sin queries nuevas ni cambios de cálculo (SC-003).

---

## Phase 3: User Story 1 - Identificar etiquetas inactivas en el listado y reasignarlas a activas (Priority: P1) 🎯 MVP

**Goal**: Ver de un vistazo qué filas del mes llevan etiqueta desactivada (chip diferenciado + marca accesible) y ver la etiqueta inactiva actual como valor no elegible al editar, para reasignarla a una activa por las vías existentes (014/029).

**Independent Test** (spec US1): desactivar en `/tags` una etiqueta usada por movimientos del mes → abrir la cuenta de ese mes: filas afectadas con chip diferenciado, demás filas como hoy; editar una marcada → el campo «Etiqueta» muestra «{nombre} (inactiva)»; elegir una activa y guardar → chip normal; histórico y agregados sin cambios.

### Implementación y tests de US1

- [ ] T007 [P] [US1] Chip de etiqueta diferenciado en la fila: cuando `movement.tag.status === "inactive"` renderizar `rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground` + `title="{nombre} (inactiva)"` + `data-inactive="true"` + sufijo accesible `<span className="sr-only"> (inactiva)</span>`; activas exactamente como hoy (`rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground`, sin `data-inactive`); aplica en todas las cuentas, cualquier mes y con el modo selección activo (chip en la celda de contenido, fila sigue seleccionable); sin etiqueta → sin chip (FR-001, R2) en `src/infrastructure/primary/ui/grouped-movement-list.tsx`
- [ ] T008 [US1] Tests del listado en `src/infrastructure/primary/ui/grouped-movement-list.test.tsx`: chip inactivo con `title` «{nombre} (inactiva)», texto accesible «(inactiva)» y `data-inactive`; chip activo sin `data-inactive` y con las clases de hoy; marcador presente en modo selección con la fila seleccionable; fila protegida sin marcador (depende de T007)
- [ ] T009 [P] [US1] Prop opcional `currentInactiveTag?: { id: number; name: string } | null` (default `null`) en `MovementFormFields`; cuando `currentInactiveTag != null && selectValue === String(currentInactiveTag.id)` renderizar como primer ítem del `SelectContent` (antes de «Sin etiqueta» y de los grupos, fuera de `SelectGroup`) un `<SelectItem value={String(id)} disabled>{nombre} (inactiva)</SelectItem>`; destinos sin cambios (solo `tagGroups` activas filtradas de protegidas; «Sin etiqueta» solo ingresos); al elegir destino el ítem deja de renderizarse; con error activo el guard 027 (`selectValue = state.values.tagId`) mantiene el valor mostrado en `src/infrastructure/primary/ui/movement-form.tsx` (FR-002, R3, contracts §3)
- [ ] T010 [US1] Tests del formulario en `src/infrastructure/primary/ui/movement-form.test.tsx`: al montar edición con `currentInactiveTag` y `tagId` inactivo el trigger muestra «{nombre} (inactiva)»; el ítem del dropdown está primero, fuera de grupos y `disabled`; destinos solo activas; guardar sin cambiar mantiene el ítem visible + error existente «Una de las etiquetas seleccionadas ya no está disponible.» con `role="alert"` (escenario 5) (depende de T009)
- [ ] T011 [US1] `EditMovementForm` computa y pasa la prop sin lecturas extra: `movement.tag !== null && movement.tag.status === "inactive" ? { id: movement.tag.id, name: movement.tag.name } : null` → `currentInactiveTag` de `MovementFormFields` (DTO capturado en estado del listado, convención «diálogos por fila») en `src/infrastructure/primary/ui/edit-movement-dialog.tsx` (depende de T009)
- [ ] T012 [US1] Tests del diálogo en `src/infrastructure/primary/ui/edit-movement-dialog.test.tsx`: edición de movimiento con etiqueta inactiva pasa `{ id, name }` al formulario (trigger «{nombre} (inactiva)»); con etiqueta activa y sin etiqueta pasa `null` (alta y retag masivo no aportan la prop — cero cambios para ellos) (depende de T011)
- [ ] T013 [US1] e2e del recorrido completo en `e2e/etiquetas-inactivas.spec.ts`: cuenta 1 × 2026-07 (combinación propia verificada, R5) — crear etiqueta «Vacaciones» inline («+ Nueva etiqueta», patrón `gestion-tags` G2) + 2 movimientos con ella y 1 con «Ocio»; desactivar en `/tags` → chips diferenciados (`title`/`data-inactive`) y chip «Ocio» intacto; editar fila marcada: trigger «Vacaciones (inactiva)», ítem deshabilitado, guardar sin cambiar → error existente; reasignar a «Ocio» → chip normal; retag masivo (029) de la segunda fila marcada → sin marcadores en el mes; specs en serie dentro del fichero (workers: 1, BD determinista compartida) (depende de T008, T010, T012)

**Checkpoint**: recorrido «detectar → reasignar» completo (SC-001/SC-002); KPIs, `/summary`, `/annual` e informe anual intactos (SC-003).

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentación asociada (DoD constitución III.3) y verificación final.

- [ ] T014 [P] Registrar en `AGENTS.md` la convención 034 de UI si procede (FR-006): chip con estado — tratamiento desaturado + borde discontinuo + `title`/`sr-only` «(inactiva)» + `data-inactive` como ancla de tests; valor actual inactivo como `SelectItem` disabled fuera de grupos
- [ ] T015 [P] Marcar la fila `034-diferenciar-tags-inactivas` como Completada en el roadmap maestro `specs/001-family-wallet/spec.md` (FR-006; la exige el guarda de `/speckit.finish`)
- [ ] T016 Validación manual de los escenarios E1-E6 de `specs/034-diferenciar-tags-inactivas/quickstart.md` y gates completos en verde: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` (SC-004; incluye el e2e nuevo)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede empezar inmediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 — **BLOQUEA** toda la UI de US1 (T002 → T003 → T004 → T005 → T006, cadena de compilación: DTO → mapper → repo → fixtures → tests)
- **User Story 1 (Phase 3)**: Depende de Phase 2 completa
- **Polish (Phase 4)**: Depende de US1 completa (T016 requiere todo lo anterior)

### User Story Dependencies

- **US1 (P1)**: Única historia — sin dependencias entre historias. Internas: T007→T008 (listado), T009→T010 (form), T009→T011→T012 (diálogo), T008+T010+T012→T013 (e2e)

### Parallel Opportunities

- T007/T008 (listado) ∥ T009/T010 (formulario): ficheros distintos, sin dependencias cruzadas
- T014 ∥ T015 (AGENTS.md ∥ roadmap): ficheros distintos
- Tras T013, T014+T015+T016 solo lecturan/verifican: T014 y T015 en paralelo, T016 al final

---

## Parallel Example: User Story 1

```bash
# Tras Phase 2 completa, lanzar en paralelo (ficheros distintos):
Task: "T007 [P] [US1] Chip diferenciado en src/infrastructure/primary/ui/grouped-movement-list.tsx"
Task: "T009 [P] [US1] Prop currentInactiveTag + SelectItem disabled en src/infrastructure/primary/ui/movement-form.tsx"

# Después, sus tests (co-localizados):
Task: "T008 [US1] Tests del listado en grouped-movement-list.test.tsx"
Task: "T010 [US1] Tests del formulario en movement-form.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline verde)
2. Complete Phase 2: Foundational (vía de datos — CRÍTICA, bloquea la UI)
3. Complete Phase 3: User Story 1 (visibilidad + coherencia en edición + e2e)
4. **STOP and VALIDATE**: quickstart E1-E6 manual + gates en verde
5. Deploy si procede (sin migraciones: sin paso pre-deploy de BD)

### Incremental Delivery

1. Setup + Foundational → el estado viaja en la lectura (invisible aún)
2. T007+T008 → chips diferenciados: valor de detección por sí solo
3. T009-T012 → coherencia en el diálogo de edición
4. T013 → e2e del recorrido completo; T014-T016 → documentación y verificación final

### Parallel Team Strategy

Con un solo implementador lo natural es secuencial; con capacidad extra, las parejas T007/T008 ∥ T009/T010 van en paralelo tras la fundación.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Lectura pura: PROHIBIDO tocar dominio, actions, esquema, migraciones, seed, `/tags`, `/summary`, `/annual`, informe anual, importador y materializaciones (FR-003/FR-004, R4, contracts §7)
- Los literales congelados en español («(inactiva)», «Selecciona etiqueta», «Una de las etiquetas seleccionadas ya no está disponible.») viven en contracts §5
- Commits Conventional Commits por tarea o grupo lógico (auto-commits de Spec Kit habilitados)
- Stop en cualquier checkpoint para validar la historia de forma independiente
