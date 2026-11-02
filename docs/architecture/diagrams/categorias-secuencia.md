# Secuencia: categorías del catálogo de etiquetas (feature 026)

Mover una etiqueta de categoría — el flujo central de la organización del catálogo (`/tags`). Crear, renombrar y eliminar categoría siguen el mismo recorrido con su acción y diálogo correspondientes. Diagrama de diseño congelado en [plan.md](../../../specs/026-categorias-tags/plan.md); este documento es la copia viva.

```mermaid
sequenceDiagram
    autonumber
    actor U as Propietario
    participant P as "/tags page.tsx (server)"
    participant LC as ListTagCatalog
    participant C as TagCatalog (client)
    participant D as MoveTagDialog
    participant A as moveTagToCategory (action, Zod)
    participant UC as MoveTagToCategory
    participant R as DrizzleTagRepository
    participant RC as DrizzleTagCategoryRepository
    participant DB as (SQLite/Turso)

    U->>P: GET /tags
    P->>LC: execute()
    LC->>RC: findAll()
    LC->>R: findAll()
    LC-->>P: grupos ordenados (genérica primero, es; activas primero)
    P-->>U: catálogo agrupado (TagCatalogGroupDTO[])

    U->>C: ⋮ de «Mercadona» → «Mover a categoría…» (primer ítem)
    C->>D: abre con categorías excepto la actual (General)
    U->>D: selecciona «Alimentación» → «Mover» (deshabilitado sin selección)
    D->>A: submit { tagId, categoryId }
    A->>A: moveTagSchema.safeParse (Zod)
    A->>UC: execute({ tagId, categoryId })
    UC->>R: findById(tagId)
    R-->>UC: Tag (categoryId = General)
    UC->>RC: findById(categoryId)
    RC-->>UC: TagCategory «Alimentación»
    UC->>UC: tag.categoryId ≠ category.id → continúa (misma categoría = no-op)
    UC->>R: update(tag.moveToCategory(alimentación))
    R->>DB: UPDATE tags SET category_id = …
    A->>A: revalidatePath("/tags") — solo /tags
    A-->>D: { status: "success", message: "Etiqueta movida a Alimentación" }
    D-->>U: toast + cierre; la fila reaparece bajo «Alimentación» sin recarga (FR-005)
    Note over U,DB: Ningún movimiento tocado: /summary, /annual, listados y KPIs idénticos (FR-008, SC-003)
```

Notas del diseño (ADR 0022):

- **Toda etiqueta nueva nace en la genérica** (FR-007): `CreateTag` resuelve `findBySlug(DEFAULT_CATEGORY_SLUG)` — la vía inline de 017 no cambia.
- **Eliminar categoría** exige 0 etiquetas (`countTags`) y no ser la genérica (`isDefaultCategorySlug`); el FK `ON DELETE RESTRICT` es la red de seguridad.
- Los diálogos se montan a nivel de `TagCatalog` (convención «diálogos por fila»): la fila cambia de grupo tras `revalidatePath`.
