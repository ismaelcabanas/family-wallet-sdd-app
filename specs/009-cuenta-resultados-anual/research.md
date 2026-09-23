# Research: Cuenta de Resultados Anual

**Feature**: `009-cuenta-resultados-anual` | **Fecha**: 2026-09-23

Investigación de Phase 0 para resolver las incógnitas del Technical Context del [plan.md](./plan.md). Sin incógnitas tecnológicas nuevas (stack fijado por 002/005/006 y la constitución); las decisiones son de **composición del cálculo anual, lectura de datos, media mensual, ubicación de la vista, presentación de la tabla 13 columnas y estrategia de tests**. Cada sección documenta: decisión, racional y alternativas consideradas.

---

## 1. Cómo se calcula la cuenta de resultados anual: composición de 12 resúmenes globales (FR-002..FR-006, FR-012)

**Decision**: VO de dominio **`AnnualIncomeStatement`** (`src/domain/movement/AnnualIncomeStatement.ts`) con factory `fromMovements(inputs, accounts, members)`. La factory particiona los movimientos del año por mes (derivado de `date`) y construye **un `GlobalMonthlySummary.fromMovements` por mes** (12 en total, los vacíos incluidos): de cada uno toma los KPIs (ingresos, gastos, compartidos, personales, saldo) y su `tagBreakdown`. Sobre esa base añade en pasadas propias lo nuevo de 009:

- **`memberIncomeRows`**: una fila por miembro del **catálogo** (`members: MemberRef[]` desde `MemberRepository.findAll()`) con ingresos por mes (12 celdas): cada ingreso se atribuye al dueño de la cuenta personal donde se registró (`accountId` → cuenta → `memberId`); los ingresos de la cuenta común van a la fila «Cuenta común» (`memberId: null`). Siempre presentes todas las filas del catálogo (FR-002), con ceros si no hay ingresos. Orden: orden del catálogo (ascendente por `id`, el de `findAll`), fila «Cuenta común» al final.
- **`totalsRow`**: fila «Total ingresos» con la suma de los `incomeTotal` de los 12 resúmenes mensuales.
- **`expenseRealRow`** / **`noPersonalExpenseRow`**: filas «Gasto real» (`expenseTotal`) y «Sin gastos personales» (`sharedExpenseTotal`, que ya incluye compartidos pagados desde cuentas personales — semántica exacta de 002/005/006).
- **`balanceRow`**: fila «Saldo» (`monthBalance` por mes).
- **`accumulatedBalanceRow`**: fila «Saldo acumulado» (FR-012): running total de `balanceRow` desde enero; el total de la fila es el acumulado a diciembre (= total anual de «Saldo»); **sin media mensual**.
- **`tagRows`**: desglose anual por tag: fusión de los 12 `tagBreakdown` por `tagId` (importe por mes, total anual, media /12). Orden por total anual descendente, desempate alfabético `es` (convención de 005/006).
- **Media mensual de cada fila** (salvo «Saldo acumulado»): total anual / 12 con redondeo al céntimo más próximo (`Math.round(totalCents / 12)`, ver §4).

El caso de uso **`GetAnnualIncomeStatement`** (`src/application/movement/`) orquesta: valida el año, lee movimientos del año, cuentas y miembros vía puertos, mapea al DTO. La decisión se registrará como **ADR 0013**.

**Rationale**:
- FR-006 exige coherencia céntimo a céntimo con `/summary` de cada mes: componer `GlobalMonthlySummary` la garantiza **estructuralmente** (cada columna mensual *es* el resumen global de ese mes, misma factory, misma fuente de reglas ADR 0012 → 0010), y un test de invariante la clava. Duplicar los bucles en un VO anual crearía dos fuentes de verdad que pueden divergir.
- La atribución de ingresos por miembro no existe en 005/006 (`memberBreakdown` es solo gastos): reutiliza sin embargo el mecanismo ya validado de 006 (cuenta de pago → dueño → `memberId`; bucket `null` = cuenta común), ahora sobre `type = 'income'`. La agrupación por identidad (`memberId`) y el tratamiento de homónimos replican la decisión de revisión de 006.
- El saldo acumulado es un simple running total sobre la fila «Saldo» (clarificación 2026-09-23): ámbito familiar (los saldos ya son globales del mes), desde enero del año consultado, sin arrastrar historia previa (el balance histórico sigue en la cabecera de `/`).
- Año vacío → 12 resúmenes a ceros → estructura completa a ceros, sin errores (FR-007, gratis por composición).

