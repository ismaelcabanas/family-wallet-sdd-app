# Research — Categorías de etiquetas: organización del catálogo (026)

**Feature**: `026-categorias-tags` | **Fecha**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

Investigación verificada contra el código real (fuentes citadas por fichero). Toda decisión sigue el formato **Decisión / Rationale / Alternativas**.

---

## §1. Modelo de dominio: `TagCategory` como agregado propio con slug estable; la pertenencia es atributo de `Tag` (FR-001)

**Decisión**: nueva entidad `TagCategory` en `src/domain/tag-category/` (`TagCategoryId` brandeado — espejo de `TagId.ts` —, `name`, `slug`, métodos `create`/`rehydrate`/`rename` con trim y slug inmutable). La pertenencia vive en `Tag`: `TagInput` y `Tag.rehydrate` ganan `categoryId: TagCategoryId` **obligatorio** y `Tag` gana `moveToCategory(categoryId)`; `rename`/`withStatus` lo conservan (instancia congelada, patrón existente en `Tag.ts:41-51`). La unicidad de nombre case-insensitive replica la de tags: se valida en los casos de uso con `findByName` (`lower(name)` en SQL, `DrizzleTagRepository.ts:46`) + índice `lower(name)` como red de seguridad (§3).

**Rationale** (verificado en código):

- La spec fija la taxonomía: «una categoría agrupa 1..N etiquetas; cada etiqueta pertenece a exactamente una, obligatoriamente. La pertenencia es atributo de la etiqueta» (Decisiones del propietario). Un agregado propio con repositorio propio replica la organización por agregado ya usada (`src/application/account/` + `src/application/member/` conviven igual: `RenameAccount.ts`/`RenameMember.ts`).
- Slug estable como identidad del catálogo ya es el patrón vigente: `Tag.rename` conserva el slug porque «los slugs son identidad estable del catálogo; 019 localiza "Aportación Común" por slug» (ADR 0018). Las categorías necesitan el mismo mecanismo para (a) identificar la genérica sin depender del nombre renombrable, (b) semilla idempotente (`onConflictDoNothing` por clave natural, AGENTS.md «Seed»).
- La derivación de slug no se duplica: `deriveTagSlug` (`src/domain/tag/TagSlug.ts:1-10`) se extrae a `src/domain/shared/slug.ts` (`deriveSlug`) y `TagSlug.ts` pasa a re-exportar `deriveTagSlug` — API pública y tests intactos, un solo dueño del algoritmo.
- `categoryId` obligatorio en `Tag` hace el invariante FR-001 **irrepresentable de otra manera** en dominio y tipo: no existe `Tag` sin categoría desde la construcción.

**Alternativas rechazadas**:

1. **Categoría como VO/array dentro del agregado Tag** — la spec exige ciclo de vida propio (crear/renombrar/eliminar categorías) y compartirlas entre etiquetas; un VO por etiqueta lo imposibilita.
2. **Tabla puente tag↔categoría (N:M)** — la pertenencia es 1:1 obligatoria por decisión del propietario; N:M es superficie para un requisito inexistente (principio I).
3. **`categoryId: number` sin brand** — pierde la validación de construcción que tiene `TagId` (`TagId.ts:4-9`); el brand es barato y consistente.

## §2. La categoría genérica se identifica por slug (`general`), no por flag ni por nombre (FR-006, FR-007; edge «Categoría genérica protegida»)

**Decisión**: módulo puro `src/domain/tag-category/DefaultCategory.ts` con `DEFAULT_CATEGORY_SLUG = "general"` e `isDefaultCategorySlug(slug)` — espejo exacto de `src/domain/tag/SystemTags.ts` (único dueño del literal, ADR 0018). «General» nace en la migración/seed con ese slug; renombrarla NO cambia el slug (paridad con «Aportación Común»), así que sigue siendo la categoría por defecto con independencia del nombre visible (Assumption de la spec). Protecciones resultantes: `DeleteCategory` lanza `ProtectedCategoryError` si el slug es el por defecto; `CreateTag` resuelve la categoría por defecto con `findBySlug(DEFAULT_CATEGORY_SLUG)` para asignarla a toda etiqueta nueva (FR-007, incluida la creación inline 017 — el flujo de `movement-form.tsx:149` llama a `createTag` action → `CreateTag`, sin cambios en la UI del formulario).

