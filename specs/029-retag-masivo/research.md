# Research: Reasignación masiva de etiquetas de movimientos

**Feature**: `029-retag-masivo` | Fase 0 del plan | 2026-11-07

Decisiones de diseño con su racional y alternativas rechazadas. Todas las decisiones de la spec (Clarifications 2026-11-07) se dan por cerradas: `updated_at` **se actualiza**, destino igual a la actual **se ejecuta igualmente**, ids desaparecidos **se descartan con aviso del recuento real**.

---

## §1 Superficie de selección: dónde vive el modo y cómo se activa

**Contexto**: `GroupedMovementList` (`src/infrastructure/primary/ui/grouped-movement-list.tsx`, client) ya renderiza el listado agrupado por fecha del mes visible con acciones por fila (✏️/🗑️) y diálogos montados a nivel del listado (patrón «diálogos por fila»). La página de cuenta (`src/app/accounts/[accountId]/page.tsx`) le pasa `movements: MovementDTO[]` y `tagGroups: ActiveTagGroupDTO[]` (027) — todo lo que la feature necesita ya está en props.

**Decisión**: el modo de selección vive **dentro de `GroupedMovementList`**, como estado local adicional: `selectionMode: boolean` y `selectedIds: Set<number>`. Entrada al modo: botón secundario «Seleccionar» junto al CTA «Nuevo movimiento» del bloque de listado; salida: botón «Salir de la selección» de la barra contextual (o al completar una reasignación con éxito). En modo selección, cada fila muestra un `Checkbox` (shadcn, ya existente en `components/ui/checkbox.tsx`) delante del contenido, con `aria-label="Seleccionar {nota}"` y área táctil ≥ 44 px (paridad ⋮ de 020). Barra contextual sobre el listado con recuento («N seleccionados»), «Seleccionar todo» / «Ninguno», «Cambiar etiqueta…» (deshabilitado con N=0) y salida del modo.

- **Filas protegidas**: `movement.tag` con slug protegido (`isProtectedTagSlug` de `src/domain/tag/SystemTags.ts` — el dominio es módulo puro compartido con cliente, constitución VII; único dueño del literal, como en 004) no renderiza checkbox (FR-004: excluidas en origen).
- **Navegación de mes** (stepper) = navegación de servidor → el componente se desmonta y la selección se reinicia: comportamiento esperado, no se persiste.
- **El estado vacío** (`EmptyState`, también dentro del componente) y el recorrido fuera del modo quedan intactos (FR-001).

**Alternativas rechazadas**:
- *Página dedicada de edición masiva* (`/accounts/{id}/bulk`): nueva ruta, duplicación de lectura y navegación de ida/vuelta para operar sobre lo que ya se ve — rompe «la feature vive donde surge la necesidad» (mismo criterio que 017 frente a 004).
- *Selección con tecla modificadora sobre las filas existentes*: indescubrible en móvil/tablet y frágil con el re-monte por `revalidatePath`.

---

## §2 Caso de uso `BulkRetagMovements` y extensión del puerto

**Contexto**: `MovementRepository` (puerto, `src/application/movement/MovementRepository.ts`) tiene CRUD unitario (`findById`/`update`/`delete`) y lecturas agregadas, pero **ninguna operación masiva**. `UpdateMovement` (edición individual) rehidrata → valida → `Movement.recreate` → `update`. En tags, 004 fijó el precedente de operación masiva transaccional a nivel de puerto: `TagRepository.mergeInto` (único `UPDATE` de reasignación + `DELETE` en `db.transaction`).

**Decisión**: caso de uso **`BulkRetagMovements`** (`src/application/movement/BulkRetagMovements.ts`) + método de puerto **`MovementRepository.retagMovements(accountId, month, movementIds, targetTagId): Promise<{ updated: number }>`**:

1. El caso de uso valida la etiqueta destino cargándola por id (`TagNotFoundError` si no existe; debe estar activa; `isProtectedTagSlug` → `ProtectedTagError` de 004) — reutiliza la resolución de etiqueta activa de alta/edición (`resolveTagId` de `movement-inputs.ts`, misma semántica que `UpdateMovement`).
2. `movementIds`: deduplica, coerciona a `MovementId`; vacío tras deduplicar → error de dominio («Selecciona al menos un movimiento.»).
3. Delega en `retagMovements(accountId, month, ids, tagId)` — **única sentencia** `UPDATE movements SET tag_id = ?, updated_at = ? WHERE id IN (…) AND account_id = ? AND date >= {mes}-01 AND date < {mes+1}-01` (adaptador Drizzle): atómica por construcción (una sentencia SQLite), el filtro de pertenencia a cuenta+mes **descarta en el propio WHERE** los ids ajenos/desaparecidos (decisión «ignorar con aviso» de la spec), y `run.changes` devuelve el recuento real actualizado.
4. Devuelve `BulkRetagResultDTO = { updatedCount, skippedCount }` (skipped = ids únicos − actualizados) → la action compone el aviso («27 de 28 movimientos actualizados» cuando skipped > 0).