**Alternatives considered**:

| Opción | Contras |
|---|---|
| VO anual con sus propios bucles para todo (sin componer `GlobalMonthlySummary`) | Duplica las reglas de agregación (naturaleza, multi-tag, orden): dos fuentes de verdad; FR-006 pasaría de garantía estructural a compromiso de mantenimiento. |
| Componer en la aplicación: llamar 12 veces a `GetGlobalMonthlySummary` y sumar DTOs | Lógica de negocio fuera del dominio (VII); el DTO de 006 no expone todo lo que 009 necesita (atribución de ingresos por miembro) → habría que re-leer movimientos igualmente; la invariante FR-006 dejaría de ser estructural. |
| Agregación SQL dedicada (GROUP BY mes/miembro/tag) | Nuevo contrato de puerto de salida + tests de integración para datos que se agregan trivialmente en memoria (005 §1 y 006 §1 ya descartaron esta vía); la atribución por miembro exigiría joins adicionales. |
| Calcular en la página o el componente | Prohibido (VII: la UI nunca calcula). |

---

## 2. Lectura de datos: nuevo método de puerto `listByYear` (FR-001, FR-011)

**Decision**: añadir **`listByYear(year: string): Promise<MovementDTO[]>`** al puerto `MovementRepository` (aplicación) e implementarlo en `DrizzleMovementRepository`: la query de `listByMonth` con el rango ampliado — `gte(date, "YYYY-01-01")` + `lt(date, "{YYYY+1}-01-01")` (rango semicerrado sargable, cruce de año incluido en el límite), mismas joins de tags y mismo `ORDER BY`. El caso de uso lee las cuentas con `AccountRepository.findAll()` (ya expone `memberId`/`memberName`) y el catálogo de miembros con `MemberRepository.findAll()`.

**Rationale**:
- Una única query trae todo lo que el VO necesita para los 12 meses; reutiliza el mapeo `mapJoinedRowsToMovementDTOs` y la convención de rangos de 002/005/006.
- **Rendimiento (FR-011)**: una query de rango por fecha (no 12 ni N por cuenta); sobre ≤ 3.600 filas el escaneo es sub-milisegundo en SQLite/Turso y la agregación en memoria trivial; muy por debajo de 3 s. Añadir un índice `date` exigiría migración que la spec prohíbe (FR-008) — YAGNI, documentado igual que en 006 §2.
- Breaking change del puerto acotado: solo `DrizzleMovementRepository` y dobles de tests implementan `MovementRepository`; el typecheck los obliga a actualizarse en el mismo cambio.
- `MemberRepository.findAll()` ya existe y devuelve `Member[]` con `id`/`name` — fuente del catálogo de filas de FR-002 (una fila por miembro del catálogo, exista o no ingresos).

**Alternatives considered**:

| Opción | Contras |
|---|---|
| 12 llamadas a `listByMonth` desde el caso de uso | 12 queries por render para obtener datos de una sola vez re-segmentados luego por mes; más latencia Turso (red) y más código de orquestación sin ganancia. |
| Puerto dedicado `getAnnualStatement(year)` con agregación en SQL | Rechazada en §1. |
| `listAll()` sin rango y filtrar el año en memoria | Carga historia completa contra FR-011 («sin cargar más años de los necesarios»). |

---

## 3. Selector de año y rango de años ofrecido (FR-001)

