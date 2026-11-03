# Data Model — Gestión de etiquetas y jerarquía unificada (027)

**Feature**: `027-gestion-etiquetas` | **Fecha**: 2026-11-03 | **Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

**Sin cambios de esquema ni de dominio** (spec «Out of Scope»): la feature es de **comportamiento y presentación** — extensión de firma de `CreateTag` (categoría explícita), nuevo caso de uso de lectura `ListGroupedActiveTags` (jubila `ListActiveTags`), nuevas DTOs de agrupación y una action despachadora. `Tag`, `TagCategory`, `Movement`, tablas y migraciones quedan **intactos** (FR-005/FR-006 por omisión).

---

## 1. Dominio — INTACTO (referencia)

- `Tag` (`src/domain/tag/Tag.ts`): nombre único case-insensitive, slug, `status`, `categoryId` obligatorio (026), `moveToCategory` — sin cambios.
- `TagCategory` + `DefaultCategory` (`DEFAULT_CATEGORY_SLUG`), errores de `TagErrors`/`TagCategoryErrors` — sin cambios; la genérica sigue siendo el destino de las etiquetas creadas **sin categoría explícita** (017) y una categoría más en el Select padre.
- `Movement`: la clasificación sigue siendo `tagId` 0..1; la categoría nunca es atributo del movimiento (FR-005 — invariante 026 intacto, ahora también por UI: cabeceras no seleccionables).

## 2. Aplicación — casos de uso

### 2.1 `CreateTag` (modificado — firma extendida, retrocompatible)

```ts
// src/application/tag/CreateTag.ts
execute(input: { name: string; categoryId?: TagCategoryId }): Promise<Tag>
```

| Regla | Comportamiento |
|---|---|
| `name` vacío tras trim | `InvalidTagError` («El nombre de la etiqueta es obligatorio.») |
| duplicado case-insensitive (global, sin acentos-normalización) | `DuplicateTagNameError` — independientemente de la categoría (regla 026 vigente) |
| `categoryId` **presente** | `CategoryRepository.findById` → `null` ⇒ `CategoryNotFoundError` («La categoría seleccionada ya no está disponible.» — edge de categoría eliminada en otra pestaña); válida ⇒ `Tag.create` con esa categoría |
| `categoryId` **ausente** | resuelve `findBySlug(DEFAULT_CATEGORY_SLUG)` y crea en la genérica — comportamiento 026 intacto (vía 017) |
| slug | `deriveTagSlug` + sufijo `-2, -3…` ante colisión (vigente) |

### 2.2 `CreateCategory` — INTACTO

Único dueño de la vía «sin padre ⇒ categoría»: trim, `DuplicateCategoryNameError`, slug con sufijo. La unicidad aplica solo al catálogo de categorías (una etiqueta puede llamarse como una categoría — edge).

### 2.3 `ListGroupedActiveTags` (nuevo — jubila `ListActiveTags`)

```ts
// src/application/tag/ListGroupedActiveTags.ts
execute(): Promise<ActiveTagGroupDTO[]>
```

- Lee `CategoryRepository.findAll()` + `TagRepository.findAllActive()` en paralelo (patrón `ListTagCatalog`).
- Agrupa etiquetas activas por `categoryId`; **omite categorías sin etiquetas activas** (escenario 8: nunca cabecera vacía).
- **Orden congelado en el caso de uso** (la UI solo anida — constitución VII): genérica (`isDefaultCategorySlug`) primera, resto `category.name.localeCompare("es")`; dentro de grupo, `tag.name.localeCompare("es")` (criterio heredado de `ListActiveTags`).
- `ListActiveTags` + su test se jubilan (sin llamadores tras el cambio; espejo `ListTags`→`ListTagCatalog` en 026).

### 2.4 Resto de casos de uso — INTACTOS

`RenameTag`, `MergeTags`, `DeactivateTag`, `ReactivateTag`, `MoveTagToCategory`, `RenameCategory`, `DeleteCategory`, `ListTagCatalog`, y todo `movement/*` (FR-006: agregados y materializaciones sin cambios).

## 3. DTOs

