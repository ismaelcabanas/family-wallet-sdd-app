# Research — Gestión de etiquetas y jerarquía unificada del catálogo (027)

**Feature**: `027-gestion-etiquetas` | **Fecha**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

Resuelve las incógnitas de la spec contra el código real (`tag-catalog.tsx`, `movement-form.tsx`, `CreateTag.ts`, `ListActiveTags.ts`, `select.tsx`, e2e de 026). Cada sección: **Decisión · Rationale · Alternativas**.

---

## 1. Q1 — Una sola vía de creación con inferencia de tipo (decisión del propietario, 2026-11-03)

**Decisión**: El diálogo «Nueva etiqueta» de `/tags` es el **único punto de creación** del catálogo. Pide **nombre** y una **categoría padre opcional** (Select con todas las categorías, genérica primera): **sin padre seleccionado se crea una categoría** (nivel superior de la jerarquía); **con padre seleccionado se crea una etiqueta** dentro de ella. Sin alta inline de categorías («+ Nueva categoría…» descartado) y **sin botón «Nueva categoría»** en la cabecera. Cancelar el diálogo no compromete nada (no hay creación intermedia).

**Rationale**: Es el modelo Money Lover que motivó la feature («una sola vía de creación», spec §Decisiones): una única superficie de alta donde el tipo se infiere de la posición en la jerarquía. El propietario lo cerró explícitamente al planificar: «en el diálogo "Nueva etiqueta" solo se pueden crear etiquetas [y categorías por inferencia], no hay creación inline; si necesitamos una nueva categoría, se crea desde la misma página». Las categorías vacías siguen siendo posibles (crear sin padre) y eliminables (⋮ → «Eliminar…», 026).

**Alternativas consideradas**:

- *Inline ansioso (patrón 017 en el diálogo)*: «+ Nueva categoría…» con action directa + `useTransition`; la categoría persiste aunque se cancele el diálogo. Descartado por el propietario: añade un segundo flujo de creación dentro del diálogo y categorías huérfanas accidentales.
- *Inline diferido/atómico*: categoría como estado cliente hasta el submit, con action compuesta categoría+etiqueta. Descartado: rompe la simetría con 017, requiere caso de uso compuesto y detecta duplicados de categoría tarde.
- *Botón «Nueva categoría» en cabecera (026 vigente)*: descartado — perpetúa los «dos botones hermanos» que ocultan la jerarquía (motivación (b) de la spec).

**Trade-off documentado**: un usuario que ignora el selector y confirma con nombre único crea una **categoría** sin quererlo. Mitigación: placeholder explícito del Select («Ninguna — se creará una categoría»), toast diferenciado («Categoría creada»/«Etiqueta creada») y visibilidad inmediata del grupo nuevo (eliminable si está vacío). El 017 del formulario de movimiento NO cambia: su etiqueta inline sigue naciendo en la genérica (FR-007 de 026, escenario 9).

## 2. Árbol unificado en `/tags` — presentación contenedora (FR-003)

**Decisión**: Mantener el esqueleto de secciones de 026 (`section aria-label="Categoría {nombre}"` + `ul` de filas) pero reforzar la **contención visual**: cada categoría pasa de simple `border-b` de cabecera a un **contenedor** `rounded-lg border` con la cabecera dentro (nombre + cardinal + ⋮) y las filas de etiqueta con **sangría** (`pl` adicional) dentro del contenedor. Un solo botón de creación («Nueva etiqueta») en la cabecera del catálogo, junto al contador «N categorías».

**Rationale**: La jerarquía «inequívoca sin explicación externa» se consigue con las dos señales visuales estándar de árbol (borde contenedor + sangría) sin introducir componentes nuevos ni patrones ARIA `tree` (que exigen gestión de teclado compleja para ganancia nula con 2 niveles y sin colapso). Los selectores estables de 026 (`region "Categoría {nombre}"`, `listitem {tag}`, `button "Acciones de…"`) se conservan: las e2e de 026/004/017 siguen pasando sin reescritura (SC-003).

**Alternativas consideradas**: chips anidados (desechable: pierde las acciones por fila), `role="tree"` ARIA (sobreingeniería sin colapso), colapso de grupos (explícitamente fuera de scope, 026).

## 3. Selector «Etiqueta» agrupado — Radix nativo + caso de uso agrupado (FR-004, FR-005)

**Decisión**:

- **UI**: el Select de `movement-form.tsx` agrupa con `SelectGroup` + `SelectLabel` **ya versionados en el repo** (`components/ui/select.tsx` los exporta; nadie los usaba aún). Las `SelectLabel` de Radix **no son ítems**: no reciben foco, no son seleccionables por clic ni por teclado, y el typeahead las salta → FR-004/FR-005 **por construcción**. «Sin etiqueta» (`NO_TAG_VALUE`, solo ingresos) permanece como ítem plano **antes** de los grupos. El `input hidden` con `tagId` y la semántica del valor guardado no cambian.
- **Datos**: nuevo caso de uso **`ListGroupedActiveTags`** (`src/application/tag/`) que devuelve `ActiveTagGroupDTO[] = { category: CategoryDTO; tags: TagDTO[] }[]` — solo categorías con ≥1 etiqueta activa, orden congelado en el caso de uso: genérica primera, resto `localeCompare("es")`, etiquetas por nombre dentro de grupo (criterio vigente de `ListActiveTags.ts:13`). **Jubila `ListActiveTags`** (su único llamador de producción es la página de cuenta, `src/app/accounts/[accountId]/page.tsx:91`; espejo del jubileo `ListTags`→`ListTagCatalog` de 026). La UI solo anida el DTO (constitución VII).
- **Extras 017**: `TagDTO` (options del Select) gana `categoryId` + `categoryName` para que la etiqueta creada inline (que nace en la genérica) se fusione en su grupo correcto desde el estado `extraTags` del diálogo (mismo mecanismo que hoy; `MovementTagDTO` de las filas de listado **no** cambia — FR-006).

**Rationale**: agrupar en la capa de aplicación evita lógica de negocio (orden, genérica primero, filtrado de vacías) en el cliente; Radix da la no-seleccionabilidad gratis. «Categorías sin etiquetas activas no pintan cabecera» (escenario 8) sale de construir los grupos solo con etiquetas activas.

**Alternativas consideradas**: extender `TagDTO` con categoría y agrupar en cliente (vierte orden/filtrado a la UI — descartado); nativo `<select>` + `<optgroup>` (el repo ya estandarizó Radix Select); combobox buscable (catálogo de decenas — innecesario).

## 4. Alta desde `/tags` — `CreateTag` con categoría + action despachadora (FR-001, FR-002)

**Decisión**:

- **Aplicación**: `CreateTag.execute({ name, categoryId? })` — si llega `categoryId` se valida existencia (`CategoryNotFoundError`, «La categoría seleccionada ya no está disponible.» — cubre el edge de categoría eliminada en otra pestaña) y se usa; si no, resuelve la genérica (comportamiento vigente de 026, firma retrocompatible para el 017 `create-tag.action.ts`). `CreateCategory` no cambia.
- **Frontera**: nueva Server Action **`createTagEntry`** (`create-tag-entry.action.ts`) con esquema Zod `{ name: trim().min(1), categoryId?: coerce.int().positive() }` y estado `idle | success | error` (espejo `CategoryActionState`): `categoryId` ausente/vacío → `CreateCategory`; presente → `CreateTag`. El diálogo usa `useActionState` (ADR 0015: los diálogos envían formularios, no consultas).
- **Revalidación**: `revalidatePath("/", "layout")` — las etiquetas alimentan los Select de movimiento (mismo alcance que `create-tag.action.ts:35`); la layout revalida también `/tags`, así que cubre la vía categoría.

**Rationale**: La inferencia de tipo es semántica de formulario (qué control dejó vacío), no regla de negocio: la action fina despacha al caso de uso correcto y cada caso de uso conserva sus invariantes (unicidad por catálogo, trim, slug). Sin caso de uso compuesto (YAGNI, principio I).

**Alternativas consideradas**: caso de uso `CreateCatalogEntry` que decide tipo (mueve una decisión de formulario a aplicación — no es regla de dominio); dos actions desde el diálogo con `useActionState` condicional (estado duplicado y submit condicional frágil).

## 5. Ciclo de vida 004/026 y diálogos — intactos, montados a nivel del listado

**Decisión**: Rename/merge/deactivate/reactivate/move y rename/delete de categoría quedan tal cual (escenario 7). El nuevo `CreateTagDialog` se monta a nivel de `TagCatalog` (convención «Diálogos por fila» de AGENTS.md), con input **controlado** (`useState`, patrón `rename-tag-dialog.tsx`, SC-004 de 014) y Select de categoría controlado + `input hidden` (patrón `move-tag-dialog.tsx`). Doble envío cubierto con `isPending` en todos los botones.

