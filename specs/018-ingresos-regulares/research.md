# Research: Ingresos mensuales regulares por miembro

**Feature**: 018-ingresos-regulares | **Fecha**: 2026-10-12

Feature de configuración por miembro de un ingreso mensual regular (importe, día, nota) que se materializa perezosamente como movimiento de ingreso corriente en la cuenta personal, de forma idempotente y sin retroactivo. Este research fija el estado verificado en código, resuelve los puntos que la spec deja al plan (anclaje de la configuración, mecanismo de idempotencia y «el borrado no regenera», punto de enganche de la materialización, semántica de reactivación, colocación UI) y descarta alternativas. La spec llega con las clarificaciones cerradas (día inexistente → último día del mes; solo-adelante aplica a importe, día y nota).

## §1. Anclaje de la configuración: miembro vs cuenta personal

**Estado actual (verificado)**: `Member` existe como entidad mínima (`src/domain/member/Member.ts`: solo `id`/`name`); la propiedad se modela en `accounts.member_id` (FK → `members`, nullable solo para la común; invariante en `Account.create`: personal ⇒ memberId ≠ null, shared ⇒ null). `MemberRepository` solo expone `findAll()`. No existe UI de gestión de miembros: nacen del seed (`Miembro A`/`Miembro B`, cada uno con su cuenta personal; ids 1/2 en cuentas).

**Decisión**: la configuración se ancla a la **cuenta personal** (`regular_incomes.account_id UNIQUE → accounts.id`), no a `members.id`.

**Rationale**: (1) el ingreso se materializa como movimiento **de la cuenta** personal: el anclaje directo evita el paso miembro→cuenta en cada materialización y hace imposible la ambigüedad si algún día un miembro tuviera dos cuentas; (2) la regla «la cuenta común no puede configurarlo» se expresa con la misma invariante que el dominio ya conoce (`AccountType`), sin consultas extra; (3) la app real es 1 miembro = 1 cuenta personal (seed + roadmap), así que ambas opciones son observacionalmente equivalentes hoy — se elige la que menos joins y casos borde deja. El término de dominio sigue siendo «ingreso regular del miembro» (UI/spec); la clase es `RegularIncome` con `accountId`.

**Alternativas consideradas**:

- *Tabla `regular_incomes.member_id → members`*: rechazada; exigiría resolver miembro→cuenta en cada materialización y en cada lectura del panel, y duplicaría la invariante «personal» ya materializada en `accounts`.
- *Configuración embebida en `accounts` (columnas nuevas)*: rechazada; mezcla configuración opcional de feature con el agregado de catálogo y obliga a tocar `Account`/migración de `accounts` por una feature lateral.
- *Anclaje a ambas (member + account desnormalizado)*: rechazado; redundancia sin consumidor (YAGNI, principio I).

## §2. Idempotencia, «solo adelante» y «el borrado no regenera»: registro de meses materializados

**Estado actual (verificado)**: `movements` no tiene ninguna unicidad salvo la PK; `DrizzleMovementRepository.create` asigna id con `coalesce(max(id),0)+1`; el borrado es **físico** (`DeleteMovement` → `delete`); la edición es por reconstrucción validada (`Movement.recreate`, ADR 0011) y puede cambiar cualquier campo incluida la fecha. No existe marca de origen ni idempotencia alguna. Las lecturas del mes pasan por `MovementRepository.listByMonth|listByMonthAndAccount|listByYear` y por `DrizzleAccountRepository.getBalance` (SQL directo sobre `movements`).

**Decisión**: **tabla de registro `regular_income_months`** — una fila `(regular_income_id, month)` por cada mes ya materializado, con `UNIQUE (regular_income_id, month)`. La materialización de un mes consiste en: si no existe fila del par, crear el movimiento de ingreso **e insertar la fila, en una única transacción** (`INSERT … ON CONFLICT DO NOTHING RETURNING`: si no devuelve fila, otra petición concurrente ganó y no se inserta el movimiento). La tabla `movements` queda **intacta**: sin marca de origen, sin columnas nuevas, sin unicidad nueva.

Esta única estructura resuelve los tres requisitos duros de la spec:

| Requisito | Cómo lo cubre el registro |
|---|---|
| FR-002 idempotencia (consultas repetidas nunca duplican) | La existencia de la fila `(config, mes)` es la condición de generación; el `UNIQUE` + `ON CONFLICT DO NOTHING` la garantiza también ante carreras (dos renders paralelos del mismo mes) |
| FR-004 «el borrado del mes es definitivo» | Borrar el movimiento **no toca el registro**: la fila sigue existiendo → el mes nunca vuelve a generarse. El flujo de borrado existente queda intacto (cero acoplamiento con 018) |
| FR-004 solo-adelante (ediciones de config no tocan meses generados) | La generación lee la config **solo** para meses sin fila en el registro; los ya registrados conservan su movimiento salvo edición manual del usuario (FR-003) |

**Rationale**: la semántica «este mes ya se generó (exista, esté editado o esté borrado el movimiento)» es un hecho del ciclo de vida de la configuración, no del movimiento; materializarla como registro explícito la hace auditable y deja `Movement` como entidad corriente (FR-003: el generado es un movimiento como cualquier otro, editable/borrable con los flujos existentes). La transacción única evita el estado intermedio «registro sin movimiento» si el insert del movimiento falla.

**Alternativas consideradas**:

- *Columna de origen en `movements` (`regular_income_id` + `source_month`) + `UNIQUE (regular_income_id, source_month)`*: rechazada; al borrar el movimiento desaparece también su unicidad → el mes se regeneraría, violando FR-004. Sostenerla exigiría borrado blando (soft delete), que rompe el flujo de borrado existente y la semántica de «movimiento corriente».
- *Comprobar idempotencia por existencia del movimiento (query «¿hay ingreso con la nota/día del config en el mes?»)*: rechazada; la edición manual (nota, día, importe — FR-003) haría la comprobación fallar y duplicaría el ingreso; además es una unicidad semántica no expresable en BD.
- *Borrado blando de movimientos generados + regeneración*: rechazada; duplica semántica de borrado solo para una feature, toca `DeleteMovement`/listados y complica los cálculos existentes.
- *Generación por lotes al guardar la config (escribir ya todos los meses hasta hoy)*: rechazada; infringe la semántica perezosa asumida en la spec (asunción «generación perezosa al consultar»: meses anteriores a la activación nunca se generan, y los del periodo inactivo tampoco — edge «borrado + reactivación»), y un borrado masivo futuro sería destructivo.

## §3. Materialización perezosa: mecanismo y punto de enganche

**Estado actual (verificado)**: no existe un único punto de lectura del mes. Cinco vías leen movimientos: `ListMovements` y `GetMonthlyClosure` (página de cuenta, `Promise.all` en `src/app/accounts/[accountId]/page.tsx:58-63`), `getBalance` (SQL directo, misma página), `GetGlobalMonthlySummary` (`/summary`) y `GetAnnualIncomeStatement` (`/annual`, lee por año). Las páginas ya calculan el mes por defecto con `currentMonth()` de `ui/format.ts` (adaptador). No hay planificador posible: despliegue serverless en Vercel (constitución: PROHIBIDO asumir estado/cron en el filesystem).

**Decisión**:

1. **Caso de uso explícito `MaterializeRegularIncomes`** (aplicación) invocado **antes de leer** por las tres páginas que muestran datos de mes/año:
   - `/accounts/[accountId]`: `ensureForAccountAndMonth(accountId, month)` — solo la cuenta visitada (la común → no-op: no puede tener config).
   - `/summary`: `ensureForMonth(month)` — todas las configs activas.
   - `/annual`: `ensureForYear(year)` — todos los meses del año consultado (los agregados anuales «consultan» de golpe todos los meses visibles; sin esto, la cuenta de resultados mostraría huecos en meses nunca abiertos por la página de cuenta, con peor UX y apariencia de bug).
2. **Guardas en el propio caso de uso** (independientes de la vista): solo materializa meses `activatedAtMonth ≤ mes ≤ currentMonth` y solo configs `active`. Los meses futuros que hoy se pueden alcanzar desde `/summary` (p. ej. `?month=2028-01`, visitado por e2e existentes) quedan blindados: FR-005 no depende de que la UI acote.
3. **`currentMonth` entra como parámetro** calculado por el adaptador (misma convención que `?month=` en las páginas y que `GetAnnualIncomeStatement.execute(year)`): la aplicación sigue pura y determinista en tests; no se introduce un puerto `Clock` para un dato que cada página ya resuelve.
4. Algoritmo por config: `meses objetivo = monthRange(max(activatedAtMonth, desde), min(currentMonth, hasta))` − `findMaterializedMonths(...)` (una query por config); para cada mes pendiente, en orden ascendente: `Movement.create` (ingreso, `date = dueDateForMonth(mes)`, nota e importe de la config, sin naturaleza ni etiqueta) + `registerMaterialization` transaccional (research §2).
5. Coste en el caso común (mes ya materializado o sin config): **una SELECT** sobre `regular_incomes` + `regular_income_months`; no degrada la apertura del mes (edge de rendimiento).

