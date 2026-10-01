# Data Model: Alta continua con nota única y tag única

**Feature**: `014-formulario-nota-tags` | **Fecha**: 2026-10-01

Dos vistas del mismo modelo: **dominio** (VOs y entidades puras, principio VII) y **persistencia** (tablas Drizzle, principio V). Esta feature **modifica** el agregado `Movement` entregado por 002 (nota única, tag 0..1, cuenta inmutable tras el alta); `Tag`, `Account` y `Member` no cambian de forma (solo la cardinalidad Tag↔Movement). El mapeo vive en `src/infrastructure/db/mappers/`.

---

## 1. Vista de Dominio

### 1.1 Value Objects

Sin cambios: `Money` (ADR 0007), `MovementType` (`expense | income`), `ExpenseNature` (`personal | shared`), `AccountType`, `TagStatus`, IDs (`MemberId`, `AccountId`, `TagId`, `MovementId`). Ver [002/data-model §1.1](../../002-registro-movimientos/data-model.md).

### 1.2 Entidades

#### `Movement` (Movimiento) — MODIFICADA

| Campo | Tipo | Regla (nuevo estado) |
|---|---|---|
| id | `MovementId` | |
| accountId | `AccountId` | Cuenta existente (FK). **Inmutable tras la creación**: la edición no puede cambiarla (FR-004); `UpdateMovement` valida que el movimiento persistido pertenece a la cuenta esperada. |
| type | `MovementType` | `'expense'` \| `'income'`. |
| date | `string` (ISO `YYYY-MM-DD`) | Fecha válida de calendario; sin cambios. |
| **note** | `string` | **NUEVA (fusiona concept+description)**: obligatoria, no vacía tras trim; se guarda trimeada (FR-002). Reemplaza a `concept` y `description` (eliminados). |
| amount | `Money` | `> 0` siempre; sin cambios (FR-009). |
| nature | `ExpenseNature \| null` | Obligatoria si `expense`, prohibida si `income`; sin cambios. |
| **tagId** | `TagId \| null` | **NUEVA (sustituye `tagIds: TagId[]`)**: obligatoria si `type = 'expense'`; opcional (`null`) si `type = 'income'` (FR-003). Debe existir y estar activa cuando está presente. Máximo 1 por construcción. |
| createdAt | `string` (ISO-8601 UTC) | Audit. |

`MovementInput` y `MovementPersistence` replican la nueva forma (`note`, `tagId`). Las factories `create`/`recreate`/`rehydrate` conservan sus contratos; `buildValidatedState` valida: nota no vacía tras trim, fecha real, importe > 0, naturaleza por tipo, y **tag según tipo** (gasto sin tag → `InvalidMovementError("tagId", …)`; la deduplicación desaparece — no hay colección).

#### `Tag`, `Account`, `Member` — sin cambios de forma

`Tag` sigue siendo catálogo (`id/name/slug/status`); «Sin Clasificar» permanece como tag activa seleccionable. La asignación automática de la tag por defecto **desaparece** de la aplicación (FR-003).

### 1.3 Relaciones (dominio)

```text
Member 1───0..1 Account        (sin cambios)
Account 1───n   Movement       (sin cambios; además inmutable tras el alta)
Movement 0..1──1 Tag           (tagId: obligatoria en gastos, opcional en ingresos)
```

La relación N:M (`tagIds`) queda eliminada.

### 1.4 Errores de dominio (src/domain/movement/MovementErrors.ts)

`MovementField` pasa a `"date" | "note" | "amount" | "accountId" | "type" | "nature" | "tagId"`. Mensajes nuevos/renombrados (UI en español, VI): «La nota es obligatoria.» (antes «El concepto es obligatorio.»), «Selecciona una etiqueta para el gasto.». `MovementNotFoundError`, `InvalidMoneyError`, `TagNotFoundError`, `InactiveTagError`, `AccountNotFoundError` sin cambios.

### 1.5 Diagrama de clases (diseño)

