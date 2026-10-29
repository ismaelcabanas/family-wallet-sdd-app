# Research: Gestión de cuentas y miembros — renombrado y nombre derivado

**Feature**: 008-gestion-cuentas-miembros | **Fecha**: 2026-10-29

Feature de gestión del catálogo: renombrar miembros (con nombre de cuenta personal **derivado** «Cuenta de {miembro}») y renombrar la cuenta común, desde el panel de cuentas (`/`). Este research fija el estado verificado en código, resuelve los puntos que la spec deja al plan (estrategia de esquema/lectura para el nombre derivado, unicidad ignorando mayúsculas, superficie ⋮ de cada tarjeta, notas materializadas, seed idempotente) y descarta alternativas. Sin altas, borrados ni cambios de tipo/atribución (FR-005).

## §1. Estrategia de esquema para el nombre derivado: `accounts.name` nullable + NULL en personales

**Estado actual (verificado)**: `accounts.name` es `text NOT NULL UNIQUE` (`drizzle/0000_fuzzy_black_bolt.sql`, `src/infrastructure/db/schema/accounts.ts`); almacena el nombre de TODAS las cuentas («Cuenta de Miembro A/B», «Cuenta común» — `seed-data.ts`). Consumidores del nombre almacenado (grep verificado): `DrizzleAccountRepository.findAll` → `AccountDTO.name` → panel (tarjeta), página de cuenta (`<h1>`, props `accountName` de listado/balance). `findById` devuelve la entidad pero ningún consumidor usa `Account.name` (las configs 018/019/023 y los materializadores usan `memberName` del DTO o ids).

**Decisión**: migración única (siguiente secuencial, `0007_*`):

1. **`accounts.name` pasa a nullable** y las filas `type = 'personal'` quedan a `NULL` en la misma migración (recreación de tabla estilo drizzle-kit: `__new_accounts` + `INSERT … SELECT id, CASE WHEN type = 'personal' THEN NULL ELSE name END, …`; el cambio de nullabilidad obliga a recrear, igual que hizo `0002` con `movements`).
2. Se sustituye `accounts_name_unique` por **`uniqueIndex("accounts_name_nocase_uq").on(sql`lower(${table.name})`)`** — espejo exacto de `tags_name_nocase_uq` (`schema/tags.ts`, 004). Los `NULL` de las personales nunca colisionan (SQLite trata cada NULL como distinto en índices únicos).
3. **`members`**: `name` sigue `NOT NULL`, pero `members_name_unique` pasa a **`members_name_nocase_uq` sobre `lower(name)`** (cambio de índices, sin recreación de tabla).

**Rationale**: (a) el nombre de una cuenta personal **no existe** como dato — solo se deriva (FR-004), así que no debe ocupar una columna con valor; (b) con NULL en personales, renombrar un miembro **no escribe nada** en `accounts` (FR-004: «sin operación ni escritura adicional») y la colisión visual aceptada por la spec (común renombrada a «Cuenta de Isma») no choca con ningún dato: no hay UNIQUE que violar; (c) el índice `lower(name)` da unicidad ignorando mayúsculas **en la propia BD** (FR-001/FR-002), no solo en la app.

**Alternativas consideradas**:

- *Mantener `NOT NULL UNIQUE` y derivar solo en lectura (sin migración)*: rechazada; los nombres almacenados de las personales («Cuenta de Miembro A») seguirían ocupando el espacio UNIQUE y **bloquearían** renombrar la común a un derivado («Cuenta de Isma») que la spec acepta explícitamente (edge «Colisión visual del derivado»); además la unicidad case-insensitive seguiría sin garantía en BD.
- *Escribir el derivado en `accounts.name` al renombrar el miembro*: rechazada; introduce escritura en cascada que FR-004 prohíbe («sin operación ni escritura adicional sobre la cuenta»), reabre la colisión UNIQUE y convierte el derivado en dato duplicado que puede desincronizarse.
- *Columna nueva `display_name` calculada + trigger*: rechazada; complejidad extra (trigger = lógica de negocio en BD, invisible para el dominio) sin consumidor que la exija (YAGNI, I).
- *Unicidad solo a nivel de aplicación (sin índice nocase)*: rechazada; pierde el backstop de BD ante la carrera check-then-update (el patrón tags resolvió exactamente esto con el índice `lower(name)`).

