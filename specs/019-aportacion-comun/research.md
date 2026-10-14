# Research — Aportación porcentual a la cuenta común por miembro (019)

**Feature**: `019-aportacion-comun` | **Fecha**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

Esta feature se construye sobre la maquinaria de 018 (`ingresos-regulares`) y sobre la superficie de configuración de 020 (`menu-configuracion-cuenta`). Cada decisión de abajo se toma **reutilizando los patrones ya verificados de 018/020** en lugar de introducir mecánicas nuevas; las desviaciones se justifican explícitamente. Todas las citas de código están verificadas contra el árbol actual de `main`.

---

## §1 — Representación del porcentaje y cálculo half-up al céntimo (FR-002, edge «Redondeo al céntimo» y «Porcentaje con decimales»)

**Estado actual (verificado)**:

- `Money` (`src/domain/movement/Money.ts`) solo tiene `fromCents` / `fromCentsOrZero` / `add` / `subtract` / `equals`. **No existe** ninguna operación de porcentaje, multiplicación ni redondeo en el dominio (ADR 0007: aritmética entera en céntimos; el único «redondeo» existente es `parseAmountToCents` en la frontera, `movement-form.schema.ts` L49–58).
- El límite `MAX_AMOUNT_CENTS = 99_999_999_999` garantiza que cualquier producto `importe × porcentaje` quepa en entero seguro: `99_999_999_999 × 10 000 ≈ 10¹⁵ < 2⁵³ ≈ 9·10¹⁵`.
- Clarify 2026-10-14 fija redondeo **half-up** al céntimo (.5 hacia arriba; 25 % de 1.500,50 € = 375,125 → 375,13 €).

**Decisión**:

1. VO de dominio `ContributionPercentage` con representación interna **entera en puntos base** (`basisPoints`): 1 % = 100 bp, 100,00 % = 10 000 bp. Rango válido: entero `1..10 000` (equivale a > 0 % y ≤ 100 % con 2 decimales exactos — FR-001).
2. El cálculo vive en el VO como aritmética entera pura, sin `Math.round` ni flotantes (extensión natural de ADR 0007):

   ```text
   cents = floor((amountCents × basisPoints + 5 000) / 10 000)
   ```

   El `+5 000` antes de dividir implementa half-up al céntimo. Verificación con los casos de la spec: 25 % × 2.000,00 € → 500,00; 33,33 % × 2.000,00 € → 666,60; 25 % × 1.500,50 € → floor((150 050×2 500 + 5 000)/10 000) = floor(375 130 000/10 000) = 37 513 → **375,13 €** ✓; 12,5 % × 2.000,00 € → 250,00.
3. En la frontera (action), el texto del input se parsea por manipulación de cadenas (espejo de `parseAmountToCents`): patrón `^\d{1,3}([.,]\d{1,2})?$`, `parsePercentageToBasisPoints("12,5") = 1 250`.

**Rationale**: los puntos base enteros eliminan por construcción los errores de coma flotante y hacen el redondeo determinista y testeable con casos tabla; la fórmula de división entera con suma de medio divisor es la forma canónica de half-up sin flotantes. La representación coincide con la precisión máxima admitida por la spec (2 decimales de porcentaje).

**Alternativas consideradas**:

- *Flotantes + `Math.round`*: rechazado; viola ADR 0007 y produce importes no deterministas (.5 bancario de `Math.round` en negativos, errores de representación de 0,1 %).
- *Librería decimal (decimal.js/big.js)*: rechazada; dependencia nueva para un cálculo que cabe en un entero seguro de 2⁵³; YAGNI (constitución I).
- *Guardar el porcentaje como texto*: rechazado; pierde validación y comparabilidad en dominio/BD.

## §2 — Entidad y casos de uso: espejo del ciclo de vida de 018 (FR-001, FR-004, FR-006)

**Estado actual (verificado)**:

- `RegularIncome` (`src/domain/regular-income/RegularIncome.ts`) fija el ciclo: `create` nace **activa** con `activatedAtMonth = currentMonth`; `update` revalida sin tocar `active`/`activatedAtMonth`; `deactivate()` conserva `activatedAtMonth`; `activate(currentMonth)` reactiva **reseteando** el mes de activación (tests L190–220).
- Los casos de uso de 018 (`ConfigureRegularIncome`, `DeactivateRegularIncome`, `GetRegularIncome`, `MaterializeRegularIncomes`) con su puerto `RegularIncomeRepository` (`findByAccountId`, `save` upsert por `account_id`, `isMaterialized`, `registerMaterialization`) son el molde exacto.
- `ConfigureRegularIncome` valida `SharedAccountIncomeError` en el caso de uso (no en la entidad), cargando cuentas vía `AccountRepository`.

