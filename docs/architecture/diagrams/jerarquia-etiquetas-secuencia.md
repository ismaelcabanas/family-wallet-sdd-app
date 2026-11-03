# Secuencia: creación única por inferencia en `/tags` (027)

Happy path de los escenarios 1–2 de `027-gestion-etiquetas`: el botón «Nueva etiqueta» abre el diálogo con **categoría padre opcional** — sin padre se crea una **categoría** (`CreateCategory`), con padre una **etiqueta** en ella (`CreateTag` extendido). La inferencia de tipo vive en la action despachadora `createTagEntry` (frontera); las reglas (unicidad por catálogo, trim, slug) viven en los casos de uso. Diagrama base: plan de 027.

```mermaid
sequenceDiagram
    autonumber
    actor U as Propietario
    participant P as "/tags page.tsx (server)"
    participant LC as ListTagCatalog
    participant C as TagCatalog (client)
    participant D as CreateTagDialog
    participant A as createTagEntry (action, Zod)
    participant UCc as CreateCategory
    participant UCt as CreateTag
    participant RC as DrizzleTagCategoryRepository
    participant RT as DrizzleTagRepository
    participant DB as (SQLite/Turso)

    U->>P: GET /tags
    P->>LC: execute()
    LC->>RC: findAll()
    LC->>RT: findAll()
    LC-->>P: grupos ordenados (genérica primera)
    P-->>U: árbol contenedor + único botón «Nueva etiqueta»

    U->>C: «Nueva etiqueta»
    C->>D: abre (Select padre con categorías, sin selección)
    U->>D: Nombre «Suscripciones», categoría vacía → «Crear»
    D->>A: submit { name: "Suscripciones" } (sin categoryId)
    A->>A: tagEntrySchema.safeParse (Zod)
    A->>UCc: execute({ name }) — inferencia: sin padre ⇒ categoría
    UCc->>RC: findByName("Suscripciones")
    RC-->>UCc: null (sin duplicado)
    UCc->>RC: save(TagCategory.create(...))
    RC->>DB: INSERT tag_categories
    A->>A: revalidatePath("/", "layout")
    A-->>D: { status: "success", message: "Categoría creada" }
    D-->>U: toast + cierre; grupo «Suscripciones» (vacío) aparece en el árbol

    U->>D: «Nueva etiqueta» → «Netflix» + padre «Suscripciones» → «Crear»
    D->>A: submit { name: "Netflix", categoryId: suscripciones }
    A->>UCt: execute({ name, categoryId })
    UCt->>RT: findByName("Netflix")
    RT-->>UCt: null
    UCt->>RC: findById(categoryId)
    RC-->>UCt: TagCategory «Suscripciones» (existe)
    UCt->>RT: save(Tag.create({ …, categoryId }))
    RT->>DB: INSERT tags
    A-->>D: { status: "success", message: "Etiqueta creada" }
    D-->>U: toast + cierre; «Netflix» dentro del grupo y disponible en el Select agrupado
    Note over U,DB: Movimientos intactos: el Select agrupa por categoría pero guarda ids de etiqueta (FR-004/FR-005); /summary, /annual, KPIs sin cambios (FR-006)
```

Notas:

- **Errores de dominio** traducidos por la action a mensajes ES: duplicado de etiqueta (`Ya existe una etiqueta con el nombre "X".`), duplicado de categoría (`Ya existe una categoría con el nombre "X".`) y categoría desaparecida en otra pestaña (`La categoría seleccionada ya no está disponible.`); otro `DomainError` → mensaje genérico.
- **Diálogo con `useActionState`** (ADR 0015): el efecto de éxito cierra + tuesta; los inputs son controlados y el Select restaura su selección con un ref tras el auto-reset de React 19.
- El Select «Etiqueta» de los formularios de movimiento agrupa con `SelectGroup`/`SelectLabel` alimentado por `ListGroupedActiveTags` (ver convención 027 en AGENTS.md).
