---

description: "Task list for feature 026 implementation"
---

# Tasks: Categorías de etiquetas — organización del catálogo

**Input**: Design documents from `/specs/026-categorias-tags/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-010 los exige explícitamente (dominio/aplicación de la lógica de categorías, componentes de `/tags` y un flujo e2e «crear categoría → mover etiqueta → histórico intacto»; constitución III). Co-localizados junto a su SUT (`*.test.ts(x)`, AGENTS.md «Tests»).

**Organization**: Una única user story pequeña (US1, P1 — constitución II, sin excepción): organizar el catálogo de etiquetas en categorías desde `/tags`. Superficie de cambio (plan «Project Structure»): agregado nuevo `tag-category` (dominio + puerto + 3 casos de uso), extensión de `Tag` (`categoryId` obligatorio + `moveToCategory`), `MoveTagToCategory` + `CreateTag` ampliado + `ListTagCatalog` (jubila `ListTags`), tabla `tag_categories` + `tags.category_id` NOT NULL FK RESTRICT (migración `0008` con backfill, SC-001), 4 Server Actions + 4 diálogos + `tag-catalog.tsx` agrupado, e2e propia y documentación (FR-009). **Cero cambios** en `Movement`, agregados de lectura, `/summary`, `/annual`, formularios de movimiento y Select «Etiqueta» plano (FR-008).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js (App Router): `src/` en la raíz del repositorio; e2e en `e2e/`; migraciones en `drizzle/`; seed en `scripts/seed.ts`; docs vivos en `docs/architecture/`; roadmap maestro en `specs/001-family-wallet/spec.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar línea base verde y la rama feature antes de tocar código.

- [X] T001 Verificar línea base verde ejecutando `npm run lint && npm run typecheck && npm run test` (todo debe pasar antes de cualquier cambio)
- [X] T002 Confirmar la rama `feature/026-categorias-tags` activa y el árbol limpio (creada por la extensión git de Spec Kit; worktree actualizado si se usa)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la implementación.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura compartida que bloquea toda la historia: slug compartido (dominio) y puesta en marcha de persistencia (esquema + migración con backfill + seed, SC-001). La modificación de `Tag.ts` (T012) NO está aquí: es trabajo de la US1.

- [X] T003 [P] Extraer `deriveSlug` al nuevo `src/domain/shared/slug.ts` (movimiento del algoritmo de `src/domain/tag/TagSlug.ts`, que pasa a re-exportarlo como `deriveTagSlug`) — API pública y `TagSlug.test.ts` intactos y en verde (research §1: un solo dueño del algoritmo para tags y categorías)
- [X] T004 [P] Esquema Drizzle de la tabla nueva y la FK: crear `src/infrastructure/db/schema/tag-categories.ts` (`id` autoincrement, `name` text NOT NULL, `slug` text NOT NULL UNIQUE, `uniqueIndex("tag_categories_name_nocase_uq").on(sql\`lower(name)\`)` — data-model §4.1); modificar `src/infrastructure/db/schema/tags.ts` añadiendo `categoryId: integer("category_id").notNull().references(() => tagCategories.id, { onDelete: "restrict" })`; exportar `tagCategories` en `src/infrastructure/db/schema/index.ts`
- [X] T005 Crear la migración `drizzle/0008_categorias-tags.sql` (+ entrada en `drizzle/meta/_journal.json` y snapshot `0008_snapshot.json`) con el orden congelado de data-model §4.2: (1) `CREATE TABLE tag_categories` + índices (`slug` UNIQUE, `lower(name)` UNIQUE); (2) `INSERT OR IGNORE INTO tag_categories (name, slug) VALUES ('General', 'general')` (precedente `0004`); (3) reconstrucción de `tags` (ADD COLUMN NOT NULL imposible en SQLite): `CREATE TABLE` nueva con el esquema resultante → `INSERT INTO nueva SELECT id, name, slug, status, (SELECT id FROM tag_categories WHERE slug = 'general') FROM tags` → `DROP TABLE tags` → `RENAME` → recrear índices de tags — **los ids se conservan**, `movements.tag_id` intacto (SC-001); aplicar con `npm run db:migrate` sobre `db.sqlite` y verificar que el 100 % de las etiquetas preexistentes quedan en «General» sin tocar name/slug/status
- [X] T006 Extender el seed para categorías: `SEED_CATEGORIES = [{ name: "General", slug: "general" }]` en `src/infrastructure/db/seed-data.ts`; en `scripts/seed.ts` insertar las categorías primero (`onConflictDoNothing` por slug) y resolver el id de la genérica para sembrar los `SEED_TAGS` con `category_id` (idempotencia intacta, AGENTS.md «Seed»); verificar `npm run db:seed` idempotente (segunda ejecución sin cambios)

