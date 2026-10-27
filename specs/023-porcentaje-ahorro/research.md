# Research — Porcentaje de ahorro por miembro con apartado mensual (023)

**Feature**: `023-porcentaje-ahorro` | **Fecha**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

Decisiones de diseño verificadas contra el código existente (018/019/020/021/022). Cada sección: Decisión · Rationale · Alternativas consideradas.

---

## §1. Mecanismo de idempotencia sin movimiento: registro de meses con importe congelado

**Decisión**: réplica exacta del patrón de registro de meses de 018/019 (`regular_income_months` / `common_contribution_months`), adaptado a la ausencia de movimiento: la fila del registro **guarda el importe congelado**.

- Tabla `savings_allocations` (config, 1 por cuenta personal) + tabla `savings_allocation_months` con `amount_cents` y `UNIQUE (savings_allocation_id, month)`.
- Al consultar un mes dentro de la ventana sin fila: calcular `SavingsPercentage.appliedToCents(income)` e insertar la fila con ese importe (`ON CONFLICT DO NOTHING` en tx). La fila **nunca se actualiza** después.
- El KPI lee la fila (`GetMonthSavings`): **importe = fila del registro, nunca recálculo** (paridad literal con 022: «importe = movimiento enlazado, nunca recálculo»).

**Rationale**: la spec fija el resultado observable («al consultar el mes, la deducción ya está», idempotente, solo-adelante, meses cerrados congelados; FR-003/FR-004) y deja el mecanismo al plan. El registro por mes satisface las tres propiedades por construcción: UNIQUE + `ON CONFLICT DO NOTHING` = idempotente ante carreras (dos renders simultáneos); el importe se lee de la config vigente **en el momento del registro** = solo-adelante; la fila es append-only = congelado. En 019 el importe congelado vive en el movimiento; aquí, sin movimiento, la fila del registro es su análogo natural y evita cualquier recomputación al leer.

**Alternativas consideradas**:

1. *Calcular siempre al vuelo* (sin registro): aparentemente más simple, pero rompe el solo-adelante — un cambio de porcentaje o de ingreso reescribiría la historia visible (viola esc. 3 y edge «Cambio del importe del ingreso regular»), y no hay forma de distinguir «mes consultado» de «mes aún no consultado». Rechazada.
2. *Re-sincronizar el mes en curso como 021*: aplicable solo cuando la base varía dentro del mes (021: los gastos comunes del mes). Aquí la base es plana sobre la config (decisión del propietario), y FR-004 ordena que un mes ya consultado **no cambie** por consultas posteriores. Rechazada (ver §3).
3. *Materializar como movimiento informativo excluido de agregados*: exigiría tocar todos los agregados para excluirlo (FR-007 los declara intocables) y contradice la decisión «sin movimiento». Rechazada.

## §2. Modelo de dominio: `SavingsAllocation` + `SavingsPercentage` (entero 1–100)

**Decisión**: módulo nuevo `src/domain/savings/` espejo de `common-contribution`, con dos diferencias selladas:

- **`SavingsPercentage` guarda el porcentaje como entero 1–100** (no puntos base): la spec exige número entero sin decimales (decisión del propietario, 2026-10-26). `appliedToCents(cents) = floor((cents × pct + 50) / 100)` — half-up al céntimo con aritmética entera pura (ADR 0007).
- **`SavingsAllocation` sin `dueDateForMonth`** ni nada relativo a movimientos: no hay fecha de materialización, etiqueta ni nota asociadas.

Errores espejo de `CommonContributionErrors.ts`: `InvalidSavingsAllocationError` (campos `percentage` / `activatedAtMonth`), `SharedAccountSavingsError`, `SavingsAllocationNotFoundError`, y **`MissingRegularIncomeError` propia del módulo** (la spec nombra la clase explícitamente en FR-001) con el mismo literal de 019. Cada módulo de dominio define sus errores sin importar cruzados (paridad: 019 definió el suyo aunque el concepto ya existiera).

**Rationale**: `SavingsAllocation` es el nombre que la spec propone (Key Entities) y el glosario lo fija (data-model §5). El VO entero hace inválidos por construcción los decimales (12,5 % no es representable), de modo que la regla «entero en (0, 100]» vive en el dominio y la frontera solo la parsea. Half-up verificado: 10 % × 3.000,05 € → 30 001 c → 300,01 €; 33 % × 1,50 € → 49,5 c → 50 c (tabla de casos en data-model §1.1).

**Alternativas consideradas**:

1. *Reusar `ContributionPercentage` (puntos base)*: permitiría 12,5 % — justo lo que la spec prohíbe — y acoplaría el módulo `savings` al de aportación (FR-006 exige independencia). Rechazada.
2. *Subclase/herencia entre configs*: abstracción prematura (constitución I); los dos agregados difieren en semántica central (movimiento vs. informativo). Rechazada.

