# Secuencia: registrar movimiento (flujo crítico)

Diagrama del flujo crítico cubierto por e2e en CI (ADR 0006). Mutación vía Server Action + `useActionState` y actualización de pantalla en el mismo roundtrip (ADR 0008). Desde 014 el alta es **continua**: el diálogo permanece abierto tras «Guardar y seguir» (`intent` en el FormData) y la tag es única obligatoria en gastos.

## Camino de éxito — tanda continua (014, SC-001)

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant D as create-movement-dialog.tsx (client)
    participant F as movement-form.tsx (useActionState)
    participant A as createMovement (Server Action)
    participant Z as Zod (frontera)
    participant UC as CreateMovement (aplicación)
    participant Dom as Movement.create (dominio)
    participant R as DrizzleMovementRepository
    participant DB as SQLite / Turso
    participant PG as page.tsx (render servidor)

    U->>D: CTA «Nuevo movimiento» (única apertura de la tanda)
    U->>F: rellena fecha, importe, Nota, tipo, naturaleza?, Etiqueta y pulsa «Guardar y seguir»
    F->>A: FormData (date, note, amount, accountId, type, nature?, tagId, intent=continue)
    A->>Z: valida FormData (nota no vacía, tagId 0..1, gasto con tag)
    Z-->>A: datos tipados (amount string → céntimos por parseo, sin float)
    A->>UC: execute(CreateMovementDTO { note, tagId })
    UC->>UC: resuelve cuenta y tag activa (sin default: 014 eliminó «Sin Clasificar» automático)
    UC->>Dom: Movement.create(...) — invariantes (naturaleza por tipo, tag por tipo, nota no vacía, importe > 0)
    Dom-->>UC: agregado Movement inmutable
    UC->>R: create(movement)
    R->>DB: INSERT movements (nota, tag_id en la propia fila; sin junction desde 0002)
    DB-->>R: ok (movementId)
    R-->>UC: MovementId
    UC-->>A: id
    A->>PG: revalidatePath("/") + revalidatePath("/accounts/[accountId]", "page")
    A-->>F: { status: 'success', message: 'Movimiento guardado', intent: 'continue' }
    F->>D: toast + savedCount+1 + carry={date, type, nature} — NO cierra
    D->>F: remonta el formulario (key=savedCount): nota/importe/tagId vacíos, fecha/tipo/naturaleza pegados, foco en Nota
    PG-->>U: página revalidada visible tras el diálogo (listado/balance/cierre al día)
    U->>F: siguiente captura → repite 2-13 (Guardados: N)
    U->>F: última captura → «Guardar y cerrar» (intent=close)
    A-->>F: { status: 'success', intent: 'close' }
    F->>D: toast + onClose()
    PG-->>U: página final con la tanda completa (1 apertura, N envíos)
```

## Camino de error de validación (nada se persiste)

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant F as movement-form.tsx
    participant A as createMovement (Server Action)
    participant Z as Zod (frontera)
    participant UC as CreateMovement (aplicación)
    participant DB as SQLite / Turso

    U->>F: envía formulario con importe inválido o gasto sin etiqueta
    F->>A: FormData
    A->>Z: valida FormData
    Z-->>A: ZodError (errores por campo con mensajes del contrato §3; superRefine de tag en gastos)
    Note over A,DB: Nada se persiste
    A-->>F: { status: 'error', errors: { amount|tagId: [...] }, values: {...} }
    F->>U: error junto al campo (aria-describedby); valores conservados (defaultValue); la tanda no se rompe
```

Las excepciones de dominio (`InvalidMovementError`, `AccountNotFoundError`, `InactiveTagError`…) que escapen de Zod se capturan en la action y se mapean al campo correspondiente (`errors[field]` / `_form`). En edición (014) el DTO lleva `expectedAccountId`: `UpdateMovement` valida que el movimiento pertenece a la cuenta de la página y `Movement.recreate` conserva la cuenta persistida — la cuenta es inmutable tras el alta.