```mermaid
classDiagram
    direction LR

    class Movement {
        <<Entity>> Movement
        +MovementId? id
        +AccountId accountId
        +MovementType type
        +String date
        +String note
        +Money amount
        +ExpenseNature? nature
        +TagId? tagId
        +String createdAt
        +create(input) Movement$
        +recreate(id, input, createdAt) Movement$
        +rehydrate(persistence) Movement$
    }

    class Money {
        <<Value Object>>
        +Int amountCents
        +fromCents(cents)$ Money
        +add(o) Money
        +subtract(o) Money
    }

    class MovementType {
        <<Value Object>>
        expense | income
    }

    class ExpenseNature {
        <<Value Object>>
        personal | shared
    }

    class Tag {
        <<Entity>> Catálogo
        +TagId? id
        +String name
        +String slug
        +TagStatus status
    }

    class Account {
        <<Entity>>
        +AccountId? id
        +String name
        +AccountType type
        +MemberId? memberId
    }

    Movement *"n" --> "1" Account : accountId (inmutable tras alta)
    Movement *"n" --> "0..1" Tag : tagId (obligatoria en expense)
    Movement ..> MovementType : type
    Movement ..> ExpenseNature : nature (solo expense)
    Movement *-- Money : amount

    note for Movement "note fusiona concept+description (FR-002)¶tagId sustituye tagIds[] (FR-003)"
```

> Diferencias con `docs/architecture/diagrams/domain-model.md` (vivo, a actualizar en la implementación): `Movement` pierde `concept`/`description`/`tagIds` y gana `note`/`tagId`; la relación con `Tag` pasa de N:M a 0..1.

### 1.6 Transiciones de estado

`Movement` sigue inmutable (reconstrucción validada en edición, ADR 0011 — sin la mitad de «mover de cuenta», revocada). La máquina de estado nueva es la del **diálogo de alta continua** (UI): ver [plan.md §Diagramas](./plan.md) y [contracts/ui-contract.md](./contracts/ui-contract.md) §4.

---

## 2. Vista de Persistencia (Drizzle, SQLite/Turso)

### 2.1 Tablas tras la migración `0002_*`

```text
members, accounts, tags          # SIN CAMBIOS (catálogo intacto)

movements
├── id: integer PK autoincrement
├── account_id: integer NOT NULL FK→accounts.id
├── type: text NOT NULL          ('expense'|'income')
├── date: text NOT NULL          (ISO 'YYYY-MM-DD')
├── note: text NOT NULL          ← sustituye concept+description
├── amount_cents: integer NOT NULL
├── nature: text NULL            ('personal'|'shared'; NULL si ingreso)
├── tag_id: integer NULL FK→tags.id ON DELETE RESTRICT   ← 0..1
├── created_at: text NOT NULL
├── updated_at: text NULL
└── INDEX idx_movements_account_date ON (account_id, date)

movement_tags                    # ELIMINADA (DROP TABLE en 0002)
```

### 2.2 Migración `0002_*` (SC-003)

1. `DELETE FROM movements` — elimina los movimientos de prueba existentes y, en cascada declarativa en el esquema 0001, sus relaciones (decisión del propietario 2026-10-01; sin migración de datos).
2. Recrear `movements` con el esquema nuevo (`note NOT NULL`, `tag_id` FK RESTRICT, sin `concept`/`description`).
3. `DROP TABLE movement_tags`.

Cuentas, miembros y catálogo de tags quedan intactos. Generada con drizzle-kit, versionada en `drizzle/` (journal idx 2); única vía de evolución del esquema (V). Aplica a dev (`db.sqlite`), e2e (`e2e.sqlite`, recreada por `pretest:e2e`) y prod (Turso, paso pre-deploy).

### 2.3 Repositorio y mapper

