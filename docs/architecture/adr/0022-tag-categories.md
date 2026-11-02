# 22. Categorías de etiquetas: taxonomía categoría/pertenencia con slug estable y FK RESTRICT

- **Fecha**: 2026-11-02
- **Estado**: Aceptado (feature 026, `specs/026-categorias-tags/`)
- **Relacionados**: [ADR 0014](./0014-tag-unica-fk-movements.md) (tag única FK `ON DELETE RESTRICT` de movimientos), [ADR 0018](./0018-mantenimiento-catalogo-tags.md) (mantenimiento del catálogo: slug inmutable y protección por slug — contexto, no reescrito), [ADR 0016](./0016-materializacion-perezosa-ingresos-regulares.md) (siembra en migración)

## Contexto y problema

El catálogo de etiquetas (002/004/017) es plano y crece; el propietario quiere un nivel de agrupación superior — **categorías familiares** (Alimentación, Hogar, Viajes…) — aunque de momento solo como organización del catálogo de `/tags`: los informes (`/summary`, `/annual`), formularios y KPIs quedan intactos por decisión explícita (diferido a feature futura ~027). La taxonomía la fija la spec: una categoría agrupa 1..N etiquetas; cada etiqueta pertenece a **exactamente una**, obligatoriamente; la pertenencia es atributo de la etiqueta, nunca del movimiento. La puesta en marcha asigna el 100 % de las etiquetas existentes a una categoría genérica (backfill, SC-001) y toda etiqueta nueva —incluida la inline de 017— nace en ella. Research en `specs/026-categorias-tags/research.md`.

## Opciones consideradas

1. **Categoría como VO dentro del agregado Tag**: la spec exige ciclo de vida propio (crear/renombrar/eliminar categorías) y compartirlas entre etiquetas; imposible por VO.
2. **Tabla puente tag↔categoría (N:M)**: la pertenencia es 1:1 obligatoria; N:M es superficie para un requisito inexistente (principio I).
3. **Columna `is_default` + índice único parcial** para la genérica: dos mecanismos de identidad (id + flag) e invariante extra de BD para lo que un slug constante ya da gratis.
4. **Fila fija con id conocido (p. ej. id=1)** para la genérica: acopla la lógica a un autoincremento; frágil entre BDs (dev/Turso/e2e).
5. **`category_id` nullable + invariante solo en aplicación**: el invariante «exactamente una» quedaría sin refuerzo de esquema (FR-001).
6. **Migración en dos pasos (nullable → backfill por script → NOT NULL)**: paso pre-deploy extra para el mismo resultado.
7. **`ListTags` + `ListCategories` aparte y ensamblado en la página**: dos lecturas y lógica de presentación en el adaptador inbound (prohibido, constitución VII).

## Decisión

- **Agregado propio `TagCategory`** (`src/domain/tag-category/`): entidad congelada con **slug inmutable como identidad** (paridad de `Tag`/ADR 0018), `create`/`rehydrate`/`rename` con trim; unicidad case-insensitive del nombre **fuera** de la entidad (casos de uso con `findByName` + índice `lower(name)` como red de seguridad). `TagCategoryId` es un brand espejo de `TagId`. La derivación de slug tiene un único dueño: `deriveSlug` en `src/domain/shared/slug.ts`, re-exportada como `deriveTagSlug`.
- **La genérica se identifica por slug constante, no por flag ni nombre**: `DEFAULT_CATEGORY_SLUG = "general"` en el módulo puro `DefaultCategory.ts` (espejo de `SystemTags`). Nace en la migración (`INSERT OR IGNORE`, precedente 0004) y en el seed (`SEED_CATEGORIES`, `onConflictDoNothing` por slug); es renombrable (el slug no cambia → sigue siendo la por defecto) y no eliminable (`DeleteCategory` → `ProtectedCategoryError`).
- **Pertenencia como columna de la etiqueta**: `tags.category_id INTEGER NOT NULL REFERENCES tag_categories(id) ON DELETE RESTRICT`. FR-001 queda reforzado por esquema: ninguna fila de tag sin categoría y ninguna categoría borrable con etiquetas (`CategoryNotEmptyError` amigable vía `countTags`; el RESTRICT es la red de seguridad de carrera, traducido también en el repositorio). `Tag` gana `categoryId` obligatorio en `create`/`rehydrate` y `moveToCategory(categoryId)` como única vía de cambio; `rename`/`withStatus` lo conservan.
- **Backfill en la propia migración `0008`** (SC-001): reconstrucción estándar de `tags` (SQLite no admite ADD COLUMN NOT NULL sin default) con `SELECT` que conserva id/name/slug/status y añade la genérica; «General» se siembra antes del rebuild; `movements.tag_id` no se toca.
- **Toda etiqueta nueva nace en la genérica (FR-007)**: `CreateTag` gana `CategoryRepository` y resuelve `findBySlug(DEFAULT_CATEGORY_SLUG)` (fallo ruidoso `CategoryNotFoundError` si faltara); la vía inline de 017 y la creación de la etiqueta de sistema en `MaterializeCommonContributions` pasan por ahí sin cambios de UI.
- **`ListTagCatalog` agrupa y ordena; la UI solo anida**: caso de lectura único que devuelve `TagCatalogGroupDTO[]` pre-ordenado (genérica primero, resto `localeCompare("es")`; dentro del grupo activas primero y luego nombre — criterio vigente). Jubila `ListTags` (sin llamadores, política de barrido de 025). `MoveTagToCategory` es no-op semántico con la misma categoría y no protege a «Aportación Común» (su protección afecta a renombrar/fusionar/desactivar, no a su pertenencia). Revalidación de categorías acotada a `revalidatePath("/tags")`: no viven en ninguna otra vista.

## Consecuencias

- La gestión vive exclusivamente en `/tags`: catálogo agrupado (secciones «Categoría {nombre}» siempre desplegadas), botón «Nueva categoría», menú ⋮ por categoría (la genérica sin «Eliminar…» — presentación; el servidor protege igualmente), «Mover a categoría…» como primer ítem del menú de cada etiqueta (la fila protegida gana menú con ese único ítem) y 4 diálogos montados a nivel del listado (convención «diálogos por fila» de AGENTS.md; inputs controlados SC-004 de 014).
- Fusión 004 sin cambios: `mergeInto` borra la absorbida (desaparece su pertenencia) y la superviviente conserva la suya — cubierto por comportamiento existente + test de regresión.
- Los agregados de lectura, formularios, listados, KPIs, `/summary` y `/annual` quedan intactos (FR-008/SC-003): la categoría no computa en ningún agregado ni aparece en el Select «Etiqueta» (plano).
- Coste: una tabla, una columna, un agregado, un puerto y 4 casos de uso nuevos; e2e propia con restauración del catálogo global (combinación Cuenta de Miembro A + Octubre de 2026) para no alterar los ficheros alfabéticamente posteriores.
