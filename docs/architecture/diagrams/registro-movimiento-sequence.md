# Secuencia: registrar movimiento (flujo crítico)

Diagrama del flujo crítico cubierto por e2e en CI (ADR 0006). Mutación vía Server Action + `useActionState` y actualización de pantalla en el mismo roundtrip (ADR 0008).

## Camino de éxito

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant F as movement-form.tsx (useActionState)
    participant A as createMovement (Server Action)
    participant Z as Zod (frontera)
    participant UC as CreateMovement (aplicación)
    participant D as Movement.create (dominio)
    participant P as MovementRepository (puerto)
    participant R as DrizzleMovementRepository
    participant DB as SQLite / Turso (db.batch)
    participant PG as page.tsx (render servidor)

    U->>F: rellena campos y pulsa "Registrar"
    F->>A: FormData (date, concept, amount, accountId, type, nature?, tagIds*)
    A->>Z: valida FormData
    Z-->>A: datos tipados (amount string → céntimos por parseo, sin float)
    A->>UC: execute(CreateMovementDTO)
    UC->>UC: resuelve cuenta y tags activas; tag por defecto "Sin Clasificar" si no hay selección (FR-006)
    UC->>D: Movement.create(...) — invariantes (naturaleza solo en gastos, mínimo 1 tag, importe > 0)
    D-->>UC: agregado Movement inmutable
    UC->>P: create(movement)
    P->>R: implementación Drizzle
    R->>DB: batch([INSERT movements, INSERT movement_tags]) — atómico
    DB-->>R: ok (movementId)
    R-->>UC: MovementId
    UC-->>A: id
    A->>PG: revalidatePath("/")
    A-->>F: { status: 'success', message: 'Movimiento guardado' }
    F->>F: toast éxito + reset del formulario a defaults
    PG-->>U: mismo roundtrip: listado del mes y balance actualizados
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

    U->>F: envía formulario con importe inválido
    F->>A: FormData
    A->>Z: valida FormData
    Z-->>A: ZodError (errores por campo con mensajes del contrato §3)
    Note over A,DB: Nada se persiste
    A-->>F: { status: 'error', errors: { amount: [...] }, values: {...} }
    F->>U: error junto al campo (aria-describedby); valores conservados (defaultValue)
```

Las excepciones de dominio (`InvalidMovementError`, `AccountNotFoundError`, `InactiveTagError`…) que escapen de Zod se capturan en la action y se mapean al campo correspondiente (`errors[field]` / `_form`).
