# Research: Edición y Eliminación de Movimientos

**Feature**: `003-edicion-movimientos` | **Fecha**: 2026-09-14

Investigación de Phase 0 para resolver las incógnitas del Technical Context del [plan.md](./plan.md). Stack fijado por la constitución y 002; las decisiones aquí son de **estrategia de actualización del agregado, extensión del puerto, reutilización de validación y composición de UI**. Cada sección documenta: decisión, racional y alternativas consideradas.

---

## 1. Estrategia de edición en el dominio: reconstrucción validada (FR-001, FR-002, FR-005)

**Decision**: `Movement` es inmutable y NO gana setters ni updates parciales: se añade la factory **`Movement.recreate(id, input, createdAt)`** (`src/domain/movement/Movement.ts`) que ejecuta **exactamente las mismas validaciones que `create`** (concepto, fecha, importe, naturaleza por tipo, mínimo una tag) y devuelve un `Movement` que **preserva identidad (`id`) y `createdAt`**. `create` y `recreate` comparten un builder privado común para que las invariantes no puedan divergir. La decisión se registrará como **ADR 0011**.

**Rationale**:
- FR-002 exige validaciones de edición idénticas al alta: la única forma de garantizarlo por construcción es que ambos caminos pasen por el mismo código de validación del dominio.
- Preservar `id` y `createdAt` mantiene la identidad del agregado (FR-005: sin residuos; el mismo `id` computa en la cuenta/mes de su nueva fecha) y no rompe las FKs de `movement_tags`.
- La edición cambia de cuenta y/o mes cambiando `accountId`/`date` del aggregate raíz: no hay nada que "mover" aparte (el balance y el cierre son vistas derivadas, ADR 0009/0010; FR-004 de la spec).

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Updates parciales (`withChanges` por campo o setters) | Permite construir estados intermedios inválidos; duplica o relaja invariantes; rompe la inmutabilidad que 002 ya congela con `Object.freeze`. |
| Validar solo en la frontera (Zod) y persistir sin pasar por el dominio | La regla de negocio dejaría de vivir en el dominio (constitución VII); dos fuentes de verdad de la validación que divergen. |
| Borrar y recrear el movimiento (delete + create) | Cambia el `id` (el repositorio asigna `max(id)+1`) y el `createdAt`; viola FR-005 conceptualmente y pierde la trazabilidad de la fila. |

---

## 2. Extensión del puerto y del repositorio (FR-001, FR-003, FR-005)

**Decision**: el puerto `MovementRepository` (`src/application/movement/MovementRepository.ts`) amplía tres métodos:

```text
findById(id: MovementId): Promise<Movement | null>   // rehydrated con sus tags
update(movement: Movement): Promise<void>             // movement.id define la fila
delete(id: MovementId): Promise<void>
```

- **`findById`**: misma query join (movimientos + tags) que `listByMonthAndAccount` filtrada por `id`; un mapper nuevo en `movement.mapper.ts` reconstruye el `Movement` rehydrated. Lo consumen `UpdateMovement` (existencia + `createdAt` original) y `DeleteMovement` (existencia).
- **`update`**: `db.batch([ UPDATE movements … WHERE id, DELETE movement_tags WHERE movementId, INSERT movement_tags (nuevo conjunto) ])` — sustitución atómica de las tags del movimiento.
- **`delete`**: un único `DELETE FROM movements WHERE id`; las filas de `movement_tags` desaparecen por la FK `onDelete cascade` ya versionada en el esquema de 002 (FR-003: el catálogo de tags queda intacto).
- **Auditoría técnica `updated_at`** (clarificación 2026-09-14): columna TEXT ISO 8601 UTC nullable en `movements` (NULL = nunca editado) que pone el repositorio en cada UPDATE. Fuera del dominio y de los DTOs; no sustituye un historial de cambios (sigue fuera de alcance). Es el **único DDL** de la feature: un `ALTER TABLE ADD COLUMN` migrado por Drizzle.