- `create`: INSERT de la fila (incl. `tag_id`); el `db.batch` para tags desaparece; el `max(id)+1` manual se mantiene.
- `update`: UPDATE de la fila (`tag_id` incluido, `updated_at`); sin DELETE/INSERT de junction.
- `findById`/`selectMonthRows`: un único `leftJoin(movements.tag_id → tags)`; 1 fila = 1 movimiento; `MovementDTO.tag: MovementTagDTO | null`.
- `delete`: sin cambios (row delete).

### 2.4 Balance y cierres

Sin cambios de cálculo: el balance (ADR 0009) no involucra tags; los desgloses por tag consumen la tag única de cada gasto (sin reparto multi-tag). `ClosureMovementInput.tags` pasa a `tag: ClosureTagRef | null`.

---

## 3. Validación por capa (dónde vive cada regla)

| Regla | Zod (frontera, action) | Dominio (entidad) | DB (constraint) |
|---|---|---|---|
| Nota presente, no vacía tras trim | ✅ `note.trim().min(1)` «La nota es obligatoria.» | ✅ `buildValidatedState` | `note NOT NULL` |
| Importe > 0, formato es-ES | ✅ (regex + parse a céntimos, sin cambios) | ✅ `Money.fromCents` | — |
| Fecha ISO real / tipo / naturaleza por tipo | ✅ (sin cambios) | ✅ | — |
| Tag: 0..1; obligatoria en gastos | ✅ `superRefine` cross-field «Selecciona una etiqueta para el gasto.» + id entero si presente | ✅ (regla por tipo) | FK + una sola columna |
| Tag existe y activa | ✅ (id entero) | — (lo hace `resolveTagId` en aplicación) | FK |
| Cuenta del movimiento = cuenta de la página | ✅ hidden `accountId` (alta) / `expectedAccountId` (edición) validados | — | FK |
| Sin campo descripción | ✅ (fuera del schema) | ✅ (fuera del input) | columna eliminada |

Errores de dominio → campos de UI: `InvalidMovementError.field ∈ {date, note, amount, type, nature, tagId}`; tag no encontrada/inactiva → `tagId` «Una de las etiquetas seleccionadas ya no está disponible.»; cuenta inesperada en edición → `accountId` «El movimiento ya no pertenece a esta cuenta.».

---

## 4. DTOs de aplicación (nuevo estado)

```ts
CreateMovementDTO { accountId, type, date, note, amountCents, nature, tagId: number | null }
UpdateMovementDTO { movementId, expectedAccountId, type, date, note, amountCents, nature, tagId: number | null }
MovementDTO { id, accountId, type, date, note, amountCents, nature, tag: MovementTagDTO | null }
```

`MovementTagDTO { id, name, slug }` sin cambios; el resto de DTOs (cierre, resumen global, anual) sin cambios de forma — reciben la tag única vía la composición existente.

---

## 5. Glosario ES ↔ EN (constitución VI)

| Español (UI/spec) | English (código) | Notas |
|---|---|---|
| Movimiento | `Movement` | |
| Nota | `note` | **NUEVO**: fusiona Concepto+Descripción (FR-002); literal UI «Nota» |
| Etiqueta / Tag | `Tag` / `tagId` | La relación pasa a 0..1: obligatoria en gastos, opcional en ingresos |
| Sin etiqueta | `null` (tagId) | Opción explícita solo visible con tipo Ingreso |
| Sin Clasificar | slug `sin-clasificar` | Sigue en el catálogo como tag seleccionable; la asignación automática desaparece |
| Cuenta (inmutable) | `accountId` / `expectedAccountId` | La edición valida la cuenta esperada; no permite mover el movimiento |
| Tanda | `batch` (captación continua) | Diario de UI: N guardados con una sola apertura del diálogo (US1) |
| Guardar y seguir / Guardar y cerrar | `intent: "continue" \| "close"` | Par enviado por los botones submit y devuelto en el estado de la action |

Términos previos («Concepto», «Descripción») quedan obsoletos y se retiran del glosario vivo en la implementación.

Sin identificadores intraducibles nuevos fuera de los listados.