## §2. Unicidad ignorando mayúsculas: patrón tags (004) replicado

**Estado actual (verificado)**: `RenameTag` (`src/application/tag/RenameTag.ts`) hace `findById` → `tag.rename(name)` → `findByName(renamed.name)` (case-insensitive: `sql`lower(${tags.name}) = lower(${name})``) → si existe con otro id, `DuplicateTagNameError` → `update`. `DrizzleTagRepository.update/save` envuelven la escritura y traducen la violación del índice (`message.includes("tags_name_nocase_uq")`) a `DuplicateTagNameError` — la carrera final la responde la BD.

**Decisión**: espejo completo para miembros y cuentas:

- Puertos nuevos: `MemberRepository` gana `findById(id): Promise<Member | null>`, `findByName(name): Promise<Member | null>` (nocase) y `update(member: Member): Promise<Member>`; `AccountRepository` gana `findByName(name): Promise<Account | null>` (nocase; las personales tienen `name = NULL` y nunca matchean) y `update(account: Account): Promise<Account>`.
- Use cases `RenameMember` y `RenameAccount` con el flujo exacto de `RenameTag` (find → rename → duplicate-check → update), lanzando `MemberNotFoundError` (nuevo) / `AccountNotFoundError` (existente) si el id no existe.
- `DrizzleMemberRepository.update` y `DrizzleAccountRepository.update` traducen la violación de su índice nocase a `DuplicateMemberNameError` / `DuplicateAccountNameError` (nuevos), igual que `translateUniqueViolation` de tags.

**Rationale**: es el patrón ya probado del repo para exactamente este requisito (paridad pedida por la spec: «Paridad con la regla de duplicados de tags del maestro»); reutiliza la semántica de índice + check + backstop sin inventar una segunda vía.

**Alternativas consideradas**: *comparar en memoria con `findAll()`* (2-3 filas): viable pero pierde el ejemplo canónico de puerto `findByName` y deja la carrera sin backstop diferenciado; *slug normalizado como en tags*: los tags tienen slug por su integración con el selector; miembros/cuentas no necesitan slug (YAGNI).

## §3. Dominio: `Member.rename`, `Account.rename` y el nombre nullable

**Estado actual (verificado)**: `Member` y `Account` son entidades inmutables (`Object.freeze`) con `create` (valida trim no vacío; `Account` además type↔memberId) y `rehydrate`; no existe `rename` ni errores de duplicado (`MemberErrors` solo tiene `InvalidMemberError`; `AccountErrors` tiene `InvalidAccountError` y `AccountNotFoundError`). `Movement` ya fijó el patrón de «edición por reconstrucción validada» (`Movement.recreate`, ADR 0011): un método de entidad que revalida y devuelve una nueva instancia congelada.

**Decisión**:

- `Member.rename(name): Member` — trima y valida no vacío (`InvalidMemberError` «El nombre del miembro es obligatorio.»); devuelve nueva instancia con mismo `id`.
- `Account.name` pasa a `string | null` con invariante reforzada: `personal ⇒ name === null`, `shared ⇒ name` trimado no vacío. `AccountInput.name: string | null`; `rehydrate` acepta `name: string | null`.
- `Account.rename(name): Account` — **solo cuentas comunes**: si `type === "personal"` lanza el error nuevo `AccountNotRenamableError` («Las cuentas personales no se renombran: su nombre se deduce del miembro.»); valida trim no vacío (`InvalidAccountError` «El nombre de la cuenta es obligatorio.»); devuelve nueva instancia con mismo `id`/`type`/`memberId`.
- Errores nuevos: `DuplicateMemberNameError` (`` `Ya existe un miembro con el nombre "${name}".` ``) y `DuplicateAccountNameError` (`` `Ya existe una cuenta con el nombre "${name}".` ``), espejo del literal de `DuplicateTagNameError`; `MemberNotFoundError` («El miembro seleccionado no existe.»).

**Rationale**: el renombrado es negocio del dominio (validación + invariante type↔nombre), y el patrón `rename()` que devuelve instancia nueva es el establecido (`Tag.rename`, ADR 0011); prohibir el renombrado de personales **en la entidad** asegura que ninguna capa superior pueda esquivar FR-004.