**Rationale**: el nombre es mutable («renombrarla sí está permitido», edge case de la spec), así que no puede ser la clave; un booleano `is_default` añadiría una columna + invariante «exactamente una por defecto» (índice único parcial) para expresar lo que el slug ya da gratis. `CreateTag` gana `CategoryRepository` por constructor y resuelve la categoría por defecto en el alta; si no existiera (imposible tras migración+seed), lanza `CategoryNotFoundError` — fallo ruidoso de invariante roto, mejor que un silencioso NULL.

**Alternativas rechazadas**:

1. **Columna `is_default` + índice único parcial** — invariante extra de BD para lo que el slug constante ya garantiza; dos mecanismos de identidad (id + flag).
2. **Fila fija con id conocido (p. ej. id=1)** — acopla la lógica a un id de autoincremento; frágil entre BDs (dev/Turso/e2e).
3. **Crear la categoría por defecto perezosamente en `CreateTag`** — una escritura de catálogo oculta en un alta de etiqueta; viola la previsibilidad y complica los tests.

## §3. Persistencia: tabla `tag_categories` + `tags.category_id` NOT NULL con FK RESTRICT; backfill en la propia migración (FR-001; SC-001)

**Decisión**:

- Nueva tabla `tag_categories(id, name, slug UNIQUE)` + índice único `lower(name)` (`tag_categories_name_nocase_uq`, espejo de `tags_name_nocase_uq` en `schema/tags.ts:12`) — migración `drizzle/0008_categorias-tags.sql`.
- `tags` gana `category_id INTEGER NOT NULL REFERENCES tag_categories(id) ON DELETE RESTRICT`. SQLite no admite `ADD COLUMN ... NOT NULL` sin default, así que la migración reconstruye la tabla (patrón estándar de drizzle-kit para SQLite): `CREATE TABLE new_tags` (esquema resultante) → `INSERT INTO new_tags SELECT id, name, slug, status, (SELECT id FROM tag_categories WHERE slug = 'general') FROM tags` → `DROP TABLE tags` → `ALTER TABLE new_tags RENAME TO tags` → recrear índices de tags. Los ids se conservan (la FK `movements.tag_id` no se toca).
- La migración inserta la categoría «General» con `INSERT OR IGNORE ... VALUES ('General', 'general')` **antes** del backfill (precedente: `drizzle/0004_aportacion-comun.sql` siembra la etiqueta de sistema en la propia migración).
- `seed-data.ts` gana `SEED_CATEGORIES = [{ name: "General", slug: "general" }]`; `scripts/seed.ts` la inserta primero (`onConflictDoNothing` por slug) y resuelve su id para sembrar las etiquetas con `category_id` (idempotencia intacta, AGENTS.md «Seed»).
- Puerto `CategoryRepository` (en `src/application/tag-category/`, constitución VII): `findAll`, `findById`, `findBySlug`, `findByName` (case-insensitive), `save`, `update`, `delete`, `countTags(id)` — implementado por `DrizzleTagCategoryRepository` (traducción de violación única → `DuplicateCategoryNameError`, espejo de `translateUniqueViolation` en `DrizzleTagRepository.ts:105-114`). `countTags` es un `SELECT count(*)` sobre `tags.category_id`: la guarda amigable de «categoría con etiquetas» vive en `DeleteCategory`, y el RESTRICT de la FK es la red de seguridad definitiva contra carreras (aborta el DELETE; se traduce a `CategoryNotEmptyError`).
- `DrizzleTagRepository.save/update` incluyen `category_id`; `mappers/tag.mapper.ts` rehidrata con `categoryId`.

