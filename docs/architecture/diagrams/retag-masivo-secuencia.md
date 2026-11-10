# Reasignación masiva de etiquetas — secuencia

Flujo crítico «seleccionar → confirmar → listado y desgloses actualizados» de la página de cuenta (`/accounts/{id}?month=`). La confirmación re-valida en servidor: los ids ajenos a la cuenta/mes o desaparecidos quedan fuera del `WHERE` de la única sentencia `UPDATE` (decisión «ignorar con aviso» — el toast compone «{u} de {t} movimientos actualizados»); la fila protegida «Aportación Común» no ofrece checkbox ni aparece como destino. `updated_at` de los reasignados se actualiza (diferencia deliberada con `mergeInto` de 004 — ADR 0023). Fuente: `specs/029-retag-masivo/plan.md` (diagrama de diseño congelado, reutilizado como documentación viva).

```mermaid
sequenceDiagram
    actor User as Usuario
    participant GML as GroupedMovementList (client)
    participant BRD as BulkRetagDialog (client)
    participant ACT as bulkRetag (Server Action)
    participant UC as BulkRetagMovements
    participant TR as DrizzleTagRepository
    participant MR as DrizzleMovementRepository
    participant DB as SQLite/Turso

    User->>GML: «Seleccionar» + marca N filas (protegidas sin checkbox)
    User->>GML: «Cambiar etiqueta…» (n ≥ 1)
    GML->>BRD: abre con {n, ids, tagGroups}
    User->>BRD: elige etiqueta destino (Select agrupado) → «Reasignar»
    BRD->>ACT: form {accountId, month, movementIds[], targetTagId}
    ACT->>ACT: bulkRetagSchema (Zod) — ids repetidos
    ACT->>UC: execute(BulkRetagInputDTO)
    UC->>UC: deduplica ids (vacío → InvalidMovementError)
    UC->>TR: findById(targetTagId)
    TR-->>UC: Tag (inexistente→TagNotFoundError · inactiva→InactiveTagError · protegida→ProtectedTagError)
    UC->>MR: retagMovements(accountId, month, ids, tagId)
    MR->>DB: UPDATE movements SET tag_id, updated_at WHERE id IN (…) AND cuenta ∧ mes
    DB-->>MR: rowsAffected = updated
    MR-->>UC: { updated }
    UC-->>ACT: { updatedCount, skippedCount }
    ACT->>ACT: revalidatePath("/", "layout")
    ACT-->>BRD: { status:"success", message:"N movimientos actualizados" }
    BRD-->>User: toast + cierre + salida del modo selección
    Note over GML: revalidate → listado/KPIs/summary/annual muestran la nueva etiqueta (joins vivos, totales idénticos)
```
