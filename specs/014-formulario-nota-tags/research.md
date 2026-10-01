# Research: Alta continua de movimientos con formulario simplificado (nota única, tag única, sin cuenta)

**Feature**: 014-formulario-nota-tags | **Fecha**: 2026-10-01

Feature de triple calado sobre el flujo de alta/edición existente (002/003/013): (1) **nota única** que fusiona `concept`+`description` en todo el stack (dominio → DTOs → schema → UI), (2) **tag única 0..1** obligatoria en gastos y opcional en ingresos (amenda FR-006 de 002 y el default «Sin Clasificar» automático), (3) **sin campo cuenta** también en edición (la cuenta queda inmutable tras el alta), más (4) **modo de captación continua**: el diálogo de alta permanece abierto tras guardar. La migración elimina todos los movimientos de prueba existentes (decisión del propietario 2026-10-01). Este research fija el estado verificado en código, las decisiones de diseño y las alternativas desechadas; resuelve además los puntos que la spec deja al plan (asunciones).

## §1. Nota única en el modelo (dominio, DTOs, persistencia)

**Estado actual (verificado)**:

- `src/domain/movement/Movement.ts`: `MovementInput`/`MovementPersistence` llevan `concept: string` + `description: string | null` (L24-25, L36-37); `buildValidatedState` valida concepto no vacío tras trim («El concepto es obligatorio.», L56-59) y normaliza descripción vacía→`null` (L90). La entidad expone `readonly concept` y `readonly description`.
- `src/domain/movement/MovementErrors.ts`: `MovementField = "date" | "concept" | "amount" | "accountId" | "type" | "nature" | "tagIds"`.
- `src/application/movement/dto.ts`: `CreateMovementDTO`/`UpdateMovementDTO`/`MovementDTO` replican `concept`+`description` (L4-43).
- `src/infrastructure/db/schema/movements.ts`: columnas `concept text notNull` (L14) y `description text` (L15).
- Mapper `movement.mapper.ts` y `DrizzleMovementRepository.selectMonthRows()`/`findById` seleccionan ambas columnas.
- Vistas que renderizan por separado: `grouped-movement-list.tsx` (`movement.concept · movement.description`, L102-105), `delete-movement-dialog.tsx` («Concepto: …»), `edit-movement-dialog.tsx` (prefill de ambos), `annual-statement-panel.tsx` (header sr-only «Concepto»).

**Decisión**:

1. **Renombrado sustantivo, no adición**: el dominio pasa a `note: string` obligatoria (no vacía tras trim, mensaje «La nota es obligatoria.») y **elimina** `concept`/`description`. `MovementField` sustituye `"concept"` por `"note"`. Los DTOs (`CreateMovementDTO`, `UpdateMovementDTO`, `MovementDTO`), `MovementInput`/`MovementPersistence`, el schema Drizzle (columna `note text notNull`), el mapper, las queries del repositorio y todas las vistas pasan a `note`. La UI etiqueta el campo **«Nota»** (placeholder «Mercadona», del concepto actual).
2. **Trim al guardar** ya lo hace la validación de dominio (`buildValidatedState`); la frontera Zod replica el `.trim().min(1)` actual del concepto con el mensaje renombrado.
3. Literales afectados: `grouped-movement-list` muestra solo `movement.note`; `delete-movement-dialog` «Nota: …»; `aria-label` de editar/eliminar usan `movement.note`; `annual-statement-panel` header sr-only pasa a «Nota».

**Rationale**: la spec (FR-002) exige un único atributo nota en entidad, DTOs y persistencia; mantener columnas legacy solo para lectura añadiría deuda sin datos que preservar (la migración elimina los movimientos, clarificación 2026-10-01). Renombrar en vez de alias evita bifurcaciones de nomenclatura (`concept` vivo en algunas capas).

**Alternativas consideradas**:

- *Conservar `concept` como nombre interno y solo fusionar en UI*: rechazada; FR-002 exige reflejar el atributo único en entidad/DTOs/persistencia, y la dualidad nombre-UI/modelo violaría el glosario (VI).
- *Mantener `description` como columna legada sin uso*: rechazada; sin datos que preservar, es esquema muerto (I, simplicidad).
- *Nota opcional con fallback al importe formateado*: rechazada; la spec mantiene el requisito de no vacío tras trim (edge case «Nota vacía o de solo espacios»).

## §2. Tag única 0..1 (dominio, aplicación, persistencia)

**Estado actual (verificado)**:

- Dominio: `tagIds: readonly TagId[]` con mínimo 1 (L80-83 de `Movement.ts`: «Selecciona al menos una etiqueta.») y deduplicación.
- Aplicación: `movement-inputs.ts` `resolveTagIds` asigna por defecto la tag «Sin Clasificar» (`DEFAULT_TAG_SLUG = "sin-clasificar"`, L45-51) cuando no llega selección; `CreateMovement`/`UpdateMovement` la invocan; `CreateMovement.ts` re-exporta `DEFAULT_TAG_SLUG`.
- Persistencia: tabla de unión `movement_tags` con PK compuesta `(movement_id, tag_id)` y cascadas; `create`/`update` escriben el set en `db.batch`; lecturas con `leftJoin` doble y agrupación en `mapJoinedRowsToMovementDTOs`.
- UI: checkboxes múltiples `name="tagIds"` + texto de ayuda «Sin selección, el movimiento se guarda con la etiqueta «Sin Clasificar».» (L332-334 de `movement-form.tsx`).
- Desgloses: `MonthlyClosure` suma el importe íntegro **por cada** tag del movimiento (multi-tag) y los 3 paneles muestran `TAG_NOTE` («Los gastos con varias tags computan en cada una…», duplicada en 3 ficheros).

**Decisión**:

1. **Dominio**: `Movement` pasa a `tagId: TagId | null`. La regla de obligatoriedad según tipo vive en la entidad: `type === "expense"` con `tagId === null` → `InvalidMovementError("tagId", "Selecciona una etiqueta para el gasto.")`; ingresos aceptan `null`. `MovementField` sustituye `"tagIds"` por `"tagId"`.
2. **Aplicación**: `resolveTagId(tags, rawTagId: number | null)` valida (si llega id) existencia y estado activo (`TagNotFoundError`/`InactiveTagError` como hoy); **sin default**: desaparece la asignación automática de «Sin Clasificar» y `DEFAULT_TAG_SLUG` se elimina de `movement-inputs.ts`/`CreateMovement.ts` (la tag «Sin Clasificar» sigue en el catálogo y es seleccionable a mano, asunción de la spec). DTOs: `tagId: number | null` en Create/Update; `MovementDTO.tags: MovementTagDTO[]` pasa a `tag: MovementTagDTO | null`.
3. **Persistencia — FK en la tabla `movements`**: nueva columna `tag_id integer FK→tags.id onDelete: set null … con guard` → en SQLite, `ON DELETE SET NULL` dejaría gastos sin tag violando el invariante; como la eliminación de tags del catálogo no existe en el producto (004 desactiva, no borra) **y** la migración parte de movimientos eliminados, se usa FK con `ON DELETE RESTRICT` (protege el invariante «gasto siempre tiene tag» a nivel de esquema) y la tabla `movement_tags` **se elimina**. `create`/`update` dejan de usar `db.batch` para tags (solo INSERT/UPDATE de la fila con `tag_id`); las lecturas simplifican el `leftJoin` doble a uno solo contra `tags`.
4. **UI**: selección simple — `RadioGroup name="tagId"` con opción explícita «Sin etiqueta» visible solo cuando el tipo actual del formulario es Ingreso (edge case «tag en ingresos»: 0 válido; si había selección y se cambia a ingreso, la selección se conserva como válida). En gastos sin selección → error frontera «Selecciona una etiqueta para el gasto.» (Zod `superRefine` cross-field, análogo al de naturaleza). Desaparece el texto de «Sin Clasificar» automático (FR-003).
5. **Desgloses**: sin cambios de cálculo (cada gasto computa en su única tag); `ClosureMovementInput.tags` pasa a `tag: ClosureTagRef | null`; los 3 `TAG_NOTE` se eliminan de los paneles.

