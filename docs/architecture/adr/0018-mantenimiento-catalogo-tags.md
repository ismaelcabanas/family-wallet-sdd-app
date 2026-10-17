# 18. Mantenimiento del catálogo de etiquetas: fusión transaccional, slug protegido y reactivación directa

- **Fecha**: 2026-10-17
- **Estado**: Aceptado (feature 004, `specs/004-gestion-tags/`)
- **Relacionados**: [ADR 0014](./0014-tag-unica-fk-movements.md) (FK `ON DELETE RESTRICT` de `movements.tag_id`), [ADR 0015](./0015-creacion-tags-inline-action-propia.md) (action directa + `useTransition`), [ADR 0017](./0017-aportacion-comun-porcentaje-materializacion.md) (localización por slug de «Aportación Común»)

## Contexto y problema

La feature 004 añade la vía de mantenimiento del catálogo `Tag` que su `status` anticipaba desde 0000: **renombrar, fusionar, desactivar y reactivar** desde la vista de administración `/tags`, sin perder ni alterar el histórico (FR-006) y protegiendo la etiqueta de sistema «Aportación Común» de las cuatro operaciones (FR-007). Cuatro decisiones técnicas: (1) atomicidad de la fusión bajo `ON DELETE RESTRICT` (ADR 0014), (2) un único dueño del slug protegido (019 ya lo usa para materializar), (3) inmutabilidad del slug en el renombrado, y (4) la forma de reactivar sin formulario. Research en `specs/004-gestion-tags/research.md`.

## Opciones consideradas

1. **Dos llamadas de repositorio orquestadas por el caso de uso** (`reassignTag` + `delete`): sin transacción, un fallo intermedio deja movimientos apuntando a una etiqueta borrada (o RESTRICT aborta el borrado).
2. **Tx en la Server Action cruzando repositorios**: la action orquestando negocio viola la dirección de dependencias (constitución VII) y la tx cruzaría el puerto.
3. **Borrado lógico de la absorbida** (dejarla inactiva): la spec exige que la absorbida **desaparezca** del catálogo; la salida con histórico es desactivar, no fusionar.
4. **Columna `is_system`** para la protección: migración para un único caso real (YAGNI); la spec fija la protección por slug.
5. **Duplicar la constante del slug en aplicación**: dos dueños del mismo literal, divergencia posible entre 019 y 004.
6. **Re-derivar el slug al renombrar**: rompería la localización por slug de 019 y crearía colisiones inexistentes.
7. **Reactivar con diálogo de confirmación + `useActionState`**: FR-008 no la exige (reversible, sin efecto sobre movimientos); no hay formulario que preservar.

## Decisión

- **`TagRepository.mergeInto(absorbedId, targetId)` como operación transaccional del puerto**: dentro de una única `db.transaction` — (1) `UPDATE movements SET tag_id = target WHERE tag_id = absorbed` (recuento devuelto como `reassignedMovements`), (2) `DELETE tags WHERE id = absorbed`. Tras (1), RESTRICT permite (2); ambas escrituras son atómicas. **No se toca `movements.updated_at`** (FR-006): la fusión es una operación de catálogo sobre la dimensión etiqueta, no una edición de movimientos. La tx vive en el adaptador (precedente 018/019), sin UnitOfWork.
- **Protección por slug en el dominio** — módulo puro `src/domain/tag/SystemTags.ts`: `CONTRIBUTION_TAG_SLUG = "aportacion-comun"` (único dueño del literal; `MaterializeCommonContributions` de 019 pasa a importarlo), `SYSTEM_TAG_SLUGS` y `isProtectedTagSlug(slug)`. Los casos de uso `RenameTag`/`MergeTags`/`DeactivateTag` lanzan `ProtectedTagError` cuando el slug es protegido — como absorbida **o** como resultante de la fusión (clarificación 2026-10-17). Futuras etiquetas de sistema solo se añaden a la lista. La UI decide con `isProtected` del DTO (calculado en dominio), sin menú para la fila protegida.
- **Slug inmutable en el renombrado** (el id tampoco cambia): `Tag.rename(name)` devuelve una nueva instancia con el nombre trimeado conservando id/slug/status. Los slugs son identidad estable del catálogo; 019 localiza «Aportación Común» por slug. `Tag.withStatus(status)` cubre desactivar y reactivar con un solo método.
- **Duplicados con `findByName` autoexcluyéndose** (en el caso de uso, no en la entidad): permite el edge «luz»→«Luz» (cambio solo de caja) y bloquea cualquier otra colisión, activa o inactiva; el índice `lower(name)` queda como red de seguridad del UPDATE (carrera → `DuplicateTagNameError` traducido).
- **Reactivar como action directa + `useTransition`** (extensión de la familia ADR 0015): `reactivateTag(tagId): { ok: true } | { ok: false; message }` — la etiqueta ya vive en el servidor, no hay formulario que preservar y el resultado es un toast, no un estado de formulario. Las otras tres operaciones usan `useActionState` con diálogo, como el resto del producto.

## Consecuencias

- Sin migración: `lower(name)` UNIQUE, `slug` UNIQUE y la FK RESTRICT existentes materializan todas las invariantes; RESTRICT queda como auditoría del borrado (la fusión reasigna antes de borrar).
- Las vistas derivadas (listados, cierres, `/summary`, `/annual`) recalculan solas: joinean `tags` en vivo y `revalidatePath("/", "layout")` en cada action refresca los usos siguientes (SC-002 por construcción: importes, fechas y cuentas intactos).
- Los diálogos de renombrado usan input controlado: React 19 restablece los inputs no controlados al resolverse la action del form, lo que perdería el nombre tecleado en error (SC-004).
- La UI de administración (`tag-catalog.tsx`) monta los diálogos a nivel del listado con el DTO capturado (convención de fila de AGENTS.md): la fila puede desaparecer tras `revalidatePath` (fusión).