**Rationale**: NOT NULL + FK materializan FR-001 en el esquema: ninguna fila de tag puede quedar sin categoría ni apuntar a una categoría inexistente. RESTRICT (no CASCADE) hace imposible el borrado accidental de una categoría con etiquetas — coherente con `movements.tag_id ON DELETE RESTRICT` (ADR 0014) y con la semántica de la fusión 004 (borrar categoría nunca debe reasignar movimientos). El backfill en la migración cumple SC-001 («el 100 % de las etiquetas existentes quedan asignadas a la genérica, sin perder ninguna ni alterar su nombre, slug ni estado»): el `SELECT` conserva todas las columnas tal cual y solo añade la categoría.

**Alternativas rechazadas**:

1. **`category_id` nullable + invariante solo en aplicación** — el invariante «exactamente una» quedaría sin refuerzo de esquema; un bug o un SQL directo lo rompe silenciosamente.
2. **Tabla `tag_category(tag_id UNIQUE, category_id)`** — normaliza el 1:1 pero añade un join a toda lectura del catálogo; la columna directa es el patrón vigente (`movements.tag_id`, ADR 0014).
3. **Migración en dos pasos (columna nullable → backfill por script → NOT NULL)** — más fricción operativa (paso pre-deploy extra) para el mismo resultado; la reconstrucción en una migración atómica es el mecanismo estándar.

## §4. Casos de uso: 3 nuevos de categoría + `MoveTagToCategory` + `CreateTag` ampliado; `ListTags` → `ListTagCatalog` agrupado (FR-002..FR-007)

**Decisión** (carpeta `src/application/tag-category/` para el agregado nuevo; `src/application/tag/` para lo que muta tags):

| Caso de uso | Módulo | Reglas (dominio + puerto) |
|---|---|---|
| `CreateCategory({name})` | tag-category | trim → vacío lanza `InvalidCategoryError`; duplicado case-insensitive (`findByName`) → `DuplicateCategoryNameError`; slug = `deriveSlug` con sufijo `-2, -3…` ante colisión (`findBySlug`) — reutiliza la estrategia de `CreateTag.ts:28-35`. Nace vacía. |
| `RenameCategory({categoryId, name})` | tag-category | `findById` → `CategoryNotFoundError`; duplicado autoexcluyéndose (paridad `RenameTag` con su edge «luz»→«Luz»); `category.rename(name)` conserva slug — la genérica es renombrable. |
| `DeleteCategory({categoryId})` | tag-category | `findById` → NotFound; `isDefaultCategorySlug` → `ProtectedCategoryError` (mensaje claro: es la categoría por defecto); `countTags > 0` → `CategoryNotEmptyError` (mensaje: mover sus etiquetas antes); `delete` (RESTRICT como red de seguridad). |
| `MoveTagToCategory({tagId, categoryId})` | tag | tag → `TagNotFoundError`; categoría → `CategoryNotFoundError`; **misma categoría = no-op con éxito** (edge «Mover a la categoría que ya tiene»); si no, `tags.update(tag.moveToCategory(categoryId))`. Sin protección extra: «Aportación Común» puede moverse (edge case de la spec). |
| `CreateTag` (modificado) | tag | igual que hoy + resuelve `findBySlug(DEFAULT_CATEGORY_SLUG)` y construye el `Tag` con `categoryId` → toda etiqueta nueva (catálogo 017 incluido) nace en la genérica (FR-007). |
| `ListTagCatalog()` | tag | **sustituye a `ListTags`** (su único consumidor es `src/app/tags/page.tsx` — grep verificado): lee categorías y tags, agrupa y ordena — genérica primero, resto por `localeCompare("es")`; dentro de cada grupo, activas primero y luego nombre (mismo criterio que `ListTags.ts:20-25`). Devuelve `TagCatalogGroupDTO[] { category: CategoryDTO; tags: CatalogTagDTO[] }` — la UI solo anida y renderiza, no calcula (constitución VII). |

`CatalogTagDTO` **no cambia** (la pertenencia viaja en la estructura de grupos); `CategoryDTO { id, name, isDefault }` nuevo en `tag-category/dto.ts`. `ListTags` + su test se jubilan en el mismo cambio (sin llamadores; misma política de barrido que 025).