**Alternativas consideradas**: *validar solo en el use case*: rechazada; la invariante «personal no tiene nombre propio» es del modelo, no del caso de uso (VII); *VO `MemberName`*: no aporta — no hay reglas más allá de trim+no-vacío y la unicidad vive en el puerto (YAGNI, igual que en `Tag`).

## §4. Nombre mostrado: derivación en lectura, DTO único para todas las vistas

**Estado actual (verificado)**: `AccountDTO` (`src/application/movement/dto.ts`) alimenta panel, página de cuenta, `GetGlobalMonthlySummary` y `GetAnnualIncomeStatement`; los desgloses por miembro usan `memberName` (join en `findAll` / `MemberRepository.findAll`). El subtítulo de tarjeta (`accountCardLabel`) ya pinta «Cuenta personal de {miembro}» desde `memberName`.

**Decisión**:

- Función pura en aplicación (`src/application/account/display-name.ts`): `personalAccountDisplayName(memberName: string | null): string` → `` `Cuenta de ${memberName ?? "miembro"}` `` (fallback «miembro», paridad con los fallbacks existentes de notas/etiquetas). La aplica `DrizzleAccountRepository.findAll` al mapear el DTO: `name = type === "shared" ? storedName : personalAccountDisplayName(memberName)`.
- **`AccountDTO.name` pasa a significar «nombre mostrado»** en todos los consumidores: la común muestra su nombre almacenado; las personales muestran el derivado. **Cero cambios** en panel, página de cuenta, listado, balance, resumen y anual: ya leen `account.name` / `memberName` del DTO, y con el seed («Miembro A/B») el derivado «Cuenta de Miembro A» es literalmente el valor que hoy muestran — sin regresión visual.
- Los desgloses por miembro (`/summary`, `/annual`) ya usan `memberName` vigente: renombrar el miembro los actualiza en la siguiente lectura sin tocar nada (SC-002).
- La barra de subtítulo de la tarjeta («Cuenta personal de {miembro}») se mantiene: es la **etiqueta de tipo**, no el nombre.

**Rationale**: una sola fuente de derivación (la lectura), sin escrituras en cascada ni lógica duplicada en UI (VII: «PROHIBIDO duplicar lógica de negocio en componentes» — la UI jamás concatena «Cuenta de»). Vistas derivadas por construcción (espejo del balance derivado, ADR 0009).

**Alternativas consideradas**: *derivar en cada componente UI*: rechazada; duplica negocio en la UI y se desincroniza; *derivar en el dominio (`Account.displayName(memberName)`)*: viable pero obliga a cargar el nombre del miembro junto a la entidad cuando el DTO ya trae el join; la función pura de aplicación cubre el único punto real de composición (el mapper del repositorio) y es testeable sin dobles.

## §5. Superficie UI: ⋮ en las dos tarjetas, diálogos patrón 004

**Estado actual (verificado)**: `AccountCardGrid` (client) usa patrón stretched-link + `AccountSettingsMenu` (⋮) **solo en personales**, con 3 ítems (Ingreso regular/Aportación/Ahorro + estado) y diálogos montados dentro de la tarjeta (excepción documentada de «diálogos por fila»: catálogo estable). La tarjeta de la común no renderiza menú. `rename-tag-dialog.tsx` (004) fija el patrón de renombrado: input **controlado** (React 19 conserva lo tecleado ante error), `useActionState`, `role="alert"` + `aria-describedby`, botones Cancelar/Guardar, toast al éxito. `e2e/panel-cuentas.spec.ts` N1 aserta hoy que «Configuración de Cuenta común» **no existe** (línea 48) — queda obsoleto con esta feature.

**Decisión**:

1. **Tarjeta personal**: el ⋮ existente gana un cuarto ítem, **primero**: «Renombrar miembro» (sin sufijo de estado), que abre `RenameMemberDialog` montado dentro de la tarjeta (mismo estado local `renameMemberOpen`). El ítem viaja con `memberId` + `memberName` actuales del DTO.
2. **Tarjeta común**: gana ⋮ (mismo trigger, `aria-label="Configuración de {nombre}"`, mismo patrón stretched-link con `z-10`) con un único ítem: «Renombrar cuenta», que abre `RenameAccountDialog` (hidden `accountId`, input precargado con el nombre almacenado — que es el `account.name` del DTO en la común).
3. Ambos diálogos replican `rename-tag-dialog.tsx` (títulos «Renombrar miembro»/«Renombrar cuenta», labels «Nombre del miembro»/«Nombre de la cuenta», input controlado, Cancelar/Guardar con `isPending`, toast, cierre). Literales congelados en [contracts/ui-contract.md](./contracts/ui-contract.md).
4. Server Actions `renameMember` / `renameAccount` (`useActionState` + Zod en frontera, espejo de `renameTag`): validan `{memberId|accountId, name}` (trim, `min(1)` con mensaje exacto), ejecutan el use case, `revalidatePath("/", "layout")` en éxito (los nombres viven en panel, cuenta, `/summary` y `/annual` — revalidación de layout, igual que tags), mapean errores de dominio a `error.message`.

**Rationale**: FR-003 pide extender el patrón ⋮ de 020 en el panel; las tarjetas son catálogo estable (excepción ya documentada en AGENTS.md), así que el diálogo por tarjeta es seguro; el input controlado es la convención anti-reset de React 19 (SC-004 de 004); la revalidación de layout es la establecida para cambios de catálogo.

**Alternativas consideradas**: *página de ajustes aparte*: rechazada; nueva superficie sin valor sobre el panel (FR-003 la descarta); *renombrar el miembro desde la página de cuenta*: rechazado; la spec congela el panel como superficie única; *un solo diálogo genérico «renombrar entidad»*: rechazado; bifurca action/estado/props por entidad y complica tests — dos diálogos pequeños y enfocados siguen el patrón 004 fichero a fichero; *action directa + `useTransition` (ADR 0015)*: rechazada para el renombrado; sí es un envío de formulario con validación y estado de error a conservar (la familia ADR 0015 es para consultas inline junto a un control, no para diálogos de formulario).

## §6. Impacto en históricos, configs y materializadores: intactos por construcción

**Estado actual (verificado)**: las notas de movimientos materializados congelan el `memberName` del momento («Ingreso regular de {miembro}» — `ConfigureRegularIncome`; «Aportación común de {miembro}» — `MaterializeCommonContributions`); los cierres/resúmenes solo usan ids + nombres vigentes en lectura; las configs 018/019/023 cuelgan de `account_id`; `GetMonthNetContribution` lee el movimiento enlazado (nunca recálculo).

**Decisión**: **nada se reescribe**. Renombrar un miembro: (a) actualiza panel/tarjeta derivada, desgloses y títulos en la siguiente lectura (DTO); (b) las notas históricas ya materializadas conservan el nombre del momento — son **contenido del movimiento** y FR-001 prohíbe alterar movimientos; (c) las materializaciones futuras (meses aún no consultados) usarán el nombre vigente, como ya hacen hoy con cualquier edición de config. Renombrar la común: etiquetas en vistas; configs intactas (cuelgan de ids).

**Rationale**: SC-002 exige histórico numéricamente idéntico; las notas son texto capturado, no etiquetas derivadas — tratarlas como inmutables es lo que ya hace el repo (`syncMaterializedMonth` conserva `movement.note`, 021).

**Alternativas consideradas**: *reescribir notas históricas al renombrar*: rechazada; viola FR-001 («sin alterar movimientos») y convierte un cambio de etiqueta en una migración de datos.

## §7. Seed idempotente con `name` NULL en personales

**Estado actual (verificado)**: `scripts/seed.ts` inserta cuentas con `onConflictDoNothing({ target: accounts.name })` — con `name = NULL` en personales el target deja de confligir (NULL ≠ NULL) y cada ejecución duplicaría cuentas personales.

**Decisión**: `SEED_ACCOUNTS` pasa a tipar el nombre como `string | null` (personales a `null`, común con `SHARED_ACCOUNT_NAME`); el seed inserta la común con `onConflictDoNothing({ target: accounts.name })` y las personales tras **comprobar existencia por `(type, member_id)`** (select previo por miembro resuelto); `SEED_MEMBERS` y el mensaje final no cambian de semántica (sigue sembrando 2 miembros y 3 cuentas idempotentemente, assumption de la spec: mismos datos, forma adaptada al esquema nuevo).

