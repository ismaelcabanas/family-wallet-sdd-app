# UI Contract — Árbol unificado y creación única en `/tags`; selector agrupado (027)

**Feature**: `027-gestion-etiquetas` | **Nuevos**: `CreateTagDialog`, selector «Etiqueta» agrupado (`SelectGroup`/`SelectLabel`) | **Modificados**: `tag-catalog.tsx` (árbol contenedor, un solo botón de creación), `movement-form.tsx` (Select agrupado), `create-movement-dialog.tsx`/`edit-movement-dialog.tsx`/`grouped-movement-list.tsx` (prop `tagGroups`), `create-tag.action.ts` (DTO enriquecido) | **Jubilados**: botón «Nueva categoría» + `CreateCategoryDialog` + `create-category.action`, `ListActiveTags` | **Intactos**: fila de etiqueta y sus diálogos 004, `RenameCategoryDialog`/`DeleteCategoryDialog`/`MoveTagDialog` (026), patrón inline 017, `/summary`, `/annual`, página de cuenta y KPIs (FR-006).

Congela la estructura y el comportamiento observable resultante. **Supersede** el [ui-contract de 026](../../026-categorias-tags/contracts/ui-contract.md) en lo no mencionado (cabecera del catálogo y vía de creación de categorías); todo lo demás queda como allí.

---

## 1. Estructura resultante de `/tags` (FR-003; escenarios 1, 4)