**Checkpoint**: Persistencia lista: esquema, migración `0008` con backfill aplicada y seed idempotente con categorías; `deriveSlug` compartido disponible para dominio de tags y categorías.

---

## Phase 3: User Story 1 - Organizar el catálogo de etiquetas en categorías (Priority: P1) 🎯 MVP

**Goal**: `/tags` muestra el catálogo agrupado por categorías (genérica «General» siempre primera): crear categorías («Nueva categoría»), renombrarlas, mover etiquetas de una en una («Mover a categoría…») y eliminar categorías vacías (la genérica protegida); toda etiqueta nueva —incluida la inline de 017— nace en la genérica (FR-007); sin tocar movimientos ni informes (FR-008).

**Independent Test**: Quickstart Q1–Q7: BD migrada → todas las etiquetas bajo «Categoría General»; crear «Alimentación» → grupo vacío ordenado; «hogar» vs «Hogar» → duplicado con valor conservado; mover «Supermercado» → cambia de grupo sin recarga; histórico y `/summary`//`annual` idénticos; renombrar grupo; eliminar con etiquetas → error, vacía → desaparece; «+ Nueva etiqueta» de 017 → nace en la genérica.

### Bloque Dominio — tests primero (en rojo)

- [X] T007 [P] [US1] Crear `src/domain/tag-category/TagCategory.test.ts` + `src/domain/tag-category/DefaultCategory.test.ts` (rojo; research §7): `TagCategory.create` trimea y rechaza nombre/slug vacíos, `rehydrate` fija id, `rename` conserva id y slug (inmutable, paridad ADR 0018); `DEFAULT_CATEGORY_SLUG === "general"` e `isDefaultCategorySlug` verdadero solo para ese slug
- [X] T008 [P] [US1] Extender `src/domain/tag/Tag.test.ts` (rojo): `categoryId` presente desde `create` y `rehydrate` (invariante FR-001 por construcción); `moveToCategory` devuelve nueva instancia con solo la categoría cambiada; `rename`/`withStatus` conservan `categoryId`

### Bloque Dominio — implementación

- [X] T009 [P] [US1] Crear `src/domain/tag-category/TagCategoryId.ts` (brand espejo de `TagId.ts`, entero > 0 en construcción) y `src/domain/tag-category/TagCategoryErrors.ts` con los 5 errores de dominio y sus mensajes ES congelados de data-model §1.2 (`InvalidCategoryError`, `DuplicateCategoryNameError` con `Ya existe una categoría con el nombre "{name}".`, `CategoryNotFoundError`, `ProtectedCategoryError`, `CategoryNotEmptyError`) — extienden `DomainError`
- [X] T010 [P] [US1] Crear `src/domain/tag-category/DefaultCategory.ts` (módulo puro espejo de `SystemTags.ts`: `DEFAULT_CATEGORY_SLUG = "general"` único dueño del literal + `isDefaultCategorySlug(slug)`) → T007 (parte `DefaultCategory`) en verde
- [X] T011 [P] [US1] Crear `src/domain/tag-category/TagCategory.ts` (entidad congelada, paridad de estilo con `Tag.ts`: `create(input: { name, slug })` con trim+validación, `rehydrate(id, name, slug)`, `rename(name)` conservando id y slug; unicidad NO vive en la entidad) → T007 en verde
- [X] T012 [US1] Modificar `src/domain/tag/Tag.ts`: `TagInput` y `rehydrate` ganan `categoryId: TagCategoryId` **obligatorio** y nuevo método `moveToCategory(categoryId)` (única vía de cambio de pertenencia); `rename`/`withStatus` lo conservan → T008 en verde (nota: este cambio rompe la compilación de `CreateTag`, `InMemoryCatalogTagRepository`, mappers y `DrizzleTagRepository` hasta T014/T022/T026/T028 — el gate de Phase 3 al final (T039) es el que debe quedar verde)

