# Data Model: Edición y Eliminación de Movimientos

**Feature**: `003-edicion-movimientos` | **Fecha**: 2026-09-14

Feature de escritura sobre el modelo existente: **sin cambios de esquema ni migraciones** (UPDATE/DELETE sobre las tablas de 002). Se amplía la entidad `Movement` con una factory de reconstrucción, el puerto `MovementRepository` con tres métodos, y se añade un error de dominio. Las entidades de 002 (Miembro, Cuenta, Movimiento, Tag) y su vista de persistencia ([data-model de 002](../002-registro-movimientos/data-model.md)) siguen siendo la fuente de verdad.

---

## 1. Vista de Dominio

### 1.1 `Movement.recreate` (src/domain/movement/Movement.ts — ampliación)

```text
Movement.recreate(id: MovementId, input: MovementInput, createdAt: string): Movement
```

Reconstruye un movimiento existente con **exactamente las mismas validaciones que `create`** (mismo builder privado compartido):

| Regla (compartida con `create`, FR-002) | Error (`InvalidMovementError.field`) |
|---|---|
| Concepto no vacío tras trim | `concept` |
| Fecha de calendario ISO real | `date` |
| `amount.amountCents > 0` | `amount` |
| Gasto: naturaleza obligatoria; ingreso: naturaleza prohibida | `nature` |
| ≥ 1 tag tras deduplicar | `tagIds` |

**Diferencias frente a `create`**: `id` y `createdAt` se toman de los parámetros (identidad y antigüedad preservadas), no se generan. `accountId`, `type`, `date`, `concept`, `description`, `amount`, `nature` y `tagIds` salen del `MovementInput` — el agregado "se mueve" de cuenta y/o mes cambiando esos campos (FR-005).

### 1.2 Error de dominio nuevo

```text
MovementNotFoundError (src/domain/movement/MovementErrors.ts)
  message: "El movimiento ya no existe."
```

Lo lanzan `UpdateMovement` y `DeleteMovement` cuando `findById` devuelve `null` (edge case de la spec: borrado en otra pestaña). El mensaje es final para UI (se muestra tal cual en el toast/`_form`).

### 1.3 Entidades y VOs reutilizados sin cambios

`Money` (ADR 0007), `MovementType`, `ExpenseNature`, `Account`, `Tag`, `Member` e IDs: ver [data-model de 002 §1](../002-registro-movimientos/data-model.md). `MonthlyClosure` (005) no cambia: se recalcula solo por ser vista derivada.

### 1.4 Transiciones de estado

Ninguna nueva con estado persistido: la "transición" es un reemplazo atómico del agregado (fila + tags) o su desaparición física. Un movimiento editado jamás queda "a medias" entre cuenta/mes origen y destino (FR-005): la fila es única y computa según sus campos finales.

---

## 2. Vista de Persistencia (Drizzle, SQLite/Turso)

**Sin DDL ni migraciones.** Comportamiento de los tres métodos nuevos de `DrizzleMovementRepository`:

| Método | SQL (efecto) | Notas |
|---|---|---|
| `findById(id)` | SELECT de la fila + LEFT JOIN `movement_tags`/`tags` filtrado por `id` | Devuelve `Movement` rehydrated (con `TagId[]`) o `null`; mismo shape de join que `listByMonthAndAccount` |
| `update(movement)` | `db.batch([ UPDATE movements SET … WHERE id = movement.id, DELETE FROM movement_tags WHERE movement_id, INSERT INTO movement_tags (nuevo conjunto) ])` | Atómico: la fila y sus tags cambian juntos o nada; `id` y `createdAt` de la fila no se tocan |
| `delete(id)` | `DELETE FROM movements WHERE id = id` | Las asociaciones en `movement_tags` desaparecen por la FK `onDelete cascade` (esquema de 002); la tabla `tags` no se toca (FR-003) |

El repositorio sigue asignando ids con `max(id)+1` solo en `create` (sin cambios); edición y eliminación nunca reasignan identidad.

---

## 3. Validación por capa (dónde vive cada regla)

| Regla | Frontera (Zod) | Aplicación | Dominio (`Movement`) | DB |
|---|---|---|---|---|
| Campos del formulario de edición (fecha, concepto, importe, tipo, naturaleza condicional, tags, cuenta) | ✅ `movement-form.schema.ts` compartido con el alta (mismos mensajes, FR-002/FR-008) | — | — | — |
| `movementId`, `currentAccountId`, `currentMonth` (contexto de pantalla) | ✅ `update-movement.action.ts` (enteros positivos / `YYYY-MM`) | — | — | — |
| `movementId` (borrado) | ✅ `delete-movement.action.ts` | — | — | — |
| Invariantes del movimiento (todas, FR-002) | — | — | ✅ `create`/`recreate` (builder compartido) | — |
| Cuenta destino existe | — | ✅ `UpdateMovement` (`AccountNotFoundError`) | — | — |
| Naturaleza por defecto en cuenta común; prohibida en ingresos | — | ✅ `movement-inputs.ts` compartido con `CreateMovement` | — | — |
| Tags existen y activas; default "Sin Clasificar" | — | ✅ `movement-inputs.ts` compartido | — | — |
| Movimiento existe al editar/eliminar | — | ✅ `findById` → `MovementNotFoundError` | — | — |
| Atomicidad fila + tags en `update` | — | — | — | ✅ `db.batch` |
| Aviso "se movió a otro mes/cuenta" (FR-007) | — | — | — | — (lo compone la Server Action; la UI solo muestra) |

La UI **nunca** valida ni calcula: recibe estados de error/éxito de las actions (constitución VII).

---

## 4. DTOs de aplicación (src/application/movement/dto.ts — ampliación)

```text
UpdateMovementDTO
├── movementId: number            // NUEVO (identidad de la fila)
├── accountId: number             // cuenta destino (puede cambiar)
├── type: MovementType
├── date: string                  // fecha nueva (puede cambiar de mes)
├── concept: string
├── description: string | null
├── amountCents: number
├── nature: ExpenseNature | null
└── tagIds: number[]
```

`CreateMovementDTO` y `MovementDTO` sin cambios; el prefill del formulario de edición se hace desde el `MovementDTO` que ya carga el listado. La conversión céntimos→texto del importe para el prefill vive en el adaptador UI (`format.ts`), nunca en DTOs.

---

## 5. Glosario ES ↔ EN (ampliación del glosario de 002/005)

| Español (UI/spec) | English (código) | Notas |
|---|---|---|
| Editar movimiento | `EditMovementDialog` / `updateMovement` | Diálogo cliente / Server Action |
| Reconstrucción validada | `Movement.recreate` | Factory que revalida y preserva `id`/`createdAt` |
| Eliminar (borrado físico) | `delete` / hard delete | Sin papelera ni soft delete (ADR 0011) |
| Movimiento no encontrado | `MovementNotFoundError` | Edge case de edición/eliminación concurrente |
| Acciones por fila | `movement-row-actions` | Botones editar/eliminar en cada fila del listado |
| Se movió a otro mes/cuenta | moved notice | Mensaje de éxito compuesto por la action (contracts §4) |
| Resolutores de entrada | `movement-inputs` | Naturaleza/tags compartidos por alta y edición |
| Esquema de formulario | `movement-form.schema` | Zod compartido por alta y edición |
