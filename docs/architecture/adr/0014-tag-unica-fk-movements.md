# 14. Tag única como FK en `movements` y migración destructiva

- **Fecha**: 2026-10-03
- **Estado**: Aceptado (decisión del propietario, clarificación 2026-10-01)

## Contexto y problema

La feature 014 reduce la relación Movimiento↔Tag de N:M (tabla de unión `movement_tags` de 002, con asignación automática de «Sin Clasificar») a **0..1**: exactamente una tag obligatoria en gastos y opcional en ingresos. Había que decidir cómo materializar esa cardinalidad y qué hacer con los datos existentes (movimientos de prueba con 0..n tags, ingresos sin tag, concept/description a fusionar en `note`).

## Opciones consideradas

1. **Conservar `movement_tags` con `unique(movement_id)`**: modela un 0..1 con la maquinaria de un N:M (joins, `db.batch`, mapper agrupador) — complejidad residual sin beneficio.
2. **`tag_id` nullable sin FK**: pierde integridad referencial y la protección del invariante a nivel de esquema (constitución V).
3. **`ON DELETE SET NULL`**: dejaría gastos sin tag violando el invariante «gasto siempre tiene tag» si una tag se borrara; el producto solo desactiva tags (004), pero el esquema no debe poder romper la regla.
4. **Migración con backfill** (primera tag de cada movimiento, fusión concept+description): los datos eran de prueba; un backfill de "primera tag de N" es arbitrario y acarrea deuda.
5. **BD limpia a mano (borrar `db.sqlite`)**: rompe la vía única de evolución versionada (V) y deja a producción (Turso) sin camino.

## Decisión

- **FK `tag_id integer NULL → tags(id) ON DELETE RESTRICT` en la propia tabla `movements`**: materialización mínima de un 0..1; imposible más de una tag por construcción; una sola fila por movimiento (INSERT/UPDATE simples, `leftJoin` único en lecturas; el `db.batch` de tags desaparece).
- **`RESTRICT`** protege el invariante «gasto siempre tiene tag» a nivel de esquema: borrar una tag con movimientos falla por FK (el borrado no existe en el producto — 004 desactiva —, pero la BD audita la regla).
- **`DROP TABLE movement_tags`** y columnas `concept`/`description` sustituidas por `note text NOT NULL` en la **migración versionada `0002_formulario-nota-tags.sql`**: `DELETE FROM movements` (elimina los movimientos de prueba y sus relaciones; decisión del propietario 2026-10-01 — no hay datos que preservar) + recreación de la tabla vacía con el esquema nuevo. Cuentas, miembros y catálogo de tags intactos.
- La regla «tag obligatoria en gastos / opcional en ingresos» vive en la entidad `Movement` (dominio puro), igual que la de naturaleza; la UI y Zod solo la replican en frontera. La asignación automática de «Sin Clasificar» (`DEFAULT_TAG_SLUG`, `resolveTagIds`) se elimina de la aplicación; la tag permanece en el catálogo como opción seleccionable a mano.

## Consecuencias

- **Positivas**: menos esquema (una tabla y dos columnas fuera), repositorio y mapper más simples (1 fila = 1 movimiento/DTO con `tag: MovementTagDTO | null`), integridad referencial explícita, migración honesta sin datos arbitrarios.
- **Negativas**: la migración es **destructiva** (borra todos los movimientos existentes): aceptada explícitamente por el propietario al no haber datos reales; en producción (Turso) se aplica como paso pre-deploy desde local (convención BD).
- Los desgloses por tag (cierre mensual, resumen global, cuenta de resultados anual) no cambian de cálculo: cada gasto computa en su única tag y las filas suman el total de gastos (la nota TAG_NOTE de "varias tags computan en cada una" desaparece de los tres paneles).
