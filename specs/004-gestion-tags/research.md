# Research: Gestión del catálogo de etiquetas

**Feature**: `004-gestion-tags` | **Fecha**: 2026-10-17

Resuelve las incógnitas del diseño con evidencia del código (verificado en la rama `feature/004-gestion-tags`): el catálogo `Tag` ya tiene `status` y unicidad `lower(name)` desde 0000; la creación inline existe desde 017; la etiqueta «Aportación Común» vive localizada por slug desde 019; no existe ninguna vía de mantenimiento.

---

## §1. Protección de la etiqueta de sistema (FR-007): dónde vive el slug protegido

**Verificado**: `CONTRIBUTION_TAG_SLUG = "aportacion-comun"` es una constante **privada** de `src/application/common-contribution/MaterializeCommonContributions.ts` (L11); la materialización de 019 localiza la etiqueta por slug (`findBySlug ?? save`). No existe concepto `isSystem` en esquema ni dominio. La spec (asunciones) fija la protección por slug y aclara (2026-10-17) que cubre las **cuatro** operaciones: renombrar, desactivar, absorbida y **resultante** de fusión.

**Decisión**: nueva función/constantes **del dominio** `src/domain/tag/SystemTags.ts`: `CONTRIBUTION_TAG_SLUG` + `SYSTEM_TAG_SLUGS` + `isProtectedTagSlug(slug): boolean` (pura, sin deps). Los cuatro casos de uso consultan `isProtectedTagSlug(tag.slug)` y lanzan el nuevo error de dominio `ProtectedTagError(name)`. `MaterializeCommonContributions` se refactoriza para **importar** la constante del dominio (aplicación → dominio, dirección permitida) y elimina su copia local: un único dueño del slug.

**Rationale**: la protección es una regla de negocio del catálogo, no de la materialización; el dominio es su sitio natural (constitución VII) y así el mismo literal no puede divergir entre 019 y 004.

**Alternativas consideradas**:
- *Duplicar la constante en aplicación (tag)*: rechazada — dos dueños del mismo slug, divergencia posible.
- *Columna `is_system` en la tabla*: rechazada — migración para un único caso real (YAGNI, principio I); la spec fija expresamente la protección por slug y anticipa que futuras etiquetas de sistema «heredarán esta protección» (basta añadirlas a `SYSTEM_TAG_SLUGS`).

## §2. Comportamiento de dominio: renombrar y cambiar de estado

**Verificado**: `Tag` está congelada y es anémica (`create`/`rehydrate`, sin `rename` ni transiciones); el nombre se valida (trim no vacío) y el slug nunca se re-deriva tras la creación; `DuplicateTagNameError`, `InvalidTagError`, `TagNotFoundError` existen; `findByName` (017) es espejo del índice `tags_name_nocase_uq ON lower(name)` (ASCII, ignora estado).

**Decisión**:
- `Tag.rename(name): Tag` — nueva instancia congelada con el nombre trimeado (vacío → `InvalidTagError` literal vigente); **conserva id, slug y status**: el slug es identidad estable (019 localiza por slug; renombrar no puede romperla) y las colisiones de slug son irrelevantes en el renombrado (el slug no cambia).
- `Tag.withStatus(status): Tag` — nueva instancia con el estado dado; cubre desactivar y reactivar con un solo método.
- Duplicado en renombrado/reactivación resuelto **en el caso de uso** con `findByName` y **exclusión de sí misma** (`existing.id !== tag.id`): permite el edge «luz»→«Luz» (cambio solo de caja, no es duplicada de sí misma) y bloquea cualquier otra colisión, activa o inactiva, como en 017.
- Reactivación: la colisión se comprueba **solo frente a la etiqueta encontrada que no sea ella misma** — por el índice global solo puede existir una fila con ese `lower(name)`; si es otra, esa otra está activa o bloquearía también (edge de la spec: inactiva «Luz» con activa «LUZ» → rechazo con el mensaje de duplicado).