**Rationale**: cada operación de la spec tiene un caso de uso con nombre propio (patrón `RenameTag`/`MergeTags`/`DeactivateTag`); las reglas de duplicado/no-op/protección viven en aplicación+dominio, nunca en la action ni en la UI. `MoveTagToCategory` vive en `tag` porque muta un `Tag` (la pertenencia es su atributo, §1), igual que `MergeTags` muta movements+tags desde el módulo tag. La fusión 004 **no necesita cambios**: `mergeInto` borra la fila absorbida (desaparece su pertenencia) y la superviviente conserva la suya (`DrizzleTagRepository.ts:89-103` no toca `category_id` de la target) — el edge «Fusión de etiquetas» queda cubierto por comportamiento existente + test de regresión.

**Alternativas rechazadas**:

1. **`updateCategory(tagId, categoryId)` genérico** — pierde el vocabulario de dominio y el no-op semántico; los casos de uso con nombre son el patrón del repo.
2. **Agrupar en la UI a partir de DTOs planos** — mover la lógica de agrupación/orden al cliente duplica criterio de negocio en el adaptador (prohibido, constitución VII); el DTO ya agrupado deja la UI presentacional.
3. **Mantener `ListTags` y añadir `ListCategories` aparte** — dos lecturas y un ensamblado en la página para lo que una consulta agrupada devuelve listo; `ListTags` quedaría sin llamadores (código muerto).

## §5. UI `/tags`: catálogo agrupado con acciones por fila y por grupo; 4 diálogos nuevos a nivel del listado (FR-002..FR-006)

**Decisión** (contrato congelado en [contracts/ui-contract.md](./contracts/ui-contract.md)):

- `src/app/tags/page.tsx` ejecuta `ListTagCatalog` (único cambio del adaptador inbound).
- `tag-catalog.tsx` (client) recibe `groups: TagCatalogGroupDTO[]` y renderiza por categoría un `<section aria-label="Categoría {nombre}">` con: cabecera (nombre + contador de etiquetas + hint «Sin etiquetas» si está vacía) y menú ⋮ «Acciones de la categoría {nombre}» (ítems «Renombrar…» y «Eliminar…»; este último ausente en la genérica — el servidor la protege igualmente), y dentro el listado de etiquetas **idéntico al actual** (fila con nombre/chips + menú ⋮ que gana el ítem «Mover a categoría…» por encima de «Renombrar…»). Botón «Nueva categoría» en la cabecera de la sección del catálogo.
- Diálogos montados a nivel de `TagCatalog` con el DTO capturado en estado (convención «diálogos por fila» de AGENTS.md): `CreateCategoryDialog`, `RenameCategoryDialog`, `DeleteCategoryDialog` (confirmación estilo `DeactivateTagDialog` con `alertdialog`) y `MoveTagDialog` (Select de categorías existentes — **sin** creación en línea, clarify 2026-11-02; excluye la categoría actual, patrón `MergeTagsDialog.tsx:79-81`).
- Inputs controlados con `useState` + `role="alert"` en errores (patrón `rename-tag-dialog.tsx`, SC-004 de 014); doble envío deshabilitado con `isPending` (edge «Doble envío»); toasts de éxito iguales a los vigentes.
- 4 Server Actions nuevas (`create-category`, `rename-category`, `delete-category`, `move-tag-to-category`) con esquema Zod propio (`category-actions.schema.ts` + `CategoryActionState`, espejo de `tag-actions.schema.ts`), `revalidatePath("/tags")` — las categorías no viven en ninguna otra vista (FR-008), a diferencia de los tags que revalidan layout completo (`create-tag.action.ts:31`).

