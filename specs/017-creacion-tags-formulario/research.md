# Research: Creación de etiquetas desde el formulario de movimiento

**Feature**: 017-creacion-tags-formulario | **Fecha**: 2026-10-04

Feature de creación inline de etiquetas junto al Select «Etiqueta» de los formularios de alta y edición de movimiento (patrón «+ Nueva etiqueta»), reducción de la fila 004 decidida por el propietario. Este research fija el estado verificado en código, resuelve los puntos que la spec deja al plan (action propia vs envío del movimiento, derivación de slug y colisiones, comportamiento del cambio de tipo con la captación abierta) y descarta alternativas. Sin cambios de modelo del movimiento, sin migración y sin tocar el catálogo del seed.

## §1. Mecanismo de creación: action propia vs parte del envío del movimiento

**Estado actual (verificado)**: no existe ninguna vía de creación de tags — `TagRepository` es solo-lectura (`findAllActive`, `findByIds`, `findBySlug`; `src/application/tag/TagRepository.ts`), `DrizzleTagRepository` no tiene insert, no hay use case de escritura ni action de tags (`src/infrastructure/primary/actions/` solo tiene las tres de movimientos + schema). El catálogo se puebla exclusivamente en `scripts/seed.ts` (insert directo Drizzle, `onConflictDoNothing` por slug).

**Decisión**: **Server Action propia `createTag(name)` + caso de uso `CreateTag`**. La creación es inmediata al confirmar la captación inline, independiente del envío del movimiento.

**Rationale**: tres exigencias de la spec fuerzan la independencia: (1) FR-004 — al confirmar, la etiqueta queda persistida **y seleccionada** mientras el movimiento aún no se envía; (2) edge «etiqueta creada y movimiento cancelado» — la etiqueta creada permanece aunque el movimiento se cancele o el diálogo se cierre a mitad de tanda; (3) FR-005 — una etiqueta creada a mitad de tanda sigue disponible en las capturas siguientes sin pasar por ningún guardado de movimiento. Una creación en el envío del movimiento no puede cumplir ninguna de las tres: la selección previa exigiría inventar un identificador temporal de tag «pendiente» en el FormData y materializarlo en `createMovement`/`updateMovement`, mezclando dos casos de uso y dos errores distintos en una action.

**Alternativas consideradas**:

- *Crear la tag dentro de `createMovement`/`updateMovement` (p. ej. campo `newTagName`)*: rechazada; viola FR-004 (persistencia y selección previas al envío) y complica el contrato de las actions existentes con una rama alternativa (`tagId` XOR `newTagName`) y doble validación; además la tag no quedaría disponible en la captura siguiente sin haber guardado movimiento.
- *Route Handler REST (`POST /api/tags`)*: rechazada; el proyecto usa Server Actions como adaptador inbound (ADR 0008) y no hay ningún consumidor externo; añadir una vía HTTP nueva duplica frontera y validación sin caso de uso.
- *Optimistic UI (crear la tag solo en cliente y persistir con el movimiento)*: rechazada; el edge «etiqueta creada y movimiento cancelado» exige persistencia real inmediata, y un id temporal rompería la FK real de `movements.tag_id`.

## §2. Duplicados ignorando mayúsculas: dónde vive la regla

**Estado actual (verificado)**: la unicidad de nombre existe solo como índice de BD `tags_name_nocase_uq ON lower(name)` (`drizzle/0000_fuzzy_black_bolt.sql:46`, definido en `src/infrastructure/db/schema/tags.ts` vía `uniqueIndex(...).on(sql`lower(${table.name})`)`). `DuplicateTagNameError` está **definido desde 002 pero nunca lanzado** (solo aparece en su definición y docs). El test de repositorio `DrizzleRepositories.test.ts:204-208` ya verifica que insertar «LUZ» existiendo «Luz» rechaza por el constraint. Semántica verificada del índice: SQLite `lower()` es ASCII-only → «Luz»/«LUZ» duplicado; «Alimentación»/«Alimentacion» **no** colisionan (coincide con el edge de acentos de la spec).

**Decisión**:

1. Nuevo método de puerto **`TagRepository.findByName(name: string): Promise<Tag | null>`** — `WHERE lower(name) = lower(?)` en Drizzle (espejo exacto del índice, mismo `lower` ASCII de SQLite). **Ignora el estado**: una «LUZ» inactiva bloquea crear «luz» (edge de la spec: la unicidad por nombre ignora el estado).
2. `CreateTag` comprueba `findByName(trimmedName)` antes de crear; si existe → lanza **`DuplicateTagNameError(name)`** (mensaje ya definido: `Ya existe una etiqueta con el nombre "…".`) — el error pasa por fin a usarse, sin cambios en su forma.
3. La action mapea `DuplicateTagNameError` → error de nombre con el mensaje exacto del error de dominio; el nombre tecleado permanece en el campo (editable para corregir, FR-003).
4. El índice de BD queda como **red de seguridad ante carrera** (dos creaciones simultáneas del mismo nombre entre check e insert): `save` captura el error de constraint de unicidad de nombre y lo traduce igualmente a `DuplicateTagNameError`. Con 1 usuario es casi imposible, pero la frontera queda honesta sin coste.

**Rationale**: la regla visible al usuario debe ser la misma que la de BD (espejo), y el mensaje debe salir del dominio (constitución VII: negocio en dominio, no en el adaptador). Reutilizar el error existente evita literales divergentes.

**Alternativas consideradas**:

- *Validar duplicado solo en cliente (comparando contra la lista de tags del prop)*: rechazada; duplica la semántica del índice en la UI (prohibido, VII), no cubre tags inactivas (el prop solo lleva activas) ni carreras, y la lista prop puede estar desfasada tras refrescos parciales.
- *Confiar solo en el constraint de BD y traducir el error crudo*: rechazada; el error de constraint no distingue nombre vs slug y su mensaje no es presentable; además la acción del dominio debe expresar la regla (`DuplicateTagNameError`) para que el caso de uso sea testeable sin BD.
- *`COLLATE NOCASE` en columna / normalizar acentos en la unicidad*: rechazada; cambiaría la semántica vigente del catálogo (la spec fija que «Alimentación»/«Alimentacion» no son duplicados) y exigiría migración de esquema para un requisito que ya cumple el índice existente.

## §3. Derivación del slug y resolución de colisiones

**Estado actual (verificado)**: no existe ninguna función de derivación de slug en `src/` (grep sin resultados); los slugs nacen hardcodeados en `seed-data.ts` con una convención manual: minúsculas **sin acentos** («Alimentación» → `alimentacion`), espacios → guion («Suscripciones online» → `suscripciones-online`). `Tag.create` exige slug no vacío; la columna `slug` es `unique` (case-sensitive, exacto).

**Decisión**:

1. **Función pura de dominio `deriveTagSlug(name: string): string`** (`src/domain/tag/TagSlug.ts`): `name.trim().toLowerCase()` → **NFD + strip de diacríticos** (`str.normalize("NFD").replace(/\p{Diacritic}/gu, "")`, Unicode-aware pero determinista y sin deps) → todo carácter **no alfanumérico** (Unicode) se sustituye por guion, runs de guiones colapsan a uno, guiones de borde se recortan. Ejemplos: «Mascotas» → `mascotas`; «Suscripciones online» → `suscripciones-online`; «Alimentación» → `alimentacion`; «Café y té» → `cafe-y-te`.
2. **Colisiones en el caso de uso**, no en el dominio: si `deriveTagSlug(name)` existe (`findBySlug`), se prueba `{slug}-2`, `{slug}-3`, … hasta hueco (bucle con tope razonable). El caso real es «Alimentación» (nombre) vs «Alimentacion» (existente): nombres distintos para la unicidad, slugs `alimentacion` y `alimentacion-2` — sin fricción ni decisión del usuario (edge de la spec). La función de dominio se mantiene pura y sin noción de persistencia; la resolución contra el catálogo real es orquestación (aplicación).
3. El slug es siempre interno: nunca se pide ni se muestra; el usuario solo ve el nombre.