**Rationale**: la entidad gana el comportamiento de catálogo que el modelo anticipaba con `status`; sin tocar `create`/`rehydrate` (compatibles con 017/019); la validación de duplicados necesita el catálogo completo, así que vive en aplicación contra el puerto (mismo reparto que `CreateTag`).

**Alternativas consideradas**:
- *Reconstruir con `rehydrate` en los casos de uso*: rechazada — la regla «nombre no vacío tras trim» volvería a duplicarse fuera de la entidad.
- *Re-derivar el slug al renombrar*: rechazada — rompería la localización por slug de 019 y crearía colisiones de slug inexistentes hoy.

## §3. Fusión: semántica y atomicidad (FR-003, FR-006, ADR 0014)

**Verificado**: `movements.tag_id` es FK → `tags.id` **`ON DELETE RESTRICT`** (ADR 0014: «borrar una tag con movimientos falla por FK»); existe índice `idx_movements_tag_id`; los repositorios de 018/019 ya usan `db.transaction` para insertar movimiento+registro de mes en una tx; las vistas de desglose **joinean `tags` en vivo** (`tagName: tags.name` en `DrizzleMovementRepository.selectMonthRows`), así que renombrar `tags.name` o reasignar `movements.tag_id` fluye a listados, cierres, `/summary` y `/annual` **sin tocar ninguna vista** (FR-009/SC-002 por construcción).

**Decisión**: método de puerto transaccional `TagRepository.mergeInto(absorbedId, targetId): Promise<{ reassignedMovements: number }>` — una sola operación de repositorio que, dentro de `db.transaction`: (1) `UPDATE movements SET tag_id = target WHERE tag_id = absorbed` (devuelve el recuento reasignado) y (2) `DELETE FROM tags WHERE id = absorbed` (tras la reasignación, RESTRICT ya no bloquea). `MergeTags` valida (ambas existen, distintas, **ninguna protegida** — absorbida ni resultante, clarificación 2026-10-17) y delega. **No se toca `updated_at`** de los movimientos: la fusión es una operación de catálogo sobre la dimensión etiqueta (FR-006), no una edición de movimientos.

**Rationale**: RESTRICT exige reasignar antes de borrar y ambas escrituras deben ser atómicas (sin mitad de fusión visible); encapsularlo en el adaptador sigue el precedente de tx de 018/019 sin introducir un gestor de transacciones/UoW (principio I). El recuento alimenta el toast y los tests.

**Alternativas consideradas**:
- *Dos llamadas de repositorio orquestadas por el caso de uso (`reassignTag` + `delete`)*: rechazada — sin tx: un fallo entre ambas dejaría movimientos apuntando a una etiqueta borrada (o RESTRICT abortando el delete).
- *Borrado lógico / dejar la absorbida inactiva*: rechazada — la spec exige que la absorbida **desaparezca** del catálogo (US5-2 del maestro); la salida con histórico es desactivar, no fusionar.
- *`reassignTag` en `MovementRepository` + tx desde la action*: rechazada — la action orquestando negocio viola el principio VII y la tx cruzaría repositorios.

## §4. Vista de administración, acciones y confirmaciones (FR-001, FR-008)

**Verificado**: no existe ninguna vista de administración; los precedentes de listado+acciones son `grouped-movement-list.tsx` (diálogos montados a nivel de listado con el DTO capturado en estado del cliente — patrón canónico de fila) y `account-card-grid.tsx` (menú ⋮ por tarjeta); `AlertDialog` de confirmación patrón `delete-movement-dialog.tsx` (`useActionState` + efecto éxito/error → `onClose()` + toast); la navegación global (`global-nav.tsx`) expone `active: "panel" | "summary" | "annual"` y se pinta en las 4 páginas; los formularios reciben solo etiquetas **activas** vía `ListActiveTags` y `resolveTagId` rechaza inactivas en el envío (edge «formulario abierto» ya cubierto).