**Decision**: nuevo componente cliente **`year-selector.tsx`** (análogo exacto a `month-selector.tsx` de 006, diseñado como semilla de esta reutilización): `YearSelector({ year })`, `Select` shadcn con `aria-label="Año visible"`, opciones de **`buildYearWindow(year, 6)`** (13 años, radio ±6 alrededor del visible), etiqueta literal `String(year)`, navegación a `/annual?year=...` vía `router.replace` dentro de `startTransition`. Se añade **`buildYearWindow`** y **`currentYear`** a `format.ts` (junto a `buildMonthWindow`/`currentMonth`).

**Rationale**:
- Un año tiene pocas opciones relevantes: una ventana de 13 años alrededor del seleccionado cubre historia y futuro razonables (p. ej. visible 2026 → 2020..2032) sin desplegables kilométricos; el selector de mes usa radio 24 para 49 opciones, proporción análoga.
- Replica el patrón probado de 006 (misma navegación, mismo `startTransition`, mismo rol/aria-label) — costo mínimo, consistencia máxima.
- Alternativa considerada: input numérico libre con `<input type="number">` — requiere validación extra y no encaja con el patrón Select del resto de la app; lista completa de años con datos (query extra `min(date)`/`max(date)`) — query y puerto nuevos para una idea de rango que la ventana ya cubre (YAGNI).

---

## 4. Media mensual: total/12 con redondeo al céntimo (FR-003, FR-009)

**Decision**: media = `Math.round(totalCents / 12)` céntimos, calculada en el VO (dominio) y expuesta en céntimos en el DTO; la UI la formatea con los helpers existentes. Siempre /12, exista o no datos y esté o no el año en curso (clarificación 2026-09-23 — réplica del Excel). La fila «Saldo acumulado» no lleva media (FR-012).

**Rationale**:
- ADR 0007 prohíbe coma flotante para *cálculos monetarios* porque acumula error; la media exige una única división, y `Math.round` sobre el resultado da el céntimo más próximo con desviación ≤ 0,005 € una sola vez, no acumulativa: es el único punto de redondeo de la feature y se documenta en el ADR/data-model.
- Alternativa: división entera truncada (`Math.floor`) — sesgo sistemático a la baja en todas las filas (12 truncados pierden hasta 11 céntimos frente al Excel); representar la media como `Money` con fracción — rompe el VO `Money` (céntimos enteros) sin necesidad de precisión sub-céntimo.

---

## 5. Ubicación y estructura de la vista: ruta propia `/annual` (FR-001, FR-002, FR-010)

**Decision**: ruta nueva **`src/app/annual/page.tsx`** (`/annual?year=YYYY`), espejo de `/summary`: server component fino que valida `year` con Zod (`/^\d{4}$/`, default `currentYear()`), enlace «Volver» a `/` + selector de año + panel servidor **`annual-statement-panel.tsx`**. En la pantalla principal se añade un **enlace «Cuenta de resultados»** junto al de «Resumen global», apuntando a `/annual?year={año del mes activo}` (preserva el contexto temporal). La página muestra además un enlace de cross-navigation **«Resumen global»** → `/summary?month={año}-01` (y desde `/summary`, su enlace de entrada pasa a apuntar también al año correspondiente — ver ui-contract §1.2) para que las dos vistas derivadas de ámbito familiar estén enlazadas entre sí.

El panel renderiza dos secciones (`<section aria-labelledby>`):

1. **Tabla mensual** («Cuenta de resultados de {Año}»): tabla semántica con primera columna de rótulos de fila + 12 columnas Ene–Dic (abreviaturas de 3 letras, `MONTH_SHORT_LABELS`) + columnas «Total año» y «Media mensual». Filas: cada miembro del catálogo, «Cuenta común», «Total ingresos», «Gasto real», «Sin gastos personales», «Saldo», «Saldo acumulado» (sin media). Todas las celdas visibles siempre (a 0,00 € si no hay datos, FR-007).
2. **Desglose de gastos por tag**: misma estructura de columnas; una fila por tag con gastos en el año; dos filas finales de totales «Gasto real» y «Sin gastos personales» (FR-005). Estado vacío «Sin gastos este año.» cuando no hay gastos.