**Rationale**: FK en `movements` es la materialización natural de una cardinalidad 0..1 (asunción de la spec que este plan resuelve): imposible más de una tag por construcción, sin tabla extra ni unicidad artificial. `RESTRICT` en el borrado mantiene el invariante de gastos audible en el esquema (V). El dominio retiene la regla tipo-dependiente porque es regla de negocio (VII), igual que hoy retiene la de naturaleza.

**Alternativas consideradas**:

- *Mantener `movement_tags` con unique(movement_id)*: rechazada; una tabla de unión con unicidad por movimiento modela un 0..1 con la maquinaria de un N:M (más joins, batch y mapper que un simple `tag_id`).
- *`tag_id` nullable sin FK*: rechazada; pierde integridad referencial y la protección RESTRICT (V).
- *Tag obligatoria también en ingresos*: rechazada; la spec la deja opcional en ingresos (decisión del propietario 2026-09-27, FR-003).
- *Select nativo en lugar de RadioGroup*: rechazado; consistencia con los RadioGroup existentes (tipo/naturaleza), visibilidad directa del catálogo (12 tags) y etiquetado accesible por label sin desplegar; no añade componente shadcn nuevo al flujo.

## §3. Sin campo cuenta: cuenta inmutable tras el alta

**Estado actual (verificado)**:

- Alta (013): cuenta fijada mostrada como bloque informativo de solo lectura «{accountName} (se cambia con el selector superior)» + `input hidden accountId` (L220-226 y L132 de `movement-form.tsx`).
- Edición (003): `Select name="accountId"` con todas las cuentas (L194-218) y `UpdateMovement` permite cambiar de cuenta; `update-movement.action.ts` `buildMovedNotice` compone «…: ahora está en {Cuenta}» cuando la cuenta cambia (L58-78) usando `ListAccounts`.
- `UpdateMovement.ts` toma `accountId` del DTO (L27-30, L38).

**Decisión**:

1. **Alta**: desaparece el bloque informativo «Cuenta» del diálogo (FR-004); se conserva el `input hidden accountId` (la cuenta de la página viaja en el FormData, como hoy).
2. **Edición**: desaparece el `Select`; el DTO de `UpdateMovement` deja de llevar `accountId` como dato editable → se añade `expectedAccountId` (hidden, la cuenta de la página actual); `UpdateMovement` carga la cuenta del movimiento y **valida** que coincide con `expectedAccountId` (si no: `InvalidMovementError("accountId", "El movimiento ya no pertenece a esta cuenta.")` → `_form`-style error de campo en el diálogo; el caso real es que otro tab lo movió —ya imposible en el producto, pero la frontera sigue validando). `Movement.recreate` recibe el `accountId` del movimiento persistido.
3. `buildMovedNotice` pierde la rama de cuenta: el mensaje pasa a ser «Movimiento actualizado» + sufijo de mes movido si aplica («…: ahora está en {Mes año}»); `ListAccounts` y el `accounts` prop de `EditMovementDialog`/`MovementFormFields` dejan de necesitarse en el flujo de edición (el listado deja de pasar `accounts` al diálogo de edición).
4. Los casos de uso siguen validando que la cuenta existe (`CreateMovement`) y es la de la página (`UpdateMovement` vía `expectedAccountId`) — FR-004 exige exactamente eso.

**Rationale**: la cuenta pasa a ser identidad inmutable del movimiento (decisión del propietario); validarla en el caso de uso mantiene la frontera honesta sin exponer un selector. `expectedAccountId` en vez de ignorar el campo evita escribir en una cuenta distinta por un FormData manipulado.

**Alternativas consideradas**:

- *Mantener `accountId` en `UpdateMovementDTO` y validar igualdad con el persistido*: equivalente en red de seguridad, pero conserva un campo editable falso en el contrato del DTO; `expectedAccountId` hace explícita la intención (check, no dato).
- *Eliminar toda validación de cuenta en edición (usar la del movimiento)*: suficiente en el happy path, pero el FormData del cliente no es de fiar (Zod en fronteras, IV); validar la coincidencia es barato y cierra el hueco.

