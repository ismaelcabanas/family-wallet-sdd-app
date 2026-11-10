# 23. Reasignación masiva de etiquetas: selección en listado y retag transaccional

- **Fecha**: 2026-11-07 (implementada 2026-11-10, feature 029, `specs/029-retag-masivo/`)
- **Estado**: Aceptado
- **Relacionados**: [ADR 0014](./0014-tag-unica-fk-movements.md) (tag única FK RESTRICT), [ADR 0018](./0018-mantenimiento-catalogo-tags.md) (protección por slug `isProtectedTagSlug`), [ADR 0015](./0015-creacion-tags-inline-action-propia.md) (familia de actions con `useActionState`/`revalidatePath`), [ADR 0008](./0008-server-actions-searchparams.md)

## Contexto y problema

Reorganizar etiquetas sobre movimientos ya registrados (p. ej. tras una importación de hoja mensual, 028) exigía editar movimiento a movimiento. La feature 029 añade la vía manual: un **modo de selección** sobre el listado agrupado de la página de cuenta (`grouped-movement-list.tsx`) y un diálogo de confirmación informada que reasigna la etiqueta de N movimientos de golpe. La operación debe ser transaccional, re-validada en servidor (los ids pueden desaparecer entre la selección y la confirmación) y excluir la etiqueta protegida «Aportación Común». El caso de uso queda tipado para su reutilización futura por el «modo IA» (feature futura anotada en el roadmap).

## Opciones consideradas

1. **Bucle `findById` + `Movement.recreate` + `update` por movimiento**: N consultas + N escrituras y revalidación redundante de campos que no cambian; sin reglas de dominio adicionales (el destino ya está validado) — rechazado por coste y complejidad de agrupar resultados.
2. **`UPDATE` directo en la Server Action**: prohibido (constitución VII; la action es adaptador fino).
3. **Deduplicación/eliminación de ids en la action antes de delegar**: mezcla validación de dominio en la frontera; el caso de uso debe ser autosuficiente para el futuro adaptador de chat (FR-006).

## Decisión

- **`MovementRepository.retagMovements(accountId, month, movementIds, targetTagId)`** como operación masiva del puerto — paridad con `TagRepository.mergeInto` de 004: la operación masiva vive en el puerto, no en la action. El adaptador Drizzle la resuelve con una **única sentencia** `UPDATE movements SET tag_id, updated_at WHERE id IN (…) AND account_id = ? AND date ∈ [mes-01, mes+1-01)`; el recuento (`rowsAffected`) es el número real de reasignados.
- **Descarte de ids en el `WHERE` con aviso de recuento real** (decisión «ignorar con aviso», Clarifications 2026-11-07): los ids ajenos a la cuenta/mes o desaparecidos no producen error ni escrituras parciales; `BulkRetagMovements` devuelve `{ updatedCount, skippedCount }` y la action compone «{u} de {t} movimientos actualizados». Una sentencia SQLite = una transacción: «todos o ninguno» por construcción sobre los ids válidos.
- **`updated_at` SÍ se actualiza — diferencia deliberada con 004** (decisión del propietario 2026-11-07): en la fusión de etiquetas la operación era sobre la dimensión catálogo (quien edita es quien gestiona etiquetas); aquí el usuario edita movimientos concretos y la edición debe reflejarse como tal. `mergeInto` se mantiene sin tocar `updated_at`.
- **`BulkRetagMovements` (aplicación)** valida y delega: deduplica y coerciona ids con `MovementId` (vacío → `InvalidMovementError("movementIds", "Selecciona al menos un movimiento.")`; el campo se añade al union `MovementField`), resuelve el destino con la semántica de alta/edición (`TagNotFoundError`/`InactiveTagError`, espejo de `resolveTagId`) y rechaza el slug protegido con `isProtectedTagSlug` del dominio (importado directamente — módulo puro compartido, sin ensuciar el puerto `TagRepository`).
- **Server Action `bulkRetag`** (familia ADR 0015 con `<form>`/`useActionState`): Zod en frontera con ids como campos repetidos (`formData.getAll("movementIds")`), mensajes congelados singular/plural/con-descartes, `revalidatePath("/", "layout")` (la etiqueta vive en listados, `/summary`, `/annual` e informe 015) y mapeo `InvalidMovementError`/`TagNotFoundError`/`ProtectedTagError` → mensaje exacto, resto → genérico.
- **Patrón UI «modo de selección»** — primera superficie de edición masiva del producto: estado local `selectionMode`/`selectedIds: Set<number>` en `GroupedMovementList`, botón «Seleccionar» junto al CTA, barra contextual («{n} seleccionados», «Seleccionar todo»/«Ninguno», «Cambiar etiqueta…», «Salir de la selección»), `Checkbox` shadcn por fila con área ≥ 44 px (`aria-label="Seleccionar {nota}"`) y **fila protegida sin checkbox** (hueco del mismo ancho, exclusión en origen por `isProtectedTagSlug`). El diálogo se monta a nivel del listado (convención «diálogos por fila»: tras `revalidatePath` las filas pueden desaparecer) y el éxito sale del modo y limpia la selección. La navegación de mes (stepper) desmonta la página de servidor y reinicia la selección: comportamiento esperado, no se persiste.

## Consecuencias

- Catálogo de etiquetas, importes, fechas, materializaciones (018/019/021/023) y agregados intactos: la operación solo sustituye/asigna `tag_id` (nunca lo retira — los gastos jamás quedan sin etiqueta; FK RESTRICT como auditoría del destino). Totales de cierres/resúmenes idénticos al céntimo; solo se mueven los desgloses por etiqueta (SC-002).
- La aportación común materializada queda excluida por protección en origen (su fila no ofrece checkbox y su slug no aparece en el Select del diálogo); el re-sync de 021 jamás reasigna etiquetas.
- Contrato autosuficiente para el futuro modo IA: entrada `{accountId, month, movementIds, targetTagId}` → salida `{updatedCount, skippedCount}` — un adaptador inbound de chat podrá construir la entrada desde su propia previsualización sin tocar dominio ni aplicación.
- Coste: un caso de uso, un método de puerto + adaptador, una action con schema y dos componentes cliente (diálogo nuevo + modo de selección en el listado existente); cero dependencias y sin migraciones.