**Rationale**: el caso de uso explícito en la página mantiene las dependencias apuntando al dominio (VII), deja los repositorios de lectura sin efectos ocultos y hace el mecanismo testeable sin BD. Invocarlo desde las páginas (y no desde dentro de los repositorios/use cases de lectura) preserva la separación lectura/escritura del código actual y evita decorar tres use cases con la misma llamada.

**Alternativas consideradas**:

- *Materializar dentro de `DrizzleMovementRepository.listBy*`*: rechazada; efecto de escritura oculto en un método de lectura (rompe la separación implícita CQRS del repo), no cubriría `getBalance` (SQL directo) y acoplaría el repositorio de movimientos a la feature 018.
- *Decorar `ListMovements`/`GetGlobalMonthlySummary`/`GetAnnualIncomeStatement`*: rechazada; duplica el enganche en tres constructores, no cubre `getBalance` en la primera carga y complica los tests existentes de esos use cases.
- *Cron / Vercel Cron / job programado*: rechazado por la spec (out of scope: «generación por calendario real») y por coste/infra (plan gratuito; principio de coste).
- *Materializar al guardar la configuración* (write-time): rechazado; solo cubriría el mes actual y exigiría igualmente lectura perezosa para meses posteriores.

## §4. CRUD de la configuración y semántica de activación/reactivación

**Estado actual (verificado)**: no existe ningún use case de escritura fuera de movimientos y tags. El patrón de upsert con entidad existe en `TagRepository.save` (017): el use case carga la entidad (o la crea), aplica métodos de dominio y persiste con `save`.

**Decisión**:

1. **`ConfigureRegularIncome`** (upsert siempre-activo): `{ accountId, amountCents, dayOfMonth, note | null, currentMonth }` → resuelve la cuenta vía `AccountRepository.findAll()` (devuelve `AccountDTO` con `type` y `memberName`: una sola llamada valida existencia + «no común» (FR-001, escenario 8) + da el nombre para la nota por defecto — con 3 cuentas, `findAll` es más simple que ampliar puertos); rechaza cuenta común con error de dominio; nota vacía → **«Ingreso regular de {memberName}»** (default de la spec); `existing.update({amount, day, note})` si ya había config — **sin tocar `activatedAtMonth`** — y `RegularIncome.create({..., activatedAtMonth: currentMonth})` si no la había.
2. **`DeactivateRegularIncome`** (`execute(accountId)`): `existing.deactivate()` → `save`. Conserva `activatedAtMonth` (irrelevante mientras esté inactiva; ver reactivación).
3. **Reactivación = volver a `ConfigureRegularIncome`** con la config inactiva: el guardado la reactiva y **resetea `activatedAtMonth = currentMonth`** — exactamente el edge «borrado + reactivación»: los meses del periodo inactivo no se rellenan retroactivamente. Con la activación original conservada tras una edición, un mes no consultado del periodo activo sí se materializa al consultarlo (FR-002: «desde el mes de activación… al consultar el mes»).
4. **`GetRegularIncome`** (`execute(accountId) → DTO | null`) para el panel; **`save` como upsert por `account_id`** (único por miembro — asunción de la spec).

**Alternativas consideradas**:

- *Un único use case con flag `active` en el DTO de entrada*: rechazado; mezcla dos contratos (desactivar no debe exigir importe/día válidos — el usuario puede desactivar sin tocar el formulario) y bifurca la validación dentro del mismo execute.
- *Borrar la fila al desactivar*: rechazado; perdería los valores para reactivar y borraría en cascada el registro de meses → la reactivación regeneraría meses pasados, violando el edge de reactivación.
- *Puerto `Clock` en aplicación para `currentMonth`*: rechazado (research §3.3); el parámetro explícito mantiene los tests deterministas sin un puerto nuevo de un solo método.

## §5. Fecha de cobro: día inexistente en meses cortos