**Decisión**:
- Ruta nueva `/tags` (`src/app/tags/page.tsx`, server): `GlobalNav active="tags"` (nuevo enlace «Etiquetas» estático, sin contexto temporal — el catálogo es atemporal) + componente cliente `TagCatalog` con el DTO del caso de uso `ListTags`.
- `ListTags` compone dos puertos: `TagRepository.findAll()` (nuevo) + `MovementRepository.countByTag(tagId)` (nuevo) → `CatalogTagDTO { id, name, slug, status, movementCount, isProtected }`, ordenado: activas primero, luego inactivas, cada bloque alfabético (`es`).
- Fila: nombre, chip de estado (Activa/Inactiva), nº de movimientos; menú ⋮ «Acciones de {nombre}» con las acciones aplicables (Renombrar, Fusionar en otra…, Desactivar | Reactivar). La fila protegida muestra distintivo «Sistema» y **no ofrece menú** (FR-007: «no se ofrecen»).
- Diálogos **a nivel del listado** con el DTO capturado (patrón canónico): `RenameTagDialog` (form + `useActionState`, valor tecleado conservado en error — el input no se remonta), `MergeTagsDialog` (Select de destino excluyendo la propia y las protegidas, muestra inactivas con su estado; texto de consecuencia con el recuento), `DeactivateTagDialog` (AlertDialog destructivo con consecuencia explícita).
- **Reactivar**: ítem de menú con **action directa + `useTransition`** (familia ADR 0015): no hay formulario que preservar — la etiqueta ya vive en el servidor — y el resultado es un mensaje, no un estado de formulario; feedback por toast (éxito y error, p. ej. colisión). Las otras tres operaciones (renombrar/fusionar/desactivar) usan `useActionState` con diálogo, como el resto del producto.
- Éxito en todas: `revalidatePath("/", "layout")` (catálogo global; los Select de alta/edición y los desgloses se recalculan en los usos siguientes — FR-009) + toast + cierre del diálogo.

**Rationale**: reutiliza los tres patrones ya fijados (fila-diálogo a nivel de listado, AlertDialog de confirmación, action directa documentada); la página es un adaptador fino que compone puertos como las existentes.

**Alternativas consideradas**:
- *Menú ⋮ dentro de cada fila con diálogos en la fila*: rechazado — la fila puede desaparecer tras `revalidatePath` (fusión) y perder el estado de `useActionState` (convención «diálogos por fila» de AGENTS.md).
- *Reactivar con diálogo de confirmación*: rechazada — FR-008 exige confirmación solo para fusión y desactivación; reactivar es reversible y sin efecto sobre movimientos.
- *Tabla HTML completa*: lista simple con filas `listitem` (mismo rol semántico que los desgloses), suficiente para ~15 etiquetas.

## §5. Disponibilidad inmediata y vistas derivadas (FR-009, SC-002)

**Verificado**: cierres, `/summary` y `/annual` se componen de `MovementRepository.list*` con `tagName` del join en vivo; los Select de alta/edición reciben `ListActiveTags` en cada render del servidor.

**Decisión**: ninguna vista derivada se modifica. `revalidatePath("/", "layout")` en cada action de catálogo + la naturaleza derivada de los joins hacen que el siguiente uso de cualquier vista muestre el estado resultante. `MaterializeCommonContributions` no cambia de comportamiento (importa la constante, nada más): la etiqueta protegida no puede renombrarse/desactivarse/fusionarse, así que el ensure-por-slug de 019 sigue siendo estable.

**Rationale**: SC-002 (cero variación de totales) se cumple por construcción: las operaciones solo tocan `tags.name`/`tags.status`/`movements.tag_id`; importes, fechas y cuentas intactos.

**Alternativas consideradas**: invalidaciones quirúrgicas por página — innecesarias (1 usuario, coste de invalidar el layout irrelevante; mismo criterio que ADR 0015).

## §6. Pruebas: cobertura por capa y aislamiento e2e (FR-011, constitución III)