## §3. Guardas del materializador: paridad §1.2.1 de 019, **sin** re-sync del mes en curso

**Decisión**: `MaterializeSavingsAllocations.ensureForAccountAndMonth(accountId, month, currentMonth)` con las guardas en orden (espejo de `MaterializeCommonContributions.ts:27-81`, adaptadas):

1. Config existe, `active`, `id ≠ null` → si no, return.
2. `activatedAtMonth ≤ month ≤ currentMonth` (lexicográfico) → si no, return (sin retroactivo ni futuro, esc. 7).
3. `!isDeducted(id, month)` → si ya registrada, return (**frozen**: ni duplica ni reajusta).
4. Ingreso regular existe **y activo** → si no, return **sin registrar** (mes abierto; paridad 019 y clarify 2026-10-26).
5. `appliedToCents(income.amount) ≥ 1` céntimo → si no, return sin registrar (espejo de la guarda `netCents < 1` de 019; la action rechaza de antemano configs cuyo resultado < 0,01 €).
6. `registerDeduction(config, month, amountCents)` — INSERT único `ON CONFLICT DO NOTHING RETURNING` en tx (carrera → false, no-op).

**Sin re-sync del mes en curso** (diferencia explícita con 021): la base es plana sobre la config (FR-002); FR-004 ordena que la deducción de un mes ya consultado **no cambie** por consultas posteriores. En 021 la re-sincronización existía porque la base (gastos comunes) muta dentro del mes; aquí los únicos insumos son configs, y su edición es solo-adelante por definición.

**Rationale**: paridad máxima con 018/019 reduce superficie de decisión nueva y reusa un patrón ya probado (AGENTS.md, ADR 0016/0017). La tx de un solo INSERT es más simple que la de 019 (que además inserta movimiento con `max(id)+1`): aquí no hay movimiento ni reserva de ids.

**Alternativas consideradas**: re-sync del mes en curso (rechazada, ver §1); guardas en la action en vez del materializador (las actions de configuración no conocen el mes consultado; el disparador de la deducción es la lectura de la página, ADR 0016/0017).

## §4. KPI neto: dónde vive la resta `saldo − ahorro`

**Decisión**: la página de cuenta compone y el componente renderiza:

- `GetMonthSavings` (NUEVO, espejo de `GetMonthNetContribution`) → `MonthSavingsDTO { configured: boolean; amountCents: number }`, importe leído de la fila del registro (§1), nunca recalculado.
- La página calcula **una única vez** `netMonthBalanceCents = closure.monthBalanceCents − (savings?.amountCents ?? 0)` y se lo pasa a `AccountMonthKpis`, que sigue siendo un **server component presentacional puro** (recibe aportación, ahorro y saldo neto ya calculados; solo formatea).

**Rationale**: la regla «saldo base de movimientos no incluye el ahorro; el KPI lo resta explícitamente sobre esa base» (spec, edge «Sin doble cómputo») se materializa así en un único punto: el adaptador inbound que ya compone `closure.monthBalanceCents` para el bloque (022). Coherencia por construcción: KPI de saldo y fila «Saldo del mes» del cierre difieren **exactamente** en el importe deducido, con ahorro > 0 (FR-007: el cierre no computa ahorro). El componente no gana lógica (constitución VII intacta) y los tests del componente siguen siendo puramente presentacionales.

**Alternativas consideradas**:

1. *Restar dentro del componente*: movería una decisión de composición de datos a la UI; el componente dejaría de ser espejo de 022. Rechazada.
2. *Caso de uso agregado `GetAccountMonthKpis` que recalcule el cierre*: duplicaría la lectura del cierre o requeriría pasarle datos ya calculados (use case con input derivado); rompería el contrato congelado de `GetMonthlyClosure` y el orden materialización→lectura de la página. Rechazada por YAGNI (constitución I).

## §5. Superficie UI: menú ⋮, diálogo espejo y KPIs de 3 métricas

**Decisión**:

- **Menú ⋮** (`account-card-grid.tsx`): tercer ítem **«Ahorro»** (tras «Ingreso regular» y «Aportación»), con función pura exportada `savingsMenuStatus(savings, regularIncome)` espejo de `commonContributionMenuStatus`: `regularIncome === null` → «Requiere ingreso regular» + ítem deshabilitado; sin config → «Sin configurar»; `active` → **«Activo»** / **«Desactivado»** (masculino, a diferencia de «Activa»/«Desactivada» de la aportación). `/` (panel) lee `GetSavingsAllocation` por cuenta personal en el mismo bucle existente.
- **Diálogo** `savings-config-dialog.tsx`: espejo estructural de `common-contribution-config-dialog.tsx` (título **«Ahorro mensual»**, `useActionState`, foco inicial, guard de éxito único, botones Cancelar/Desactivar/Guardar con anti-doble-envío). Único campo **«Porcentaje (%)»** con `inputMode="numeric"`, placeholder **«10»**, `defaultValue` = `String(config.percentage)` (entero: sin `formatBasisPointsForInput`). El diálogo se monta condicionalmente dentro de la tarjeta (excepción documentada en AGENTS.md, catálogo estable).
- **KPIs** (`account-month-kpis.tsx`): `dl` pasa de 2 a **3 celdas** (`grid-cols-3`): «Aportación común» (intacta) · **«Ahorro del mes»** (nueva: `formatAmountCents`; subtexto **«Sin ahorro configurado»** solo con `configured: false`) · **«Saldo del mes»** (label intacto de 022, valor ahora **neto**: `formatSignedCents(netMonthBalanceCents)`, rojo si negativo). Sticky y resto del bloque intactos (022 §1).
- **Action** `configure-savings-allocation.action.ts` espejo de la de aportación + `savings-form.schema.ts` con `INTEGER_PERCENTAGE_PATTERN = /^\d{1,3}$/` y `parseIntegerPercentage` (manipulación de cadenas, nunca `parseFloat`; paridad con `contribution-form.schema.ts`). Cualquier entrada con decimales (12,5) cae en el error de formato con mensaje propio.

**Rationale**: FR-001 exige espejo 020/019; reutilizar el patrón stretched-link, el estado del menú como función pura y el diálogo con `useActionState` mantiene las convenciones de AGENTS.md sin excepciones nuevas. La guardia de configuración consulta **existencia** de ingreso regular (`income === null` → `MissingRegularIncomeError`), paridad literal con `ConfigureCommonContribution.ts:40-43`; el requisito de *activo* aplica en la deducción (guarda 4 de §3), igual que en 019.

**Alternativas consideradas**: KPI «Disponible» propio (descartado en clarify 2026-10-26); input con `type="number"` (consistente con el patrón existente del repo: `Input` de shadcn + `inputMode`, sin `type="number"` en ningún diálogo); preview de importe en el diálogo (rechazado en research de 019, mismo argumento).

## §6. E2E: combinación cuenta/mes y convivencia con la suite existente

**Decisión**: fichero nuevo `e2e/porcentaje-ahorro.spec.ts` en **Cuenta de Miembro B (id 2) + mes en curso real**, serial dentro del fichero (`test.describe.configure({ mode: "serial" })`), con **limpieza total UI-driven** al final: desactivar ahorro → desactivar aportación (si quedó activa) → desactivar ingreso regular → borrar todos los movimientos creados → verificar listado vacío.

Verificación contra la matriz de ocupación (workers: 1, orden alfabético; `porcentaje-ahorro` corre entre `panel-cuentas` y `registro-movimientos`):

| Fichero | Cuenta | Mes |
|---|---|---|
| `aportacion-comun` / `descuento-gastos-comunes` | 2 (Miembro B) | en curso (limpieza total: configs desactivadas) |
| `pagina-cuenta` / `panel-cuentas` / `cuenta-resultados-anual` | 2 | fijos 2026-04 / 2026-03 / 2027-01·07 |
| `ingresos-regulares` / `kpis-fijos-cuenta` | 1 (Miembro A) | en curso (limpieza total) |
| `registro-movimientos` | 1 (Miembro A) | propios — **aserta balance histórico absoluto de la cuenta 1** |
| **`porcentaje-ahorro` (nuevo)** | **2 (Miembro B)** | **en curso (limpieza total)** |

- El mes en curso es obligatorio: la activación nace en el mes en curso (FR-004) y la deducción solo se produce en la ventana activación→en curso (FR-003); un mes fijo pasado mostraría 0,00 €.
- Cuenta 2 en el mes en curso queda libre al llegar «p»: `aportacion-comun` y `descuento-gastos-comunes` desactivan aportación e ingreso y borran sus movimientos (A6/D11 verificados). El setup del spec es defensivo (desactiva aportación si apareciera activa) para ser determinista.
- `registro-movimientos` (posterior, cuenta 1) aserta el **balance histórico absoluto**: nuestra limpieza total en la cuenta 2 no lo toca; la deducción de ahorro **no crea movimientos** (es su aserción central), y el ingreso regular materializado se borra en la limpieza.
- **`kpis-fijos-cuenta.spec.ts` sigue verde sin cambios**: sus aserciones son tolerantes a hermanos nuevos (`getByText("Aportación común").locator("..")`, sin conteos de celdas) y con ahorro sin configurar el saldo neto coincide con el bruto (K1: −500,00 ✓). Verificado contra el código del spec; la suite se ejecutará íntegra en CI como doble chequeo.
- FR-007 se aserta con elegancia en el propio flujo: la fila «Saldo del mes» del cierre muestra el bruto (+3.000,00 con ingreso 3.000) mientras el KPI muestra el neto (−300 € de ahorro): difieren exactamente en el importe deducido (edge «Sin doble cómputo»); y el listado no contiene ningún movimiento de ahorro.