### Bloque Aplicación — puertos, DTOs y dobles

- [X] T013 [P] [US1] Crear el puerto `src/application/tag-category/CategoryRepository.ts` (constitución VII: `findAll`, `findById`, `findBySlug`, `findByName` case-insensitive, `save`, `update`, `delete`, `countTags` — data-model §3.1) y `src/application/tag-category/dto.ts` con `CategoryDTO { id: number; name: string; isDefault: boolean }`; el tipo `TagCatalogGroupDTO { category: CategoryDTO; tags: CatalogTagDTO[] }` se añade a `src/application/tag/dto.ts` (`CatalogTagDTO` sin cambios)
- [X] T014 [P] [US1] Crear `src/application/tag-category/InMemoryCategoryRepository.ts` (doble de tests, espejo de `InMemoryCatalogTagRepository.ts`: `findByName` compara en minúsculas, `countTags` cuenta por `categoryId`) y modificar `src/application/tag/InMemoryCatalogTagRepository.ts` para persistir/rehidratar `categoryId` en save/update/findAll (firma del puerto `TagRepository` intacta)

### Bloque Aplicación — tests primero (en rojo)

- [X] T015 [P] [US1] Crear `src/application/tag-category/CreateCategory.test.ts` + `RenameCategory.test.ts` + `DeleteCategory.test.ts` (rojo, doble `InMemoryCategoryRepository`): trim/vacío → `InvalidCategoryError`; duplicado case-insensitive («Hogar» vs «HOGAR») → `DuplicateCategoryNameError` y «Alimentación» vs «Alimentacion» **no** duplicado (sin normalizar acentos, edge); renombrado con duplicado autoexcluyéndose («luz»→«Luz» permitido, paridad `RenameTag`); genérica (slug `general`) renombrable pero no eliminable → `ProtectedCategoryError`; `countTags > 0` → `CategoryNotEmptyError`; id inexistente → `CategoryNotFoundError`
- [X] T016 [P] [US1] Crear `src/application/tag/MoveTagToCategory.test.ts` (rojo): mover válido cambia `categoryId`; **misma categoría = no-op con éxito sin escritura** (edge); tag inexistente → `TagNotFoundError`; categoría inexistente → `CategoryNotFoundError`; «Aportación Común» movible como cualquier etiqueta (edge, sin protección extra)
- [X] T017 [P] [US1] Extender `src/application/tag/CreateTag.test.ts` (toda etiqueta nace en la genérica resolviendo `findBySlug(DEFAULT_CATEGORY_SLUG)`; genérica ausente → `CategoryNotFoundError`) y crear `src/application/tag/ListTagCatalog.test.ts` (agrupación completa — cada tag bajo su grupo, ninguna pérdida; genérica primero; resto por `localeCompare("es")`; dentro del grupo activas primero y luego nombre — criterio vigente de `ListTags`)

### Bloque Aplicación — implementación