**Rationale**: la existencia explícita (`findById` → `MovementNotFoundError`) cubre el edge case "ya no existe" con un error de dominio claro en lugar de un UPDATE/DELETE silencioso sobre cero filas; el batch de Drizzle da atomicidad a "fila + tags" sin transacciones manuales nuevas; el cascade evita un DELETE explícito redundante; y `updated_at` da una marca de depuración/auditoría barata sin contaminar el modelo (decisión explícita del propietario).

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Sin `updated_at` | Cero coste, pero sin rastro de si una fila fue editada; cualquier necesidad futura exigiría migración retroactiva sobre datos ya modificados (decisión del propietario: añadirlo, 2026-09-14). |
| Tabla de auditoría con valores previos (trigger o historial) | Requisito de auditoría real inexistente (uso individual); complejidad de escritura y lectura para cero consumo actual. |
| Borrado lógico (columna `deleted_at` o estado) | Requisito de auditoría inexistente (uso individual, YAGNI); contaminaría TODAS las queries existentes del listado, balance y cierre con un filtro `deleted_at IS NULL`. |
| `update` con diff de tags (borrar solo las quitadas) | Complejidad sin beneficio: el conjunto es ≤ 12 filas del catálogo; el replace es más simple y determinista. |
| No comprobar existencia antes de update/delete | Éxito silencioso con 0 filas afectadas; el edge case "movimiento no encontrado" de la spec quedaría sin error claro (FR-007). |

---

## 3. Reutilización de la validación: de la creación a la edición (FR-002, FR-008)

**Decision**: dos extracciones, una por capa, para que alta y edición compartan código por construcción:

1. **Aplicación**: los resolutores privados de `CreateMovement` (`resolveNature`, `resolveTagIds` — defaults de naturaleza en cuenta común, tag "Sin Clasificar", tags activas) se extraen a **`src/application/movement/movement-inputs.ts`** (funciones de módulo) y los consumen `CreateMovement` y `UpdateMovement`. `CreateMovement` se refactoriza sin cambio de comportamiento (sus tests actuales actúan de regresión).
2. **Frontera**: el schema Zod del formulario, `extractFormData`, `toFormValues` y `parseAmountToCents` se extraen de `create-movement.action.ts` a **`src/infrastructure/primary/actions/movement-form.schema.ts`**; `update-movement.action.ts` lo reutiliza y añade `movementId` (entero positivo), `currentAccountId` y `currentMonth` (campos ocultos del contexto de pantalla). `delete-movement.action.ts` define su schema mínimo propio (`movementId`).

**Rationale**: FR-002 ("mismos mensajes de error que el alta") solo es auditable si los mensajes salen del mismo módulo; la extracción es lineal (mover funciones), sin patrones nuevos (constitución I).

**Alternatives considered**: duplicar schema y resolutores en las actions de edición (riesgo de divergencia de mensajes, exactamente lo que FR-002 prohíbe); validar la edición solo en el dominio saltándose Zod (viola constitución IV: toda frontera valida en runtime).

---

## 4. UI: reutilización del formulario, diálogos y avisos (FR-006, FR-007)

**Decision**:
- **`MovementFormFields` se amplía con un modo edición** (props `initialValues` y `accounts`): en edición, "Cuenta" pasa de texto estático a un `Select` con todas las cuentas (FR-001 permite cambiar de cuenta), la naturaleza fija/"compartido por defecto" se deriva de la cuenta elegida **en el formulario** (estado cliente), y los `defaultValue` salen del movimiento. El modo alta queda intacto (regresión cubierta por sus tests).
- **Diálogos shadcn nuevos** copiados y versionados: `components/ui/dialog.tsx` y `components/ui/alert-dialog.tsx` (con sus peers `@radix-ui/react-dialog` / `@radix-ui/react-alert-dialog` — cubierto por ADR 0005).
- **`edit-movement-dialog.tsx`** (client): abre desde un botón por fila, embebe `MovementFormFields` en modo edición, envía con `updateMovement`; al éxito cierra y muestra el toast con el mensaje de la action.
- **`delete-movement-dialog.tsx`** (client): `AlertDialog` de confirmación que muestra **concepto, importe y fecha** del movimiento (clarificación 2026-09-14) y confirma/cancela.
- **`movement-list.tsx`** (AMPLIADO): cada fila monta los dos botones (editar/eliminar); `page.tsx` pasa al listado `accounts`, `tags`, `currentAccountId` y `currentMonth` (ya cargados en la página).
- **Aviso de "movido" (FR-007)**: la action calcula la visibilidad final (cuenta nueva ≠ `currentAccountId` o mes de la fecha nueva ≠ `currentMonth`) y compone el mensaje de éxito; la UI solo lo muestra (toast). Textos exactos en [contracts/ui-contract.md](./contracts/ui-contract.md) §4.
- `revalidatePath("/")` existente refresca listado, balance y cierre tras cada operación (FR-004 gratis: vistas derivadas).

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Ruta propia de edición (`/movimientos/:id/editar`) | Viola FR-006 (misma pantalla, sin navegación); duplicaría la carga de contexto (cuentas/tags/mes). |
| Formulario de edición duplicado | Drift garantizado de campos/mensajes frente al alta (lo que FR-002 prohíbe). |
| Inline editing en la fila (inputs por celda) | No cabe el conjunto de campos (tags, naturaleza condicional); coste de testeo alto para cero valor añadido. |
| Ventana modal nativa (`window.confirm`) | Sin datos del movimiento en la confirmación (requisito de la clarificación) y sin estilo/accesibilidad shadcn. |