**Estado actual (verificado)**: suites por capa co-localizadas; fakes en memoria para puertos (`CreateTag.test.ts`); repositorios contra libsql `:memory:` con migraciones (`test-support.ts`, la migración 0004 inserta la etiqueta 100 «Aportación Común» — disponible en todos los tests de repositorio); actions mockeando use cases con `vi.hoisted`; componentes con Testing Library; e2e con `workers: 1` (orden alfabético sobre `e2e.sqlite` compartida), serie dentro de cada fichero y combinación cuenta/mes exclusiva por spec.

**Decisión**:

1. **Dominio**: `Tag.test.ts` — `rename` (trimea, vacío → `InvalidTagError`, conserva id/slug/status) y `withStatus`; `SystemTags.test.ts` — `isProtectedTagSlug` (aportacion-común sí, resto no).
2. **Aplicación** (fake en memoria ampliado con `findAll`/`findById`/`update`/`mergeInto`/`countByTag`): `RenameTag` (éxito, solo-caja de sí misma permitido, duplicado con otra — activa o inactiva —, vacío, protegida, id desconocido), `MergeTags` (éxito delega `mergeInto` con los ids correctos, protegida como absorbida, **protegida como resultante** — clarificación 2026-10-17, misma etiqueta, ids desconocidos), `DeactivateTag` (éxito, protegida, desconocida), `ReactivateTag` (éxito, colisión con activa → `DuplicateTagNameError`, desconocida), `ListTags` (orden activas→inactivas alfabético, recuentos, `isProtected` cierto para aportacion-comun).
3. **Repositorio** (libsql `:memory:`): `findAll`/`findById`/`update` (persiste renombrado y estado; violación de `lower(name)` en UPDATE → `DuplicateTagNameError`), `mergeInto` (reasigna los movimientos y borra la absorbida en una tx; absorbeda sin movimientos devuelve 0; tras la fusión los DTO de lectura muestran la resultante), `countByTag` (0, N).
4. **Actions**: una por action — Zod inválido, mapeo de `InvalidTagError`/`DuplicateTagNameError`/`ProtectedTagError`/`TagNotFoundError` a mensaje, éxito revalida layout y devuelve estado.
5. **Componentes**: `tag-catalog` (filas con estado/recuento, menús por estado, fila «Sistema» sin menú), diálogos (renombrar conserva nombre en error; fusión excluye protegidas del Select y muestra consecuencia; desactivar confirma y deshabilita en vuelo), `global-nav` (enlace «Etiquetas», `aria-current` en /tags).
6. **e2e nueva `gestion-tags.spec.ts`** — posición alfabética: tras `edicion-movimientos`, antes de `ingresos-regulares`. **Combinación: Cuenta de Miembro B + septiembre 2026** (verificada libre; análisis de ocupación abajo): registrar dos movimientos con dos etiquetas creadas en línea (017), luego desde /tags: renombrar (la fila del listado de septiembre muestra el nombre nuevo, totales intactos), fusionar (los movimientos quedan bajo la resultante, la absorbida desaparece del catálogo, el desglose del cierre acumula bajo la resultante), desactivar con histórico (la fila histórica conserva la etiqueta; el Select del alta ya no la ofrece), reactivar (vuelve al Select), protección («Aportación Común» con distintivo «Sistema» y sin menú; ausente como destino de fusión) y acceso por la navegación global.

**Mapa de ocupación verificado** (cuenta × mes usado por cada spec existente): Cuenta común — mes actual real (`registro` E1/E4, con balance histórico absoluto asertado: cualquier movimiento en común lo rompe); Miembro A — mes actual (`registro` E2/E3, balance histórico absoluto) + julio 2026 (`edicion`); Miembro B — mes actual real (`aportacion`, `cierre`, `ingresos`), abril 2026 (`pagina-cuenta`, balance del mes exacto), mayo 2026 (`creacion-tags`), agosto 2026 (`edicion`), junio 2026 en las tres cuentas (`resumen-global`, KPIs exactos), 2027 (`cuenta-resultados-anual`, tablas exactas del año), marzo 2026 debe seguir a 0 acumulado y 2027-06 vacío (`pagina-cuenta` P3/P5). **Septiembre 2026 en Miembro B no lo usa nadie** y ninguna spec posterior aserta sobre él; los movimientos de la spec nueva (solo B, solo septiembre 2026) no alteran ningún balance asertado. Las etiquetas que crea/renombra/fusiona/desactiva la spec son **nuevas** (no del seed): ningún Select posterior enumera el catálogo completo, solo elige opciones concretas.