**Racional**: paridad con `mergeInto` de 004 (la operación masiva vive en el puerto, no en la action); una única sentencia evita N viajes y cualquier estado intermedio parcial; el dominio valida el destino (existe, activa, no protegida) y el invariante «un movimiento siempre conserva una única etiqueta» se preserva (FK `tag_id` NOT NULL no cambia de cardinalidad; los gastos siempre terminan con etiqueta, nunca a null — la operación solo fija un valor, nunca lo retira).

**Diferencia deliberada con 004**: `retagMovements` **sí actualiza `updated_at`** (decisión del propietario 2026-11-07 — aquí el usuario edita movimientos concretos, allí la operación era sobre la dimensión catálogo). Se anota en el ADR nuevo (§7).

**Alternativas rechazadas**:
- *Bucle `findById` + `Movement.recreate` + `update` por movimiento*: N consultas + N escrituras, revalidación redundante de campos que no cambian (nota, importe, fecha) y complejidad de agrupar resultados; para 50–100 filas es un orden de magnitud más lento sin ganar ninguna regla de dominio adicional (la etiqueta destino ya se validó).
- *`UPDATE` directo en la Server Action*: prohibido (constitución VII, FR-004 de la spec).

---

## §3 Server Action `bulkRetag` y validación de frontera (Zod)

**Contexto**: patrón canónico de action con diálogo: `rename-tag.action.ts` — `"use server"`, use case instanciado en módulo, firma `(prevState, formData)` para `useActionState`, Zod en frontera, mapeo de errores de dominio a mensaje exacto, `TagActionState` unión discriminada.

**Decisión**: action **`bulkRetag`** en `src/infrastructure/primary/actions/bulk-retag.action.ts` con schema propio `bulk-retag.schema.ts` (paridad `tag-actions.schema.ts`):

- **Schema**: `{ accountId: z.coerce.number().int().positive(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), targetTagId: z.coerce.number().int().positive(), movementIds: z.array(z.coerce.number().int().positive()).min(1, "Selecciona al menos un movimiento.") }` — los ids viajan como campos repetidos `movementIds` (`formData.getAll("movementIds")`).
- **Estado**: `BulkRetagActionState = { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string }`.
- **Éxito**: `revalidatePath("/", "layout")` + mensaje compuesto del resultado: skipped 0 → «N movimientos actualizados» (singular «1 movimiento actualizado»); skipped > 0 → «N de M movimientos actualizados».
- **Errores**: `TagNotFoundError` / `ProtectedTagError` / `InvalidMovementError` → `error.message`; resto → genérico «No se ha podido completar la operación. Inténtalo de nuevo.» (paridad `mapErrorToMessage`).
- **Revalidación**: `revalidatePath("/", "layout")` (familia ADR 0015 con las actions de catálogo: la etiqueta de N movimientos vive en listados, `/summary`, `/annual` e informe 015 — todo en una).

**Alternativas rechazadas**: action directa + `useTransition` (familia ADR 0015 para consultas): aquí sí hay `<form>` con Select y un estado de formulario que conservar en error — el patrón correcto es `useActionState` en diálogo (igual que `merge-tags.action`); enviar un único campo `ids=1,2,3` serializado — `getAll` con campos repetidos es el mecanismo nativo de formularios HTML, sin parsing artesanal.

---

## §4 Diálogo `BulkRetagDialog` (convención «diálogos por fila»/listado)

**Decisión**: diálogo montado **a nivel del listado** (no por fila; convención AGENTS.md), con el conjunto de ids seleccionados capturado en estado del cliente. Contenido: texto de consecuencia con recuento («Se cambiará la etiqueta de **N movimientos**.»), Select «Nueva etiqueta» **agrupado por categorías** (`SelectGroup`+`SelectLabel`, patrón `movement-form.tsx` 027) alimentado por `tagGroups` ya disponible en props, **filtrado**: solo activas (ya lo garantiza `ListGroupedActiveTags`), **sin protegidas** (excluye el grupo/filas con slug aportacion-comun) y **sin «Sin etiqueta»** (v1: siempre sustituir/asignar — spec Out of Scope). Campos ocultos: `accountId`, `month`, un `movementIds` por seleccionado. Valor del Select **controlado con `useState`** (SC-004: inputs de diálogos con `useActionState` jamás `defaultValue`) + restauración tras error con ref de última selección válida (paridad `create-tag-dialog.tsx` 027 frente al auto-reset de React 19 sobre el select nativo de Radix). Éxito: guard → cierre + toast (mensaje del estado) + **salida del modo selección** y limpieza de `selectedIds`. `isPending` → «Reasignando…» y controles deshabilitados.

**Alternativas rechazadas**: `AlertDialog` destructivo (no es una operación destructiva: la confirmación informada ya vive en el diálogo con recuento y destino); confirmación en dos pasos (diálogo + segundo diálogo de confirmación): redundante para una operación reversible (revertir = otra reasignación).

---

## §5 e2e: combinación cuenta/mes y posición alfabética

**Contexto**: BD compartida determinista, `workers: 1` (orden alfabético de ficheros), convención de combinación cuenta/mes propia por spec (AGENTS.md). Mapa de ocupación verificado (exploración de las 19 specs existentes):