- [X] T018 [P] [US1] Crear `src/application/tag-category/CreateCategory.ts` (`execute({ name })`: trim → vacío lanza `InvalidCategoryError`; `findByName` → `DuplicateCategoryNameError`; slug = `deriveSlug` con sufijo `-2, -3…` ante colisión por `findBySlug`, estrategia de `CreateTag.ts:28-35`)
- [X] T019 [P] [US1] Crear `src/application/tag-category/RenameCategory.ts` (`execute({ categoryId, name })`: `findById` → `CategoryNotFoundError`; duplicado autoexcluyéndose; `category.rename(name)` conserva slug)
- [X] T020 [P] [US1] Crear `src/application/tag-category/DeleteCategory.ts` (`execute({ categoryId })`: NotFound; `isDefaultCategorySlug` → `ProtectedCategoryError`; `countTags > 0` → `CategoryNotEmptyError`; si no, `delete`)
- [X] T021 [P] [US1] Crear `src/application/tag/MoveTagToCategory.ts` (`execute({ tagId, categoryId })`: tag → `TagNotFoundError`, categoría → `CategoryNotFoundError`; misma categoría → no-op con éxito; si no, `tags.update(tag.moveToCategory(...))`)
- [X] T022 [US1] Modificar `src/application/tag/CreateTag.ts` (firma `execute({ name })` sin cambios): constructor gana `CategoryRepository`; resuelve `findBySlug(DEFAULT_CATEGORY_SLUG)` y construye el `Tag` con esa `categoryId` → toda etiqueta nueva nace en la genérica (FR-007, incluida la inline de 017 sin cambios de UI)
- [X] T023 [US1] Crear `src/application/tag/ListTagCatalog.ts` (`execute(): Promise<TagCatalogGroupDTO[]>`: lee categorías y tags, agrupa y ordena — genérica primero, resto `localeCompare("es")`, activas primero dentro de grupo; la UI solo anida, constitución VII) y **jubilar** `src/application/tag/ListTags.ts` + `ListTags.test.ts` (sin llamadores tras T038, política de barrido de 025)

**Checkpoint parcial**: dominio y aplicación verdes por SUT (T007–T017 en verde con T018–T023).

### Bloque Persistencia — tests primero (en rojo)

- [X] T024 [P] [US1] Crear `src/infrastructure/db/DrizzleTagCategoryRepository.test.ts` (rojo; libsql `:memory:` + migraciones de `drizzle/`, patrón `test-support.ts`): CRUD completo, `findByName` case-insensitive, `findBySlug`, `countTags`; violación de `tag_categories_name_nocase_uq` → `DuplicateCategoryNameError`; DELETE de categoría con etiquetas abortado por FK RESTRICT → `CategoryNotEmptyError` (red de seguridad, research §3)
- [X] T025 [P] [US1] Extender `src/infrastructure/db/DrizzleRepositories.test.ts` (rojo): backfill de `0008` — tags preexistentes quedan en la genérica conservando id/name/slug/status (SC-001); `DrizzleTagRepository.save`/`update` persisten `category_id` (alta nueva y renombrado rehidratan con su categoría); fusión `mergeInto` conserva la categoría de la superviviente y no deja huérfanas (edge de la spec)

### Bloque Persistencia — implementación

- [X] T026 [P] [US1] Crear `src/infrastructure/db/mappers/tag-category.mapper.ts` (fila ↔ `TagCategory`) y modificar `src/infrastructure/db/mappers/tag.mapper.ts` (rehidrata `categoryId` como `TagCategoryId`) + export en `mappers/index.ts`
- [X] T027 [P] [US1] Crear `src/infrastructure/db/DrizzleTagCategoryRepository.ts` (implementa `CategoryRepository`; traduce violación única → `DuplicateCategoryNameError`, espejo de `translateUniqueViolation` de `DrizzleTagRepository.ts:105-114`; RESTRICT del DELETE → `CategoryNotEmptyError`) → T024 en verde
- [X] T028 [US1] Modificar `src/infrastructure/db/DrizzleTagRepository.ts` (`save`/`update` incluyen `category_id`; `mergeInto` no toca la categoría de la superviviente) → T025 en verde

### Bloque Actions (frontera) — tests primero (en rojo)

- [X] T029 [P] [US1] Crear `src/infrastructure/primary/actions/category-actions.schema.ts`: esquemas Zod `createCategorySchema { name: trim().min(1) }`, `renameCategorySchema { categoryId: coerce.int().positive(), name: trim().min(1) }`, `deleteCategorySchema { categoryId }`, `moveTagSchema { tagId, categoryId }` + `CategoryActionState` (`idle | success | error`) espejo de `TagActionState` (ui-contract §4)
- [X] T030 [P] [US1] Crear `create-category.action.test.ts` + `rename-category.action.test.ts` + `delete-category.action.test.ts` + `move-tag-to-category.action.test.ts` en `src/infrastructure/primary/actions/` (rojo; patrón `rename-tag.action.test.ts`, `vi.mock`): validación Zod, traducción de errores de dominio a mensajes ES de data-model §1.2 (cualquier otro `DomainError` → «No se ha podido completar la operación. Inténtalo de nuevo.»), `revalidatePath("/tags")` en éxito