**Rationale**: la convención del seed pasa de implícita a explícita y testeada; la normalización NFD+diacríticos reproduce «sin acentos» para alfabetos latinos de forma estándar. Mantener la derivación en el dominio permite testearla como tabla de casos pura; la resolución de colisión necesita el puerto, así que vive en `CreateTag`.

**Alternativas consideradas**:

- *Slug = id autoincrement (sin derivación)*: rechazado; rompe la convención legible del catálogo y el contrato implícito del seed (URLs/nombres de archivo futuros, depuración); el coste de derivar es una función pura.
- *Derivar en la action o en el repositorio*: rechazado; es regla de negocio del catálogo (dominio, VII), no de frontera ni de persistencia; en la action se duplicaría en cuanto hubiera una segunda vía de creación (futura 004).
- *Slug con timestamp/sufijo aleatorio*: rechazado; no determinista ni legible, y la colisión es rarísima (catálogo doméstico, ~12 tags).
- *Rechazar el alta ante colisión de slug*: rechazada; la spec exige resolución «sin fricción ni decisiones del usuario».

## §4. Captación inline junto al Select (UI)

**Estado actual (verificado)**: `MovementFormFields` (`src/infrastructure/primary/ui/movement-form.tsx`) renderiza el Select shadcn controlado (`value`/`onValueChange` + `input hidden name="tagId"`, L284-311), con items `String(tag.id)` y opción «Sin etiqueta» solo con Ingreso (`NO_TAG_VALUE="__no_tag__"` → hidden `""`). El resto del formulario es no controlado (`defaultValue`) salvo tipo/naturaleza/tag en estado local. Los diálogos (`create-movement-dialog.tsx`, `edit-movement-dialog.tsx`) montan `MovementFormFields`; el de alta remonta el formulario completo con `key={savedCount}` tras cada «Guardar y seguir» (patrón 014, AGENTS.md). Ambos diálogos reciben `tags` como prop desde `GroupedMovementList` (server → client props).

**Decisión**:

1. **Acceso «+ Nueva etiqueta»**: botón tipo link/texto junto al Label «Etiqueta» (visible tanto en alta como en edición, FR-001/FR-006). Al pulsarlo se muestra **la captación inline bajo el Select**: un `Input` de nombre + botones «Crear» y «Cancelar» dentro del mismo bloque. El Select queda sustituido visualmente por la captación (estado local `creatingTag: boolean` en `MovementFormFields`); cancelar restaura el Select **exactamente como estaba** (selección previa incluida, escenario 3).
2. **Sin form anidado ni useActionState**: los `<form>` anidados son HTML inválido y el formulario padre perdería el envío. La captación llama a la action directamente (`await createTag(name)` dentro de un `useTransition`) — el nombre ya vive en estado local (`newTagName`), no hay nada que repoblar desde un estado de action; el botón «Crear» es `type="button"` y el Input intercepta Enter (`onKeyDown` → prevenir default y crear) para no enviar el formulario del movimiento. **Excepción al patrón «toda action con useActionState»**: aquí el estado vive en el propio componente y la action devuelve un **resultado** (no un estado de formulario); es la misma forma que una consulta, no un envío.
3. **Estados de la captación**: en curso (`isPending` de la transition → «Crear» muestra «Creando…» y «Cancelar» deshabilitado — doble envío imposible, edge); error de nombre vacío (Zod/action → mensaje bajo el input, nombre conservado, escenario 6); error de duplicado (mensaje de `DuplicateTagNameError`, nombre conservado, escenario 2); éxito → toast «Etiqueta creada», captación colapsada, **`selectedTagId = nueva id`** (queda seleccionada en el Select), foco devuelto al Select; el resto de campos del movimiento no se toca (el estado local de tipo/naturaleza y los `defaultValue` nunca se alteran — SC-002/SC-003).
4. **Comunicación al diálogo**: `MovementFormFields` gana prop **`onTagCreated?: (tag: TagDTO) => void`**; los diálogos la usan para añadir la tag a su estado **`extraTags`** (merge con el prop `tags`, ordenado por nombre igual que `ListActiveTags`). En la tanda, `extraTags` vive en `CreateMovementDialog` (padre del remonte `key={savedCount}`) → sobrevive a cada guardado y la tag sigue disponible en las capturas siguientes (FR-005, SC-004) aunque las props del servidor aún no hayan refrescado. En edición, igual en `EditMovementDialog`.
5. **Cambio Gasto↔Ingreso con la captación abierta** (edge): el cambio de tipo es estado local del formulario y no desmonta el bloque Etiqueta; la captación **continúa abierta e íntegra** (campos del movimiento intactos). El requisito de etiqueta se evalúa al enviar según el tipo vigente; en ingresos la etiqueta recién creada es una selección válida como cualquier otra (y «Sin etiqueta» sigue disponible).
6. **Botón deshabilitado durante el guardado del movimiento** (`isPending` de la action del movimiento): la captación inline también se deshabilita mientras el movimiento se está guardando (mismo patrón anti doble envío).