**Decisión**:

1. Agregado nuevo **`CommonContribution`** en `src/domain/common-contribution/` (término de dominio «aportación (común)»; glosario en data-model §5): campos `id`, `accountId` (personal, única), `percentage: ContributionPercentage`, `active`, `activatedAtMonth`. **Sin** `note`/`dayOfMonth`/`amount`: el importe se deriva (porcentaje × ingreso regular) y los valores por defecto del movimiento generado son fijos (§5). Ciclo de vida idéntico a `RegularIncome` (misma semántica solo-adelante del clarify: reactivar resetea el mes de activación).
2. Casos de uso espejo en `src/application/common-contribution/`: `ConfigureCommonContribution`, `DeactivateCommonContribution`, `GetCommonContribution`, `MaterializeCommonContributions` + puerto `CommonContributionRepository` con la misma firma que el de 018.
3. `ConfigureCommonContribution` valida, en este orden: cuenta existe (`AccountNotFoundError`) → cuenta personal (`SharedAccountContributionError`, literal espejo) → **existe configuración de ingreso regular** (`MissingRegularIncomeError`, nuevo error de dominio de la feature; FR-006) → porcentaje válido (VO). Después aplica la regla de importe mínimo de §7.
4. La dependencia del ingreso regular se lee por su puerto (`RegularIncomeRepository.findByAccountId`) — no se duplica ni se incrusta en la aportación.

**Rationale**: la spec fija explícitamente «misma semántica que 018» (clarify 2026-10-14, FR-004); replicar el agregado y sus casos de uso minimiza el riesgo, maximiza la simetría de tests y evita acoplar dos conceptos con ciclos de vida independientes (porcentaje vs importe/día/nota).

**Alternativas consideradas**:

- *Extender `RegularIncome` con un campo porcentaje opcional*: rechazada; acopla dos configuraciones con lifecycles distintos (se puede aportar sin la semántica de día/nota y viceversa), ensucia los invariantes de 018 ya entregados y viola FR-001 (la aportación es «por miembro», entidad propia).
- *Guardar el porcentaje calculado como importe fijo*: rechazado; FR-004 exige que los meses no generados sigan al porcentaje vigente, y un importe congelado lo incumple.

## §3 — Materialización perezosa: segundo materializador bajo el patrón del ADR 0016 (FR-002, FR-005; escenarios 2, 3, 9, 11)

**Estado actual (verificado)**:

- El **único disparador** de la materialización de 018 es la página de cuenta (`src/app/accounts/[accountId]/page.tsx` L61–72), que la invoca **antes** del `Promise.all` de lecturas (cubre listado, cierre y balance del mismo render). `/summary` y `/annual` no materializan (ADR 0016, decisión del propietario 2026-10-12).
- La idempotencia vive en `regular_income_months` (`UNIQUE (regular_income_id, month)`) con `ON CONFLICT DO NOTHING RETURNING` **en la misma transacción** que el insert del movimiento (`DrizzleRegularIncomeRepository.registerMaterialization` L63–98); el borrado del movimiento es definitivo porque el registro de mes permanece.
- Guardas de `MaterializeRegularIncomes`: config activa, `activatedAtMonth ≤ month ≤ currentMonth` (comparación lexicográfica `YYYY-MM`), `!isMaterialized`.

**Decisión**:

1. Caso de uso `MaterializeCommonContributions.ensureForAccountAndMonth(accountId, month, currentMonth)` con las **mismas guardas** y este orden: config existe y activa → ventana `activatedAtMonth ≤ month ≤ currentMonth` → `!isMaterialized` → **ingreso regular existe y activo** (si falta o está inactivo: no-op, FR-006) → importe calculado ≥ 1 céntimo (§7) → construir movimiento (§5) → `registerMaterialization`.
2. La página de cuenta lo invoca **inmediatamente después** de `MaterializeRegularIncomes` y antes del `Promise.all` (dos awaits secuenciales; determinismo y misma cobertura de lecturas). Sigue siendo el único disparador; agregados intactos.
3. Nueva tabla registro `common_contribution_months` con `UNIQUE (common_contribution_id, month)` + el mismo `registerMaterialization` transaccional (mes + movimiento con `coalesce(max(id),0)+1`); el borrado de la aportación de un mes es definitivo (escenario 5).
4. La base de cálculo se lee **en el momento de generar**: `RegularIncomeRepository.findByAccountId` → `income.amount` (FR-004 solo-adelante: cambios del importe 018 solo afectan a meses aún no generados — edge «Cambio del importe del ingreso regular»). Si el ingreso regular está **inactivo**, la aportación no se genera (sin base estable; coherente con que 018 tampoco genera el ingreso de esos meses).