**Rationale**: la agrupación reutiliza la maquinaria de 004 (menús ⋮ + diálogos a nivel del listado + estados de action) — mismo recorrido cognitivo para el propietario. La presentación queda **no colapsable y plana** dentro de cada grupo (el edge «Catálogo grande» lo deja al plan): decenas de categorías × decenas de tags siguen siendo una lista scrolleable de secciones con cabecera visible; añadir acordeones/colapso es superficie interactiva sin necesidad expresada (principio I). El orden «genérica primero» ancla visualmente el destino por defecto de las etiquetas nuevas.

**Alternativas rechazadas**:

1. **Mover etiquetas con un Select inline en cada fila** — una fila con select permanente añade ruido a un listado largo; el diálogo con Select (patrón fusión) concentra la acción y confirma el destino.
2. **Diálogo de categoría dentro de la propia fila** — rompe la convención de diálogos a nivel del listado (AGENTS.md): tras `revalidatePath` la fila puede cambiar de grupo y desmontarse.
3. **Acordeones colapsables por categoría** — YAGNI: decenas de categorías no justifican estado de colapso ni tests extra (el edge pide «usable», no «colapsable»).

## §6. E2E: spec propia con combinación cuenta/mes libre y catálogo restaurado (FR-010; SC-002..SC-004; convención de aislamiento AGENTS.md)

**Decisión**: nueva `e2e/categorias-tags.spec.ts` (serial dentro del fichero, como toda la suite) que cubre el flujo exigido: crear categoría → mover etiqueta → histórico intacto. Aislamiento:

- **Movimientos**: combinación propia **Cuenta de Miembro A (cuenta 1) + Octubre de 2026** — verificada libre por grep (los meses fijos usados son Mayo/Junio/Julio/Agosto/Septiembre de 2026, Abril en `pagina-cuenta`, 2027 en `cuenta-resultados-anual`; los meses «en curso» de las cuentas 1 y 2 los usan `kpis-fijos`/`cuenta-kpi-gasto-personal`/`porcentaje-ahorro`/`ingresos-regulares`/`descuento-gastos-comunes`/`aportacion-comun`/`registro-movimientos`). Octubre es un mes **cerrado** → sin materialización ni re-sync que interfiera.
- **Catálogo (global)**: la spec restaura el estado al terminar — devuelve la etiqueta movida a la genérica y elimina la categoría creada — de modo que `creacion-tags`/`gestion-tags` (alfabéticamente posteriores: c·r·e/g > c·a) encuentran el catálogo exacto que esperan (p. ej. `gestion-tags` G1/G3 asumen «Ocio» presente y activo). El propio flujo de restauración ejercita mover de vuelta y eliminar categoría vacía.
- **No-regresión de informes** (SC-003): el histórico intacto se verifica en la propia spec (fila del movimiento con misma etiqueta e importe antes/después de mover) y el resto de la suite (`resumen-global`, `cuenta-resultados-anual`) sigue en verde sin cambios — sus desgloses por etiqueta no se alteran porque la pertenencia no toca `movements` (FR-008).

**Rationale**: la convención e2e del repo (BD compartida determinista, `workers: 1`, orden alfabético, combinación cuenta/mes por fichero) obliga a (a) un mes/cuenta sin otros lectores y (b) dejar el catálogo global como se encontró. Posición alfabética de `categorias-tags` (2ª de la suite, tras `aportacion-comun`): su estado inicial es el seed + los movimientos de `aportacion-comun` en el mes en curso de la cuenta 2 — irrelevante para octubre de la cuenta 1.

**Alternativas rechazadas**:

1. **Extender `gestion-tags.spec.ts`** — mezcla dos sujetos y encadena el estado de categorías con el de tags de 004; la convención del repo es fichero propio por flujo (AGENTS.md «E2E»).
2. **No restaurar el catálogo** — `gestion-tags` G3 rellena «Ocio» en un renombrado para provocar duplicado: la etiqueta debe seguir existiendo; dejarla en otra categoría rompería además la legibilidad del catálogo en specs posteriores.
3. **Mes en curso de una cuenta libre** — ningún mes en curso está libre (todas las cuentas tienen lectores de agregados); el mes cerrado de octubre es determinista y sin interferencias de materialización.

