# Secuencia: importación de la hoja mensual (feature 028)

Flujo crítico «subida → previsualización → confirmación → listado» de `/import`. La confirmación **re-parsea y re-valida el fichero en servidor** (recalcula el plan fresco desde las filas con `buildSheetImportPlan`, no confía en la previsualización previa) y persiste en una **única transacción todo-o-nada** (`DrizzleSheetImportRepository`; FR-005). `Movement.create` es la única vía de validación/escritura (FR-006). Fuente: `specs/028-importacion-excel/plan.md` (diagrama de diseño congelado, reutilizado como documentación viva).

```mermaid
sequenceDiagram
    actor U as Usuario
    participant W as ImportSheetWizard (client)
    participant A as importSheetAction
    participant P as parseSheetCsv
    participant Prev as BuildSheetImportPreview
    participant C as buildSheetImportPlan
    participant Conf as ConfirmSheetImport
    participant R as DrizzleSheetImportRepository (tx)
    participant M as Movement (dominio)

    U->>W: cuenta, mes, fichero CSV → «Previsualizar importación» (intent=preview)
    W->>A: importSheetAction({accountId, month, intent, file})
    A->>A: Zod (accountId, month, intent, file ≤ 512 KB)
    A->>P: file.text() (BOM/CRLF) → cabecera 13 columnas, filas no vacías
    A->>Prev: {accountId, month, rows}
    Prev->>C: catálogo (activas/desactivadas) + genérica + rows
    C->>M: Movement.create por fila (TagId centinela en etiquetas nuevas)
    M-->>C: validación (nota, importe, fecha, naturaleza, etiqueta)
    C-->>Prev: ImportPlan (ok/ignored/error + totales + tagsToCreate)
    Prev-->>A: SheetImportPreviewDTO
    A-->>W: {status:"preview"} (sin escribir nada)

    U->>W: revisa totales/filas → «Confirmar importación» (intent=confirm, mismo File)
    W->>A: importSheetAction({accountId, month, intent, file})
    A->>Conf: {accountId, month, rows (re-parseado y re-validado fresco)}
    Conf->>C: recalcula el plan
    alt plan con errores o 0 movimientos
        Conf-->>A: {status:"invalid"}
        A-->>W: error «La previsualización ya no es válida…» (vuelve al paso 1)
    else plan válido
        Conf->>R: persist(plan) — TODO-O-NADA (FR-005)
        R->>R: tx: INSERT tags nuevas (slug único, genérica) RETURNING ids
        R->>M: Movement.create por movimiento (con tagId resuelto)
        M-->>R: validación autoritativa
        R->>R: INSERT movimientos (rollback total ante cualquier error)
        R-->>Conf: {movementsCreated, tagsCreated}
        Conf-->>A: imported
        A->>A: revalidatePath("/", "layout")
        A-->>W: {status:"imported", …} → «Importación completada» + enlace a /accounts/{id}?month=
    end
```

Notas:

- La UI **nunca** mapea ni calcula totales: solo renderiza `SheetImportPreviewDTO` (constitución VII).
- El `File` viaja como argumento desde estado del cliente (acción directa, familia ADR 0015; un file input no puede ser controlado — SC-004).
- Cambiar cuenta/mes/fichero tras previsualizar **invalida la previsualización en cliente** (vuelve al paso 1): se evita confirmar algo distinto de lo revisado.