## §4. Modo de captación continua (diálogo de alta)

**Estado actual (verificado)**:

- `create-movement-dialog.tsx`: `useActionState(createMovement, …)`; en éxito `onClose()` + `toast.success("Movimiento guardado")` (L76-81); «Cancelar» en `secondaryActions`; submit «Registrar» con `disabled={isPending}` («Guardando…»).
- `movement-form.tsx`: campos **no controlados** (`defaultValue` + `state.values` en error); naturaleza/tipo/cuenta elegidas en estado local (`chosenType`/`chosenNature`); tags con `defaultChecked` recalculado por `key` (L320).
- La action devuelve `{ status: "success", message: "Movimiento guardado" }` y revalida `/` + `/accounts/[accountId]` page; el diálogo (client) montado en `GroupedMovementList` sobrevive a la revalidación (demostrado por el test de 013 del diálogo de borrado).
- `MovementFormFields` rellena `defaultValue` solo desde `initialValues` (edición) o vacío (alta) — no hay mecanismo de «valores pegados» entre guardados.
- El wrapper embebido de 002 ya resolvió altas encadenadas con un `formKey` de remonte (eliminado en 013).

**Decisión**:

1. **Estado del diálogo**: `CreateMovementDialog` amplía su formulario interno con un **contador de tanda** `savedCount` y una **semilla de valores pegados** `carry: CarryOverValues` (`{ date: string; type; nature: ExpenseNature | null }`). En éxito: `setSavedCount(n+1)`, `setCarry({ date: state…último envío })`, `toast.success("Movimiento guardado")` **sin cerrar**; `MovementFormFields` recibe `carry` + `savedCount` y: remonta el `<form>` con `key={savedCount}` (formulario limpio: nota/importe/tagId vacíos), prefija `defaultValue` de fecha con `carry.date`, `chosenType` inicial con `carry.type` y naturaleza con `carry.nature` (cuando aplique al tipo), y hace `focus()` en el primer campo vacío (nota) tras el remonte (refs + `useEffect`).
2. **Guardar y cerrar**: `secondaryActions` pasa a tener **dos** botones: «Guardar y cerrar» (submit con `formAction` alternativo marcado — ver 3) y «Cancelar». La acción primaria «Guardar y seguir» envía el formulario con `name="intent" value="continue"`; «Guardar y cerrar» envía con `intent="close"`. Ambos son `type="submit"` sobre el mismo `<form>` (botones con `name`/`value` aportan el par al FormData); la Server Action lee `intent` y lo devuelve en el estado (`intent: "close" | "continue"`) para que el diálogo sepa si cerrar tras el éxito.
3. **Contrato de la action**: `CreateMovementState` success pasa a `{ status: "success"; message: string; intent: "close" | "continue" }`. La action lee `formData.get("intent")` (default `"close"` — comportamiento seguro para clientes que no lo envían, p. ej. tests antiguos… que se adaptan igualmente). El mensaje de éxito sigue siendo «Movimiento guardado»; el feedback discreto de tanda es el toast por guardado + el contador visible en el diálogo («Guardados: N» junto al título) — la forma exacta ya quedó discreta por la spec (asunción) y se congela en el ui-contract.
4. **Cancelación**: Cancelar/X/Escape cierra y descarta **solo la entrada en curso** (los guardados ya persistieron y la página ya se revalidó en cada guardado) — sin confirmación, igual que hoy.
5. **Errores**: `status: "error"` conserva valores y errores como hoy; el diálogo permanece abierto; corregir y guardar continúa la tanda (el `key` no cambia, no hay remonte).
6. **Naturaleza con lote alternante**: si `carry.type` es `income`, el formulario recién remontado no muestra naturaleza y la tag es opcional (regla por tipo actual del formulario, edge case de la spec). `carry.nature` solo se aplica si `carry.type === "expense"`.
7. **Solo alta es continua** (FR-006): `EditMovementDialog` mantiene cierre en éxito; `UpdateMovementState` no cambia su forma (solo el mensaje pierde la rama de cuenta, §3).
8. **Doble envío**: ambos botones `disabled={isPending}` («Guardando…»), igual que hoy.

