# UI Contract — Catálogo de etiquetas agrupado por categorías (026)

**Feature**: `026-categorias-tags` | **Nuevos**: `CreateCategoryDialog`, `RenameCategoryDialog`, `DeleteCategoryDialog`, `MoveTagDialog`, botón «Nueva categoría», menú ⋮ por categoría | **Modificados**: `tag-catalog.tsx` (agrupado), `/tags` `page.tsx` (lectura `ListTagCatalog`) | **Intactos**: fila de etiqueta y sus diálogos 004 (`RenameTagDialog`, `MergeTagsDialog`, `DeactivateTagDialog`, Reactivar), `GlobalNav`, acciones de tag 004/017, formularios de movimiento y Select «Etiqueta» plano, `/summary`, `/annual`, página de cuenta y KPIs (FR-008).

Congela la estructura y el comportamiento observable de `/tags` resultante. **Supersede** la estructura de listado plano de [004 ui-contract](../../004-gestion-tags/contracts/) en lo no mencionado; todo lo demás queda como allí y en AGENTS.md («Diálogos por fila»).

---

## 1. Estructura resultante de `/tags` (FR-002; escenarios 1, 2)

```text
┌──────────────────────────────────────────────────────────────┐
│ h1 «Etiquetas»                        GlobalNav (active=tags)│
│ section «Catálogo de etiquetas»                               │
│ [Nueva categoría] (Button, abre CreateCategoryDialog)         │
│ ┌ section «Categoría General» (genérica, siempre primera) ┐  │
│ │ General (N etiquetas)                  ⋮ «Acciones de la  │
│ │                                         categoría General» │
│ │   · fila etiqueta (igual que hoy: nombre · chips Sistema/ │
│ │     Activa/Inactiva · ⋮ «Acciones de {tag}»)              │
│ │   · …                                                    │
│ └──────────────────────────────────────────────────────────┘  │
│ ┌ section «Categoría Alimentación» …  ⋮ «Acciones de la      │
│ │   categoría Alimentación»               ────────────────── │
│ │   · filas de etiquetas · …                               │
│ └──────────────────────────────────────────────────────────┘  │
│ ┌ section «Categoría Viajes» (vacía) · «Sin etiquetas» · ⋮ ┐ │
│ └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

- **Orden congelado** (viene del DTO, la UI no ordena): genérica primero (`isDefault`), resto por nombre `localeCompare("es")`; dentro de cada grupo, activas primero y luego nombre (criterio vigente 004). Sin colapso: todos los grupos siempre desplegados (research §5).
- **Cada grupo** es un `section` con `aria-label="Categoría {nombre}"`, cabecera con nombre visible + cardinal («{N} etiquetas»; «Sin etiquetas» si vacía) y menú ⋮ `aria-label="Acciones de la categoría {nombre}"` (≥ 44 px, igual que el de fila).
- **Fila de etiqueta**: idéntica a la actual; su menú ⋮ gana el ítem **«Mover a categoría…»** en primera posición, seguido de «Renombrar…» / «Fusionar en otra…» / «Desactivar…» (activas) o «Reactivar» (inactivas). La fila protegida («Aportación Común») mantiene su comportamiento 004 **con menú** (es movible): «Mover a categoría…» es su único ítem.
- **Estado vacío global** (0 etiquetas en total): mensaje actual dentro de la genérica («No hay etiquetas todavía.»).

## 2. Menú ⋮ de categoría (FR-004, FR-006; edge «Categoría genérica protegida»)

| Grupo | Ítems |
|---|---|
| Genérica (`isDefault`) | «Renombrar…» (sin «Eliminar…») |
| Resto | «Renombrar…», «Eliminar…» |

- La ausencia de «Eliminar…» en la genérica es **presentación**; el servidor protege igualmente (`ProtectedCategoryError`) contra cualquier vía.

## 3. Diálogos (montados a nivel de `TagCatalog`, DTO capturado en estado — AGENTS.md «Diálogos por fila»)

| Diálogo | Trigger | Contenido | Éxito (toast + cierre) | Errores (`role="alert"`, valor conservado) |
|---|---|---|---|---|
| `CreateCategoryDialog` | Button «Nueva categoría» | `DialogTitle «Nueva categoría»`; input controlado `Label «Nombre»`; footer «Cancelar» / «Crear» («Creando…» en pending) | «Categoría creada» — el grupo nuevo aparece (vacío) ordenado | vacío tras trim; `Ya existe una categoría con el nombre "{X}".` (esc. 3) |
| `RenameCategoryDialog` | ⋮ → «Renombrar…» | `«Renombrar categoría»`; input controlado con el nombre actual; «Guardar» | «Categoría renombrada» | duplicado (autoexcluido) |
| `DeleteCategoryDialog` | ⋮ → «Eliminar…» | `alertdialog «Eliminar categoría»`; texto «Se eliminará la categoría "{X}". Las etiquetas no se verán afectadas.»; «Eliminar» (destructive) | «Categoría eliminada» | `La categoría "{X}" tiene etiquetas asignadas…` (esc. 7, guardado servidor); genérica protegida |
| `MoveTagDialog` | ⋮ de fila → «Mover a categoría…» | `«Mover etiqueta»`; texto «"{tag}" pasará a la categoría que elijas.»; Select `Label «Categoría»` con **todas las categorías excepto la actual** (sin creación en línea — clarify 2026-11-02); «Mover» deshabilitado sin selección | «Etiqueta movida a {categoría}» — la fila reaparece en el grupo destino inmediatamente (esc. 4) | tag/categoría ya no disponible |

- **Inputs controlados** con `useState` + `aria-describedby` al `role="alert"` (patrón `rename-tag-dialog.tsx`, SC-004 de 014). **Doble envío**: todos los botones submit/disable con `isPending` (edge de la spec).
- El Select de `MoveTagDialog` usa el patrón `MergeTagsDialog` (Select controlado + `input hidden` con el id, `autoFocus` en el trigger).

## 4. Server Actions y revalidación

| Action | Esquema (Zod, `category-actions.schema.ts`) | Revalida |
|---|---|---|
| `createCategory` | `{ name: trim().min(1) }` | `revalidatePath("/tags")` |
| `renameCategory` | `{ categoryId: coerce.int().positive(), name: trim().min(1) }` | ídem |
| `deleteCategory` | `{ categoryId: coerce.int().positive() }` | ídem |
| `moveTagToCategory` | `{ tagId: coerce.int().positive(), categoryId: coerce.int().positive() }` | ídem |

- Estado compartido `CategoryActionState` (`idle | success | error`), espejo de `TagActionState` (`tag-actions.schema.ts:21-24`). Errores de dominio traducidos a mensaje ES (tabla de data-model §1.2); cualquier otro `DomainError` → «No se ha podido completar la operación. Inténtalo de nuevo.».
- **Solo `/tags`**: las categorías no aparecen en ninguna otra vista (FR-008), a diferencia de los tags (que revalidan layout completo porque alimentan el Select «Etiqueta»).

## 5. Comportamiento observable intacto (FR-007, FR-008; escenarios 5, 8)

- Registrar/editar/eliminar movimientos, crear etiquetas inline («+ Nueva etiqueta» de 017), renombrar/fusionar/desactivar/reactivar etiquetas de 004: **recorridos idénticos** a hoy; la etiqueta nueva aparece bajo la genérica sin paso adicional.
- `/summary` y `/annual`: mismos desgloses por etiqueta, mismos importes (SC-003) — ninguna referencia a categorías.
- El Select «Etiqueta» de los formularios de movimiento sigue **plano, sin agrupar** (FR-008).

## 6. Selectores estables para tests

| Elemento | Selector |
|----------|----------|
| Catálogo | `getByRole("region", { name: "Catálogo de etiquetas" })` (inalterado) |
| Grupo de categoría | `getByRole("region", { name: "Categoría {nombre}" })` (o `section` con `aria-label`) |
| Botón crear | `getByRole("button", { name: "Nueva categoría" })` |
| Menú de categoría | `getByRole("button", { name: "Acciones de la categoría {nombre}" })` |
| Fila de etiqueta / menú | inalterados 004: `listitem` con `aria-label={tag.name}` · `button «Acciones de {tag}»` |
| Mover | menú → `menuitem «Mover a categoría…»` → `dialog «Mover etiqueta»` → `combobox «Categoría»` |
| Alertas de diálogo | `getByRole("alert")` dentro del diálogo (valor del input conservado) |

## 7. Accesibilidad

- Grupos como `section` con `aria-label` navegable; menús ⋮ ≥ 44 px con `aria-label` descriptivo (patrón vigente).
- Diálogos Radix con foco inicial (input en crear/renombrar, Select en mover) y retorno de foco al cerrar; `alertdialog` para la eliminación (confirmación destructiva).
- Sin tablas ni árboles: listas planas dentro de secciones — mismo modelo de navegación por teclado que 004.

## 8. Fuera de alcance (this contract)

Informe por categorías (~027), agrupar el Select «Etiqueta» (optgroup), desactivar/fusionar categorías, reordenar catálogo, colores/iconos, movimiento en lote, creación de categoría en línea desde `MoveTagDialog`, dark mode y optimización móvil específica (spec «Out of Scope»).