**Rationale**: la spec fija «generación perezosa al consultar» (Assumptions) y exige idempotencia exacta (SC-002, escenario 2). El patrón 0016 ya resolvió concurrencia de renders, definitividad del borrado y serverless sin cron; duplicar la mecánica con su propia tabla registro mantiene los dos agregados desacoplados (borrar/limpiar uno no afecta al otro).

**Alternativas consideradas**:

- *Un único materializador combinado (ingreso + aportación)*: rechazado; acopla agregados y complica las guardas (la aportación tiene dependencia extra del ingreso); no aporta valor con dos entidades.
- *Registrar la idempotencia en la existencia del movimiento*: rechazado explícitamente por ADR 0016 y escenario 5 (el borrado debe ser definitivo).
- *Cron/calendario real*: rechazado; serverless sin planificador (Out of Scope de la spec).
- *Materializar también en `/summary` y `/annual`*: rechazado; mantiene la decisión del propietario 2026-10-12 (ADR 0016) y la convención de AGENTS.md.

## §4 — Etiqueta «Aportación Común»: triple garantía de disponibilidad (FR-003; edge «Etiqueta Aportación Común»)

**Estado actual (verificado)**:

- Los gastos **exigen** etiqueta (`Movement.buildValidatedState`: `type === "expense"` → `nature` y `tagId` obligatorios; ADR 0014, FK única `movements.tag_id` con `ON DELETE RESTRICT`).
- `SEED_TAGS` (`src/infrastructure/db/seed-data.ts`) **no** contiene «Aportación Común»; no existe referencia en código (verificado con grep).
- El seed es idempotente por slug (`onConflictDoNothing({ target: tags.slug })`), pero solo corre bajo demanda (`npm run db:seed` / `pretest:e2e`); las BD ya existentes (dev `db.sqlite`, Turso prod) no la recibirían sin más.
- `TagRepository` expone `findBySlug`; `CreateTag` resuelve colisiones de slug con sufijos `-2`… — mecánica no deseada aquí (queremos un slug fijo).

**Decisión** (tres capas complementarias):

1. **Seed**: `SEED_TAGS` gana `{ name: "Aportación Común", slug: "aportacion-comun" }` (idempotente por slug).
2. **Migración de datos**: `0004_aportacion-comun.sql` incluye `INSERT OR IGNORE INTO tags (name, slug, status) VALUES ('Aportación Común','aportacion-comun','active')` — cubre BDs existentes sin re-seed (mismo patrón de migración manual que `0002_…`, constitución V: migraciones versionadas como única vía de evolución).
3. **Ensure en runtime (resolución por slug en cada generación)**: `MaterializeCommonContributions` resuelve la etiqueta con `TagRepository.findBySlug("aportacion-comun")` y, si no existiera (p. ej. borrada por el usuario sin movimientos asociados), la **crea** (`Tag.create({ name: "Aportación Común", slug: "aportacion-comun", status: "active" })` + `save`). Nunca se cachea ni se persiste un `tagId` en la configuración.

**Rationale**: el edge de la spec exige que la etiqueta exista (gasto obligatorio) y que el mantenimiento futuro del catálogo (renombrar/desactivar) **no rompa la generación existente**. Resolver por slug en cada generación sobrevive a renombrados (el slug es estable), a desactivados (la FK no distingue estado) y a borrados sin uso (el ensure la recrea); el `RESTRICT` de la FK protege el histórico de movimientos que ya la usan. La migración de datos evita depender de que el propietario re-siemble su BD de desarrollo/producción.

**Alternativas consideradas**:

- *Solo seed*: rechazada; las BD existentes no la tendrían y la primera materialización lanzaría `InvalidMovementError`.
- *Fijar `tagId` en la configuración al guardar*: rechazada; si la etiqueta se borra y se recrea, la config apuntaría a un id huérfano (rompe el edge de mantenimiento).
- *Etiqueta del sistema no borrable (flag en `tags`)*: rechazada; añade columna y lógica de catálogo fuera del alcance de 019 (Out of Scope: cambios en mantenimiento de catálogo).

## §5 — Movimiento generado: literales y reglas contables (FR-003; escenarios 1, 4, 5; Assumptions)

**Estado actual (verificado)**:

- 018 genera `Movement.create({ type: "income", date: config.dueDateForMonth(month), note: config.note, amount: config.amount, nature: null, tagId: null })`.
- Los gastos en la lista se muestran con etiqueta y firma `−importe` (`formatSignedAmountCents`); la naturaleza `personal` queda fuera de «Gastos compartidos» del resumen global y dentro de los «gastos personales» de la cuenta anual (reglas actuales, verificado en `GetMonthlyClosure`/`GetAnnualIncomeStatement`: agrupan por `nature`).
- El cierre mensual, el resumen global y la anual se **componen** de los movimientos existentes; no hay ninguna capa especial por origen del movimiento.

**Decisión**:

1. La aportación se materializa como **un único movimiento** con estos valores fijos (congelados también en ui-contract §4):
   - `type: "expense"`, `nature: "personal"` (decisión de clarify 2026-10-14: computa como gasto personal; **no** suma a KPIs compartidos — FR-003).
   - `date: ${month}-01` (día 1, coherente con el default de 018; assumption «Valores por defecto… coherentes con 018»).
   - `note: "Aportación común de ${memberName ?? "miembro"}"` (espejo del default de 018 «Ingreso regular de …»; `memberName` se resuelve vía `AccountRepository` en la generación).
   - `tagId`: la etiqueta resuelta de §4.
   - `amount: Money.fromCents(percentage.appliedToCents(income.amountCents))`.
2. **Cero cambios** en cierres, resúmenes, anual, formularios de movimiento y flujos de edición/eliminación: la aportación es un movimiento corriente (FR-003 «editable y eliminable con los flujos existentes»; escenarios 4 y 5 se heredan del comportamiento ya entregado en 003/014).

**Rationale**: la spec prohíbe expresamente cambiar las reglas de las vistas (Out of Scope) y exige computar «con las reglas actuales»; un movimiento estándar con naturaleza propia lo garantiza sin tocar ninguna capa de lectura. La ausencia de marca de «generado automáticamente» estaba ya fuera de alcance en el ui-contract de 018 («badge visual de generado automáticamente» listado como futuro).

**Alternativas consideradas**:

- *Naturaleza `shared`*: rechazada por doble cómputo documentado en la spec (sumaría a «Gastos compartidos» del resumen global y a «Sin gastos personales» anual junto con los gastos reales pagados desde la común).
- *Doble anotación (gasto en la personal + ingreso en la común)*: rechazada por decisión del propietario 2026-10-09 (Out of Scope, posible feature futura).
- *Columna «origen automático» en `movements`*: rechazada; YAGNI, ningún requisito la necesita (la idempotencia vive en el registro de meses, §3).

## §6 — UI: entrada en el menú ⋮, diálogo espejo y lectura en `/` (FR-001, FR-006, FR-007)

**Estado actual (verificado)**:

- `AccountSettingsMenu` (`account-card-grid.tsx` L60–97) renderiza hoy un único ítem «Ingreso regular» + estado (`regularIncomeMenuStatus`: «Sin configurar»/«Activa»/«Desactivada»), montado solo en cuentas personales; el diálogo se monta **dentro de la tarjeta** (excepción documentada en AGENTS.md: catálogo estable, `useActionState` sobrevive al `revalidatePath`).
- `/` (`src/app/page.tsx` L21–27) lee en servidor, solo para cuentas personales, `GetRegularIncome` por cuenta y pasa el record como prop.
- El diálogo de 018 (`regular-income-config-dialog.tsx`) fija el patrón completo: `useActionState` + guard `handledRef`, focus programado, botones `name="intent"`, `disabled={isPending}` (anti-doble-envío, edge de la spec).

**Decisión**:

1. **Menú**: segundo `DropdownMenuItem` «Aportación» bajo «Ingreso regular», con estado a la derecha (`ml-auto text-muted-foreground`) producido por la función pura exportada `commonContributionMenuStatus(contribution, regularIncome)`, con **cuatro** literales congelados: «Requiere ingreso regular» (sin ingreso regular 018; ítem **deshabilitado** — no abre diálogo; FR-006/escenario 10), «Sin configurar», «Activa», «Desactivada». La cuenta común sigue sin menú (escenario 8, intacto de 020).
2. **Diálogo** `CommonContributionConfigDialog` espejo del de 018: título «Aportación a la cuenta común», único campo editable «Porcentaje (%)» (`inputMode="decimal"`, placeholder «25»), botones «Cancelar» / «Desactivar» (solo si activa) / «Guardar», toasts de la action. Montaje condicional dentro de la tarjeta, instancia fresca por apertura (misma excepción documentada).
3. **Action** `configure-common-contribution.action.ts` espejo de la de 018 (estado `idle|success|error`, `intent` save/deactivate, `revalidatePath("/", "layout")`, mapeo de errores de dominio a campos). Toasts congelados: «Aportación guardada» / «Aportación desactivado»→ **«Aportación desactivada»** ( concordancia de género).
4. **`/` page** lee además `GetCommonContribution` por cuenta personal (mismo bucle serial; se fusionan ambas lecturas en un único `for`) y pasa `commonContributions` a `AccountCardGrid`. El render de tarjetas sigue sin mostrar importes (020).
5. Helper de formato en el adaptador UI: `formatBasisPointsForInput(bp)` en `format.ts` («25», «12,5») para el `defaultValue` del input; parse inverso `parsePercentageToBasisPoints` en la action (§1). El formateo vive solo en `src/infrastructure/primary/ui/format.ts` (convención de moneda/formato de AGENTS.md).

**Rationale**: FR-007 exige literalmente «añadir su entrada junto a Ingreso regular… conforme al menú definido en 020»; el ui-contract de 018 ya reservaba esta extensión y el de 020 documentó que «la aportación % (019) añadirá ahí su entrada». El estado deshabilitado con literal propio resuelve el requisito de claridad de FR-006 sin nueva superficie.

**Alternativas consideradas**:

- *Ítem habilitado que abre diálogo con aviso de dependencia*: rechazada; más recorrido para el mismo mensaje, y el guardado habría que bloquearlo igualmente en la action (defensa en profundidad que sí se mantiene con `MissingRegularIncomeError`).
- *Sección de configuración en la página de cuenta*: rechazada; 020 dejó la página libre de configuración por decisión del propietario.
- *Preview del importe resultante dentro del diálogo*: rechazado por ahora; útil pero no exigido (YAGNI), y acoplaría el diálogo a la lectura del ingreso regular.

## §7 — Edge degenerado: porcentaje cuyo importe redondea a 0 céntimos (edge «Redondeo» + FR-001)

**Estado actual (verificado)**: `Money.fromCents` rechaza `≤ 0` («El importe debe ser mayor que cero.»); un 0,01 % sobre un ingreso de 5,00 € produce `floor((500×1 + 5 000)/10 000) = 0` → la generación explotaría.

**Decisión**:

1. **Al configurar** (`ConfigureCommonContribution`): tras validar la existencia del ingreso regular, se calcula `appliedToCents(income.amountCents)` y si es `< 1` se rechaza con `InvalidCommonContributionError("percentage", "El porcentaje aplicado a tu ingreso regular debe resultar en al menos 0,01 €.")` (literal congelado en ui-contract §3). El check es gratis: el ingreso ya se cargó para `MissingRegularIncomeError`.
2. **Al materializar** (`MaterializeCommonContributions`): guard defensiva — si el cálculo diera `< 1` (p. ej. el ingreso regular bajó después de configurar), se hace **no-op sin registrar el mes**: el mes no queda marcado y una subida futura del ingreso permitiría generarlo en una consulta posterior (comportamiento conservador y transparente; nunca escribe un movimiento de 0).

**Rationale**: rechazar temprano con mensaje claro es lo más honesto (el usuario cree haber configurado algo que nunca aparecería); la guard defensiva evita que una edición posterior del importe 018 rompa la apertura del mes (excepción no controlada en render).

**Alternativas consideradas**:

- *Dejar que `Money.fromCents` lance en runtime*: rechazada; rompería el render de la página de cuenta (violaría la robustez del happy path de 0016).
- *Registrar el mes con movimiento de 0*: rechazada; `Money` lo prohíbe y un gasto de 0,00 € no tiene sentido contable.