**Alternativas consideradas**: cuenta 1 (ocupada por `kpis-fijos-cuenta` inmediatamente antes y por `registro-movimientos` inmediatamente después — margen cero ante cualquier descuido de limpieza); mes fijo pasado (la deducción no se produce; no valida nada).

## §7. Matriz de tests por capa (FR-009)

| Capa | SUT | Casos clave |
|---|---|---|
| Dominio (node) | `SavingsPercentage` | tabla half-up (10 % × 3.000,00 → 300,00; 10 % × 3.000,05 → 300,01; 33 % × 1,50 → 0,50; 10 % × 0,05 → 0,01; 1 % × 0,99 → 0,01); entero 1–100 (rechaza 0, 101, 12,5 bp-equivalente, no enteros) |
| Dominio (node) | `SavingsAllocation` | create/rehydrate/update/deactivate/activate(reset mes); `activatedAtMonth` YYYY-MM inválido |
| Aplicación (node) | `ConfigureSavingsAllocation` | feliz (alta activa en mes en curso, edición, reactivación con reset); `MissingRegularIncomeError` sin ingreso; `SharedAccountSavingsError` cuenta común; importe < 0,01 € rechazado; `AccountNotFoundError` |
| Aplicación (node) | `DeactivateSavingsAllocation` | `SavingsAllocationNotFoundError`; conserva `activatedAtMonth` |
| Aplicación (node) | `MaterializeSavingsAllocations` | idempotencia (ya registrado → no-op); ventana (antes de activación / futuro → no-op); inactivo → no-op; ingreso inexistente o inactivo → **no-op sin registrar**; importe congelado con el porcentaje e ingreso vigentes al registrar; carrera (`registerDeduction` false) |
| Aplicación (node) | `GetMonthSavings` | sin config `{configured:false, amountCents:0}`; con fila → importe de la fila; mes inválido → throw |
| Infra (node, libsql :memory: + migraciones) | `DrizzleSavingsAllocationRepository` | upsert por `account_id`; `registerDeduction` idempotente por UNIQUE (segunda inserción → false); `findDeductedAmount` |
| Actions (node) | `configure-savings-allocation.action` | tabla de validación (vacío, «12,5», «abc», «0», «101», «-5»); intent deactivate sin config; mapeo de errores de dominio; éxito revalida |
| UI (jsdom) | `SavingsConfigDialog` | render espejo, error de campo con `role="alert"`, disabled con isPending, Desactivar solo activa |
| UI (jsdom) | `AccountCardGrid` (MOD) | ítem «Ahorro» con 4 estados; deshabilitado sin ingreso; apertura de diálogo |
| UI (jsdom) | `AccountMonthKpis` (MOD) | 3 celdas y orden; sin config → «Sin ahorro configurado» + 0,00 € + neto = bruto; con ahorro → neto = bruto − ahorro; neto negativo rojo |
| E2E (Playwright) | `e2e/porcentaje-ahorro.spec.ts` | flujo completo de SC-005: configurar ingreso 3.000 + ahorro 10 % → KPI 300,00 y saldo neto −300 vs cierre bruto; sin movimiento de ahorro en listado; re-consulta estable; 12,5 rechazado; mes futuro sin deducción; limpieza total |

## §8. Documentación y ADRs (FR-008)

**Decisión**: **sin ADR nuevo**: la feature es consecuencia directa de los ADR 0016/0017 (materialización perezosa con registro de meses, único disparador = página de cuenta) y de las decisiones cerradas de la spec (informativo, plano, paridad temporal). El patrón «registro con importe congelado sin movimiento» es una variante menor que se documenta como convención en **AGENTS.md** (actualización de la convención «Bloque KPIs sticky»: 3 métricas + ahorro informativo con registro congelado) y en el roadmap maestro (fila 023 → Completada + nota datada de la amenda al contrato de 022). `docs/architecture/diagrams/` se extiende en la implementación reutilizando los diagramas de este plan como base.

**Alternativas consideradas**: ADR «apartados informativos» (no hay decisión arquitectónica nueva: ni patrón ni dirección de dependencias cambian; constitución I); no documentar (viola FR-008 y la regla de mantenimiento de AGENTS.md).