### Bloque Actions — implementación

- [X] T031 [P] [US1] Crear `src/infrastructure/primary/actions/create-category.action.ts` + `rename-category.action.ts` (composición inline `new UC(new DrizzleTagCategoryRepository(db))`; validan con Zod, delegan, traducen errores, `revalidatePath("/tags")` — solo `/tags`, research §5)
- [X] T032 [P] [US1] Crear `src/infrastructure/primary/actions/delete-category.action.ts` + `move-tag-to-category.action.ts` (este compone `DrizzleTagRepository` + `DrizzleTagCategoryRepository`) y **actualizar la composición de `create-tag.action.ts`** (constructor de `CreateTag` gana `DrizzleTagCategoryRepository(db)`; comportamiento y revalidación layout intactos)

### Bloque UI — tests primero (en rojo)

- [X] T033 [P] [US1] Extender `src/infrastructure/primary/ui/tag-catalog.test.tsx` (rojo; ui-contract §1/§2/§6): recibe `groups: TagCatalogGroupDTO[]`; un `region` «Categoría {nombre}» por grupo con cabecera (nombre + «{N} etiquetas»/«Sin etiquetas») y menú ⋮ «Acciones de la categoría {nombre}» (genérica: solo «Renombrar…»; resto: «Renombrar…» + «Eliminar…»); fila de etiqueta idéntica con ítem «Mover a categoría…» en primera posición del ⋮; fila protegida «Aportación Común» con menú cuyo único ítem es «Mover a categoría…»; botón «Nueva categoría»; estado vacío global dentro de la genérica; orden de grupos tal cual llega del DTO (la UI no ordena)
- [X] T034 [P] [US1] Crear `create-category-dialog.test.tsx` + `rename-category-dialog.test.tsx` + `delete-category-dialog.test.tsx` + `move-tag-dialog.test.tsx` en `src/infrastructure/primary/ui/` (rojo; ui-contract §3): inputs controlados que **conservan el valor tecleado** ante error con `role="alert"` + `aria-describedby` (esc. 3); `alertdialog` de eliminación con texto «Se eliminará la categoría "{X}". Las etiquetas no se verán afectadas.»; Select «Categoría» de `MoveTagDialog` con todas las categorías **excepto la actual**, sin creación en línea, «Mover» deshabilitado sin selección; doble envío deshabilitado con `isPending`; toasts de éxito («Categoría creada»/«Categoría renombrada»/«Categoría eliminada»/«Etiqueta movida a {categoría}»)

### Bloque UI — implementación

- [X] T035 [P] [US1] Crear `src/infrastructure/primary/ui/create-category-dialog.tsx` + `rename-category-dialog.tsx` (patrón `rename-tag-dialog.tsx`: `useState` controlado, `useActionState`, alerta accesible, toasts)
- [X] T036 [P] [US1] Crear `src/infrastructure/primary/ui/delete-category-dialog.tsx` (confirmación `alertdialog` estilo `deactivate-tag-dialog.tsx`, destructive) + `move-tag-dialog.tsx` (Select controlado + input hidden con el id y `autoFocus` en el trigger, patrón `merge-tags-dialog.tsx:79-81` para excluir la categoría actual)
- [X] T037 [US1] Modificar `src/infrastructure/primary/ui/tag-catalog.tsx` (client; ui-contract §1–§3): prop `groups` y render por categoría de `<section aria-label="Categoría {nombre}">` con cabecera (nombre + cardinal/hint «Sin etiquetas») y menú ⋮ ≥ 44 px `aria-label="Acciones de la categoría {nombre}"`; botón «Nueva categoría» en la cabecera del catálogo; fila de etiqueta idéntica a la actual con «Mover a categoría…» como primer ítem del ⋮; los 4 diálogos nuevos montados **a nivel del listado** con el DTO capturado en estado del cliente (convención «Diálogos por fila» de AGENTS.md — nunca dentro de la fila ni del grupo, que pueden desmontarse tras `revalidatePath`); sin colapso, todos los grupos desplegados
- [X] T038 [US1] Modificar `src/app/tags/page.tsx`: ejecutar `new ListTagCatalog(new DrizzleTagRepository(db), new DrizzleTagCategoryRepository(db))` (firma definitiva según T023) y pasar `groups` a `TagCatalog`; resto de la página intacto
- [X] T039 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (incluye el resto de suites existentes: cambio no destructivo, FR-008/SC-003 parcial)