## §7. Matriz de tests por capa (FR-010; SC-004) y documentación (FR-009)

**Decisión** — tests (co-localizados con su SUT, AGENTS.md «Tests»):

| Capa | Fichero | Cobertura |
|---|---|---|
| Dominio | `TagCategory.test.ts` (nuevo) | create/rehydrate/rename: trim, nombre vacío, slug inmutable |
| Dominio | `Tag.test.ts` (extendido) | `categoryId` presente desde `create`/`rehydrate`; `moveToCategory` cambia solo categoría; `rename`/`withStatus` la conservan |
| Aplicación | `CreateCategory.test.ts` · `RenameCategory.test.ts` · `DeleteCategory.test.ts` (nuevos, doble `InMemoryCategoryRepository` — espejo de `InMemoryCatalogTagRepository.ts`) | duplicado case-insensitive (y no-normalización de acentos), autoexclusión en renombrado, genérica no eliminable, categoría con etiquetas no eliminable, NotFound |
| Aplicación | `MoveTagToCategory.test.ts` (nuevo) | mover válido, misma categoría = no-op, tag/categoría inexistentes, «Aportación Común» movible |
| Aplicación | `CreateTag.test.ts` (extendido) | toda etiqueta nace en la genérica (FR-007) |
| Aplicación | `ListTagCatalog.test.ts` (nuevo) | agrupación completa, genérica primero, orden es, activas primero; `ListTags.test.ts` jubilado |
| Repositorio | `DrizzleTagCategoryRepository.test.ts` (nuevo, libsql `:memory:` + migraciones) | CRUD, `findByName` case-insensitive, `countTags`, violación única → `DuplicateCategoryNameError`, DELETE de categoría con tags abortado por RESTRICT |
| Repositorio | `DrizzleRepositories.test.ts` / `DrizzleTagRepository` (extendidos) | backfill de `category_id` (tags preexistentes → genérica), `save`/`update` persisten categoría, fusión conserva la categoría de la superviviente |
| Actions | `create-category.action.test.ts` · `rename-category.action.test.ts` · `delete-category.action.test.ts` · `move-tag-to-category.action.test.ts` (nuevos) | traducción de errores de dominio a mensajes, revalidación (patrón `rename-tag.action.test.ts`) |
| Componente | `tag-catalog.test.tsx` (extendido) + 4 tests de diálogo (nuevos) | agrupación por categorías, vacío «Sin etiquetas», menús ⋮ por grupo y por fila, mensajes `role="alert"` conservando el nombre tecleado (esc. 3), genérica sin «Eliminar…» |
| E2E | `categorias-tags.spec.ts` (nueva) | flujo completo + restauración (§6) |

**Documentación** (DoD de la constitución): ADR **0022** nuevo (`tag-categories`: agregado con slug estable, pertenencia como columna NOT NULL RESTRICT de `tags`, genérica por slug — consolida §1–§3); AGENTS.md gana convención «Categorías del catálogo de etiquetas (026)» y actualiza «Seed»; `docs/architecture/diagrams/domain-model.md` añade `TagCategory` + relación, nuevo `categorias-secuencia.md` (mover etiqueta), notas en `gestion-tags-secuencia.md`/`overview.md`/`c4.md` donde mencionen el catálogo; roadmap maestro: **fila 026** (nueva — hoy no existe en la tabla del maestro) marcada Completada al cierre + la nota de diferimiento de informes ya registrada (2026-11-02, ~027).

**Rationale**: constitución III (lógica de negocio cubierta, flujo crítico e2e) y DoD (documentación en el mismo cambio). La fila del roadmap es requisito explícito FR-009.

**Alternativas rechazadas**: anotar ADR 0018 en lugar de ADR nuevo — 0018 registra el mantenimiento de 004; la taxonomía categoría/pertenencia y su esquema son una decisión arquitectónica distinta (nueva tabla + FK + identidad por slug de categoría).

---

**NEEDS CLARIFICATION**: ninguno — todos los puntos del Technical Context y de la spec quedan resueltos contra código en §1–§7.
