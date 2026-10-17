# Secuencia: mantenimiento del catálogo de etiquetas (feature 004)

Fusión de dos etiquetas — la operación más rica del mantenimiento (`/tags`). Renombrar, desactivar y reactivar siguen el mismo recorrido con su acción y diálogo correspondientes.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant C as TagCatalog (client)
    participant M as MergeTagsDialog
    participant A as mergeTags (Server Action)
    participant UC as MergeTags (aplicación)
    participant R as DrizzleTagRepository (tx)
    participant P as "/tags page.tsx (server)"

    U->>C: menú ⋮ de «super-casa» → «Fusionar en otra…»
    C->>M: abre con el DTO de la absorbida (capturado en estado)
    U->>M: elige «supermercado» como resultante → «Fusionar» (controles deshabilitados en vuelo)
    M->>A: submit FormData { absorbedId, targetId }
    A->>A: mergeTagsSchema.safeParse (Zod: ids numéricos)
    A->>UC: execute({ absorbedId, targetId })
    UC->>R: findById(absorbedId), findById(targetId)
    R-->>UC: ambas existen, distintas
    UC->>UC: isProtectedTagSlug(ambos slugs) → false (protegida absorbida O resultante → ProtectedTagError)
    UC->>R: mergeInto(absorbedId, targetId)
    R->>R: tx: UPDATE movements SET tag_id=target WHERE tag_id=absorbed → n (sin tocar updated_at)
    R->>R: tx: DELETE tags WHERE id=absorbed (tras reasignar, RESTRICT permite)
    R-->>UC: { reassignedMovements: n }
    UC-->>A: ok
    A->>P: revalidatePath("/", "layout") — Select de alta/edición y desgloses frescos (FR-009)
    A-->>M: { status: "success", message }
    M-->>U: cierra + toast «Etiquetas fusionadas»
    P-->>U: lista sin «super-casa» (server render revalidado)
    Note over U,P: listados, cierres, /summary y /annual recalculan por sí mismos (joins vivos): «supermercado» acumula ambos importes, totales globales idénticos (SC-002)
```

Reactivar es la excepción de forma: ítem de menú directo → `reactivateTag` (action directa + `useTransition`, familia ADR 0015) → toast; sin diálogo ni formulario.