Ambas tablas viven en un contenedor con **scroll horizontal** (tabla ancha de 15 columnas): `overflow-x-auto` y `min-w` de tabla — patrón estándar de tablas anchas de Tailwind, sin librería nueva (la tabla de 006 ya es HTML semántico + Tailwind; no existe componente shadcn table).

**Rationale**:
- La pantalla principal está scopeada por cuenta y `/summary` por mes: la vista anual tiene otro ámbito (año) y otro selector → ruta propia, mismo razonamiento que 006 §3 (la spec FR-001 delega ubicación y selector en el plan).
- 12 meses por columna es la estructura literal del Excel que la feature replica (FR-002/FR-004); con total y media añade 2 columnas. En escritorio cabe; en móvil el scroll horizontal es la solución simple sin componente nuevo (YAGNI frente a tablas pivote/pestañas por trimestre).
- El enlace desde `/` preserva el año del mes activo (mismo criterio de contexto temporal que 006).

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Sección anual dentro de `/summary` | Mezcla ámbitos (mes vs año) en una URL con dos selectores que recalculan regiones distintas; confusión y acoplamiento de rutas. |
| Tabs por mes o desglose mensual apilado (12 paneles tipo 006) | Deja de replicar la vista lateral del Excel (la comparación entre meses es el valor); obliga a desplazarse para comparar. |
| Tabla con sticky first column + librería de tablas | Componente nuevo sin justificación (I): el scroll simple cubre el caso a escala familiar. |

---

## 6. Presentación de celdas vacías y fila «Cuenta común» (FR-002, FR-007)

**Decision**: la spec deja al plan decidir «0,00 € o celda vacía». Se decide: **todas las celdas muestran siempre su valor formateado, incluido `0,00 €`** (cero explícito), igual que los KPIs a cero de 005/006 — la tabla es una parrilla completa comparable de un vistazo, y el cero explícito elimina ambigüedad entre «sin datos» y «error de render». La fila «Cuenta común» de ingresos usa la misma etiqueta que el desglose por miembro de 006; las filas de miembros usan su nombre del catálogo. El desglose por tag solo incluye tags **con gastos en el año** (regla de 005/006), con nota permanente heredada sobre multi-tag.

**Rationale**: consistencia con el comportamiento ya aceptado de 005/006 (meses vacíos → ceros visibles, panel no oculto); celdas vacías ahorrarían poco y dificultarían la lectura comparativa fila/columna que es la razón de ser de la vista.

---

## 7. Estrategia de tests y aislamiento e2e (constitución III, FR-006)

**Decision**: cuatro niveles con los patrones de 005/006:

1. **Dominio** (`AnnualIncomeStatement.test.ts`, node): happy path multimes/multicuenta; **invariante FR-006** (los KPIs de cada mes del VO anual = `GlobalMonthlySummary.fromMovements` de ese mes, y tagBreakdown anual = fusión de los 12); atribución de ingresos por miembro (cuenta personal → dueño; cuenta común → fila común; ingreso no atribuye a miembro); homónimos y varias cuentas del mismo miembro → una fila por identidad; catálogo completo siempre presente con ceros; saldo acumulado running desde enero (meses a cero no alteran); total de «Saldo acumulado» = total anual de «Saldo»; medias /12 con redondeo (p. ej. total 100,00 € → media 8,33 €); multi-tag sin duplicar gasto real anual; años contiguos fuera (la factory es total: inputs ya filtrados por el año — test de partición por mes con fechas de diciembre/enero); año vacío → todo a ceros con 12 meses; gastos personales desde cuenta común y compartidos desde personal en las filas correctas; orden de `tagRows` (total desc, alfabético `es`).
2. **Aplicación** (`GetAnnualIncomeStatement.test.ts`, node): dobles en memoria de `MovementRepository` (con `listByYear`), `AccountRepository` y `MemberRepository`; validación de año (rechaza no-4-dígitos sin llamar puertos); mapeo DTO→dominio→DTO; resultados idénticos a los del VO.
3. **Persistencia** (`DrizzleMovementRepository.test.ts`, ampliación): `listByYear` contra libsql `:memory:`: devuelve movimientos de todas las cuentas del año exacto (sin 31-dic del año anterior ni 1-ene del siguiente), con tags; año vacío → [].
4. **UI** (`annual-statement-panel.test.tsx` y `year-selector.test.tsx`, ui jsdom + RTL): filas/celdas con formato es-ES vía helpers, fila «Cuenta común», celdas a 0,00 €, fila «Saldo acumulado» sin media, estado vacío del desglose por tag, y navegación del selector a `/annual?year=`.
5. **E2E** (`e2e/cuenta-resultados-anual.spec.ts`): fichero nuevo, serie dentro del fichero (convención del repo). **Aislamiento**: se registra **solo en la cuenta de Miembro B** y en el **año 2027** (enero y julio con datos, y un año vacío 2028 para la estructura a ceros): 2027 no colisiona con los meses usados por las otras specs (registro usa el mes actual y la común/A con balances históricos; cierre usa Miembro B en el mes actual; edición usa julio/agosto 2026 en B; resumen global usa junio 2026 y consulta vacía enero 2025) y registrando solo en Miembro B no se altera ningún balance histórico de cuentas común/A. Se registran ingresos (nómina B, aportación común no aplicable: solo B), gastos personal y compartido multi-tag, se navega al enlace «Cuenta de resultados» desde `/` y se verifican cifras exactas de celdas concretas (ingreso de B por mes, totales, media anual, saldo acumulado a enero y julio, filas del desglose por tag con total y media) y la estructura a ceros del año vacío. El cambio de año queda en verificación manual (quickstart), como en 005/006.

**Rationale**: el e2e protege el flujo completo registro→cuenta anual con las aserciones justas para cubrir la funcionalidad (tablas amplias: celdas representativas + invariantes de fila); la coherencia FR-006 queda clavada en el test de dominio (más barato y determinista). El aislamiento respeta la convención documentada en AGENTS.md (combinación cuenta/mes propia) extendida al año.

**Alternatives considered**: e2e con los tres cuentas y los 12 meses (lento, frágil, duplica el test de dominio); reutilizar el año 2026 de `resumen-global.spec.ts` (contaminaría sus cifras exactas de junio 2026 si esta spec corriera antes — el orden alfabético `cuenta-resultados` < `resumen-global` lo haría).

---

## Resumen de decisiones (trazabilidad)

| Tema | Decisión | ADR |
|---|---|---|
| Cálculo anual | VO `AnnualIncomeStatement` que **compone 12 `GlobalMonthlySummary`** (cadena 0012 → 0010) + pasadas propias (ingresos por miembro, acumulado, medias, fusión de tags) | **0013** |
| Coherencia FR-006 | Garantía estructural por composición + test de invariante (cada mes = resumen global de 006) | 0013 |
| Lectura de datos | Puerto `MovementRepository.listByYear(year)`; cuentas y miembros vía puertos existentes | 0013 |
| Persistencia | Ninguna: vista derivada (FR-008, ADR 0009); sin índice nuevo (escala familiar, YAGNI) | 0009 → 0013 |
| Media mensual | `Math.round(totalCents / 12)` — único punto de redondeo, al céntimo más próximo | 0007 → 0013 |
| Vista | Ruta propia `/annual?year=` + panel servidor con 2 tablas + scroll horizontal; selector de año `YearSelector` (`buildYearWindow`, radio 6); enlaces desde `/` y a `/summary` | — |
| Celdas vacías | Cero explícito `0,00 €` en todas las celdas (consistencia 005/006); tags solo con gastos + nota multi-tag | — |
| Tests | VO + use case + repo (libsql :memory:) + RTL + e2e nuevo en serie (año 2027, cuenta Miembro B, año vacío 2028) | — |