**Checkpoint**: US1 funcional: `/tags` agrupado con crear/renombrar/eliminar categorías y mover etiquetas; etiquetas nuevas (catálogo 004 e inline 017) nacen en la genérica; suites de dominio, aplicación, repositorios, actions y componentes en verde.

---

## Phase 4: E2E del flujo crítico (FR-010, constitución III)

**Purpose**: Spec nueva en fichero propio con la combinación verificada libre por research §6: **Cuenta de Miembro A (`/accounts/1`) + Octubre de 2026** (mes cerrado, sin lectores ni materialización). `categorias-tags` corre en 2ª posición alfabética (tras `aportacion-comun`) sobre `e2e.sqlite` compartida (`workers: 1`); la **restauración del catálogo global al terminar** (devolver la etiqueta movida a la genérica y eliminar la categoría creada) es obligatoria para que `creacion-tags`/`gestion-tags` encuentren el catálogo exacto.

- [X] T040 [US1] Crear `e2e/categorias-tags.spec.ts` (serial en el fichero, helpers espejo de `e2e/gestion-tags.spec.ts`) cubriendo el flujo crítico: **G1** en `/tags`, todas las etiquetas del seed agrupadas bajo «Categoría General» (esc. 1, backfill visible); **G2** crear categoría «Alimentación» → grupo vacío «Sin etiquetas» ordenado tras la genérica (esc. 2); **G3** duplicado: intentar «alimentación» → alerta `Ya existe una categoría con el nombre "Alimentación".` con el valor conservado (esc. 3); **G4** registrar un movimiento con la etiqueta «Supermercado» en la Cuenta de Miembro A + Octubre 2026 (combinación propia), memorizar su fila (etiqueta e importe), mover «Supermercado» a «Alimentación» → toast y fila reapareciendo en el grupo destino **sin recarga manual** (esc. 4); **G5** histórico intacto: el movimiento sigue mostrando «Supermercado» con mismo importe y fecha; `/summary` y `/annual` con las mismas filas por etiqueta que antes de mover (esc. 5, SC-003); **G6** renombrar la categoría a «Comida» → grupo con nuevo nombre y etiquetas dentro (esc. 6); **G7** intentar eliminar «Comida» con etiquetas → alerta de `CategoryNotEmptyError` (esc. 7); **G8** restauración: mover «Supermercado» de vuelta a la genérica, eliminar «Comida» (ahora vacía → éxito, ejercita esc. 7 segunda parte), borrar el movimiento de prueba, y verificar el catálogo igual que al inicio
- [X] T041 [US1] Ejecutar `npm run test:e2e` y verificar las 16 specs en verde (las 15 existentes **sin cambios esperados** — en particular `creacion-tags.spec.ts` y `gestion-tags.spec.ts` siguen verdes: restauración de research §6; ajustar solo si un literal afectado lo exigiese)

**Checkpoint**: Flujo crítico «crear categoría → mover etiqueta → histórico intacto» cubierto end-to-end con restauración del estado compartido (SC-002–SC-004).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva, convenciones y roadmap actualizados en el mismo cambio (constitución III DoD, FR-009). Incluye **ADR 0022 nuevo** (research §7: la taxonomía categoría/pertenencia y su esquema son decisión arquitectónica propia; 0018 queda como contexto).

