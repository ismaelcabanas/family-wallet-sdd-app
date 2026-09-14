# 11. Edición por reconstrucción validada y borrado físico

- **Fecha**: 2026-09-14
- **Estado**: Aceptado

## Contexto y problema

La feature 003 permite editar cualquier campo de un movimiento (incluidos cuenta, mes y tipo) y eliminarlo (FR-001/FR-003). `Movement` es inmutable y congelada desde 002; había que decidir **cómo aplicar los cambios sin relajar invariantes** (FR-002: validaciones idénticas al alta), **cómo extender el puerto** de persistencia y **qué marca de auditoría** registrar (clarificación 2026-09-14).

## Opciones consideradas

1. **Updates parciales** (`withChanges` por campo o setters): permite estados intermedios inválidos, duplica o relaja invariantes y rompe la inmutabilidad que 002 congela con `Object.freeze`.
2. **Validar solo en la frontera (Zod) y persistir sin pasar por el dominio**: la regla de negocio dejaría de vivir en el dominio (constitución VII); dos fuentes de verdad que divergen.
3. **Borrar y recrear** (delete + create): cambia el `id` (el repositorio asigna `max(id)+1`) y el `createdAt`; pierde la identidad de la fila.
4. **Borrado lógico** (`deleted_at` o estado): sin requisito de auditoría (uso individual, YAGNI); contaminaría todas las queries existentes con `deleted_at IS NULL`.
5. **Tabla de auditoría con valores previos**: requisito inexistente; coste de escritura/lectura para cero consumo.
6. **`update` con diff de tags** (borrar solo las quitadas): complejidad sin beneficio con conjuntos ≤ 12 filas; el replace es determinista.
7. **No comprobar existencia antes de update/delete**: éxito silencioso con 0 filas afectadas; el edge case "movimiento no encontrado" de la spec quedaría sin error claro.

## Decisión

- **`Movement.recreate(id, input, createdAt)`**: factory que ejecuta **exactamente las mismas validaciones que `create`** mediante un builder privado compartido (`buildValidatedState`), preservando identidad (`id`) y `createdAt`; sin setters ni updates parciales. El agregado "se mueve" de cuenta/mes cambiando `accountId`/`date`.
- **Puerto `MovementRepository` +3**: `findById` (join de fila + tags, rehidratación con el mapper existente), `update` (batch atómico de Drizzle: UPDATE de fila + DELETE/INSERT del conjunto de tags) y `delete` físico (la FK `onDelete cascade` de `movement_tags` limpia las asociaciones; el catálogo `tags` nunca se toca).
- **`updated_at`** (TEXT ISO 8601 UTC, nullable, NULL = nunca editado): auditoría técnica que **pone el repositorio en cada UPDATE**; única migración de la feature. Fuera del dominio y de los DTOs; no es historial de valores previos.
- Existencia explícita: `UpdateMovement`/`DeleteMovement` lanzan `MovementNotFoundError` ("El movimiento ya no existe.") cuando `findById` devuelve `null`.

## Consecuencias

- **Positivas**: FR-002 garantizado por construcción (alta y edición pasan por el mismo código de validación en dominio y frontera — `movement-form.schema.ts`, `movement-inputs.ts`); atomicidad fila + tags sin transacciones manuales nuevas (research.md §1–§2); el mismo `id` computa exclusivamente en la cuenta/mes de su nueva fecha (FR-005) porque balance y cierre son vistas derivadas (ADR 0009/0010) que se recalculan solas vía `revalidatePath("/")`.
- **Negativas**: reescritura completa de la fila y del conjunto de tags en cada edición (≤ 12 filas por movimiento: coste despreciable, aceptado a cambio de simplicidad determinista); la marca `updated_at` no responde "qué cambió", solo "cuándo por última vez" (decisión explícita del propietario).