**Rationale**: la captación inline (sin diálogo anidado ni navigate) cumple FR-001 literalmente («dentro del propio formulario, sin cerrar ni navegar») y es la interacción de menor fricción; reutiliza Input/Button shadcn existentes. `extraTags` en el padre del remonte replica el patrón de estado de 014 (`savedCount`/`carry` viven en el diálogo, no en el formulario remontado).

**Alternativas consideradas**:

- *Diálogo anidado para crear la tag*: rechazado; Radix lo permite pero añade foco-trap anidado, profundidad visual y complejidad de restauración; la spec pide la captación «junto al selector».
- *Combobox editable con «crear "X"» dentro del propio Select (patrón Command)*: rechazado; exige traer el componente Command de shadcn (dependencia nueva de componentes sin justificar, constitución UI) y rehace la interacción del Select validada por 014 y 6 specs e2e; el botón «+ Nueva etiqueta» es más explícito y accesible.
- *useActionState para la captación con `<form>` hermano*: rechazado; el form hermano rompe la semántica de submit (Enter en el nombre podría enviar el del movimiento) y `useActionState` exige estado repoblable que aquí no hace falta (el nombre no se pierde nunca).

## §5. Disponibilidad inmediata: extraTags + revalidación

**Estado actual (verificado)**: `page.tsx` carga `ListActiveTags` una vez por render de página; los refrescos del cliente dependen de `revalidatePath` en las actions de movimientos (`revalidatePath("/")` + `revalidatePath("/accounts/[accountId]", "page")`). Tras guardar un movimiento, el diálogo abierto sobrevive (client) y la página se refresca bajo él.

**Decisión**:

1. `extraTags` (research §4.4) garantiza disponibilidad **inmediata** en el diálogo actual y en toda la tanda, sin depender del timing del refresco del servidor.
2. `createTag.action` ejecuta **`revalidatePath("/", "layout")`** al crear con éxito: invalida el layout completo, de modo que la siguiente navegación/render RSC de cualquier página del árbol vuelve a pedir `ListActiveTags`. Así, cerrar y reabrir el diálogo (o navegar a otra cuenta) con la app ya montada muestra la tag nueva sin recarga completa (SC-004: «aperturas futuras de los formularios de alta y edición»).
3. Los desgloses no se tocan (asunción de la spec): la tag nueva solo computa cuando se usa en movimientos; no hay filas nuevas en cierres por el mero hecho de existir.

**Rationale**: `revalidatePath` sin pathname concreto no es adecuado para una action compartida por múltiples páginas; invalidar el layout es el mecanismo estándar de App Router para «datos de layout/página pueden haber cambiado». El coste es irrelevante (1 usuario, 3 cuentas, catálogo de ~12 tags). El nombre de la tag se persiste y devuelve como `TagDTO`, así que `extraTags` y la revalidación convergen en el mismo dato.

**Alternativas consideradas**:

- *`router.refresh()` desde el cliente tras crear*: rechazado; duplica mecanismo con la revalidación del servidor y acopla la UI al enrutador cuando la action puede invalidar por sí sola.
- *No revalidar nada y fiarlo todo a `extraTags`*: rechazada; al cerrar/reabrir el diálogo (nuevo mount con props del servidor) la tag desaparecería si la RSC en caché no se ha invalidado — rompe SC-004 («aperturas futuras»).
- *Revalidar solo `/accounts/[accountId]`*: insuficiente; la action no conoce la cuenta origen (la creación de tags es global al catálogo) y no hay FormData con contexto.

## §6. Pruebas: cobertura por capa y aislamiento e2e

**Estado actual (verificado)**: suites existentes relevantes — `DrizzleRepositories.test.ts` (índice lower(name)), actions de movimientos mockeando repos con `vi.mock`/`vi.hoisted`, componentes de formulario/diálogos con la tanda completa de 014, 7 specs e2e con combinaciones cuenta/mes exclusivas por fichero y `workers: 1` (orden alfabético sobre `e2e.sqlite` compartida).

**Decisión**:

1. **Dominio**: `TagSlug.test.ts` — tabla de casos: los 12 slugs del seed reproducidos desde sus nombres (verifica la convención), acentos, espacios múltiples, guiones de borde, mayúsculas, solo símbolos (→ vacío → el caso de uso lo tratará: si la derivación da vacío —p. ej. nombre «---»— `Tag.create` lanza `InvalidTagError`, mensaje existente «El slug de la etiqueta es obligatorio.» que la action mapea al campo de nombre).
2. **Aplicación**: `CreateTag.test.ts` con puerto falso en memoria — éxito (activa por defecto, nombre trimeado, slug derivado), duplicado exacto y case-insensitive («LUZ» vs «Luz» existente → `DuplicateTagNameError`), duplicado de inactiva (también bloquea), colisión de slug («Alimentación» con «Alimentacion» → `alimentacion-2`), segunda colisión (`-3`), nombre vacío/solo espacios → `InvalidTagError`.
3. **Repositorio**: `findByName` case-insensitive y con acentos no colisionando (espejo del índice, contra libsql `:memory:` con migraciones); `save` persiste y devuelve `Tag` con id; constraint de nombre→`DuplicateTagNameError` (traducción de la carrera).
4. **Action**: `create-tag.action.test.ts` — nombre vacío (Zod), éxito (mock del use case → tag devuelta, `revalidatePath` llamada), `DuplicateTagNameError` mapeado a mensaje de nombre.
5. **Componentes**: `movement-form.test.tsx` — abrir «+ Nueva etiqueta», cancelar restaura, crear con éxito selecciona la nueva y llama `onTagCreated`, error de duplicado conserva nombre, Enter no envía el form del movimiento, disabled durante la creación; `create-movement-dialog.test.tsx` — tag creada en 2.ª captura disponible en la 3.ª tras el remonte; `edit-movement-dialog.test.tsx` — crear tag en edición, guardar con ella y cerrar.
6. **e2e nueva `creacion-tags.spec.ts`** (FR-009, constitución III): flujo crítico completo — tanda en la que la 2.ª captura crea su etiqueta en línea («Mascotas»), guarda con ella, la 3.ª captura la reutiliza del Select; duplicado case-insensitive rechazado con datos intactos; cancelación de la captación; creación en el diálogo de edición. **Combinación: Cuenta de Miembro B + mayo 2026**, verificada frente a las specs existentes y su orden alfabético efectivo (`creacion-tags` corre tras `cierre-mensual` y antes de `cuenta-resultados-anual`): ninguna usa mayo 2026; las posteriores asientan movimientos de Miembro B solo en agosto 2026 (`edicion-movimientos`), 2027-01/07 (`cuenta-resultados-anual`) y 2026-04 (`pagina-cuenta`, que además asienta balance heredado desde abril — mayo 2026 es posterior a abril pero ninguna spec de las que corren después asienta mayo, y `pagina-cuenta` P3 solo aserta marzo vacío y abril visible; los balances de `pagina-cuenta` son mensuales del mes visible, no históricos absolutos de fechas intermedias). Los asserts de la spec nueva son del mes propio (listado/cierre de mayo) y del estado del diálogo.
7. **Gates**: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` en verde (SC-005).

**Rationale**: cada capa cubre su riesgo (derivación, unicidad, colisión, conservación de datos, remonte de tanda); la e2e valida el flujo crítico de la feature de punta a punta con el aislamiento que exige la convención del proyecto.

**Alternativas consideradas**:

- *Absorber la e2e en `registro-movimientos.spec.ts`*: rechazada; esa spec opera en Cuenta común/Miembro A con mes actual real (variable) y asienta balance acumulado — añadir la creación de tags ahí contamina su combinación; la feature merece fichero propio con combinación fija elegida, como hicieron 005/006/009.
- *Testear la action contra BD real*: se mantiene el patrón vigente de mocks (`vi.mock` de repos), más los tests de repositorio contra libsql `:memory:` (cobertura de la SQL real sin duplicar).

## §7. Documentación viva y roadmap

**Verificado**: `docs/architecture/overview.md` menciona `DuplicateTagNameError` (como error del dominio), `domain-model.md` documenta el catálogo `Tag` sin vía de creación; el diagrama de secuencia de registro no involucra creación de tags; el roadmap maestro aún tiene `004-gestion-tags` «Futura» con alcance completo.

**Decisión** (en la implementación, DoD): **ADR 0015** («Creación de etiquetas inline con action propia») registrando: action propia frente a creación en el envío, derivación de slug en dominio + resolución de colisiones en aplicación, `findByName` espejo del índice, `extraTags` + `revalidatePath("/", "layout")`. Actualizar `overview.md` (vía de creación de tags existente), `domain-model.md` (`deriveTagSlug`, métodos de puerto) y el diagrama de secuencia de registro (paso opcional de creación inline). Roadmap maestro (FR-008): fila `017-creacion-tags-formulario` «Completada» y reducción de `004-gestion-tags` a mantenimiento de catálogo (renombrar, fusionar, desactivar) con nota de la decisión del 2026-10-04. `AGENTS.md` solo si la implementación fija convención nueva (candidata: patrón de captación inline con action directa + estado `extraTags`).

**Rationale**: DoD de la constitución (III) y regla de documentación en el mismo cambio; los diagramas de este plan son la base de la extensión.

**Alternativas consideradas**: ninguna razonable; docs desfasadas violan la DoD.

## Resumen de decisiones

| Tema | Decisión | Alternativa rechazada |
|------|----------|----------------------|
| §1 Mecanismo | Server Action propia `createTag` + use case `CreateTag`; creación inmediata, independiente del envío | Crear en `createMovement`; REST; optimistic UI |
| §2 Duplicados | `findByName` espejo de `lower(name)` (ASCII, ignora estado) + `DuplicateTagNameError` (por fin lanzado); índice BD como red de seguridad ante carreras | Solo cliente; solo constraint crudo; COLLATE/acentos en unicidad |
| §3 Slug | `deriveTagSlug` pura en dominio (minúsculas, NFD sin diacríticos, no-alfanum → guion); colisiones `-2/-3…` en `CreateTag` vía `findBySlug` | Slug = id; derivar en action/repositorio; sufijo aleatorio; rechazar |
| §4 UI | Captación inline bajo el Select («+ Nueva etiqueta»): Input + Crear/Cancelar, action directa con `useTransition`, Enter interceptado, sin form anidado; éxito → seleccionada + `onTagCreated(tag)`; error → nombre conservado; captación continúa al cambiar Gasto↔Ingreso | Diálogo anidado; combobox Command; useActionState con form hermano |
| §5 Disponibilidad | `extraTags` en los diálogos (sobrevive al remonte de la tanda) + `revalidatePath("/", "layout")` en la action | `router.refresh()`; solo extraTags; revalidar solo la página de cuenta |
| §6 Pruebas | Nueva por capa (slug, duplicados, colisión, conservación, tanda, edición) + e2e nueva `creacion-tags.spec.ts` (Miembro B, mayo 2026 — combinación verificada) | Absorber en `registro-movimientos`; action contra BD real |
| §7 Documentación | ADR 0015 + overview/domain-model/secuencia actualizados + fila 017 «Completada» y 004 reducida en el maestro | Docs desfasadas |