```ts
// src/application/movement/dto.ts — TagDTO extendido (options del selector)
export interface TagDTO {
  id: number;
  name: string;
  slug: string;
  categoryId: number;      // NUEVO — para fusionar extras 017 en su grupo
  categoryName: string;    // NUEVO — etiqueta de la cabecera del grupo
}

// src/application/tag/dto.ts — NUEVO (espejo activo de TagCatalogGroupDTO)
export interface ActiveTagGroupDTO {
  category: CategoryDTO;   // { id, name, isDefault } (026, sin cambios)
  tags: TagDTO[];
}
```

- `MovementTagDTO` (filas de listado) **sin cambios** — FR-006.
- `CatalogTagDTO`/`TagCatalogGroupDTO` (`ListTagCatalog`, `/tags`) **sin cambios**.
- `CreateTagResult.tag` del 017 (`create-tag.action.ts`) pasa a llevar `categoryId`/`categoryName` (la acción construye el DTO desde el `Tag` devuelto + la categoría resuelta).

## 4. Frontera — Server Actions (Zod)

### 4.1 `createTagEntry` (nueva, `src/infrastructure/primary/actions/create-tag-entry.action.ts`)

```ts
const tagEntrySchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  categoryId: z.coerce.number().int().positive().optional(),  // "" del Select vacío → ausente
});

export type TagEntryActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

createTagEntry(_prev: TagEntryActionState, formData: FormData): Promise<TagEntryActionState>
```

- **Despacho (inferencia de tipo, research §1)**: sin `categoryId` → `CreateCategory.execute({ name })` («Categoría creada»); con `categoryId` → `CreateTag.execute({ name, categoryId })` («Etiqueta creada»). La inferencia vive en la frontera (semántica de formulario), las reglas en los casos de uso.
- Errores de dominio traducidos a mensaje ES (tabla §5); otro `DomainError` → «No se ha podido completar la operación. Inténtalo de nuevo.».
- `revalidatePath("/", "layout")` (las etiquetas alimentan los Select de movimiento; la layout cubre `/tags` — research §4).

### 4.2 `createTag` (017) — comportamiento intacto, DTO enriquecido

Firma `createTag(name)` sin cambios (nace en genérica); `result.tag` incluye `categoryId`/`categoryName` para que el diálogo lo fusione en el grupo correcto del Select agrupado.

### 4.3 Resto de actions — INTACTAS

`createCategory` pierde su llamador UI (botón de cabecera desaparece) y **se jubila junto a `CreateCategoryDialog`** (la vía categoría pasa por `createTagEntry`); `renameCategory`, `deleteCategory`, `moveTagToCategory` y todas las de tag/movimiento siguen igual.

## 5. Validación por capa

| Regla | Dominio | Aplicación | Frontera (Zod/actions) | UI |
|-------|---------|------------|------------------------|-----|
| Inferencia: sin padre ⇒ categoría (FR-002) | — | cada UC conserva sus reglas | `createTagEntry` despacha por presencia de `categoryId` | Select vacío con placeholder explícito «Ninguna — se creará una categoría» |
| Etiqueta en categoría existente (FR-001, edge otra pestaña) | — | `CreateTag` → `CategoryNotFoundError` | action traduce mensaje | `role="alert"`, nombre conservado (input controlado) |
| Trim + no vacío (edge) | `Tag.create`/`TagCategory.create` | UC replican | `trim().min(1)` | ídem |
| Duplicados por catálogo (esc. 3, edge) | — | `findByName` (lower) por UC | action traduce ambos errores | `role="alert"` por diálogo |
| Cabeceras no seleccionables (FR-004/005, esc. 5-6) | — | — | — | Radix `SelectLabel` no es ítem: ni clic ni foco ni typeahead |
| Sin cabeceras de grupos vacíos (esc. 8) | — | `ListGroupedActiveTags` omite categorías sin activas | — | render directo del DTO |
| Agregados intactos (FR-006, SC-003) | `Movement` intacto | UC de lectura/escritura intactos | actions intactas | `/summary`, `/annual`, listados, KPIs sin cambios |

## 6. Transiciones de estado

- **Categoría**: `inexistente → existente` gana una vía nueva (diálogo «Nueva etiqueta» sin padre); renombrar/eliminar igual que 026 (vacía y no genérica).
- **Etiqueta**: `inexistente → existente` gana categoría explícita en el alta desde `/tags` (antes solo genérica vía 017); resto del ciclo (renombrar/fusionar/desactivar/reactivar/mover) intacto.
- **Movimiento**: sin transiciones nuevas (FR-006).

