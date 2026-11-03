---

description: "Task list for feature 027 implementation"
---

# Tasks: Gestión de etiquetas y jerarquía unificada del catálogo

**Input**: Design documents from `/specs/027-gestion-etiquetas/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-008 los exige explícitamente (aplicación del alta con categoría e inferencia, actions, componentes de `/tags` y del selector agrupado, y un flujo e2e «categoría → etiqueta → movimiento»; constitución III). Co-localizados junto a su SUT (`*.test.ts(x)`, AGENTS.md «Tests»).

**Organization**: Una única user story pequeña (US1, P1 — constitución II, sin excepción): gestionar etiquetas desde `/tags` presentando la jerarquía como un solo concepto. Superficie de cambio (plan «Project Structure»): **sin dominio, esquema ni migraciones** — `CreateTag` extiende firma con `categoryId?`, nuevo `ListGroupedActiveTags` (jubila `ListActiveTags`), `TagDTO` enriquecido + `ActiveTagGroupDTO`, action despachadora `createTagEntry` (inferencia de tipo en la frontera), `tag-catalog.tsx` como árbol contenedor + `CreateTagDialog` (jubilan `CreateCategoryDialog` + `create-category.action`), Select «Etiqueta» agrupado (`SelectGroup`/`SelectLabel`) en `movement-form.tsx` y diálogos con `tagGroups`, e2e propia y documentación (FR-007). **Cero cambios** en `Movement`, `/summary`, `/annual`, listados, KPIs y materializaciones (FR-006).

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
- [ ] T002 Confirmar la rama `feature/027-gestion-etiquetas` activa y el árbol limpio (creada por la extensión git de Spec Kit)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la implementación.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Núcleo de aplicación compartido por las **dos superficies** de la US1 (diálogo de `/tags` y selector agrupado del formulario): DTOs de agrupación, `CreateTag` con categoría explícita y `ListGroupedActiveTags` (jubila `ListActiveTags`). La feature no tiene infraestructura de persistencia que montar (**sin migraciones ni esquema nuevos**, plan «Storage») — este bloque es el equivalente funcional de la Phase 2 de 026. Tests primero en rojo (T003–T005), implementación después (T006–T009).

- [ ] T003 [P] Extender `src/application/tag/CreateTag.test.ts` (rojo; dobles `InMemoryCatalogTagRepository`/`InMemoryCategoryRepository` de 026, data-model §2.1): con `categoryId` válido → etiqueta creada en esa categoría; con `categoryId` inexistente → `CategoryNotFoundError` («La categoría seleccionada ya no está disponible.» — edge otra pestaña); duplicado case-insensitive global intacto (regla 026); **sin** `categoryId` → resuelve la genérica por `findBySlug(DEFAULT_CATEGORY_SLUG)` (regresión 017); vacío tras trim → `InvalidTagError`
- [ ] T004 [P] Crear `src/application/tag/ListGroupedActiveTags.test.ts` (rojo; data-model §2.3): agrupación completa por `categoryId` (ninguna etiqueta perdida); genérica (`isDefaultCategorySlug`) primera, resto `name.localeCompare("es")`; **solo etiquetas activas**; **categorías sin etiquetas activas omitidas** (esc. 8: nunca cabecera vacía); dentro de grupo orden por nombre (criterio vigente de `ListActiveTags.ts:13`)
- [ ] T005 [P] Extender `src/infrastructure/primary/actions/create-tag.action.test.ts` (rojo; data-model §3/§4.2): `result.tag` pasa a llevar `categoryId`/`categoryName` (etiqueta inline 017 nace en la genérica); firma `createTag(name)` y revalidación layout intactas; errores de dominio traducidos igual que hoy
- [ ] T006 [P] Modificar DTOs: `src/application/movement/dto.ts` — `TagDTO` gana `categoryId: number` y `categoryName: string` (`MovementTagDTO` de las filas **sin cambios**, FR-006); `src/application/tag/dto.ts` — nuevo `ActiveTagGroupDTO { category: CategoryDTO; tags: TagDTO[] }` (espejo activo de `TagCatalogGroupDTO`, `CategoryDTO` de 026 intacto)
- [ ] T007 [P] Modificar `src/application/tag/CreateTag.ts` (data-model §2.1): firma `execute(input: { name: string; categoryId?: TagCategoryId })` — `categoryId` presente → `CategoryRepository.findById` → `null` ⇒ `CategoryNotFoundError`, válida ⇒ `Tag.create` con ella; ausente → vía genérica vigente (retrocompatible con 017); trim/duplicado/slug intactos → T003 en verde
- [ ] T008 [P] Crear `src/application/tag/ListGroupedActiveTags.ts` (data-model §2.3): `execute(): Promise<ActiveTagGroupDTO[]>` leyendo `CategoryRepository.findAll()` + `TagRepository.findAllActive()` en paralelo (patrón `ListTagCatalog.ts`); agrupa, omite grupos vacíos y congela el orden (genérica primera, resto es-ES, etiquetas por nombre — la UI solo anida, constitución VII) → T004 en verde
- [ ] T009 Modificar `src/infrastructure/primary/actions/create-tag.action.ts` (data-model §3/§4.2): construir el DTO enriquecido desde el `Tag` devuelto + la categoría resuelta (`DrizzleTagCategoryRepository.findById` sobre `tag.categoryId`); firma, guard de `id === null`, traducción de errores y `revalidatePath("/", "layout")` intactos → T005 en verde

**Checkpoint**: Aplicación en verde por SUT (T003–T005 con T007/T008/T009); `CreateTag` acepta categoría explícita, `ListGroupedActiveTags` disponible y DTO de 017 enriquecido. Las dos superficies de US1 pueden empezar.

---

## Phase 3: User Story 1 - Gestionar etiquetas desde /tags con la jerarquía a la vista (Priority: P1) 🎯 MVP

**Goal**: `/tags` presenta un único árbol (categorías contenedor + etiquetas sangradas) con una sola vía de creación («Nueva etiqueta»: sin categoría padre crea categoría, con padre crea etiqueta en ella) y el selector «Etiqueta» de alta/edición agrupa por categoría con cabeceras no seleccionables; ciclo 004/026 e inline 017 intactos; informes y KPIs sin cambios (FR-001–FR-006).

**Independent Test**: Quickstart Q1–Q8: árbol contenedor con único botón «Nueva etiqueta»; crear «Mercadona» en «Alimentación» → fila en su grupo y disponible en el Select bajo su cabecera; «Suscripciones» sin padre → grupo nuevo vacío; duplicados con valor conservado; cabeceras no seleccionables por clic ni teclado y sin grupos vacíos; inline 017 en la genérica con tanda intacta; `/summary`//`/annual`/KPIs idénticos.

### Bloque Actions (frontera) — tests primero (en rojo)

- [ ] T010 [P] [US1] Crear `src/infrastructure/primary/actions/create-tag-entry.action.test.ts` (rojo; patrón `create-category.action.test.ts` de 026, `vi.mock`): sin `categoryId` → llama `CreateCategory` con el nombre (inferencia: sin padre ⇒ categoría); con `categoryId` → llama `CreateTag`; Zod rechaza `categoryId` no positivo y nombre vacío tras trim; traducción de errores de dominio a mensajes ES de data-model §4.1/§5 (`Ya existe una etiqueta con el nombre "{X}".` / `Ya existe una categoría con el nombre "{X}".` / `La categoría seleccionada ya no está disponible.`; otro `DomainError` → «No se ha podido completar la operación. Inténtalo de nuevo.»); `revalidatePath("/", "layout")` en éxito; estados «Etiqueta creada»/«Categoría creada»

### Bloque UI — tests primero (en rojo)

- [ ] T011 [P] [US1] Crear `src/infrastructure/primary/ui/create-tag-dialog.test.tsx` (rojo; ui-contract §2/§6): `dialog «Nueva etiqueta»` con `textbox «Nombre»` controlado (`autoFocus`) y `combobox «Categoría»` con todas las categorías (genérica primera), **sin selección inicial** y opción `Ninguna — se creará una categoría`; submit sin padre → `createTagEntry` sin `categoryId`, con padre → con `categoryId`; error conserva el nombre tecleado con `role="alert"` + `aria-describedby` (esc. 3); «Cancelar»/«Crear» deshabilitados con `isPending` (doble envío); toasts «Etiqueta creada»/«Categoría creada»; cancelar no compromete nada
- [ ] T012 [P] [US1] Extender `src/infrastructure/primary/ui/tag-catalog.test.tsx` (rojo; ui-contract §1/§6): cada categoría es un **contenedor** (`section aria-label="Categoría {nombre}"` con borde `rounded-lg border`) y las filas de etiqueta quedan **sangradas dentro** (contenedor vs contenido, sin dos listados hermanos); **un único** botón de creación `button «Nueva etiqueta»` y **no existe** `button «Nueva categoría»`; `CreateTagDialog` montado a nivel del listado; filas/menús ⋮/chips/estado vacío y orden de grupos idénticos a 026 (el DTO `ListTagCatalog` no cambia)
- [ ] T013 [P] [US1] Extender `src/infrastructure/primary/ui/movement-form.test.tsx` (rojo; ui-contract §3/§6): prop `tagGroups: ActiveTagGroupDTO[]` sustituye a `tags: TagDTO[]`; cabeceras de categoría visibles como texto (`SelectLabel`, **sin rol `option`** — no seleccionables, FR-005); sin cabeceras de grupos vacíos (render directo del DTO, esc. 8); «Sin etiqueta» solo en ingresos como ítem plano primero; `input hidden name="tagId"` y semántica del valor intactos (FR-004); extra 017 aparece dentro del grupo de la genérica; edición con etiqueta inactiva conserva el comportamiento vigente

### Bloque Actions — implementación

- [ ] T014 [US1] Crear `src/infrastructure/primary/actions/create-tag-entry.action.ts` (data-model §4.1; composición inline `new CreateTag(new DrizzleTagRepository(db), new DrizzleTagCategoryRepository(db))` / `new CreateCategory(new DrizzleTagCategoryRepository(db))`): `tagEntrySchema = z.object({ name: z.string().trim().min(1, "El nombre es obligatorio."), categoryId: z.coerce.number().int().positive().optional() })` (el `""` del Select vacío → ausente), `TagEntryActionState` (`idle | success | error`), **despacho por presencia de `categoryId`** (la inferencia vive en la frontera, research §1/§4), traducción de errores y `revalidatePath("/", "layout")` → T010 en verde

### Bloque UI `/tags` — implementación

- [ ] T015 [US1] Crear `src/infrastructure/primary/ui/create-tag-dialog.tsx` (patrón `rename-tag-dialog.tsx` para el input controlado + patrón `move-tag-dialog.tsx` para el Select controlado con `input hidden` del id; `useActionState(createTagEntry)` con efecto de éxito cierra + toast; foco inicial en «Nombre») → T011 en verde
- [ ] T016 [US1] Modificar `src/infrastructure/primary/ui/tag-catalog.tsx` (ui-contract §1–§2): eliminar el botón «Nueva categoría» y `CreateCategoryDialog`; cada categoría pasa a contenedor `rounded-lg border` con cabecera dentro (nombre + cardinal + ⋮) y `ul` de filas sangrada dentro; único botón «Nueva etiqueta» en la cabecera del catálogo que abre `CreateTagDialog` montado **a nivel del listado** con las categorías derivadas de `groups` (genérica primera, ya ordenadas por `ListTagCatalog`); ajuste menor de `src/app/tags/page.tsx` solo si el diálogo necesita el listado explícito → T012 en verde
- [ ] T017 [US1] Jubilar `src/infrastructure/primary/ui/create-category-dialog.tsx` + `create-category-dialog.test.tsx` y `src/infrastructure/primary/actions/create-category.action.ts` + `create-category.action.test.ts` (sin llamadores tras T016: la vía categoría pasa por `createTagEntry`); podar `createCategorySchema` de `src/infrastructure/primary/actions/category-actions.schema.ts` conservando los esquemas/estados que `rename-category`/`delete-category`/`move-tag-to-category` sigan usando (sin código muerto, criterio 026)

### Bloque UI selector agrupado — implementación

- [ ] T018 [US1] Modificar `src/infrastructure/primary/ui/movement-form.tsx` (ui-contract §3): prop `tagGroups` y `SelectContent` con «Sin etiqueta» (`NO_TAG_VALUE`, solo ingresos) como ítem plano primero + un `SelectGroup` por categoría con `SelectLabel {categoría}` + `SelectItem` por etiqueta activa (importar `SelectGroup`/`SelectLabel` de `./components/ui/select`, ya versionados); el extra 017 (`createdTags`) se fusiona en el grupo de la genérica por `categoryId` (o crea su grupo si no existe); `input hidden` y `onTagCreated` intactos → T013 en verde
- [ ] T019 [US1] Modificar `src/infrastructure/primary/ui/create-movement-dialog.tsx` + `edit-movement-dialog.tsx` (+ sus `.test.tsx`): prop `tagGroups: ActiveTagGroupDTO[]`; el estado `extraTags` fusiona por `categoryId`/`categoryName` dentro del grupo correspondiente (fin del sort plano — el orden vive en el DTO, constitución VII); `onTagCreated` tipado con el `TagDTO` enriquecido; mecánica de tanda (`key={savedCount}`, `carry`) intacta (esc. 9)
- [ ] T020 [US1] Modificar `src/infrastructure/primary/ui/grouped-movement-list.tsx` (+ `grouped-movement-list.test.tsx`): prop `tagGroups` desde la página a `EditMovementDialog`/`CreateMovementDialog` (los diálogos de fila siguen montados a nivel del listado, convención AGENTS.md)
- [ ] T021 [US1] Modificar `src/app/accounts/[accountId]/page.tsx`: sustituir `ListActiveTags` (líneas 9 y 91) por `new ListGroupedActiveTags(tagRepository, new DrizzleTagCategoryRepository(db))` y pasar `tagGroups` al listado (una lectura agrupada por render, plan «Performance Goals»); **jubilar** `src/application/tag/ListActiveTags.ts` + `ListActiveTags.test.ts` (sin llamadores, espejo del jubileo `ListTags`→`ListTagCatalog` de 026)
- [ ] T022 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (incluye el resto de suites existentes: cambio no destructivo, FR-006/SC-003 parcial; las suites de `/summary`, `/annual`, KPIs y materializaciones sin cambios esperados)

**Checkpoint**: US1 funcional: `/tags` con árbol contenedor y creación única por inferencia; selector «Etiqueta» agrupado con cabeceras no seleccionables; inline 017 en la genérica; suites de aplicación, actions y componentes en verde.

---

## Phase 4: E2E del flujo crítico (FR-008, constitución III)

**Purpose**: Spec nueva en fichero propio con la combinación verificada libre por research §6: **Cuenta de Miembro A (`/accounts/1`) + Enero de 2026** (`?month=2026-01`, mes cerrado sin lectores posteriores). `jerarquia-etiquetas` corre entre `ingresos-regulares` y `kpis-fijos-cuenta` (posición alfabética J) sobre `e2e.sqlite` compartida (`workers: 1`); la **restauración del catálogo global al terminar** (borrar movimiento + mover etiqueta a la genérica + eliminar categoría) es obligatoria para que los ficheros posteriores encuentren el catálogo en su estado.

- [ ] T023 [US1] Crear `e2e/jerarquia-etiquetas.spec.ts` (serial en el fichero, helpers espejo de `e2e/categorias-tags.spec.ts`) cubriendo el flujo crítico «categoría inline → etiqueta → movimiento»: **J1** en `/tags`, «Nueva etiqueta» con nombre «Suscripciones» y categoría **sin seleccionar** → toast «Categoría creada» y grupo nuevo vacío («Sin etiquetas») ordenado tras la genérica (esc. 2, FR-002); **J2** duplicado case-insensitive sin padre → alerta `Ya existe una categoría con el nombre "Suscripciones".` con el valor conservado (esc. 3); **J3** «Nueva etiqueta» → «Netflix» con padre «Suscripciones» → toast «Etiqueta creada» y fila dentro del grupo (esc. 1/2); **J4** registrar un gasto con «Netflix» en la Cuenta de Miembro A + Enero 2026 (combinación propia): el Select «Etiqueta» desplegado muestra la cabecera «Suscripciones» como texto **sin rol `option`** y «Netflix» como opción en su grupo (esc. 5/6, FR-004/005); **J5** restauración: borrar el movimiento de prueba, mover «Netflix» a la genérica (⋮ «Mover a categoría…»), eliminar la categoría «Suscripciones» ahora vacía (⋮ → «Eliminar…») y verificar el catálogo como al inicio + «Netflix» activa en General (misma disciplina que `categorias-tags.spec.ts` G8)
- [ ] T024 [US1] Ejecutar `npm run test:e2e` y verificar las 17 specs en verde (las 16 existentes **sin cambios esperados** — en particular `creacion-tags.spec.ts`, `gestion-tags.spec.ts` y `categorias-tags.spec.ts` siguen verdes: restauración de research §6; ajustar solo si un literal afectado lo exigiese)

**Checkpoint**: Flujo crítico «inferencia → etiqueta → movimiento → restauración» cubierto end-to-end (SC-001/SC-002/SC-004).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva, convenciones y roadmap actualizados en el mismo cambio (constitución III DoD, FR-007). **Sin ADR nuevo** (research §7: no hay decisión estructural — la inferencia de tipo queda congelada en el ui-contract y la extensión de `CreateTag` es evolución de firma).

- [ ] T025 [P] Actualizar `AGENTS.md`: nueva convención «Jerarquía y creación única (027)» amendando la sección «Categorías del catálogo de etiquetas (026)» — única vía «Nueva etiqueta» con inferencia de tipo (sin padre ⇒ categoría), árbol contenedor en `/tags`, Select «Etiqueta» agrupado con `SelectLabel` no seleccionables, `ListGroupedActiveTags` jubila `ListActiveTags`, extras 017 con DTO enriquecido, jubilaciones de `create-category.action`/`CreateCategoryDialog` y `CreateTag` con `categoryId?`
- [ ] T026 [P] Actualizar la documentación viva de `docs/architecture/` (base: los diagramas de plan.md y data-model §7): `diagrams/domain-model.md` añade `ListGroupedActiveTags`/`ActiveTagGroupDTO` y la firma extendida de `CreateTag`; nuevo diagrama de secuencia de la creación por inferencia (`createTagEntry` → `CreateCategory`/`CreateTag`, reutilizando el del plan); revisar y anotar `overview.md`, `diagrams/gestion-tags-secuencia.md`, `diagrams/categorias-secuencia.md` y `diagrams/c4.md` donde mencionen el catálogo o el Select plano
- [ ] T027 [P] Actualizar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-007): añadir la fila `027-gestion-etiquetas` marcada **Completada** y re-referenciar la nota del informe del mes por categorías de **~027** a **~028** (anotada el 2026-11-02, research §7)
- [ ] T028 Validar manualmente los escenarios Q1–Q8 de `specs/027-gestion-etiquetas/quickstart.md` con `npm run db:migrate && npm run db:seed && npm run dev` (Q5.3 desactivando temporalmente etiquetas de una categoría para verificar que no pinta cabecera vacía); dejar el estado limpio al terminar (categorías de prueba eliminadas, etiquetas devueltas a su categoría)
- [ ] T029 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-004, DoD)

**Checkpoint**: Documentación viva, AGENTS.md, diagramas, roadmap y quickstart sincronizados con la implementación; feature entregada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Depende de Phase 1. Tests rojo primero (T003 ∥ T004 ∥ T005, ficheros distintos), luego impl (T006 ∥ T007 ∥ T008 por ficheros; T009 tras T006). **Bloquea toda US1**: el diálogo `/tags` necesita `CreateTag` extendido (T007) y las dos superficies consumen los DTOs (T006) y `ListGroupedActiveTags` (T008).
- **US1 (Phase 3)**: Depende de Phase 2. Dos cadenas independientes que pueden intercalarse o repartirse: **(a) frente `/tags`** T010 → T014 → T011 → T015 → T012 → T016 → T017; **(b) frente selector agrupado** T013 → T018 → T019 → T020 → T021. Gate T022 al final con ambas cadenas completas.
- **E2E (Phase 4)**: Depende de Phase 3 completa (UI operativa para validar el flujo).
- **Polish (Phase 5)**: Depende de todas las anteriores (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US1 (P1, única)**: Sin dependencias entre historias (constitución II: una sola US). Independientemente testable vía quickstart Q1–Q8 y las suites por capa; el MVP de la feature es la propia US1 completa (Phase 1–4).

### Within Each User Story

- Tests primero y en rojo antes de su SUT: T003–T005 → T006–T009 (Phase 2); T010 → T014; T011 → T015; T012 → T016; T013 → T018 (Phase 3).
- T013/T018 cambian la prop `tags`→`tagGroups` de `MovementFormFields`: la compilación de diálogos/listado/tests se restaura en T019/T020 — el verde integral se verifica en T022, no bloquea el orden por bloques (espejo de la nota T012 de 026).
- T017 (jubilar `create-category`) solo tras T016 (pérdida del último llamador); T021 (jubilar `ListActiveTags`) solo tras el cambio de llamador de la página de cuenta.
- Actions (T014) antes que el diálogo que la invoca (T015).
- Unit/component gates (T022) antes del e2e (T023–T024); gates completos acumulativos al final (T029).

### Parallel Opportunities

- Phase 2: T003 ∥ T004 ∥ T005 (tests); T006 ∥ T007 ∥ T008 (impl, ficheros distintos).
- Phase 3 tests: T010 ∥ T011 ∥ T012 ∥ T013 (ficheros distintos).
- Phase 3 cadenas: frente `/tags` (a) y frente selector (b) en paralelo — no comparten ficheros.
- Phase 5: T025 ∥ T026 ∥ T027 (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Aplicación — tests en rojo en paralelo (ficheros distintos):
Task: "Extender CreateTag.test.ts con categoryId (rojo)"
Task: "Crear ListGroupedActiveTags.test.ts (rojo)"
Task: "Extender create-tag.action.test.ts con DTO enriquecido (rojo)"

# US1 — tests de componentes en rojo en paralelo (ficheros distintos):
Task: "Crear create-tag-entry.action.test.ts (rojo)"
Task: "Crear create-tag-dialog.test.tsx (rojo)"
Task: "Extender tag-catalog.test.tsx con árbol contenedor (rojo)"
Task: "Extender movement-form.test.tsx con Select agrupado (rojo)"

# US1 — las dos cadenas de adaptadores en paralelo (sin ficheros compartidos):
# (a) /tags:    create-tag-entry.action.ts → create-tag-dialog.tsx → tag-catalog.tsx → jubilar create-category
# (b) selector: movement-form.tsx → create/edit-movement-dialog.tsx → grouped-movement-list.tsx → page.tsx + jubilar ListActiveTags

# Docs de Phase 5 en paralelo (ficheros distintos):
Task: "Actualizar AGENTS.md (convención Jerarquía y creación única 027)"
Task: "Actualizar docs/architecture/ (domain-model + secuencia creación + notas)"
Task: "Añadir fila 027 Completada al roadmap maestro + nota ~027 → ~028"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Complete Phase 1: línea base verde y rama feature
2. Complete Phase 2: núcleo de aplicación (DTOs, `CreateTag` con `categoryId?`, `ListGroupedActiveTags`, DTO 017 enriquecido)
3. Complete Phase 3: US1 por cadenas (actions → UI `/tags` ∥ UI selector agrupado), tests rojo primero en cada SUT; gate T022 en verde
4. **STOP and VALIDATE**: validación manual Q1–Q6 con `npm run dev` (Q5.3 y Q8 con datos de prueba)
5. Complete Phase 4: e2e `jerarquia-etiquetas.spec.ts` con restauración obligatoria + suite completa (17) en verde
6. Complete Phase 5: AGENTS.md, diagramas vivos, roadmap (FR-007), Q1–Q8 completos y gates totales (SC-004)

### Incremental Delivery

- Feature de una sola US (constitución II): el valor de usuario llega con Phase 3 — al terminar T021 ya se crean etiquetas/categorías desde `/tags` y el selector agrupa; Phase 4 asegura el flujo crítico end-to-end y Phase 5 cierra el DoD.

### Parallel Team Strategy

- Para 1 desarrollador (real): secuencial por bloques con los [P] internos como confirmaciones atómicas. Con varios: las dos cadenas de Phase 3 (frente `/tags` y frente selector) pueden repartirse; las cadenas críticas (T014→T015→T016→T017 y T018→T019→T020→T021) no se parten.

---

## Notes

- [P] tasks = different files, no dependencies
- **La inferencia de tipo vive en la frontera** (research §1/§4): `createTagEntry` despacha por presencia de `categoryId` a `CreateCategory`/`CreateTag`; cada caso de uso conserva sus invariantes (unicidad por catálogo, trim, slug). Sin caso de uso compuesto (YAGNI, principio I).
- **FR-005 por construcción**: `SelectLabel` de Radix no es ítem — ni clic ni foco ni teclado ni typeahead pueden elegir una categoría; el modelo ya lo garantizaba (`movements.tag_id` → `tags.id`).
- `ListGroupedActiveTags` agrupa, filtra vacías y ordena; la UI **solo anida** el DTO pre-ordenado (constitución VII); `ListActiveTags` se jubila sin llamadores (política 026/025)
- El orden del Select del diálogo «Nueva etiqueta» y del árbol hereda el del DTO (`ListTagCatalog`/`ListGroupedActiveTags`): genérica primera (`DEFAULT_CATEGORY_SLUG`), sin reordenar en cliente
- Revalidación única de la action nueva: `revalidatePath("/", "layout")` (las etiquetas alimentan los Select de movimiento y la layout cubre `/tags`); las actions de categoría 026 siguen revalidando `/tags`
- **Intocable (FR-006)**: `Movement`, dominio, esquema y migraciones, `/summary`, `/annual`, página de cuenta (más allá del cambio de lector de tags), KPIs, materializaciones, acciones 004/017 (más allá del DTO enriquecido), fila de etiqueta y sus diálogos
- E2E: fichero propio, Miembro A + Enero 2026 (cerrado, sin interferencias, verificado por grep en `e2e/`), posición alfabética J (entre `ingresos-regulares` y `kpis-fijos-cuenta`), **restauración del catálogo global** al terminar (borrar movimiento + mover etiqueta a la genérica + eliminar categoría) — deja el catálogo como estaba +1 etiqueta activa en General (research §6)
- Commit after each task or logical group (Conventional Commits, en español el enunciado cuando aporte claridad)