## §8 — Tests y e2e: combinación propia de cuenta/mes y orden alfabético (FR-009; constitución III; convención de aislamiento e2e)

**Estado actual (verificado)**:

- Suites co-localizadas con su SUT; repos contra libsql `:memory:` con migraciones reales (`createTestDb`); actions mockeadas en componentes con `vi.mock`; e2e `workers: 1`, orden alfabético sobre `e2e.sqlite` recreada por `pretest:e2e`.
- Ocupación verificada de cuentas/meses: `ingresos-regulares` usa **cuenta 1 (Miembro A) + mes en curso real** (con limpieza final: borrado + desactivación); `pagina-cuenta` usa cuenta 2 con meses fijos 2026-03/04 y 2027-06 (el mes actual de la cuenta 2 solo aparece en asertos de stepper/picker, no de contenido); `resumen-global` usa 2026-06; `cuenta-resultados-anual` 2027; `panel-cuentas` navega sin asertar contenido de mes. **Nadie aserte contenido de la cuenta 2 en el mes en curso**.

**Decisión**:

1. Nueva spec e2e `e2e/aportacion-comun.spec.ts` con **Cuenta de Miembro B (cuenta 2) + mes en curso real** (helpers locales `currentMonthIso()` al estilo de 018), serial dentro del fichero. Casos: A1 dependencia (sin ingreso regular → ítem «Aportación» con «Requiere ingreso regular» deshabilitado; tras configurar ingreso regular 2.000,00 → «Sin configurar»), A2 configurar 25 % → gasto −500,00 con nota «Aportación común de Miembro B» y etiqueta «Aportación Común», exactamente 1 vez, sin cambios en la cuenta común, A3 idempotencia (`/summary`×2, `/annual`×2, reload → count 1), A4 editar a 30 % → el mes generado conserva 500,00, A5 eliminar la aportación → definitiva (no reaparece), A6 **limpieza**: eliminar los movimientos generados y desactivar aportación e ingreso regular de B.
2. **Nota crítica de orden**: `aportacion-comun` corre **primero** alfabéticamente sobre la BD compartida. La limpieza de A6 no es cosmética: si la aportación de B quedara activa, cualquier visita posterior a `/accounts/2` sin `?month` (la hace `pagina-cuenta` P4/P7 y `panel-cuentas` N2) re-materializaría el mes en curso. Desactivar ambas configs + borrar los movimientos restaura el estado pre-019.
3. Suite unitaria de dominio (`ContributionPercentage`: validación 1–10 000, tabla half-up con los 4 casos de §1; `CommonContribution`: ciclo de vida espejo de 018), de aplicación (`MaterializeCommonContribures`: idempotencia, solo-adelante, sin retroactivo ni futuro, sin ingreso/inactivo → no-op, base al momento de generar, ensure de etiqueta por slug con creación si falta, nota/fecha/naturaleza/tag del movimiento, guard de céntimo 0; `ConfigureCommonContribution`: defaults, reactivación resetea, `SharedAccountContributionError`, `MissingRegularIncomeError`, mínimo 0,01 €; `Deactivate`/`Get`), de action (espejo de los 14 casos de 018: parse `25`/`12,5`/`33,33`, `0`/vacío/`100,01`/3 decimales → literales, `intent=deactivate`, nada persiste en error de validación), de componentes (estados del ítem de menú incl. disabled sin ingreso; diálogo vacío/pre-relleno «25»/«12,5», focus, intents, errores por campo) y de repositorio (upsert por cuenta, tx idempotente: segunda inserción del par config-mes → `false` sin movimiento; movimiento visible a `listByMonthAndAccount`/`getBalance`).

**Rationale**: la convención de aislamiento (AGENTS.md) exige combinación cuenta/mes propia; la cuenta 2 + mes en curso está libre (verificado arriba) y es la única opción real — la activación siempre arranca en el mes en curso (FR-004), así que no cabe un mes fijo pasado para la primera generación.

**Alternativas consideradas**:

- *Reusar cuenta 1 + mes en curso (como 018)*: rechazada; colisiona con `ingresos-regulares` (aserta conteo exacto de ingresos de A en el mes en curso y estado de su menú).
- *Mes futuro fijo*: imposible; FR-005 prohíbe generar meses futuros.

## §9 — Documentación viva, ADR y roadmap (FR-008; DoD constitución)