**Rationale**: remontar por `key` tras éxito es el patrón que ya usaba el wrapper embebido de 002 para altas encadenadas — probado y sin estado sincronizado a medias; los valores pegados viajan como `defaultValue` del remonte (no controlado, como el resto del formulario). El par `intent` en botones es HTML estándar, sin JavaScript extra ni segunda action. El contador de tanda da el «feedback visible del guardado» exigido por FR-001 sin inventar un componente nuevo: texto discreto junto al título.

**Alternativas consideradas**:

- *Mantener el DOM y limpiar campos manualmente (`form.reset()` + `useEffect`)*: rechazada; mezcla estado controlado/no controlado, exige resincronizar `defaultChecked` de la nueva UI de tag y el foco, y duplica el mecanismo de remonte ya existente.
- *Dos Server Actions (createMovement vs createMovementAndClose)*: rechazada; duplica la action y su test surface por una diferencia de una línea (`intent`).
- *Mantener la tag pegada entre guardados*: rechazada por defecto (asunción de la spec: obliga a elegir conscientemente en cada gasto obligatorio); la fecha/tipo/naturaleza sí se pegan porque son estables en una tanda real.
- *Toast distinto por guardado («Movimiento 2 guardado»)*: rechazado; el contador del diálogo ya informa del progreso y el toast canónico «Movimiento guardado» es literal congelado de 002/013.

## §5. Migración de datos y adaptación del repositorio

**Estado actual (verificado)**:

- `drizzle/`: `0000_fuzzy_black_bolt.sql` (crea las 5 tablas), `0001_wide_vermin.sql` (`updated_at`); journal v7. Migraciones solo por script (`npm run db:migrate`), nunca en runtime (convención).
- e2e: `pretest:e2e` recrea `e2e.sqlite` (migrate + seed) — cada run parte de esquema migrado + catálogo, sin movimientos.
- Seed: solo members/accounts/tags (idempotente); «Sin Clasificar» sigue en el catálogo.
- Tests de repositorio: `createTestDb()` libsql `:memory:` + migraciones de `drizzle/`.

**Decisión**:

1. Nueva migración **`0002_*.sql`** (generada con drizzle-kit, journal actualizado) que: (a) `DROP TABLE movement_tags`, (b) recrea `movements` con `note text NOT NULL` y `tag_id integer NULL REFERENCES tags(id) ON DELETE RESTRICT` **sin** `concept`/`description` — SQLite no soporta `DROP COLUMN` en versiones antiguas de la toolchain y drizzle-kit genera el patrón estándar de tabla nueva + copia; **la copia se sustituye por un DELETE previo**: como la decisión del propietario es eliminar todos los movimientos de prueba, la migración hace `DELETE FROM movements` (cascada virtual de movement_tags, que se dropea igualmente) y crea la tabla vacía con el esquema nuevo. Cuentas, miembros y catálogo de tags quedan intactos (SC-003).
2. `DrizzleMovementRepository`: `create` simplifica a un INSERT de la fila (sin batch de tags; el `max(id)+1` manual se mantiene), `update` a un UPDATE (`tag_id` incluido en el row), `findById` y `selectMonthRows` reducen al `leftJoin` único contra `tags` por `movements.tag_id`; el mapper pierde la agrupación multi-fila (`mapJoinedRowsToMovementDTOs` pasa a 1 fila = 1 DTO con `tag: … | null`).
3. `pretest:e2e` no cambia (ya recrea la BD). Los tests de repositorio y dominio se adaptan a los nuevos invariantes.

**Rationale**: al no haber datos que preservar (clarificación 2026-10-01), recrear `movements` vacía es la migración mínima y honesta; `RESTRICT` conserva la integridad referencial y el invariante de gastos. Drizzle-kit genera y versiona el SQL (única vía de evolución del esquema, V).