---

## 5. Estrategia de tests (constitución III)

**Decision**: cuatro niveles con los patrones de 002/005:

1. **Dominio** (`Movement.test.ts` ampliado, proyecto node): `recreate` revalida todas las invariantes de `create` (un caso por campo), preserva `id`/`createdAt`/tags deduplicadas, y rechaza igual que `create`.
2. **Aplicación** (`UpdateMovement.test.ts`, `DeleteMovement.test.ts`, con dobles en memoria del puerto): existencia (`MovementNotFoundError`), resolución de naturaleza/tags idéntica a la creación (reusa `movement-inputs`), update llamado con el `Movement` reconstruido (id/createdAt preservados), delete llamado; `CreateMovement.test.ts` sin cambios como regresión del refactor.
3. **Infraestructura** (`DrizzleMovementRepository.test.ts` ampliado, libsql `:memory:` + migraciones): `findById` con/sin tags y no encontrado; `update` cambia fila + sustituye conjunto de tags (incluido cambio de cuenta/fecha); `delete` borra la fila y sus `movement_tags` sin tocar `tags`.
4. **UI** (jsdom + RTL): `movement-form` en modo edición (prefill, select de cuenta, naturaleza dinámica por cuenta elegida, submit con action mockeada); diálogos de edición y borrado (datos del movimiento en la confirmación, cancelar no llama a la action, éxito cierra y tuestea el mensaje — incluido el de "movido").
5. **E2E** (`e2e/edicion-movimientos.spec.ts`, serie dentro del fichero — decisión del revisor, 2026-09-14): registra → **edita el importe (caso más frecuente)** → verifica listado y cierre; y **elimina un movimiento con confirmación** → verifica listado y cierre. El cambio de mes/cuenta (E2/E3), el cambio de tipo con reglas de naturaleza (E4/E5) y las validaciones de formulario (E5) quedan en verificación manual (quickstart) — mismo criterio que 005 aplicó al cambio de mes. Mismas convenciones de 005 (puerto 3100, BD e2e aislada).

**Alternatives considered**: reutilizar el fichero e2e de registro (acopla features); testear la edición solo vía e2e (lento, sin aislamiento de la lógica de dominio).

---

## Resumen de decisiones (trazabilidad)

| Tema | Decisión | ADR |
|---|---|---|
| Estrategia de edición | `Movement.recreate`: reconstrucción con validación completa, preserva `id`/`createdAt` | **0011** |
| Puerto/repositorio | `findById`/`update` (batch fila + replace de tags, pone `updated_at`)/`delete` físico con cascade FK | 0011 |
| Auditoría técnica | `updated_at` TEXT ISO en BD, fuera de dominio/DTOs; única migración de la feature | 0011 |
| Borrado | Físico; sin borrado lógico ni papelera (YAGNI) | 0011 |
| Validación compartida | `movement-inputs.ts` (aplicación) + `movement-form.schema.ts` (frontera) | — |
| UI | `MovementFormFields` con modo edición + diálogos shadcn (dialog, alert-dialog) | 0005 (deps Radix) |
| Aviso FR-007 | La action compone el mensaje según visibilidad final; la UI solo tuestea | — |
| Tests | Dominio + aplicación (dobles) + repositorio (:memory:) + RTL + e2e nuevo en serie | — |