```text
┌──────────────────────────────────────────────────────────────┐
│ h1 «Etiquetas»                        GlobalNav (active=tags)│
│ section «Catálogo de etiquetas»                               │
│ [N categorías]  ……………………  [Nueva etiqueta] (Button NUEVO)    │
│ ┌────────── section «Categoría General» (contenedor) ──────┐ │
│ │ ▸ General (13 etiquetas)               ⋮ «Acciones de la  │ │
│ │ ▸   categoría General»                                  │ │
│ │   · fila etiqueta (sangrada: nombre · chips Sistema/     │ │
│ │     Activa/Inactiva · ⋮ «Acciones de {tag}»)             │ │
│ │   · …                                                    │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌────────── section «Categoría Suscripciones» ────────────┐  │
│ │ ▸ Suscripciones (Sin etiquetas) · ⋮ «Acciones de la      │ │
│ │ ▸   categoría Suscripciones»                             │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- **Cada categoría es un contenedor visual** `rounded-lg border` con la cabecera dentro (nombre + cardinal + ⋮) y el `ul` de etiquetas **sangrado** dentro del contenedor: contenedor vs contenido, jerarquía inequívoca sin dos listados hermanos (spec §Assumptions → fija la presentación).
- **Un único botón de creación**: «Nueva etiqueta» en la cabecera del catálogo (junto al contador «N categorías»). **No existe** «Nueva categoría» en ninguna parte (FR-002, Q1).
- Orden, `aria-label`s (`region "Catálogo de etiquetas"`, `region "Categoría {nombre}"`), menús ⋮ (categoría y fila), chips y estado vacío global: **idénticos a 026** (DTO `ListTagCatalog` sin cambios).

## 2. Diálogo «Nueva etiqueta» (FR-001, FR-002; escenarios 1–3)

| Aspecto | Contrato |
|---|---|
| Trigger | Button «Nueva etiqueta» (cabecera del catálogo); montado a nivel de `TagCatalog` |
| Título | `dialog «Nueva etiqueta»` |
| Campos | 1) `Label «Nombre»` — input **controlado**, `autoFocus`. 2) `Label «Categoría»` — Select controlado con **todas** las categorías (genérica primera, DTO `ListTagCatalog`), `input hidden` con el id (patrón `MoveTagDialog`), **sin selección inicial** |
| Placeholder del Select | «Ninguna — se creará una categoría» (hace explícita la inferencia de tipo) |
| Footer | «Cancelar» / «Crear» («Creando…» en pending; deshabilitados con `isPending` — edge doble envío) |
| Éxito sin padre | toast «Categoría creada»; el grupo nuevo (vacío, «Sin etiquetas») aparece ordenado sin recarga |
| Éxito con padre | toast «Etiqueta creada»; la fila aparece dentro del grupo elegido y queda disponible en el Select de movimiento sin recarga |
| Errores (`role="alert"`, valores conservados) | vacío tras trim («El nombre es obligatorio.»); duplicado etiqueta (`Ya existe una etiqueta con el nombre "{X}".`, esc. 3); duplicado categoría (`Ya existe una categoría con el nombre "{X}".`, vía sin padre); categoría desaparecida («La categoría seleccionada ya no está disponible.», edge otra pestaña) |
| Cancelar | cierra sin compromiso (no-op limpio — edge, Q1) |

- Submit vía `useActionState(createTagEntry)`; el efecto de éxito cierra + toast (patrón `CreateCategoryDialog` de 026).
- La regla de duplicados aplica **por catálogo destino** (etiqueta↔etiqueta, categoría↔categoría); una etiqueta puede llamarse como una categoría (regla 026).

## 3. Selector «Etiqueta» agrupado (FR-004, FR-005; escenarios 5, 6, 8)

- En alta y edición (`MovementFormFields`): el `SelectContent` renderiza **«Sin etiqueta»** (solo ingresos, ítem plano primero) y luego un `SelectGroup` por categoría con `SelectLabel {categoría}` + `SelectItem` por etiqueta activa.
- **Cabeceras no seleccionables por construcción** (Radix `SelectLabel` no es ítem): ni clic, ni foco, ni teclado, ni typeahead pueden elegir una categoría — FR-005 garantizado en UI además de por modelo (`movements.tag_id` → `tags.id`, nunca `tag_categories`).
- **Sin cabeceras vacías**: `ListGroupedActiveTags` omite categorías sin etiquetas activas (esc. 8). Orden: genérica primera, resto es-ES; etiquetas por nombre dentro de grupo (data-model §2.3).
- Prop nueva `tagGroups: ActiveTagGroupDTO[]` sustituye a `tags: TagDTO[]` en `MovementFormFields`, `CreateMovementDialog`, `EditMovementDialog` y `GroupedMovementList` (la página de cuenta llama a `ListGroupedActiveTags`).
- **Extras 017 intactos**: la etiqueta creada inline («+ Nueva etiqueta») se fusiona en el grupo de la genérica desde el estado `extraTags` del diálogo (ahora con `categoryId`/`categoryName` en el DTO del resultado) — sin recarga, tanda intacta (esc. 9).
- Edición con etiqueta inactiva: comportamiento vigente (la opción actual no está en los grupos activos; el valor viaja en el `input hidden` igual que hoy — edge).
- El valor guardado y el `input hidden name="tagId"` **no cambian** (FR-004: misma semántica de id de etiqueta).

## 4. Server Actions y revalidación

| Action | Esquema (Zod) | Estado | Revalida |
|---|---|---|---|
| `createTagEntry` (nueva) | `{ name: trim().min(1), categoryId?: coerce.int().positive() }` | `TagEntryActionState` (idle/success/error) | `revalidatePath("/", "layout")` |
| `createTag` (017, intacta en firma) | `z.string().trim().min(1)` | `{ ok, tag }` — `tag` con `categoryId`/`categoryName` | `revalidatePath("/", "layout")` (vigente) |
| `renameCategory`/`deleteCategory`/`moveTagToCategory`/tags 004 | intactas (026/004) | intactos | `/tags` (categorías) · layout (tags) — vigente |

- `createCategory.action.ts` + `CreateCategoryDialog` se jubilan (la vía «sin padre» de `createTagEntry` los sustituye; sin llamadores).

## 5. Comportamiento observable intacto (FR-006; escenarios 7, 9; SC-003)

- Renombrar/fusionar/desactivar/reactivar/mover etiquetas y renombrar/eliminar categorías: recorridos idénticos a 004/026 con diálogos a nivel del listado (esc. 7).
- Inline 017 «+ Nueva etiqueta» en el formulario: flujo idéntico; la etiqueta nace en la genérica y aparece bajo su cabecera en el selector agrupado (esc. 9).
- `/summary`, `/annual`, listados de cuenta, KPIs y materializaciones: funcionalmente idénticos (SC-003).

## 6. Selectores estables para tests

| Elemento | Selector |
|----------|----------|
| Árbol / grupos | `region "Catálogo de etiquetas"` · `region "Categoría {nombre}"` (inalterados 026) |
| Botón crear | `button "Nueva etiqueta"` (nuevo; **no existe** `button "Nueva categoría"`) |
| Diálogo alta | `dialog "Nueva etiqueta"` → `textbox "Nombre"` · `combobox "Categoría"` |
| Opción «sin padre» | `option "Ninguna — se creará una categoría"` (ítem del Select) |
| Select agrupado | `combobox "Etiqueta"` → cabeceras como texto de `SelectLabel` (sin rol `option`); etiquetas como `option {nombre}` dentro de su grupo |
| Alertas de diálogo | `role="alert"` dentro del diálogo (valores conservados) |
| Filas/menús 004/026 | inalterados (`listitem {tag}` · `button "Acciones de {tag}"` · `button "Acciones de la categoría {nombre}"`) |

## 7. Accesibilidad

- Contenedores de categoría como `section` con `aria-label` (navegación por regiones, sin `role="tree"`); filas sangradas mantienen el modelo de navegación plana de 004/026.
- Cabeceras del Select agrupado: `SelectLabel` Radix — expuestas a lectores como agrupación, fuera del orden de tabulación y del conjunto de opciones.
- Diálogo con foco inicial en «Nombre», retorno de foco al cerrar; `role="alert"` + `aria-describedby` en errores (patrón SC-004 de 014).

## 8. Fuera de alcance (this contract)

Asignar categorías a movimientos, informes por categoría (~028 tras FR-007), colapso de grupos, reordenado, colores/iconos, movimiento en lote, creación de categorías desde `MoveTagDialog`, «subcategorías» de 3+ niveles, dark mode y optimización móvil específica (spec «Out of Scope»).