- Congelados exactos: **2024** entero (informe anual), **2027** entero en las 3 cuentas (cuenta-resultados-anual), **2026-06** global (resumen-global), 2023/2025-01/2028 vacíos, **2026-03/B vacío exigido** (pagina-cuenta P3), 2026-04/05/08/09 en B ocupados sin limpieza, mes actual dinámico ocupado en A/B/común con asserts exactos, y meses anterior/siguiente dinámicos de A y B leídos en vacío.
- Cualquier etiqueta **nueva** no eliminable rompería los recuentos de catálogo de `categorias-tags` (G1: 13 etiquetas, G8: 14) y el orden de `jerarquia-etiquetas` — las specs que crean etiquetas deben correr tras `resumen-global` o reutilizar las del seed.

**Decisión**: spec nueva `e2e/retag-masivo.spec.ts` con **Cuenta de Miembro B + febrero 2026** (combinación verificada libre: nadie usa 2026-02 en ninguna cuenta y ningún assertion global lo cubre; y «retag» > «resumen» alfabéticamente ⇒ corre **la última** de la suite, tras todos los residuos). Usa **solo etiquetas del seed** (p. ej. «Ocio», «Hogar», «Aportación Común»), crea sus movimientos en la combinación propia y no requiere limpieza (es la última y 2026-02/B no lo lee nadie). Escenario: 3 gastos «Ocio» + 1 gasto «Aportación Común» (protegido, creado a mano — el Select del alta la ofrece; 004 solo la protege frente a gestión de catálogo) + 1 ingreso sin etiqueta; activar selección (checkbox ausente en la protegida), reasignar 2 a «Hogar» (toast «2 movimientos actualizados», filas y desglose del listado correctos, totales del mes intactos), «Seleccionar todo» (cuenta excluye la protegida), reasignación del resto, no-op con destino = actual («1 movimiento actualizado»), y verificación en `/summary?month=2026-02` de que los importes por etiqueta se movieron sin variar los totales (SC-002).

**Alternativas rechazadas**: Cuenta común + 2026-02 (también libre, pero B permite además verificar la exclusión de la protegida en un contexto personal con KPIs visibles para comparar totales); mes dinámico (colisiona con asserts exactos de registro/kpis).

---

## §6 Transaccionalidad y re-validación: resumen del contrato

- **Una sentencia** = una transacción (SQLite): no hay estado intermedio parcial posible; «todos o ninguno» se cumple por construcción sobre los ids válidos (FR-003).
- **Descarte de ids ajenos/desaparecidos en el WHERE** de la sentencia (pertenencia a cuenta + rango de fechas del mes): el recuento devuelto es el real y el aviso «N de M» sale de la diferencia — sin segunda ronda de lecturas.
- **`updated_at`**: lo fija la propia sentencia (`now` ISO). El caso de uso no rehidrata cada movimiento (§2) — el invariante relevante (etiqueta única, nunca null en gastos, destino activo y no protegido) está garantizado antes de la sentencia por el caso de uso.
- **Meses cerrados / materializaciones**: la operación no toca importes, fechas ni configs ⇒ sin interacción con 018/019/021/023 (FR-005); los movimientos de aportación están excluidos por protección en origen y el re-sync de 021 jamás los reasigna.

---

## §7 Documentación y ADR

**Decisión**: **ADR 0023** («Reasignación masiva de etiquetas: selección en listado y retag transaccional») registrando: `MovementRepository.retagMovements` como operación masiva de puerto (paridad `mergeInto`), `updated_at` actualizado con la diferencia razonada frente a 004 (decisión del propietario 2026-11-07), descarte de ids en el WHERE con aviso de recuento real, y el patrón UI de «modo de selección» como primera superficie de edición masiva del producto. `AGENTS.md`: convención nueva «Modo de selección y acciones masivas sobre listados» (estado en `GroupedMovementList`, diálogos a nivel del listado, checkbox excluido en filas protegidas). Diagramas vivos de `docs/architecture/diagrams/` extendidos en implementación reutilizando los del plan.

**Alternativas rechazadas**: no crear ADR (la diferencia `updated_at` vs 004 quedaría solo en la spec, y el patrón de selección quedaría sin anclaje para features futuras — p. ej. el modo IA reutilizando el caso de uso).

---

## Necesidades cubiertas sin investigación adicional

- **Componentes**: `Checkbox` shadcn ya copiado en el repo (`components/ui/checkbox.tsx`); `Dialog`, `Select` (con `SelectGroup`/`SelectLabel`), `Button`, `Label`, sonner — todos existentes. **Cero dependencias nuevas** (constitución I/V).
- **Esquema**: sin migraciones — `movements.tag_id` FK RESTRICT ya soporta la reasignación (el destino existe y queda activo); no se borra ninguna etiqueta (diferencia esencial con `mergeInto`).
- **Provider ZAI / modo IA**: fuera de alcance (spec Out of Scope); el contrato del caso de uso (§2) es la preparación completa.