**Estado actual (verificado)**: ADR 0016 documenta la materialización perezosa de 018; `docs/architecture/diagrams/` mantiene diagramas vivos (p. ej. `ingreso-regular-secuencia.md` con la variante 020); el roadmap maestro (`specs/001-family-wallet/spec.md`) tiene la línea diferida a amendar en Assumptions («Provisionalmente, las aportaciones a la cuenta común, si se registran, se anotan como ingresos en dicha cuenta.») y notas datadas de 018/020 que ya anuncian 019.

**Decisión**:

1. **ADR 0017** (`0017-aportacion-comun-porcentaje-materializacion.md`): porcentaje en puntos base con redondeo half-up entero (extensión de ADR 0007), segundo materializador perezoso bajo patrón 0016 (tabla registro propia, mismo disparador único, agregados sin materializar), resolución de etiqueta por slug con ensure, base = ingreso regular al momento de generar, parada sin ingreso/inactivo.
2. Diagrama vivo nuevo `docs/architecture/diagrams/aportacion-comun-secuencia.md` (base: el de este plan) y variante en `panel-cuentas-sequence.md` si procede; `domain-model.md` extendido con el agregado.
3. **AGENTS.md**: la convención «Materialización perezosa (ingresos regulares)» se generaliza a ambos materializadores (aportación incluida: único disparador, registro de meses, nunca en agregados).
4. **Roadmap (FR-008)**: fila `019-aportacion-comun` (Estado: Completada al cerrar), amend de la línea diferida (la aportación mensual porcentual queda cubierta como gasto propio con etiqueta «Aportación Común»; la contrapartida en la común sigue manual) y nota datada 2026-10.
5. `README` no aplica (sin cambios de uso global); el seed documenta la etiqueta nueva implícitamente en `seed-data.ts`.

**Rationale**: la constitución (DoD, principio II y flujo §3) exige documentación actualizada en el mismo cambio y ADR para decisiones arquitectónicas nuevas; FR-008 es un requisito funcional explícito de la spec.

**Alternativas consideradas**:

- *Ampliar el ADR 0016 en lugar de uno nuevo*: rechazada; 0016 está cerrado y citado como referencia de un patrón; las decisiones nuevas (puntos base, half-up, ensure de etiqueta, dependencia del ingreso) merecen registro propio con su contexto.
- *Dejar el roadmap para `/speckit.finish`*: parcialmente sí — la fila se marca al cerrar la feature; el amend del texto y la nota se preparan en tasks para que el cierre solo verifique.

---

## Resumen de decisiones

| Tema | Decisión | Alternativa rechazada |
|------|----------|----------------------|
| Porcentaje y redondeo (§1) | VO `ContributionPercentage` en puntos base (1–10 000); `floor((cents×bp + 5 000)/10 000)` half-up entero | Flotantes/`Math.round`; librería decimal; texto |
| Agregado (§2) | `CommonContribution` espejo de `RegularIncome` + 4 casos de uso y puerto propios | Extender `RegularIncome`; importe congelado |
| Generación (§3) | `MaterializeCommonContributions` tras 018 en la página de cuenta; `common_contribution_months` UNIQUE + ON CONFLICT en tx; base leída al generar; no-op sin ingreso o ingreso inactivo | Materializador combinado; idempotencia por movimiento; cron; materializar en agregados |
| Etiqueta (§4) | Seed + `INSERT OR IGNORE` en la migración 0004 + ensure por slug en cada generación | Solo seed; `tagId` persistido en config; etiqueta del sistema no borrable |
| Movimiento (§5) | Gasto propio, día 1, nota «Aportación común de {miembro}», etiqueta «Aportación Común»; vistas intactas | Naturaleza compartida; doble anotación; columna de origen |
| UI (§6) | Ítem «Aportación» con 4 estados (disabled «Requiere ingreso regular»), diálogo espejo, action espejo, `/` lee ambas configs | Diálogo-aviso; configuración en la página de cuenta; preview de importe |
| Céntimo 0 (§7) | Rechazo al configurar (literal propio) + no-op sin registrar al materializar | Excepción en runtime; movimiento de 0,00 € |
| Tests/e2e (§8) | Cuenta 2 (Miembro B) + mes en curso; serial; limpieza final obligatoria (corre primero) | Cuenta 1 (colisión con 018); mes futuro (imposible) |
| Docs (§9) | ADR 0017 + diagrama vivo + AGENTS.md + amend roadmap FR-008 | Ampliar ADR 0016; dejar docs para el cierre |
