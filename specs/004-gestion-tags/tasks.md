---
description: "Task list for feature 004 implementation"
---

# Tasks: Gestión del catálogo de etiquetas (renombrar, fusionar, desactivar)

**Input**: Design documents from `/specs/004-gestion-tags/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-011 los exige explícitamente (unidad de dominio/aplicación de cada operación, repositorio, actions, componentes de la vista de administración y un flujo e2e «renombrar + fusionar + desactivar verificando el histórico»; constitución III). En rojo primero donde la feature añade comportamiento nuevo (`Tag.rename/withStatus`, `SystemTags`, los cinco casos de uso, `mergeInto` del repositorio, las cuatro actions y los cuatro componentes UI); las suites nuevas se escriben contra los contratos congelados de data-model/ui-contract.

**Organization**: Una única user story pequeña (US1, P1 — constitución II, sin excepción): mantener el catálogo de etiquetas —renombrar, fusionar, desactivar, reactivar— sin perder ni alterar el histórico. El cambio baja por las capas en la dirección de dependencias (VII): comportamiento de catálogo + protección por slug en dominio puro → cinco casos de uso + puerto `TagRepository` ampliado en aplicación → repositorio Drizzle (`update` + `mergeInto` transaccional) → cuatro Server Actions → vista `/tags` + nav ampliada → e2e. **Sin migración** (el esquema ya soporta todo), **cero dependencias nuevas**, y `movements`, formularios de movimiento (013/014), cierres, `/summary` y `/annual` intactos (FR-006, Out of Scope): las vistas derivadas recalculan solas (joins vivos).

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
- [X] T002 Confirmar la rama `feature/004-gestion-tags` activa y el árbol limpio (creada por la extensión git de Spec Kit; worktree actualizado si se usa)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la fase fundacional.

---

## Phase 2: Foundational (Dominio → Aplicación → Persistencia — bloquea US1)

**Purpose**: Vertical del backend del catálogo: `Tag.rename/withStatus` y `SystemTags`/`ProtectedTagError` puros en dominio, el slug protegido como único dueño del literal (019 pasa a importarlo), cinco casos de uso (`ListTags`, `RenameTag`, `MergeTags`, `DeactivateTag`, `ReactivateTag`) contra el puerto `TagRepository` ampliado (`findById`, `findAll`, `update`, `mergeInto` transaccional), y `DrizzleTagRepository` extendido. Todo aditivo: sin migración, `tags`/`movements` estructuralmente intactas.

**Nota**: Conceptualmente estas tareas sirven solo a US1, pero no llevan label de historia: son prerrequisito compartido (backend) de todo lo que viene después (actions + vista + e2e).

### Tests primero (en rojo)

- [X] T003 [P] Crear `src/domain/tag/Tag.test.ts` (rojo): `rename` trimea el nombre, `rename("   ")`/`rename("")` → `InvalidTagError` «El nombre de la etiqueta es obligatorio.», `rename` conserva id/slug/status en la instancia devuelta (slug inmutable — data-model §1.1), `withStatus("inactive")`/`withStatus("active")` devuelven nueva instancia con el estado dado y resto de campos intactos; ejecutar y confirmar rojo
- [X] T004 [P] Crear `src/domain/tag/SystemTags.test.ts` (rojo): `isProtectedTagSlug("aportacion-comun")` → `true`, cualquier otro slug («luz», «sin-clasificar», «») → `false`; `CONTRIBUTION_TAG_SLUG === "aportacion-comun"` y `SYSTEM_TAG_SLUGS` lo contiene; ejecutar y confirmar rojo
- [X] T005 [P] Crear `src/application/tag/RenameTag.test.ts` (rojo) con doble en memoria de `TagRepository` ampliado (`findAll`/`findById`/`update`/`mergeInto`): éxito carga por `findById`, renombra y persiste vía `update`; renombrar «luz»→«Luz» sobre sí misma **permitido** (edge solo-caja: `findByName` devuelve la propia id → no error); duplicado con **otra** etiqueta (activa o inactiva) → `DuplicateTagNameError` con el nombre nuevo; nombre vacío tras trim → `InvalidTagError`; etiqueta protegida (slug `aportacion-comun`) → `ProtectedTagError`; id desconocido → `TagNotFoundError`; ejecutar y confirmar rojo
- [X] T006 [P] Crear `src/application/tag/MergeTags.test.ts` (rojo) con doble en memoria: éxito valida ambas por `findById` y delega en `mergeInto(absorbedId, targetId)` devolviendo `{ reassignedMovements }`; protegida como **absorbida** → `ProtectedTagError`; protegida como **resultante** → `ProtectedTagError` (clarificación 2026-10-17); `absorbedId === targetId` → `InvalidTagError` «Elige dos etiquetas distintas.»; ids desconocidos → `TagNotFoundError`; ejecutar y confirmar rojo
- [X] T007 [P] Crear `src/application/tag/DeactivateTag.test.ts` y `src/application/tag/ReactivateTag.test.ts` (rojos, doble en memoria): `DeactivateTag` éxito → `update` con `status: "inactive"`, protegida → `ProtectedTagError`, desconocida → `TagNotFoundError`, ya inactiva → idempotente (devuelve la etiqueta sin llamar `update`); `ReactivateTag` éxito → `update` con `status: "active"`, colisión con otra etiqueta de igual `lower(name)` (edge inactiva «Luz» vs activa «LUZ») → `DuplicateTagNameError`, desconocida → `TagNotFoundError`; ejecutar y confirmar rojo
- [X] T008 [P] Crear `src/application/tag/ListTags.test.ts` (rojo) con doble en memoria: mapea `findAll()` a `CatalogTagDTO { id, name, slug, status, isProtected }`, orden activas primero → luego inactivas, cada bloque alfabético (`es`); `isProtected === true` solo para slug `aportacion-comun`; **sin recuento de movimientos** (decisión del propietario 2026-10-17); ejecutar y confirmar rojo
- [X] T009 Crear los tests de repositorio en `src/infrastructure/db/DrizzleRepositories.test.ts` (rojo, ampliar el `describe("DrizzleTagRepository")` contra `createTestDb` libsql `:memory:` con migraciones — la 0004 ya siembra «Aportación Común»): `findAll` devuelve activas **e inactivas** ordenadas por nombre; `findById` resuelve y devuelve `null` si no existe; `update` persiste renombrado (slug estable) y cambio de estado devolviendo la entidad rehidratada; `update` hacia `lower(name)` ajeno → `DuplicateTagNameError` (carrera del índice); `mergeInto` reasigna los `movements.tag_id` a la resultante (recuento correcto), borra la absorbida, y **no toca `movements.updated_at`** (FR-006); `mergeInto` con absorbida sin movimientos devuelve 0 y borra; tras la fusión, `DrizzleMovementRepository.listByMonthAndAccount` muestra la resultante (join vivo); ejecutar y confirmar rojo

### Dominio y aplicación

- [X] T010 [P] Crear `src/domain/tag/SystemTags.ts` (módulo puro, sin dependencias): `export const CONTRIBUTION_TAG_SLUG = "aportacion-comun"`, `export const SYSTEM_TAG_SLUGS = [CONTRIBUTION_TAG_SLUG] as const`, `export function isProtectedTagSlug(slug: string): boolean` (data-model §1.1); verificar T004 en verde
- [X] T011 Añadir `ProtectedTagError` a `src/domain/tag/TagErrors.ts` (`extends DomainError`, mensaje `La etiqueta "{name}" pertenece al sistema y no puede modificarse.`) y los métodos `rename(name): Tag` (trimea; vacío → `InvalidTagError` con el literal vigente; conserva id/slug/status) y `withStatus(status: TagStatus): Tag` (nueva instancia congelada) a `src/domain/tag/Tag.ts` (data-model §1.1, research §2); verificar T003 en verde
- [X] T012 Ampliar el puerto `src/application/tag/TagRepository.ts` con `findById(id: TagId): Promise<Tag | null>`, `findAll(): Promise<Tag[]>` (activas e inactivas, orden alfabético), `update(tag: Tag): Promise<Tag>` y `mergeInto(absorbedId: TagId, targetId: TagId): Promise<{ reassignedMovements: number }>` (data-model §1.3) y crear `src/application/tag/dto.ts` con `export interface CatalogTagDTO { id: number; name: string; slug: string; status: TagStatus; isProtected: boolean }` (data-model §4)
- [X] T013 [P] Crear `src/application/tag/RenameTag.ts`: `findById` → `TagNotFoundError`; `isProtectedTagSlug(tag.slug)` → `ProtectedTagError`; `tag.rename(name)` → `InvalidTagError`; `findByName(newName)` → `DuplicateTagNameError(newName)` **solo si la encontrada no es ella misma**; `update` devolviendo la etiqueta persistida (data-model §1.2); verificar T005 en verde
- [X] T014 [P] Crear `src/application/tag/MergeTags.ts`: cargar ambas por `findById` → `TagNotFoundError`; `absorbedId === targetId` → `InvalidTagError` («Elige dos etiquetas distintas.»); protegida absorbida **o resultante** → `ProtectedTagError`; `mergeInto` → `{ reassignedMovements }` (el estado de la resultante no cambia — fusión hacia inactiva válida); verificar T006 en verde
- [X] T015 [P] Crear `src/application/tag/DeactivateTag.ts` (protección → `ProtectedTagError`; ya inactiva → idempotente; si no, `update(tag.withStatus("inactive"))`) y `src/application/tag/ReactivateTag.ts` (`findByName(tag.name)` ajena → `DuplicateTagNameError`; si no, `update(tag.withStatus("active"))`) (data-model §1.2); verificar T007 en verde
- [X] T016 [P] Crear `src/application/tag/ListTags.ts`: `findAll()` → `CatalogTagDTO` ordenado activas→inactivas, cada bloque alfabético `es` (`.toLocaleCompare("es")`), `isProtected = isProtectedTagSlug(slug)`; un solo puerto, sin recuento de movimientos (research §4); verificar T008 en verde
- [X] T017 Refactorizar `src/application/common-contribution/MaterializeCommonContributions.ts`: eliminar la constante local `CONTRIBUTION_TAG_SLUG` (L11) e importarla de `@/domain/tag/SystemTags` (aplicación → dominio, dirección permitida; un único dueño del slug — research §1); comportamiento intacto (`MaterializeCommonContributions.test.ts` existente debe seguir en verde sin cambios)

### Persistencia

- [X] T018 Implementar en `src/infrastructure/db/DrizzleTagRepository.ts`: `findById` (select por pk → `mapRowToTag`), `findAll` (select completo `.orderBy(asc(tags.name))`), `update` (`update(tags).set({ name, status }).where(eq(tags.id, id)).returning()` → rehidratar; catch → `translateUniqueViolation` existente, carrera del `lower(name)` → `DuplicateTagNameError`) y `mergeInto` (**`db.transaction`**: (1) `update(movements).set({ tagId: targetId }).where(eq(movements.tagId, absorbedId))` → recuento; (2) `delete(tags).where(eq(tags.id, absorbedId))`; tras (1) `ON DELETE RESTRICT` permite (2); **sin tocar `updated_at`** — data-model §2.2, research §3); verificar T009 en verde
- [X] T019 Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (cambio aditivo: las suites existentes —incluida la de 019— no cambian de forma)

**Checkpoint**: Catálogo operativo de dominio a BD (los cinco casos de uso utilizables vía código; slug protegido compartido con 019); `tags`/`movements` sin migración ni cambios de esquema; fase UI desbloqueada.

---

## Phase 3: User Story 1 - Mantener el catálogo de etiquetas sin perder el histórico (Priority: P1) 🎯 MVP

**Goal**: Vista de administración `/tags` desde la navegación global (enlace «Etiquetas»): lista completa con chips «Activa»/«Inactiva», distintivo «Sistema» sin menú para «Aportación Común», menú ⋮ por fila y diálogos de renombrado/fusión/desactivación montados a nivel del listado (patrón canónico de fila), reactivación como action directa + `useTransition` (familia ADR 0015); cuatro Server Actions con Zod en frontera y `revalidatePath("/", "layout")` en éxito (FR-001–FR-009, SC-001–SC-004).

**Independent Test**: Quickstart Q1–Q6: navegar a `/tags` y ver el catálogo completo con estados; renombrar «super»→«supermercado» y verificar en la cuenta que la fila y los desgloses muestran el nombre nuevo con totales exactos; duplicado rechazado conservando lo tecleado (y solo-caja permitido); fusionar «super-casa» en «supermercado» con la absorbida desaparecida y totales globales intactos; desactivar con histórico (fuera del Select del alta, presente en desgloses) y reactivar; «Aportación Común» protegida en los cuatro papeles (sin menú y ausente como destino de fusión).

### Tests para US1 (primero, en rojo)

- [X] T020 [P] [US1] Crear `src/infrastructure/primary/actions/rename-tag.action.test.ts` (rojo, mockeando `RenameTag` con `vi.mock`/`vi.hoisted` como las actions existentes): Zod rechaza nombre vacío tras trim («El nombre de la etiqueta es obligatorio.») sin delegar; éxito → `{ status: "success", message: "Etiqueta renombrada" }` con `revalidatePath("/", "layout")` llamada (mock); `InvalidTagError`/`DuplicateTagNameError`/`ProtectedTagError`/`TagNotFoundError` mapeados a su mensaje exacto en `{ status: "error", message }`; cualquier otro `DomainError` → «No se ha podido completar la operación. Inténtalo de nuevo.»; nunca lanza al cliente; ejecutar y confirmar rojo
- [X] T021 [P] [US1] Crear `src/infrastructure/primary/actions/merge-tags.action.test.ts` (rojo, mock de `MergeTags`): Zod rechaza ids no numéricos sin delegar; éxito → `{ status: "success", message: "Etiquetas fusionadas" }` + revalidate del layout; `InvalidTagError` («Elige dos etiquetas distintas.»)/`ProtectedTagError` (absorbida o resultante)/`TagNotFoundError` mapeados a mensaje exacto; resto → genérico; ejecutar y confirmar rojo
- [X] T022 [P] [US1] Crear `src/infrastructure/primary/actions/deactivate-tag.action.test.ts` (rojo, mock de `DeactivateTag`): Zod rechaza id no numérico; éxito → `{ status: "success", message: "Etiqueta desactivada" }` + revalidate; `ProtectedTagError`/`TagNotFoundError` mapeados; resto → genérico; ejecutar y confirmar rojo
- [X] T023 [P] [US1] Crear `src/infrastructure/primary/actions/reactivate-tag.action.test.ts` (rojo, mock de `ReactivateTag`): firma directa `reactivateTag(tagId: number)` → `{ ok: true }` con `revalidatePath("/", "layout")` (mock) o `{ ok: false, message }` con el mensaje exacto de `DuplicateTagNameError`/`TagNotFoundError`/`ProtectedTagError` y genérico para el resto; nunca lanza; ejecutar y confirmar rojo
- [X] T024 [P] [US1] Crear `src/infrastructure/primary/ui/tag-catalog.test.tsx` (rojo, actions mockeadas): región `aria-label="Catálogo de etiquetas"` con filas `listitem` (nombre + chip «Activa»/«Inactiva»), orden activas→inactivas alfabético; fila protegida muestra «Sistema» y **sin** botón ⋮; activa no protegida → menú «Acciones de {nombre}» con «Renombrar…», «Fusionar en otra…», «Desactivar…» que abren el diálogo correspondiente con el DTO capturado; inactiva → solo «Reactivar» que llama la action en `useTransition`; los diálogos se montan **a nivel del listado**, no en la fila (convención de fila); ejecutar y confirmar rojo
- [X] T025 [P] [US1] Crear `src/infrastructure/primary/ui/rename-tag-dialog.test.tsx` (rojo, action mockeada): diálogo «Renombrar etiqueta» con input «Nombre» pre-rellenado con el nombre actual y foco inicial; en `{ status: "error" }` el mensaje aparece con `role="alert"` y **el nombre tecleado permanece en el campo** (SC-004); éxito → toast «Etiqueta renombrada» y cierre; `isPending` deshabilita «Guardar» (doble envío); «Cancelar»/Escape cierran sin enviar; ejecutar y confirmar rojo
- [X] T026 [P] [US1] Crear `src/infrastructure/primary/ui/merge-tags-dialog.test.tsx` (rojo, action mockeada): diálogo «Fusionar etiqueta» con el texto de consecuencia con el nombre de la absorbida («Los movimientos con la etiqueta "{absorbida}" pasarán a la etiqueta que elijas. "{absorbida}" desaparecerá del catálogo.»); Select «Etiqueta resultante» ofrece todas **menos** la propia absorbida y las protegidas, con las inactivas etiquetadas «(inactiva)»; «Fusionar» deshabilitado sin destino; submit → «Fusionando…» + controles deshabilitados; éxito → toast «Etiquetas fusionadas» y cierre; error de dominio visible `role="alert"`; «Cancelar»/Escape sin efectos; ejecutar y confirmar rojo
- [X] T027 [P] [US1] Crear `src/infrastructure/primary/ui/deactivate-tag-dialog.test.tsx` (rojo, action mockeada): AlertDialog «Desactivar etiqueta» con el texto de consecuencia exacto («"{nombre}" dejará de ofrecerse para nuevos movimientos. Los movimientos existentes la conservarán y seguirán computando en los desgloses.»); botones «Cancelar»/«Desactivar» (destructivo); `isPending` deshabilita ambos; éxito → toast «Etiqueta desactivada» y cierre; ejecutar y confirmar rojo
- [X] T028 [P] [US1] Ampliar `src/infrastructure/primary/ui/global-nav.test.tsx` (rojo): enlace «Etiquetas» como 4.º destino con `href="/tags"` presente en todos los usos; con `active="tags"` lleva `aria-current="page"` y los demás enlaces no; la página `/tags` no requiere contexto temporal (sin `month`, sin romper los usos con `month`); ejecutar y confirmar rojo

### Frontera (Server Actions) y UI

- [X] T029 [US1] Crear `src/infrastructure/primary/actions/tag-actions.schema.ts` (patrón `movement-form.schema.ts`): `renameTagSchema { tagId: number; name: z.string().trim().min(1) }` con mensaje «El nombre de la etiqueta es obligatorio.», `mergeTagsSchema { absorbedId: number; targetId: number }`, `deactivateTagSchema { tagId: number }`, `reactivateTagSchema { tagId: number }` (ids `z.coerce.number().int().positive()` sobre FormData) y el tipo compartido `TagActionState = { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string }` (data-model §4)
- [X] T030 [US1] Crear `src/infrastructure/primary/actions/rename-tag.action.ts`: `renameTag(prev: TagActionState, formData: FormData)` — `renameTagSchema.safeParse` (sin delegar si falla), instanciación de `RenameTag` con `DrizzleTagRepository` (patrón de las actions existentes), mapeo de `InvalidTagError`/`DuplicateTagNameError`/`ProtectedTagError`/`TagNotFoundError` a su mensaje exacto y resto de `DomainError` al genérico («No se ha podido completar la operación. Inténtalo de nuevo.»), éxito → `revalidatePath("/", "layout")` antes de devolver `{ status: "success", message: "Etiqueta renombrada" }` (ui-contract §5); verificar T020 en verde
- [X] T031 [US1] Crear `src/infrastructure/primary/actions/merge-tags.action.ts` (mismo patrón y mapeo; éxito → `{ status: "success", message: "Etiquetas fusionadas" }`); verificar T021 en verde
- [X] T032 [US1] Crear `src/infrastructure/primary/actions/deactivate-tag.action.ts` (mismo patrón y mapeo; éxito → `{ status: "success", message: "Etiqueta desactivada" }`); verificar T022 en verde
- [X] T033 [US1] Crear `src/infrastructure/primary/actions/reactivate-tag.action.ts`: action **directa** `reactivateTag(tagId: number): Promise<ReactivateTagResult>` con `export type ReactivateTagResult = { ok: true } | { ok: false; message: string }` (resultado, no estado de formulario — familia ADR 0015); `reactivateTagSchema` valida el id; mapeo de errores a mensaje; `revalidatePath("/", "layout")` solo en `{ ok: true }`; verificar T023 en verde
- [X] T034 [US1] Modificar `src/infrastructure/primary/ui/global-nav.tsx`: ampliar `active` a `"panel" | "summary" | "annual" | "tags"` y añadir el 4.º enlace «Etiquetas» con `href="/tags"` **estático** (el catálogo es atemporal — sin contexto temporal), `aria-current` cuando `active === "tags"` (ui-contract §1); verificar T028 en verde
- [X] T035 [US1] Crear `src/infrastructure/primary/ui/rename-tag-dialog.tsx` (client, patrón `edit-movement-dialog.tsx`): `Dialog` «Renombrar etiqueta», label «Nombre» con `defaultValue` = nombre actual del DTO, foco inicial en el input; `useActionState(renameTag)` con guard de éxito único → `onClose()` + toast sonner «Etiqueta renombrada»; error → `role="alert"` bajo el input (`aria-describedby`) **sin remontar el campo** (el valor tecleado permanece); `isPending` → «Guardando…» + disabled; botones `[Cancelar] (type="button")] [Guardar (primario)]`; el `tagId` viaja en input oculto del form; verificar T025 en verde
- [X] T036 [US1] Crear `src/infrastructure/primary/ui/merge-tags-dialog.tsx` (client): `Dialog` «Fusionar etiqueta» con texto fijo de consecuencia (ui-contract §3.2), Select shadcn «Etiqueta resultante» (opciones = catálogo recibido por props menos la propia absorbida y las `isProtected`; inactivas con sufijo «(inactiva)»), `[Cancelar] [Fusionar]` destructivo deshabilitado sin destino; confirmación integrada (texto + botón destructivo — FR-008); `useActionState(mergeTags)` con guard de éxito → cierre + toast «Etiquetas fusionadas»; `isPending` → «Fusionando…» + todo deshabilitado; `absorbedId` en input oculto, `targetId` como valor del Select del form; verificar T026 en verde
- [X] T037 [US1] Crear `src/infrastructure/primary/ui/deactivate-tag-dialog.tsx` (client, patrón `delete-movement-dialog.tsx`): `AlertDialog` «Desactivar etiqueta» con el texto de consecuencia exacto (ui-contract §3.3), `[Cancelar] [Desactivar]` destructivo; `useActionState(deactivateTag)` con guard de éxito → cierre + toast «Etiqueta desactivada»; `isPending` deshabilita ambos; `tagId` en input oculto; verificar T027 en verde
- [X] T038 [US1] Crear `src/infrastructure/primary/ui/tag-catalog.tsx` (client): región `aria-label="Catálogo de etiquetas"`, `ul > li` por etiqueta (nombre, chip «Activa»/«Inactiva», distintivo «Sistema» para `isProtected` **sin menú**); menú `DropdownMenu` con trigger ⋮ `aria-label="Acciones de {nombre}"` (≥ 44 px, portal): activa no protegida → «Renombrar…»/«Fusionar en otra…»/«Desactivar…», inactiva → «Reactivar»; los tres diálogos montados **a nivel del listado** con el DTO capturado en estado del cliente (convención de fila de AGENTS.md — la fila puede desaparecer tras `revalidatePath`); «Reactivar» llama `reactivateTag` con `useTransition` + toast de éxito/error («Etiqueta reactivada» / mensaje de dominio p. ej. colisión); tras éxito el foco vuelve al listado; verificar T024 en verde
- [X] T039 [US1] Crear `src/app/tags/page.tsx` (server, adaptador fino): `GlobalNav active="tags"` (sin `month`) + `h1` «Etiquetas» + `ListTags` (con `DrizzleTagRepository`) → `<TagCatalog tags={dtos} />` (ui-contract §1); las demás páginas no cambian
- [X] T040 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (SC-005 parcial)

**Checkpoint**: US1 funcional: `/tags` navegable con las cuatro operaciones y protección visible; formularios de movimiento y vistas derivadas intactos y frescos tras cada operación (FR-009); suites unitarias y de componentes en verde.

---

## Phase 4: E2E del flujo crítico (FR-011, constitución III)

**Purpose**: Spec nueva en fichero propio con combinación cuenta/mes exclusiva verificada libre (**Cuenta de Miembro B + septiembre 2026** — research §6): posición alfabética entre `edicion-movimientos` e `ingresos-regulares` sobre la BD compartida con `workers: 1`; las etiquetas que crea/renombra/fusiona/desactiva son nuevas (no del seed), por lo que **no se requiere limpieza final** (ningún Select posterior enumera el catálogo completo). Las 10 specs existentes quedan intactas.

- [X] T041 [US1] Crear `e2e/gestion-tags.spec.ts` (serial, helpers locales al estilo de `creacion-tags.spec.ts`): preparar en Miembro B + septiembre 2026 dos gastos con dos etiquetas creadas en línea (017), p. ej. «super» −50,00 y «super-casa» −30,00; G1 acceso por nav «Etiquetas» → `/tags` con todas las etiquetas, chips de estado y «Aportación Común» con «Sistema» sin menú; G2 renombrar «super»→«supermercado» → la fila del listado del mes muestra «supermercado» y los totales del cierre idénticos; G3 duplicado en renombrado rechazado con el nombre conservado en el campo; G4 fusionar «super-casa» en «supermercado» → la absorbida desaparece del catálogo, ambos movimientos bajo «supermercado» y el desglose del cierre acumula −80,00 con totales globales intactos (SC-002); G5 desactivar «supermercado» → el histórico la conserva y el Select del alta ya no la ofrece (SC-003); G6 reactivar → vuelve al Select con nombre e histórico intactos; G7 protección: «Aportación Común» ausente como destino de fusión (ui-contract §6/Q6)
- [X] T042 [US1] Ejecutar `npm run test:e2e` y verificar las 11 specs en verde (las 10 existentes sin cambios esperados — ajustar solo si un literal afectado lo exige)

**Checkpoint**: Flujo crítico «renombrar + fusionar + desactivar verificando el histórico» más reactivación y protección cubiertos end-to-end (SC-005).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva, ADR 0018 y roadmap maestro actualizados en el mismo cambio (constitución III DoD, research §7, FR-010).

- [X] T043 [P] Crear `docs/architecture/adr/0018-mantenimiento-catalogo-tags.md`: `mergeInto` transaccional bajo `ON DELETE RESTRICT` (reasignación + borrado atómicos, sin tocar `updated_at`), protección por slug en dominio (`SystemTags`, único dueño del literal que 019 importa), slug inmutable en el renombrado, reactivar como action directa (extensión de la familia ADR 0015) (research §7)
- [X] T044 [P] Actualizar `docs/architecture/`: extender `diagrams/domain-model.md` con `Tag.rename/withStatus`, `SystemTags`/`ProtectedTagError` y el puerto ampliado (base: data-model §1.4), crear el diagrama de secuencia del mantenimiento de catálogo (base: plan.md §Diagramas de diseño) y actualizar `overview.md` con la vista `/tags` y los cinco casos de uso
- [X] T045 [P] Actualizar `AGENTS.md` solo si la implementación fija convención nueva (candidata: patrón de vista de administración con menús por fila, diálogos a nivel del listado y reactivación directa — regla de oro 6)
- [X] T046 Preparar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-010): marcar la fila `004-gestion-tags` como «Completada» y dejar constancia datada de que FR-005 queda íntegramente cubierto (crear → 017; renombrar, fusionar, desactivar y reactivar → 004)
- [X] T047 Validar manualmente los escenarios Q1–Q6 de `specs/004-gestion-tags/quickstart.md` con `npm run dev` sobre BD migrada y sembrada (`npm run db:migrate && npm run db:seed`)
- [X] T048 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-005, DoD)

**Checkpoint**: Documentación viva, ADR, roadmap y quickstart sincronizados con la implementación; feature entregada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Depende de Phase 1. **Bloquea US1** (las actions y la vista consumen los casos de uso y el repositorio). Dentro de la fase: tests rojos (T003–T009) → dominio (T010–T011) → puerto + DTO (T012) → casos de uso (T013–T016) → refactor 019 (T017) → persistencia (T018) → gate (T019); la dirección de dependencias es hacia abajo, nunca al revés (constitución VII).
- **US1 (Phase 3)**: Depende de Phase 2 completa. Tests rojos primero (T020–T028) → schemas (T029) → actions (T030–T033) → nav (T034) → diálogos (T035–T037) → catálogo (T038) → página (T039) → gate (T040).
- **E2E (Phase 4)**: Depende de Phase 3 (UI completa operativa).
- **Polish (Phase 5)**: Depende de todas las anteriores (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US1 (P1, única)**: Tras Phase 2. Independientemente testable vía quickstart Q1–Q6 y las suites por capa; el MVP de la feature es la propia US1 completa (Phase 1–4).

### Within Each User Story

- Tests primero y en rojo antes de su SUT (T003–T008 → T010–T016; T009 → T018; T020–T023 → T029–T033; T024–T027 → T035–T038; T028 → T034).
- Dominio (T010–T011) antes del puerto (T012) y de los casos de uso (T013–T016 los consumen; SystemTags/ProtectedTagError son sus dependencias); puerto (T012) antes del repositorio (T018).
- Schemas (T029) antes de las actions (T030–T033 los consumen); actions antes de los diálogos que las llaman (T030→T035, T031→T036, T032→T037, T033→T038); diálogos antes del catálogo que los monta (T035–T037 → T038); catálogo y nav antes de la página (T039 compone ambos).
- E2E tras la UI completa; gates acumulativos al final de cada fase.

### Parallel Opportunities

- Phase 2: T003 ∥ T004 ∥ T005 ∥ T006 ∥ T007 ∥ T008 (ficheros distintos, en rojo); luego T010 ∥ T011 (ficheros distintos); tras T012: T013 ∥ T014 ∥ T015 ∥ T016 (ficheros distintos).
- Phase 3: T020 ∥ T021 ∥ T022 ∥ T023 ∥ T024 ∥ T025 ∥ T026 ∥ T027 ∥ T028 (ficheros distintos, en rojo); tras T029: T030 ∥ T031 ∥ T032 ∥ T033 (ficheros distintos); tras las actions: T034 ∥ T035 ∥ T036 ∥ T037 (ficheros distintos).
- Phase 5: T043 ∥ T044 ∥ T045 (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Launch red tests together:
Task: "Create Tag.test.ts (src/domain/tag/)"
Task: "Create SystemTags.test.ts (src/domain/tag/)"
Task: "Create RenameTag.test.ts (src/application/tag/)"
Task: "Create MergeTags.test.ts (src/application/tag/)"
Task: "Create DeactivateTag.test.ts + ReactivateTag.test.ts"
Task: "Create ListTags.test.ts (src/application/tag/)"
# (T009 amplía DrizzleRepositories.test.ts — secuencial, mismo fichero)

# Tras el rojo, dominio en paralelo (ficheros distintos):
Task: "Create SystemTags.ts (isProtectedTagSlug)"
Task: "Add ProtectedTagError + Tag.rename/withStatus"
# y después puerto, casos de uso y persistencia (secuenciales por dependencia):
Task: "Extend TagRepository.ts (port) + create dto.ts"
Task: "Create RenameTag.ts / MergeTags.ts / DeactivateTag.ts + ReactivateTag.ts / ListTags.ts"
Task: "Refactor MaterializeCommonContributions.ts (importa el slug del dominio)"
Task: "Extend DrizzleTagRepository.ts (update + mergeInto transaccional)"

# Frontera y UI (secuenciales por dependencia, en rojo primero):
Task: "Create tag-actions.schema.ts"
Task: "Create rename/merge/deactivate/reactivate tag actions"
Task: "Modify global-nav.tsx + create the three dialogs + tag-catalog.tsx"
Task: "Create src/app/tags/page.tsx"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Complete Phase 1: línea base verde
2. Complete Phase 2: backend fundacional (dominio → aplicación → persistencia, aditivo, **sin migración**)
3. Complete Phase 3: US1 — actions + vista `/tags` + nav (quickstart Q1–Q6)
4. **STOP and VALIDATE**: `npm run lint && npm run typecheck && npm run test` + validación manual Q1–Q6
5. Complete Phase 4: e2e del flujo crítico (`gestion-tags.spec.ts`, Miembro B + septiembre 2026)
6. Complete Phase 5: ADR 0018, docs vivas, AGENTS.md si procede, roadmap (FR-010) y gates completos (SC-005)

### Incremental Delivery

- Feature de una sola US (constitución II): el valor de usuario llega con Phase 3. Phase 2 es un checkpoint técnico (los cinco casos de uso utilizables solo vía código, sin UI), no un despliegue parcial.

### Parallel Team Strategy

- Para 1 desarrollador (real): estrictamente secuencial por fases. Con varios: tras los tests rojos de Phase 2, dominio y casos de uso avanzan en ficheros distintos; T020–T028 en rojo en paralelo; docs de Phase 5 en paralelo.

---

## Notes

- [P] tasks = different files, no dependencies
- El negocio vive en dominio/aplicación (`Tag.rename/withStatus`, `isProtectedTagSlug`, duplicados con autoexclusión, atomicidad de la fusión delegada a `mergeInto`); las páginas solo componen puertos y la UI lista y delega — decide con `isProtected` del DTO, calculado en dominio (constitución VII)
- **Sin migración**: `lower(name)` UNIQUE, `slug` UNIQUE y la FK `ON DELETE RESTRICT` + `idx_movements_tag_id` existentes materializan todas las invariantes (research §3); RESTRICT queda como auditoría del borrado (la fusión reasigna antes de borrar, en una tx)
- La fusión **no toca `movements.updated_at`** (FR-006): es una operación de catálogo sobre la dimensión etiqueta, no una edición de movimientos
- Renombrar/fusionar no cambian ningún total por construcción (SC-002): las vistas derivadas joinean `tags` en vivo y `revalidatePath("/", "layout")` en cada action basta para la disponibilidad inmediata (FR-009)
- Reactivar es action directa + `useTransition` (familia ADR 0015, excepción documentada): no hay formulario que preservar y el resultado es un toast, no un estado de formulario
- E2E en fichero propio (Miembro B + septiembre 2026, combinación verificada libre — research §6): corre entre `edicion-movimientos` e `ingresos-regulares` con `workers: 1`; sin limpieza final porque solo crea etiquetas nuevas y ningún spec posterior aserta sobre ese mes ni enumera el catálogo completo
- `movements`, formularios de movimiento (013/014), cierres, `/summary`, `/annual`, seed y migraciones intactos (FR-006, Out of Scope)
- Commit after each task or logical group (Conventional Commits, en español el enunciado cuando aporte claridad)