**Estado actual (verificado)**: `ui/format.ts` (adaptador) ya tiene `monthEndIsoDate`/`shiftMonth`, pero el dominio **no puede importar de infraestructura** (VII); `Movement.buildValidatedState` valida fechas de calendario real con `isRealCalendarDate` local (precedente de lógica calendario pura en dominio).

**Decisión**: helpers puros en `src/domain/shared/calendar.ts`: `lastDayOfMonth(month: string): number` (`new Date(y, m, 0).getDate()`, sin dependencias) y `monthRange(from, to): string[]` (iteración inclusiva mes a mes). `RegularIncome.dueDateForMonth(month)`: `${month}-${String(min(dayOfMonth, lastDayOfMonth(month))).padStart(2,"0")}` — día 31 → 30 en abril, 28/29 en febrero; el día configurado se conserva (clarificación 2026-10-12). La comparación/ordenación de meses es la lexicográfica de `YYYY-MM` (longitud fija); se documenta como invariante del formato.

**Alternativas consideradas**:

- *Importar `monthEndIsoDate` de `ui/format`*: prohibido por la dirección de dependencias (VII).
- *Guardar ya la fecha clampada o una regla por row*: rechazado; el clamping es cálculo puro derivable (YAGNI) y el día configurado debe conservarse intacto.

## §6. UI: panel + diálogo en la página de la cuenta personal

**Estado actual (verificado)**: la página de cuenta (011/016) ordena `MonthStepper → GroupedMovementList → AccountBalance → MonthlyClosurePanel`; 016 fijó «list-first» (el listado va inmediatamente tras el selector). Los formularios usan `useActionState` + diálogos Radix + toasts sonner; los botones submit pueden viajar con `name="intent"` (patrón 014). La action de tags (017) es la única excepción directa sin `useActionState` (ADR 0015) — no aplica aquí: esto **es** un envío de formulario con estado repoblable.

**Decisión**:

1. **`RegularIncomePanel`** (client, nuevo) renderizado **solo en cuentas personales** (FR-006), al **final de la página** (debajo de `MonthlyClosurePanel`): es configuración de la cuenta, no dato del mes consultado; así no rompe el «list-first» de 016 ni desplaza los datos mensuales. Estados: sin config (CTA «Configurar ingreso»), activa (importe + día + nota + «Editar»/«Desactivar»), inactiva («Reactivar» vía Editar→Guardar).
2. **Diálogo con formulario** `useActionState(configureRegularIncome)`: Importe (€) — parse ES→céntimos reutilizando `parseAmountToCents` de `movement-form.schema.ts` con mensajes propios (sin la coletilla de abonos, que no aplica) —; Día del mes (1–31, default 1); Nota (opcional, placeholder con el default). Botones submit `name="intent"`: «Guardar» (`save`) y, con config activa, «Desactivar» (`deactivate`, valida solo accountId — research §4.1). Anti doble envío: `isPending` deshabilita (edge de la spec).
3. **`revalidatePath("/", "layout")`** al guardar/desactivar: el refresco RSC re-renderiza la página de cuenta, cuya materialización (§3) hace aparecer el ingreso del mes en curso de inmediato (SC-001) y refresca `/summary`//`annual` en caché del router.
4. La **cuenta común no monta el panel** (escenario 8): la condición `account.type === "personal"` vive en la página (adaptador), la regla de dominio en `ConfigureRegularIncome`.

**Alternativas consideradas**:

- *Panel entre `MonthStepper` y el listado*: rechazado; rompe el «list-first» de 016 y empuja los datos del mes bajo la configuración.
- *Página propia `/accounts/[id]/ingreso-regular`*: rechazada; navegación extra para un formulario de 3 campos (la spec pide acceso desde la página de la cuenta, no una ruta).
- *Switch «activo» dentro del formulario*: rechazado; la desactivación debe ser una acción explícita de un botón (intención inequívoca) y no un checkbox que se envía de rebote con una edición.
- *Action directa + `useTransition` (excepción ADR 0015)*: no aplica; aquí sí hay envío de formulario con validación repoblable — es el patrón general de `createMovement`, no una consulta puntual.

## §7. Pruebas: cobertura por capa y aislamiento e2e