**Riesgo residual documentado**: igual que 017 eligió mayo 2026, si la suite se ejecutara exactamente durante septiembre de 2026 el mes fijo colisionaría con las specs de mes actual en B; hoy (2026-10) es un mes pasado y el riesgo es puramente teórico.

7. **Gates**: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` en verde (SC-005).

**Alternativas consideradas**: reutilizar `creacion-tags.spec.ts` (rechazada — combinación ajena y fichero propio por convención); action contra BD real (se mantiene el patrón de mocks + repositorios contra `:memory:`).

## §7. Documentación viva y roadmap (FR-010, DoD)

**Verificado**: `docs/architecture/` documenta el catálogo sin vía de mantenimiento; ADRs hasta 0017; el roadmap maestro tiene la fila `004-gestion-tags` «Futura» (reducida 2026-10-04).

**Decisión** (en la implementación, DoD): **ADR 0018** («Mantenimiento del catálogo de etiquetas: fusión transaccional y protección por slug») registrando: `mergeInto` transaccional (reasignación + borrado dentro de RESTRICT, sin tocar `updated_at`), protección por slug compartida en dominio (`SystemTags`), slug inmutable en renombrado, reactivar como action directa (extensión de la familia ADR 0015). Actualizar `overview.md` (vista /tags, use cases de catálogo), `diagrams/domain-model.md` (`Tag.rename/withStatus`, puerto ampliado) y el diagrama de secuencia con base en los de este plan. Roadmap maestro: fila `004-gestion-tags` «Completada» + constancia de FR-005 íntegro (crear → 017; renombrar, fusionar, desactivar y reactivar → 004). `AGENTS.md` solo si la implementación fija convención nueva (candidata: patrón de vista de administración con menús por fila y reactivación directa).

**Rationale**: DoD de la constitución (III) y regla de documentación en el mismo cambio; los diagramas de este plan son la base de la extensión.

**Alternativas consideradas**: ninguna razonable; docs desfasadas violan la DoD.

## Resumen de decisiones

| Tema | Decisión | Alternativa rechazada |
|------|----------|----------------------|
| §1 Protección | Slug protegido en dominio (`SystemTags.ts`); `ProtectedTagError`; 019 importa la constante | Duplicar constante; columna `is_system` |
| §2 Dominio | `Tag.rename` (slug/id/estado estables) + `Tag.withStatus`; duplicado con `findByName` excluyéndose a sí misma | `rehydrate` en use cases; re-derivar slug |
| §3 Fusión | `TagRepository.mergeInto` transaccional (reasignar → borrar; recuento devuelto); sin tocar `updated_at` | Dos llamadas sin tx; borrado lógico; tx en la action |
| §4 Vista | `/tags` + `ListTags` (dos puertos, DTO con estado/recuento/protección); menús ⋮ por fila; diálogos a nivel de listado; reactivar con action directa + `useTransition` | Diálogos en la fila; confirmar reactivación |
| §5 Disponibilidad | `revalidatePath("/", "layout")`; vistas derivadas intactas (joins vivos) | Invalidación por página; tocar desgloses |
| §6 Pruebas | Nueva por capa (dominio, 5 use cases, repos, 4 actions, 4 componentes + nav) + e2e `gestion-tags.spec.ts` (Miembro B + septiembre 2026, ocupación verificada) | Absorber en specs existentes; BD real en actions |
| §7 Documentación | ADR 0018 + overview/domain-model/secuencia + fila 004 «Completada» y FR-005 íntegro en el maestro | Docs desfasadas |
