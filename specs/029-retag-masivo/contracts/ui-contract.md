# UI Contract: Reasignación masiva de etiquetas de movimientos

**Feature**: `029-retag-masivo` | 2026-11-07

**Componentes**: `src/infrastructure/primary/ui/grouped-movement-list.tsx` (client; **MODIFICADO**: modo de selección + barra contextual) + `src/infrastructure/primary/ui/bulk-retag-dialog.tsx` (client; **NUEVO**) | **Action**: `src/infrastructure/primary/actions/bulk-retag.action.ts` (**NUEVA**, `useActionState` — familia ADR 0015 de diálogos con form)

**Fuente de datos**: sin lecturas nuevas en servidor. La página de cuenta ya pasa `movements: MovementDTO[]`, `tagGroups: ActiveTagGroupDTO[]`, `currentAccountId`, `currentMonth` al listado (027) — la feature es puramente cliente + action.

---

## §1 `GroupedMovementList` — modo de selección

### §1.1 Entrada y salida del modo

- Botón **«Seleccionar»** (secundario/ghost, `type="button"`, junto al CTA «Nuevo movimiento» del bloque de listado) → `selectionMode = true`. Visible siempre que haya movimientos en el mes (con el estado vacío no se ofrece: no hay nada que seleccionar).
- **Barra contextual** (encima del primer grupo de fecha, visible solo en modo): texto **«{n} seleccionados»**, botones `type="button"`:
  - **«Seleccionar todo»** ↔ **«Ninguno»** (toggle): marca/desmarca **todas las filas seleccionables** (las protegidas nunca entran).
  - **«Cambiar etiqueta…»**: deshabilitado con `n === 0`; abre `BulkRetagDialog` (montado a nivel del listado — convención «diálogos por fila»).
  - **«Salir de la selección»**: `selectionMode = false`, `selectedIds` vacío, diálogos cerrados.
- Al completar una reasignación con éxito: cierre del diálogo, **salida automática del modo** y selección limpia.
- Navegar de mes (steeper ‹ ›) desmonta la página de servidor: la selección se reinicia (comportamiento esperado).
- Fuera del modo, la fila y su recorrido (badge de etiqueta, nota, naturaleza, importe, ✏️/🗑️, estado vacío) son exactamente los de 025 — FR-001.

### §1.2 Fila en modo selección

- `Checkbox` (shadcn existente) delante del contenido, `checked={selectedIds.has(id)}`, `onCheckedChange` alterna el id en el `Set`; área táctil ≥ 44 px, `aria-label="Seleccionar {nota}"` (paridad ⋮ 020).
- **Fila protegida** (`movement.tag` existe y `isProtectedTagSlug(movement.tag.slug)`): **sin checkbox** — sustituido por un hueco del mismo ancho para no desplazar la columna; la fila conserva su aspecto.
- Los botones ✏️/🗑️ por fila permanecen disponibles en modo selección (no colisionan: son acciones unitarias).

## §2 `BulkRetagDialog` — confirmación informada

- **Apertura**: solo desde «Cambiar etiqueta…» con `n ≥ 1`. Título: **«Cambiar etiqueta»**.
- **Texto de consecuencia** (congelado): `Se cambiará la etiqueta de {n} movimientos.` (n = seleccionados al abrir).
- **Form** (`useActionState(bulkRetag)`):
  - Campos ocultos: `accountId` (número), `month` (`YYYY-MM`), y un input oculto `movementIds` **por cada id seleccionado** (n campos con el mismo `name`).
  - `Label` **«Nueva etiqueta»** + Select agrupado por categorías (`SelectGroup`/`SelectLabel`, patrón `movement-form.tsx`): opciones = `tagGroups` recibidos por props, **filtrados**: sin etiquetas protegidas; **sin ítem «Sin etiqueta»** (v1 siempre sustituye/asigna). Valor **controlado con `useState`** (SC-004) + ref de última selección válida para restaurar tras error (paridad `create-tag-dialog.tsx` frente al auto-reset de React 19 sobre el select nativo de Radix).
  - `[Cancelar]` **`[Reasignar]`** — submit deshabilitado sin destino elegido; `isPending` → botón **«Reasignando…»** y todos los controles deshabilitados.
- **Éxito** (guard de `state.status === "success"`): cierre, toast con `state.message`, salida del modo selección. El guard se blinda contra re-ejecuciones (flag por envío, patrón 014).
- **Error de dominio**: mensaje visible `role="alert"` + `aria-describedby` en el diálogo; el valor del Select se conserva (estado controlado + restauración).
- Escape/«Cancelar» sin efectos (diálogo cierra, selección permanece para reintentar).

## §3 Action `bulkRetag`

| Aspecto | Contrato |
|---|---|
| Firma | `bulkRetag(_prev: BulkRetagActionState, formData: FormData): Promise<BulkRetagActionState>` |
| Entrada | `bulkRetagSchema` (data-model §4): `accountId`, `month` (`YYYY-MM`), `targetTagId`, `movementIds[] ≥ 1` (campos repetidos por `formData.getAll`) |
| Éxito | `revalidatePath("/", "layout")` + `{ status: "success", message }` — mensajes congelados en data-model §4 («{n} movimiento actualizado» / «{n} movimientos actualizados» / «{u} de {t} movimientos actualizados») |
| Errores | Zod → primer mensaje del schema; `ProtectedTagError`/`TagNotFoundError`/`InvalidMovementError` → `error.message`; resto → «No se ha podido completar la operación. Inténtalo de nuevo.» |
| Instanciación | use case en módulo: `new BulkRetagMovements(new DrizzleMovementRepository(db), new DrizzleTagRepository(db))` |

## §4 Literales congelados (es)

«Seleccionar», «Salir de la selección», «{n} seleccionados», «Seleccionar todo», «Ninguno», «Cambiar etiqueta…», «Cambiar etiqueta» (título), «Se cambiará la etiqueta de {n} movimientos.», «Nueva etiqueta», «Cancelar», «Reasignar», «Reasignando…», «Seleccionar {nota}» (aria), mensajes de resultado/errores del data-model §4.

## §5 Cobertura de tests UI (resumen — detalle en tasks)

- `grouped-movement-list`: entrada/salida del modo, checkbox por fila y exclusión de protegidas, toggle todo/ninguno sin incluir protegidas, «Cambiar etiqueta…» deshabilitado con 0, apertura del diálogo con n, éxito → toast + salida del modo, estado vacío sin botón «Seleccionar».
- `bulk-retag-dialog`: render del texto de consecuencia con n, Select solo activas sin protegidas ni «Sin etiqueta», submit deshabilitado sin destino, pendiente, error `role="alert"` con valor conservado, cancelación sin efectos.
- `bulk-retag.action` (mock del use case): Zod rechaza sin delegar (mes malformado, ids vacíos/inválidos), éxito compone mensajes singular/plural/con-descartes y revalida layout, errores de dominio mapeados, resto genérico.

## §6 No-contratos (no cambian)

`movement-form.tsx` y diálogos de alta/edición/eliminación (013/014), `MonthStepper`, `AccountMonthKpis`, `/tags` completo (004/026/027), nav global, `/summary`, `/annual`, `/reports/*` — sin cambios de contrato; reflejan la nueva etiqueta por sus joins vivos tras `revalidatePath("/", "layout")`.