## 6. E2E — fichero propio, combinación libre y restauración (FR-008, SC-004)

**Decisión**: `e2e/jerarquia-etiquetas.spec.ts` (posición alfabética J: tras `ingresos-regulares`, antes de `kpis-fijos-cuenta`), serial dentro del fichero (convención). Combinación propia: **Cuenta de Miembro A + Enero de 2026** (`/accounts/1?month=2026-01`, mes cerrado sin lectores posteriores; las combinaciones usadas por otros specs son 2026-03..10, 2025-01, 2026-05/06/07/08/09). Flujo: crear categoría por inferencia (sin padre) → crear etiqueta en ella → registrar un gasto con esa etiqueta → verificar grupo del selector agrupado + cabeceras no seleccionables → **restaurar**: borrar el movimiento, mover la etiqueta a la genérica (⋮ «Mover a categoría…») y eliminar la categoría vacía (⋮), dejando el catálogo como estaba +1 etiqueta activa en General (misma disciplina que `categorias-tags.spec.ts` G8, que dejó «Mercadona» activa sin romper a los ficheros posteriores).

**Rationale**: BD e2e compartida determinista con `workers: 1` y orden alfabético (AGENTS.md «E2E»): el fichero debe encontrar el catálogo en el estado exacto en que lo dejaron los anteriores (tras `gestion-tags`/`ingresos-regulares`) y dejarlo utilizable para los siguientes. Ningún spec posterior cuenta etiquetas exactas del catálogo ni lee Enero 2026 (verificado por grep de meses/cuentas en `e2e/`).

## 7. Roadmap maestro (FR-007) y documentación viva

**Decisión**: Al completar la feature: fila `027-gestion-etiquetas` (Completada) en `specs/001-family-wallet/spec.md` y re-referencia de la nota del informe mensual por categorías «~027» (2026-11-02, línea 85 del maestro) a **~028**. En el mismo cambio: convención nueva en AGENTS.md («Jerarquía y creación única (027)»), extensión de `docs/architecture/diagrams/` reutilizando los diagramas del plan (regla anti-drift) y **sin ADR nuevo** (no hay decisión estructural: ni esquema, ni puerto, ni patrón inédito — la inferencia de tipo es contrato UI y queda congelada en el ui-contract; la extendición de `CreateTag` es evolución de firma).

**Alternativa descartada**: ADR para la creación única — sería duplicar el ui-contract; criterio 026 (ADR 0022 se justificó por taxonomía + esquema + migración, aquí inexistentes).

## 8. Matriz de cobertura de tests (FR-008, SC-004)

| Capa | SUT | Casos clave |
|---|---|---|
| Aplicación | `CreateTag` (extendido) | categoría explícita válida; `CategoryNotFoundError` (inexistente — edge otra pestaña); duplicado case-insensitive conserva reglas; sin `categoryId` → genérica (regresión 017) |
| Aplicación | `ListGroupedActiveTags` | agrupación por categoría; genérica primera + `localeCompare("es")`; solo activas; **grupos vacíos omitidos** (esc. 8); orden por nombre dentro de grupo |
| Actions | `createTagEntry` | sin `categoryId` → vía categoría (duplicado categoría traducido); con `categoryId` → vía etiqueta; Zod rechaza ids no positivos; revalida layout |
| Componentes | `tag-catalog` + `CreateTagDialog` | árbol contenedor (una sección por categoría, filas dentro); un solo botón «Nueva etiqueta» (sin «Nueva categoría»); sin padre → submit crea categoría; error conserva nombre (input controlado); genérica primera |
| Componentes | `movement-form` (Select agrupado) | cabeceras por categoría; cabeceras **no** aparecen como `option`; sin cabeceras de grupos vacíos; «Sin etiqueta» solo ingresos; extra 017 se coloca en su grupo |
| E2E | `jerarquia-etiquetas.spec.ts` | flujo completo inferencia → etiqueta → movimiento → restauración (research §6) |

## 9. NEEDS CLARIFICATION — resumen

Ninguna pendiente: Q1 resuelto en §1 (inferencia de tipo) y plegado en la spec (FR-001/2/3, escenarios 2/4, edge cases) el 2026-11-03. El resto de la spec no tenía marcadores (checklist de requirements verificado).