## 7. Diagrama de clases (diseño)

```mermaid
classDiagram
    direction LR

    class Tag {
        <<Entity — INTACTA (026)>>
        +id · name · slug · status
        +categoryId: TagCategoryId
        +moveToCategory(categoryId)
    }
    class TagCategory {
        <<Entity — INTACTA (026)>>
        +id · name · slug (genérica por DEFAULT_CATEGORY_SLUG)
        +rename(name)
    }
    class Movement {
        <<Entity — INTACTA>>
        tagId 0..1 — la categoría nunca es atributo (FR-005)
    }

    class TagRepository {
        <<Port — firma intacta>>
        findAllActive() · findBySlug(name) · save() …
    }
    class CategoryRepository {
        <<Port — intacto (026)>>
        findAll() · findById(id) · findBySlug(slug) …
    }

    class CreateTag {
        <<Use case — MODIFICADO (027)>>
        +execute({ name, categoryId? })
        categoría explícita validada;
        sin categoryId → genérica (017 intacto)
    }
    class CreateCategory {
        <<Use case — INTACTO (026)>>
        vía «sin padre» de createTagEntry
    }
    class ListGroupedActiveTags {
        <<Use case — NUEVO (jubila ListActiveTags)>>
        +execute() ActiveTagGroupDTO[]
        genérica primero · sin grupos vacíos
    }
    class ListTagCatalog {
        <<Use case — INTACTO (026)>>
        +execute() TagCatalogGroupDTO[]
    }

    class TagDTO {
        <<DTO — EXTENDIDA>>
        +id · name · slug
        +categoryId · categoryName [NUEVO]
    }
    class ActiveTagGroupDTO {
        <<DTO — NUEVA>>
        +category: CategoryDTO
        +tags: TagDTO[]
    }

    class CreateTagEntryAction {
        <<Server Action — NUEVA (adaptador)>>
        +createTagEntry(prev, formData)
        despacha por categoryId (Zod) · revalida layout
    }
    class CreateTagAction {
        <<Server Action 017 — DTO enriquecido>>
        result.tag con categoryId/categoryName
    }

    CreateTag --> TagRepository
    CreateTag --> CategoryRepository : findById / findBySlug(general)
    CreateCategory --> CategoryRepository
    ListGroupedActiveTags --> TagRepository : findAllActive
    ListGroupedActiveTags --> CategoryRepository : findAll
    ListGroupedActiveTags ..> ActiveTagGroupDTO
    ActiveTagGroupDTO --> CategoryDTO
    ActiveTagGroupDTO --> TagDTO
    CreateTagEntryAction --> CreateTag
    CreateTagEntryAction --> CreateCategory
    CreateTagAction --> CreateTag
    Tag "1..*" --> "1" TagCategory : categoryId NOT NULL FK RESTRICT
    Movement --> Tag : tag_id (intacta)
```

> `docs/architecture/diagrams/domain-model.md` (vivo) se extiende en la implementación reutilizando este diagrama como base. Sin tablas nuevas: el esquema Drizzle y `drizzle/` quedan intactos.

## 8. Glosario ES ↔ EN (constitución VI)

| Español (UI/spec) | English (código) | Notas |
|-------------------|------------------|-------|
| Categoría padre | parent category — Select «Categoría» del diálogo «Nueva etiqueta» | Opcional; su ausencia dispara la vía categoría. |
| Inferencia de tipo | type inference — despacho en `createTagEntry` | Sin padre ⇒ categoría; con padre ⇒ etiqueta (Q1, 2026-11-03). |
| Árbol unificado | unified tree — `TagCatalog` con secciones contenedor | Categoría = grupo contenedor; etiqueta = elemento contenido (FR-003). |
| Selector agrupado | grouped tag Select — `SelectGroup`/`SelectLabel` | Cabeceras organizativas no seleccionables (FR-004/005). |
| Vía única de creación | single creation entry — botón «Nueva etiqueta» | Único punto de alta de etiquetas **y** categorías en `/tags` (FR-002). |

Sin identificadores intraducibles nuevos fuera de los listados.