- [X] T042 [P] Crear `docs/architecture/adr/0022-tag-categories.md` (consolida research §1–§3: agregado `TagCategory` con slug inmutable como identidad, genérica identificada por `DEFAULT_CATEGORY_SLUG` — no por flag ni nombre, pertenencia como `tags.category_id` NOT NULL con FK `ON DELETE RESTRICT`, backfill en la migración `0008`)
- [X] T043 [P] Actualizar `AGENTS.md` (FR-009): nueva convención «Categorías del catálogo de etiquetas (026)» (taxonomía 1..N por categoría con pertenencia única y obligatoria atributo de la etiqueta; genérica por slug constante renombrable no eliminable; gestión solo en `/tags` con diálogos a nivel del listado; `ListTagCatalog` agrupado — la UI solo anida; revalidación acotada a `/tags`; informes intactos) y amendar la sección «Seed» (ahora también `SEED_CATEGORIES` por slug)
- [X] T044 [P] Actualizar la documentación viva de `docs/architecture/` (base: los diagramas de plan.md y data-model §7): `diagrams/domain-model.md` añade `TagCategory` + relación `Tag → TagCategory`; nuevo `diagrams/categorias-secuencia.md` (secuencia de mover etiqueta); revisar y anotar `overview.md`, `diagrams/gestion-tags-secuencia.md` y `diagrams/c4.md` donde mencionen el catálogo de etiquetas
- [X] T045 [P] Actualizar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-009): añadir la fila `026-categorias-tags` marcada **Completada** (hoy no existe en la tabla) — la nota de diferimiento de la visión por categorías en informes ya está registrada como feature futura (~027, commit 2026-11-02)
- [X] T046 Validar manualmente los escenarios Q1–Q7 de `specs/026-categorias-tags/quickstart.md` con `npm run db:migrate && npm run db:seed && npm run dev` sobre BD con datos previos (Q1 verifica el backfill, SC-001); dejar el estado limpio al terminar (categorías de prueba eliminadas, etiquetas devueltas a su categoría)
- [X] T047 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-004, DoD)