**Alternativas consideradas**:

- *Migración con `ALTER TABLE … ADD COLUMN note/tag_id` + backfill de concept y primera tag + DROP COLUMN*: rechazada; no hay datos que migrar (decisión del propietario) y el backfill de «primera tag de N» sería arbitrario.
- *Mantener `movement_tags` con unique constraint*: rechazada (§2).
- *BD limpia a mano (borrar db.sqlite)*: rechazada; las migraciones versionadas son la única vía (V) y la prod (Turso) también necesita el camino 0002.

## §6. Pruebas: adaptación y cobertura nueva

**Estado actual (verificado)**: suite completa afectada — fixtures con `concept`/`description`/`tagIds: [..]` en dominio (Movement, cierres, resúmenes), aplicación (Create/Update/Delete, queries), repositorio (create/update con set de tags, cascada), actions (FormData con `concept`/`description`/`tagIds` múltiple), componentes (labels «Concepto», checkboxes de tags, Select de cuenta en edición) y 7 specs e2e (helpers rellenan «Concepto» + loop de checkboxes; E1 multi-tag; ediciones con cambio de cuenta).

**Decisión**:

1. **Dominio**: `Movement.test.ts` adapta fixture a `note` y regla de tag (gasto sin tag → error; ingreso sin tag → ok; ingreso con tag → ok). `MonthlyClosure/GlobalMonthlySummary/AnnualIncomeStatement.test.ts` sustituyen fixtures multi-tag por tag única; los assertions de desglose no cambian de aritmética (cada gasto ya computaba íntegro por tag).
2. **Aplicación**: tests de `resolveTagId` (sin default; tag inexistente/inactiva rechazada; gasto sin tag error de dominio vía `Movement.create`); `UpdateMovement` valida `expectedAccountId` (desajuste → error); desaparecen los tests de default «Sin Clasificar» y de mover de cuenta, sustituidos por los nuevos.
3. **Repositorio**: create/update con `tag_id` única; cascada → RESTRICT (borrar tag con movimientos falla); migración 0002 aplicada por `createTestDb()` (SC-003 se verifica implícitamente: la BD de test nace con el esquema nuevo; opcionalmente un test dedicado que migre un fixture del esquema 0001 y compruebe movimientos vacíos + catálogo intacto).
4. **Actions**: FormData con `note` y `tagId` única; `intent` en create (continue → estado con `intent: "continue"`; default sin intent → `close`); update sin rama de cuenta en el notice.
5. **Componentes**: `movement-form.test.tsx` (labels «Nota», radio de tag, sin bloque cuenta en alta ni Select en edición, error de tag en gasto); `create-movement-dialog.test.tsx` cubre la tanda (guardar → diálogo abierto, contador +1, nota/importe/tag vacíos, fecha/tipo/naturaleza pegados, foco en nota; «Guardar y cerrar» → guarda y cierra; error → valores conservados); `edit-movement-dialog.test.tsx` sin cuenta; `grouped-movement-list.test.tsx` renderiza `note` y tag única; paneles sin TAG_NOTE.
6. **e2e (FR-007, constitución III)**: helpers rellenan «Nota» y `getByRole("radio", { name })` para la tag; `registro-movimientos.spec.ts` pasa a ser la spec canónica de la **tanda continua** (N movimientos con una apertura; «Guardar y cerrar»; error por gasto sin tag con el diálogo abierto; ingreso sin tag ok) manteniendo su combinación cuenta/mes; el resto de specs adaptan helpers a un solo `radio` y a que el alta **continúa abierta** tras «Guardar y seguir» (los helpers usan «Guardar y cerrar» o cierran tras guardar). Las specs que registran varios movimientos pueden encadenarlos ya sin reabrir el diálogo — simplificación natural de los helpers, manteniendo una apertura por tanda (SC-001).
7. **Gates**: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` en verde (SC-004).

**Rationale**: la adaptación mantiene lo que cada test verifica (FR-007) y la cobertura nueva apunta a los riesgos propios de la feature: remonte con valores pegados, intent de cierre, tag obligatoria en gasto y migración destructiva.

**Alternativas consideradas**:

- *Spec e2e nueva para la tanda*: rechazada; `registro-movimientos` ya es la spec del flujo crítico de alta y absorbe la tanda sin nuevo fichero en la cola serial (mismo criterio que 013).
- *Mantener helpers con checkbox→radio genérico*: parcial; se simplifica a radio único pero se conserva el patrón por role/name (robusto).

## §7. Documentación viva y roadmap

**Verificado**: `docs/architecture/diagrams/domain-model.md` documenta `Movement` con `concept/description/tagIds` (relación N:M y «mínimo 1 tras default»); ADR 0011 menciona el movimiento «se mueve» de cuenta; `overview.md` y el diagrama de secuencia de registro reflejan el alta actual; fila 014 del maestro ya refleja la refundición (2026-10-01) y quedará «Completada» con sus enmiendas (FR-008).

**Decisión**: en la implementación (DoD): actualizar `domain-model.md` (nota única, relación 0..1, invariante tag por tipo, cuenta inmutable), el diagrama de secuencia de registro (tanda continua + intent), `overview.md` si menciona concepto/descripción o multi-tag, ADR 0011 (la edición ya no mueve de cuenta; nota del cambio) y **nuevo ADR** registrando la decisión de tag única como FK en `movements` (sustituye la N:M de 002) y la eliminación de movimientos en la migración. Fila 014 del maestro a «Completada» con las enmiendas de FR-008. `AGENTS.md` solo si la implementación fija convención nueva (p. ej. patrón de remonte por `key` en diálogos de captación continua) — candidato a documentar.

**Rationale**: DoD de la constitución (III) y regla de documentación en el mismo cambio; los diagramas de este plan son la base de la extensión.

**Alternativas consideradas**: ninguna razonable; docs desfasadas violan la DoD.

## Resumen de decisiones

| Tema | Decisión | Alternativa rechazada |
|------|----------|----------------------|
| §1 Nota única | Renombrado sustantivo a `note` en dominio/DTOs/schema/UI; sin columnas legacy | Mantener `concept` interno; `description` legada; nota opcional |
| §2 Tag única | `tagId: TagId \| null` en dominio (obligatoria en gastos), `resolveTagId` sin default, FK `tag_id` en `movements` (RESTRICT) y DROP de `movement_tags`; RadioGroup simple con «Sin etiqueta» solo en ingresos; TAG_NOTE fuera | Junction con unique; tag obligatoria también en ingresos; select nativo |
| §3 Sin campo cuenta | Hidden `accountId` en alta (sin bloque informativo); edición sin Select con `expectedAccountId` validado en `UpdateMovement`; notice sin rama de cuenta; cuenta inmutable | `accountId` editable-validado; sin validación en edición |
| §4 Captación continua | Diálogo abierto en éxito: remonte por `key={savedCount}`, `carry` (fecha/tipo/naturaleza), foco en nota, contador «Guardados: N», botones «Guardar y seguir»/«Guardar y cerrar» vía `intent` en el FormData; action devuelve `intent`; solo alta es continua | `form.reset()` manual; dos actions; tag pegada; toasts numerados |
| §5 Migración | `0002_*`: DELETE movimientos + recrear tabla con `note` + `tag_id` FK RESTRICT + DROP `movement_tags`; catálogo intacto | Backfill arbitrario; BD a mano |
| §6 Pruebas | Adaptar fixtures/selectores a nota/tag única (dominio→e2e) manteniendo lo verificado; cobertura nueva de tanda, tag obligatoria, `intent` y migración; `registro-movimientos` como spec canónica de la tanda | Spec e2e nueva; selectores posicionales |
| §7 Documentación | domain-model/sequence/overview/ADR 0011 actualizados + ADR nuevo (FK tag única + migración destructiva); fila 014 «Completada»; convención de remonte a AGENTS.md si se fija | Docs desfasadas |