**Estado actual (verificado)**: Vitest con `test.projects` (node: dominio/aplicación/db/actions; ui: jsdom); repositorios contra libsql `:memory:` con migraciones de `drizzle/`; actions con `vi.mock` de repos; e2e Playwright `workers: 1` (orden alfabético) sobre `e2e.sqlite` compartida. Combinaciones cuenta/mes en uso: cierre-mensual→B (mes actual implícito); cuenta-resultados-anual→B+común/2027 (+`/annual?year=2028`); creacion-tags→B/2026-05; edicion-movimientos→B/2026-07·08; pagina-cuenta→B/2026-04 (más caídas a mes actual); panel-cuentas→`/`+B/2026-03+`/summary` 2025-01/2026-03/2028-01; registro-movimientos→**A+común en el mes actual real (dinámico), con asserts de balance exactos**; resumen-global→todas/2026-06.

**Decisión**:

1. **Dominio**: `RegularIncome.test.ts` (validaciones de create/update: importe 0/negativo/no entero, día 0/32/29 válido, nota, mes de activación; `dueDateForMonth` con clamping 31→feb/abr, 30→feb, 1→feb bisiesto; `deactivate`/`activate` y conservación de `activatedAtMonth` en `update`) + `calendar.test.ts` (`lastDayOfMonth` bisiestos, `monthRange` con cruce de año y `from > to` → vacío).
2. **Aplicación**: `ConfigureRegularIncome.test.ts` (crear con defaults día 1 y nota por miembro, cuenta común rechazada, edición sin reset de activación, reactivación resetea a currentMonth, importe inválido), `DeactivateRegularIncome.test.ts` (sin config → error), `GetRegularIncome.test.ts`, y `MaterializeRegularIncomes.test.ts` con doble en memoria del puerto: primera consulta materializa el mes en curso; repetida no duplica; meses < activación nunca; meses > currentMonth nunca (futuro); cambio de importe no toca mes ya registrado y aplica al pendiente; tras «borrar» el movimiento (el doble lo simula borrando solo el movimiento) no se regenera; config inactiva no materializa; reactivación no rellena el hueco; día 31 clamp a febrero.
3. **Repositorio**: `DrizzleRegularIncomeRepository.test.ts` contra libsql `:memory:`: upsert por cuenta; `findMaterializedMonths` por rango; `registerMaterialization` inserta movimiento + fila transaccionalmente y devuelve `false` ante conflicto concurrente (segunda inserción del mismo par) **sin** crear movimiento; el movimiento creado es un ingreso corriente visible para `DrizzleMovementRepository.listByMonthAndAccount` y para `getBalance`.
4. **Action**: `configure-regular-income.action.test.ts` — Zod (importe vacío/formato/cero con mensajes exactos, día fuera de rango), intent `deactivate` sin campos, mapeo de errores de dominio por campo, éxito con `revalidatePath("/", "layout")`.
5. **Componente**: `regular-income-panel.test.tsx` — sin config (CTA), config activa (resumen + Editar/Desactivar), config inactiva (Reactivar), guardado con éxito (toast + cierre), errores por campo con valores conservados, deshabilitado durante pending, cuenta común no relevante (no se monta).
6. **e2e nueva `ingresos-regulares.spec.ts`**: **Cuenta de Miembro A + mes en curso real (dinámico, calculado como en `panel-cuentas`)**. Flujo: configurar 2.000 € (día 1) → el listado muestra el ingreso sin alta manual (escenario 1, SC-001); reconsultar desde `/summary` y `/annual` del mismo mes/año → exactamente 1 (escenario 2, SC-002); recarga directa de la página de cuenta → sin duplicado; editar importe a 2.100 → el mes conserva 2.000 (escenario 3, mitad e2e-able); **borrar el movimiento generado → no reaparece al reconsultar** (escenario 5); **desactivar → el panel muestra estado inactivo** (escenario 6). **Limpieza final natural**: los dos últimos pasos dejan la BD como estaba (movimiento borrado + config inactiva) — `registro-movimientos` (A+común, mes actual, balances exactos) corre **después** alfabéticamente y quedaría contaminado si 018 dejara materializado el ingreso del mes actual de A. Verificación del resto del orden: `cierre-mensual`/`cuenta-resultados-anual`/`creacion-tags` (antes, no tocan A en el mes actual); `edicion-movimientos` (B, meses fijos pasados < activación); `pagina-cuenta` (B); `panel-cuentas` (`/summary` 2028-01 futuro → guarda FR-005; `/summary` 2026-03/2025-01 < activación → no-op); `resumen-global` (2026-06 < activación → no-op). Los edges de clamping y retroactivo quedan en suites unitarias (no e2e-ables sin meses fijos).
7. **Gates**: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` en verde (SC-005).

**Alternativas consideradas**: *mes fijo pasado para la e2e* — imposible: la materialización está acotada a `mes ≤ currentMonth` y la activación siempre es el mes en curso de ejecución; *cuenta B + mes actual* — `pagina-cuenta`/`panel-cuentas` (posteriores) caen al mes actual de B y `cierre-mensual` (anterior) ya opera ahí: más fricción de la necesaria; *no limpiar y rezar* — rompe `registro-movimientos` de forma determinista.

## §8. Documentación viva y roadmap

**Verificado**: `docs/architecture/overview.md` y `diagrams/` no conocen la feature; el roadmap maestro no tiene fila 018 (la spec nace de petición directa); la spec fija FR-007 (fila 018 Completada + nota de que la aportación % a la común queda como feature hija futura, p. ej. 019, sobre 018, reviviendo el alcance diferido).

**Decisión** (en la implementación, DoD): **ADR 0016** («Materialización perezosa de ingresos regulares con registro de meses»): pereza al consultar en serverless sin cron, tabla `regular_income_months` como fuente de idempotencia/borrado-definitivo/solo-adelanto, `movements` intacta, enganche en las 3 páginas lectoras, `currentMonth` como parámetro del adaptador. Actualizar `overview.md` (nuevo módulo aplicación/dominio + repositorio), `domain-model.md` (`RegularIncome` + helpers calendario) y añadir `diagrams/ingreso-regular-secuencia.md` (base: diagrama de secuencia de este plan). Roadmap (FR-007): fila `018-ingresos-regulares` Completada + nota de la decisión 2026-10-09 (división en dos features; 019 aporta % sobre la cuenta común). `AGENTS.md`: convención nueva «materialización perezosa» (las páginas que muestran datos de mes invocan `MaterializeRegularIncomes` antes de leer; la idempotencia vive en el registro de meses, nunca en la existencia del movimiento).

**Alternativas consideradas**: ninguna razonable; docs desfasadas violan la DoD (constitución III).

## Resumen de decisiones

| Tema | Decisión | Alternativa rechazada |
|------|----------|----------------------|
| §1 Anclaje | `RegularIncome` por cuenta personal (`account_id UNIQUE`); término de dominio «ingreso regular del miembro» | FK a members; columnas en accounts; mixto |
| §2 Idempotencia | Tabla registro `regular_income_months` (`UNIQUE (config, mes)`) + materialización transaccional (`ON CONFLICT DO NOTHING`); `movements` intacta | Marca/unicidad en movements; soft delete; comprobación por existencia; generación write-time |
| §3 Materialización | Use case `MaterializeRegularIncomes` invocado por página de cuenta (cuenta+mes), `/summary` (mes) y `/annual` (año, meses ≤ actual); guardas `activación ≤ mes ≤ currentMonth`; `currentMonth` parámetro del adaptador | Efectos en repositorios de lectura; decorar use cases; cron; write-time |
| §4 CRUD | `ConfigureRegularIncome` (upsert; edición no resetea activación; (re)activación fija activación = mes en curso) + `DeactivateRegularIncome` + `GetRegularIncome`; nota default «Ingreso regular de {miembro}» | Use case único con flag; borrar al desactivar; puerto Clock |
| §5 Fecha | Helpers puros dominio (`lastDayOfMonth`, `monthRange`); `dueDateForMonth` clampa al último día sin alterar el día configurado | Importar de ui/format; persistir el clamping |
| §6 UI | `RegularIncomePanel` al final de la página de cuenta personal + diálogo `useActionState` con intents `save`/`deactivate`; `revalidatePath("/", "layout")` | Panel sobre el listado; página propia; switch activo; action directa ADR 0015 |
| §7 Pruebas | Por capa (entidad, calendario, use cases con dobles, repo libsql, action, panel) + e2e `ingresos-regulares.spec.ts` (A + mes actual dinámico, con limpieza natural por escenarios 5-6) | Mes fijo; cuenta B; sin limpieza |
| §8 Documentación | ADR 0016 + overview/domain-model/diagrama nuevo + fila 018 y nota 019 en roadmap + convención AGENTS.md | — |