**Checkpoint**: Documentación viva, ADR, AGENTS.md, roadmap y quickstart sincronizados con la implementación; feature entregada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Depende de Phase 1. T003 ∥ T004 (ficheros distintos); T005 tras T004 (la migración materializa el esquema); T006 tras T004–T005 (el seed necesita tabla y migración aplicada). **Bloquea todo US1** (dominio usa `deriveSlug`; tests de repositorio y e2e necesitan `0008`).
- **US1 (Phase 3)**: Depende de Phase 2. Dentro: tests rojo → impl por bloque (Dominio → Aplicación → Persistencia → Actions → UI), con `page.tsx` (T038) al final y el gate T039.
- **E2E (Phase 4)**: Depende de Phase 3 completa (UI operativa para validar el flujo).
- **Polish (Phase 5)**: Depende de todas las anteriores (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US1 (P1, única)**: Sin dependencias entre historias (constitución II: una sola US). Independientemente testable vía quickstart Q1–Q7 y las suites por capa; el MVP de la feature es la propia US1 completa (Phase 1–4).

### Within Each User Story

- Tests primero y en rojo antes de su SUT: T007/T008 → T009–T012; T015–T017 → T018–T023; T024/T025 → T026–T028; T029/T030 → T031/T032; T033/T034 → T035–T037.
- T012 (`Tag.categoryId`) rompe compilación de aplicación/persistencia hasta T014/T022/T026/T028 — el verde integral se verifica en T039, no bloquea el orden por bloques.
- T023 jubila `ListTags` solo cuando T038 deja de usarlo (page pasa a `ListTagCatalog`).
- Actions (T031/T032) antes que la UI que las invoca (T035–T037).
- Unit/component gates (T039) antes del e2e (T040–T041); gates completos acumulativos al final (T047).

### Parallel Opportunities

- Phase 2: T003 ∥ T004.
- Dominio: T007 ∥ T008 (tests); T009 ∥ T010 ∥ T011 (impl, ficheros distintos).
- Aplicación: T013 ∥ T014; T015 ∥ T016 ∥ T017 (tests); T018 ∥ T019 ∥ T020 ∥ T021 ∥ T023 (use cases, ficheros distintos; T022 toca `CreateTag` en paralelo también).
- Persistencia: T024 ∥ T025 (tests); T026 ∥ T027 (impl).
- Actions: T029 ∥ T030; T031 ∥ T032.
- UI: T033 ∥ T034 (tests); T035 ∥ T036 (diálogos).
- Phase 5: T042 ∥ T043 ∥ T044 ∥ T045 (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Dominio — tests en rojo en paralelo (ficheros distintos):
Task: "Crear TagCategory.test.ts + DefaultCategory.test.ts (rojo)"
Task: "Extender Tag.test.ts con categoryId/moveToCategory (rojo)"

# Dominio — implementación en paralelo (ficheros distintos):
Task: "Crear TagCategoryId.ts + TagCategoryErrors.ts"
Task: "Crear DefaultCategory.ts"
Task: "Crear TagCategory.ts"

# Aplicación — use cases en paralelo (ficheros distintos):
Task: "Crear CreateCategory.ts"
Task: "Crear RenameCategory.ts"
Task: "Crear DeleteCategory.ts"
Task: "Crear MoveTagToCategory.ts"

# Docs de Phase 5 en paralelo (ficheros distintos):
Task: "Crear ADR 0022-tag-categories.md"
Task: "Actualizar AGENTS.md (convención Categorías 026 + Seed)"
Task: "Actualizar docs/architecture/ (domain-model + categorias-secuencia + notas)"
Task: "Añadir fila 026 Completada al roadmap maestro"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Complete Phase 1: línea base verde y rama feature
2. Complete Phase 2: slug compartido + esquema + migración `0008` con backfill + seed
3. Complete Phase 3: US1 por bloques (dominio → aplicación → persistencia → actions → UI), tests rojo primero en cada bloque; gate T039 en verde
4. **STOP and VALIDATE**: validación manual Q1–Q3 + Q5–Q7 con `npm run dev` (Q4 necesita movimientos previos)
5. Complete Phase 4: e2e `categorias-tags.spec.ts` con restauración obligatoria + suite completa en verde
6. Complete Phase 5: ADR 0022, AGENTS.md, diagramas vivos, roadmap (FR-009), Q1–Q7 completos y gates totales (SC-004)

### Incremental Delivery

- Feature de una sola US (constitución II): el valor de usuario llega con Phase 3 — al terminar T038 el catálogo ya está agrupado y gestionable; Phase 4 asegura el flujo crítico end-to-end y Phase 5 cierra el DoD.

### Parallel Team Strategy

- Para 1 desarrollador (real): secuencial por bloques con los [P] internos como confirmaciones atómicas. Con varios: los grupos [P] de cada bloque (tests, entidades, use cases, diálogos, docs) pueden repartirse; las cadenas críticas (T005→T006, T012→T014/T022/T026/T028, T023↔T038) no se parten.

---

## Notes

- [P] tasks = different files, no dependencies
- **FR-001 por construcción**: no existe `Tag` sin `categoryId` (dominio) ni fila de tag sin categoría (`NOT NULL` + FK `ON DELETE RESTRICT`); `countTags`/`ProtectedCategoryError` son guardas amigables y el RESTRICT la red de seguridad definitiva (research §3)
- La genérica se identifica por **slug constante** (`DEFAULT_CATEGORY_SLUG = "general"`, espejo de `SystemTags`): renombrable sin perder su papel, no eliminable; jamás por nombre ni flag (research §2)
- `ListTagCatalog` agrupa y ordena; la UI **solo anida** el DTO pre-ordenado (constitución VII); `ListTags` se jubila sin llamadores (política 025)
- `MoveTagToCategory` es no-op semántico con la misma categoría; el diálogo excluye la actual (edge de la spec)
- Revalidación de categorías acotada a `revalidatePath("/tags")` — no viven en ninguna otra vista (FR-008); los tags siguen revalidando layout por el Select «Etiqueta» (patrón vigente intacto)
- **Intocable (FR-008)**: `Movement`, `/summary`, `/annual`, página de cuenta y KPIs, formularios de movimiento, Select «Etiqueta» plano, `ListActiveTags`, acciones de tag 004/017 (más allá de la composición de `CreateTag`)
- E2E: fichero propio, Miembro A + Octubre 2026 (cerrado, sin interferencias), **restauración del catálogo global** al terminar (etiqueta devuelta + categoría eliminada) para no romper `creacion-tags`/`gestion-tags` (research §6)
- Commit after each task or logical group (Conventional Commits, en español el enunciado cuando aporte claridad)