**Rationale**: la idempotencia por clave natural se conserva; la clave natural de una cuenta personal pasa a ser su atribución (miembro), no un nombre que ya no posee.

**Alternativas consideradas**: *índice UNIQUE parcial sobre `(member_id) WHERE type='personal'` como target de conflicto*: tentador (blinda además «una personal por miembro»), pero añade una invariante nueva no pedida por la spec (las altas son feature futura) — YAGNI; *mantener nombres falsos en personales*: contradice §1.

## §8. Pruebas por capa, e2e nueva con restauración y enmiendas

**Estado actual (verificado)**: Vitest projects node/ui con suites co-localizadas; no existen `Member.test.ts` ni `Account.test.ts`; `DrizzleRepositories.test.ts` aserta `findAll` con el nombre almacenado (líneas 52-67); `account-card-grid.test.tsx` mockea las actions y testea funciones puras; e2e con `workers: 1` (orden alfabético) sobre `e2e.sqlite`; `registro-movimientos.spec.ts` aserta el **balance histórico absoluto** de Cuenta de Miembro A navegando por nombre; `resumen-global.spec.ts` (2026-06) aserta desgloses por miembro por nombre.

**Decisión**:

1. **Dominio**: suites nuevas `Member.test.ts` (rename: trim, vacío, conserva id) y `Account.test.ts` (create/rehydrate con name nullable e invariante type↔name; rename: común ok con trim, personal lanza `AccountNotRenamableError`).
2. **Aplicación**: `RenameMember.test.ts` / `RenameAccount.test.ts` con mocks `vi.fn()` por método (espejo `RenameTag.test.ts` si existe / `GetGlobalMonthlySummary.test.ts`): happy path (payload exacto a `update`), no encontrado, duplicado nocase (findByName con otro id), personal en `RenameAccount`.
3. **Repositorios** (libsql `:memory:` + migraciones reales): `update` de miembro/cuenta, `findByName` nocase, traducción de carrera (`members_name_nocase_uq` / `accounts_name_nocase_uq` → errores de dominio), `findAll` **con derivación** (personal NULL → DTO con «Cuenta de {miembro}»; común → nombre almacenado). Enmienda de los fixtures existentes de `DrizzleRepositories.test.ts` (inserts de personales con `name: null`, asserts del DTO derivado).
4. **Actions**: `rename-member.action.test.ts` / `rename-account.action.test.ts` (mock use case + `revalidatePath` + db): Zod (vacío → mensaje exacto), éxito (`revalidatePath("/", "layout")` + mensaje), tabla `it.each` de errores de dominio.
5. **Componentes**: `account-card-grid.test.tsx` ampliado (⋮ en las 3 tarjetas; ítem «Renombrar miembro» en personales y «Renombrar cuenta» en la común; apertura de diálogos con los mocks) y suites de los dos diálogos (precarga, error con valor conservado, toast+cierre).
6. **E2E nueva `renombrado-cuentas-miembros.spec.ts`** (serial, prefijos R1…): renombrar «Miembro A»→«Isma» desde ⋮ de su tarjeta y verificar tarjeta «Cuenta de Isma», h1 de la página de cuenta y desglose por miembro en `/summary`; renombrar la común y verificar tarjeta + `/summary`; errores vacío y duplicado case-insensitive (crear «ISMA» sobre «Sole»... caso exacto: renombrar B a «ISMA» con A llamado «Isma»); **test final de restauración** que devuelve los nombres del seed («Miembro A/B», «Cuenta común»). Posición alfabética verificada: corre tras `registro-movimientos` (que aserta el balance de A **antes** de cualquier renombrado) y antes de `resumen-global` (que lee nombres dinámicos ya restaurados). Sin movimientos nuevos: sin contaminación numérica de ninguna spec.
7. **Enmienda puntual e2e**: `panel-cuentas.spec.ts` N1 — «⋮ solo en personales» pasa a «⋮ en las 3 tarjetas»; el assert de ausencia del menú en la común (línea 48) se invierte (botón «Configuración de Cuenta común» visible con su ítem). Resto de N1-N5 intacto.
8. **Gates**: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` en verde (SC-003).

**Alternativas consideradas**: *e2e sin restauración final*: rechazada; `resumen-global` y cualquier re-ejecución leerían nombres cambiados; *toquetear `registro-movimientos`*: innecesario — el orden alfabético ya lo protege; *spec e2e sobre mes concreto*: los renombrados no crean movimientos, la combinación cuenta/mes se reduce a «no tocar números» + restauración (convención respetada por construcción).

## §9. Documentación viva y roadmap

**Verificado**: no existe ADR del modelo de nombres (el «nombre derivado» nace aquí); `docs/architecture/diagrams/domain-model.md` y `panel-cuentas-sequence.md` no recogen ni renombrado ni ⋮ en la común; AGENTS.md documenta el ⋮ «solo donde hay opciones aplicables (hoy: cuentas personales)»; el roadmap maestro tiene la fila 008 reservada.

**Decisión** (en la implementación, DoD): **ADR 0020** «Nombre de cuenta personal derivado del miembro» (esquema nullable + derivación en lectura + unicidad nocase; decisión arquitectónica de modelo, no simple patrón UI — research §1/§4). Roadmap (FR-008): fila 008 marcada Completada en su mitad «renombrar» con nota de que la mitad «añadir» queda aplazada a una feature futura (decisión 2026-10-29). `AGENTS.md`: ampliar la convención de tarjetas lanzaderas (el ⋮ existe en las 3 tarjetas: personales con config + «Renombrar miembro», común con «Renombrar cuenta»; nombre mostrado de personal = derivado, nunca almacenado). `docs/architecture/diagrams/domain-model.md` (Account.name nullable + rename) y `panel-cuentas-sequence.md` (variante renombrar) extendidos con los diagramas de este plan como base.

**Alternativas consideradas**: *sin ADR*: rechazado; cambia el esquema y el contrato de lectura de `accounts` — exactamente el tipo de decisión que la constitución manda registrar; *ADR separado por índice nocase*: no; es parte de la misma decisión de nombres (§1).

## Resumen de decisiones

| Tema | Decisión | Alternativa rechazada |
|------|----------|----------------------|
| §1 Esquema | `accounts.name` nullable + NULL en personales (migración con recreación) + índices `lower(name)` en members/accounts (patrón tags) | Mantener NOT NULL y derivar solo en lectura; escribir derivado al renombrar; display_name+trigger; unicidad solo app |
| §2 Unicidad | `findByName` nocase + check en use case + traducción de carrera UNIQUE en el repo (espejo 004) | Comparar en memoria con findAll; slug normalizado |
| §3 Dominio | `Member.rename`/`Account.rename` (reconstrucción validada); `Account.name: string \| null` con invariante type↔nombre; `AccountNotRenamableError` para personales; `Duplicate*NameError` + `MemberNotFoundError` | Validar solo en use case; VO MemberName |
| §4 Nombre mostrado | Función pura de aplicación aplicada en `findAll` → `AccountDTO.name` = nombre mostrado; vistas intactas | Derivar en cada componente; derivar en la entidad |
| §5 Superficie UI | «Renombrar miembro» como primer ítem del ⋮ personal; ⋮ nuevo en la común con «Renombrar cuenta»; diálogos espejo de 004; actions `useActionState` + Zod + `revalidatePath("/", "layout")` | Página de ajustes; renombrar desde la cuenta; diálogo genérico; action directa ADR 0015 |
| §6 Histórico | Nada se reescribe: notas materializadas congelan el nombre del momento; futuras materializaciones usan el vigente | Reescribir notas históricas |
| §7 Seed | Personales a `name: null`; existencia por `(type, member_id)` para idempotencia; común por conflicto de nombre | Índice parcial UNIQUE; mantener nombres falsos |
| §8 Pruebas | Suites por capa (dominio nuevo para Member/Account, use cases, repos con migración real, actions, componentes); e2e nueva con restauración final; enmienda N1 de `panel-cuentas` | e2e sin restauración; tocar registro-movimientos |
| §9 Documentación | ADR 0020 (nombre derivado); roadmap 008 «renombrar» completada + «añadir» aplazada; AGENTS.md + diagramas vivos | Sin ADR; ADR separado para nocase |
