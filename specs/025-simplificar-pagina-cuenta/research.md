# Research — Simplificación de la página de cuenta: retirada de balance acumulado y cierre (025)

**Feature**: `025-simplificar-pagina-cuenta` | **Fecha**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

Investigación verificada contra el código real (fuentes citadas por fichero:línea). Toda decisión sigue el formato **Decisión / Rationale / Alternativas**.

---

## §1. Página de cuenta resultante: secciones retiradas y lecturas condicionadas (FR-001, FR-003)

**Decisión**: `src/app/accounts/[accountId]/page.tsx` elimina los dos últimos bloques del render (`<AccountBalance …>` en `page.tsx:138-142` y `<MonthlyClosurePanel …>` en `page.tsx:144`) y sus imports (`page.tsx:21,27`). El `Promise.all` pierde la lectura de balance (`accountRepository.getBalance(...)` en `page.tsx:91`) y `GetMonthlyClosure` pasa a ejecutarse **solo en cuentas personales**, con el mismo patrón condicional que ya usan `netContribution`/`savings` (`page.tsx:94-102`): `account.type === "personal" ? new GetMonthlyClosure(...).execute(...) : Promise.resolve(null)`. La guarda del bloque KPI añade `closure !== null`.

**Rationale** (verificado en código):

- La página hoy renderiza, en orden: h1+nav, subtítulo, `MonthStepper` (`:117`), KPIs solo personales (`:119-127`), `GroupedMovementList` (`:129-136`), `AccountBalance` (`:138-142`) y `MonthlyClosurePanel` (`:144`). Tras 025 quedan los cuatro primeros; SC-001 exige 0 apariciones de las regiones «Balance de {cuenta}» (`account-balance.tsx:20`) y «Cierre de {mes}» (`monthly-closure-panel.tsx:18`).
- `getBalance` tiene **un único llamador de producción**: `page.tsx:91` (grep verificado). Retirar la lectura retira el último uso; el puerto jubila el método (§3).
- `GetMonthlyClosure` **no cambia contrato ni lógica** (FR-003): sigue siendo la fuente de composición de los KPIs (`closure.personalExpenseCents` y `closure.monthBalanceCents`, restas de 024/023 en `page.tsx:122,124`). Condicionar su ejecución al tipo de cuenta replica literalmente el patrón existente para `GetMonthNetContribution`/`GetMonthSavings` — la cuenta común hoy ya no consume su resultado para nada visible (el panel era su único destino), y FR-003 ordena dejar de ejecutarlo y de consultar el balance para la común.
- El orden de los 3 awaits secuenciales de materialización (018/019/023, `page.tsx:70-87`) **no se toca** (FR-006): siguen disparándose para toda cuenta antes de leer, igual que hoy.
- El chequeo de orden dinámico `main > *` de `pagina-cuenta.spec.ts:138-150` usa índices calculados sobre `aria-labelledby`; al desaparecer las secciones finales solo cambian los índices resultantes, no el mecanismo.

**Alternativas rechazadas**:

1. **Mantener `GetMonthlyClosure` incondicional** y solo condicionar el render — ejecuta una lectura que la cuenta común ya no consume (query inútil por render; FR-003 explícito). Rechazada.
2. **Ocultar con CSS / feature flag** — deja código muerto ejecutándose, viola SC-004 y YAGNI. Rechazada.
3. **Envolver la ejecución condicional en un caso de uso nuevo** («GetAccountMonthView») — mueve el mismo `if` a una clase nueva sin valor; la página ya es el adaptador fino que compone (precedente 022/023/024). Rechazada.

## §2. `GetMonthlyClosure` conservado como fuente interna; KPIs intactos (FR-003, FR-006)

**Decisión**: `src/application/movement/GetMonthlyClosure.ts` y su DTO (`src/application/movement/dto.ts:62-69`) quedan **byte a byte iguales**, con sus unit tests (`GetMonthlyClosure.test.ts`, 3 tests) intactos. La página sigue componiendo las **dos únicas restas** `personalExpenseCents = closure.personalExpenseCents − netContribution.amountCents` (024) y `netMonthBalanceCents = closure.monthBalanceCents − savings.amountCents` (023) dentro de la rama de cuentas personales. `AccountMonthKpis` y su contrato congelado 4 métricas/sticky/grid no cambian.

**Rationale**: tras 025 la coherencia KPI ↔ cierre deja de ser un producto visible y pasa a ser **coherencia por construcción** (ambos números salen del mismo `MonthlyClosureDTO` que la página lee una vez — la spec lo registra en el edge «Coherencia KPI ↔ cierre»). Los unit tests del caso de uso + dominio garantizan la aritmética bruta (spec, Assumptions). Grep verificado: nadie más consume `GetMonthlyClosure` (solo `page.tsx` y su test); `/summary` usa `GetGlobalMonthlySummary` y `/annual` `GetAnnualIncomeStatement`, ambos **sin** `getBalance` (`GetGlobalMonthlySummary.ts:24-27`, `GetAnnualIncomeStatement.ts:27-31`).

**Alternativa rechazada**: jubilar también `GetMonthlyClosure` y recomponer los KPIs desde lecturas nuevas — duplicaría agregados ya existentes (FR-003 lo prohíbe expresamente).

## §3. Barrido de código muerto: componentes, puerto `getBalance` y helper `monthEndIsoDate` (FR-002, FR-004; SC-004)

**Decisión**: jubilación completa y en el mismo cambio de todo el código que queda sin llamantes:

1. **Componentes UI + tests**: `src/infrastructure/primary/ui/account-balance.tsx` (+ `account-balance.test.tsx`, 4 tests) y `monthly-closure-panel.tsx` (+ `monthly-closure-panel.test.tsx`, 6 tests). Grep verificado: sus únicos importadores son `page.tsx` y sus propios tests (`/` dejó de usarlos en 012; `GlobalSummaryPanel` solo replica estructura, no importa).
2. **Puerto**: `getBalance(id, asOf?)` de `src/application/account/AccountRepository.ts:10` + implementación `DrizzleAccountRepository.ts:70-83`. El puerto queda con `findAll`, `findById`, `findByName`, `update`.
3. **Tests que lo cubren específicamente**: 5 tests de `DrizzleRepositories.test.ts:120-218` (retirada); en `DrizzleRegularIncomeRepository.test.ts:121-136` y `DrizzleCommonContributionRepository.test.ts:133-148` el test «visible a listByMonthAndAccount y a getBalance» conserva **solo la mitad de `listByMonthAndAccount`** (re-anclaje exigido por FR-004) y se renombra en consecuencia.
4. **Dobles de test de `AccountRepository`** (dejan de declarar el método, 10 ficheros): `ListAccounts.test.ts:15`, `RenameAccount.test.ts:21`, `GetGlobalMonthlySummary.test.ts:73`, `GetAnnualIncomeStatement.test.ts:106`, `UpdateMovement.test.ts:86`, `CreateMovement.test.ts:82`, `ConfigureSavingsAllocation.test.ts:99-101`, `ConfigureCommonContribution.test.ts:103-105`, `MaterializeCommonContributions.test.ts:240-242`, `ConfigureRegularIncome.test.ts:69-71`.
5. **Helper colateral `monthEndIsoDate`**: `src/infrastructure/primary/ui/format.ts:55` queda sin consumidores de producción (su único uso era `page.tsx:91`; `shiftMonth` sí lo usa `MonthStepper` y **se conserva**). Se jubila junto a sus 2 tests (`format.test.ts:117-125`) — mismo criterio YAGNI/SC-004 que el resto del barrido. `overview.md:160` menciona el helper y se actualiza (§7).

**Rationale**: FR-002/FR-004 y SC-004 exigen 0 restos; la misma política aplicó `012-panel-cuentas` a la UI retirada de `/`. El typecheck sobre `AccountRepository` (interfaz) fuerza el barrido completo de dobles — no puede quedar a medias. La verificación de visibilidad de movimientos materializados (018/019) queda re-anclada en `listByMonthAndAccount` (puerto `MovementRepository.ts:9`), que ya es el ancla de los tests de visibilidad de `DrizzleMovementRepository.test.ts`.

**Alternativas rechazadas**: conservar `getBalance` «por si acaso» (YAGNI, principio I; FR-004 explícito); marcar `@deprecated` sin borrar (deja código muerto, SC-004).

## §4. E2E: retirada de `cierre-mensual.spec.ts` y re-anclaje fichero a fichero (FR-005)

**Decisión**: `e2e/cierre-mensual.spec.ts` se **elimina** (su sujeto UI desaparece; FR-005). Los demás ficheros se re-anclan **conservando flujos e importes verificados**. Inventario completo verificado (16 ficheros en `e2e/`, sin fixtures compartidos; los 5 no listados en FR-005 — `aportacion-comun`, `cuenta-resultados-anual`, `descuento-gastos-comunes`, `renombrado-cuentas-miembros`, `resumen-global` — no referencian cierre/balance de la página de cuenta):

| Fichero | Ancla actual (verificada) | Re-anclaje decidido |
|---|---|---|
| `cierre-mensual.spec.ts` | todo el fichero (regiones «Cierre de», `:59-107`) | **RETIRADA** |
| `pagina-cuenta.spec.ts` | `:85-87` región «Acumulado hasta Abril de 2026» (P1); `:181` `/^-120,00/` (P2); `:195` `/^0,00/` (P3) | P1 → región «KPIs del mes» visible + etiqueta pasiva «Abril de 2026»; P2/P3 → celda KPI «Saldo del mes» (helper `balanceCell` estilo `kpis-fijos-cuenta.spec.ts:62-64`), explícito en vez de implícito |
| `edicion-movimientos.spec.ts` | helper `closurePanel` `:7-9`; `selectMonth` espera al cierre `:17-24`; E1 `:108-110`; E2 `:138-142` | `selectMonth` → esperar al `combobox «Mes visible»` con `toContainText` (patrón `resumen-global.spec.ts:17-21`); E1/E2 → celda KPI «Gasto personal» **78,50** (naturaleza personal, mes exclusivo Agosto 2026) + ausencia de fila ya cubierta en `:134-136` |
| `gestion-tags.spec.ts` | helper `closurePanel` `:7-9`; `selectMonth` `:21-28`; G2 `:104-109,138-148`; G4 `:200-211`; G5 `:249-251` | `selectMonth` → combobox; totales 80,00 → celda KPI «Gasto personal» (Sept 2026 exclusivo); desglose por tag (supermercado 50,00) → filas del listado con importe firmado (la fila ya se aserta con el tag en `:131-136`); G5 → quedan las aserciones de fila `:243-248` (suficientes) |
| `creacion-tags.spec.ts` | `selectMonth` espera al cierre `:13-20` | `selectMonth` → combobox (única referencia) |
| `ingresos-regulares.spec.ts` | R2 checksum de idempotencia sobre región «Balance de Cuenta de Miembro A» `:92-93,111-114` | checksum sobre celda KPI «Saldo del mes» = **+2000,00 €** (cuenta A personal, mes solo con el ingreso materializado; sin ahorro → neto = bruto), patrón before/after conservado |
| `registro-movimientos.spec.ts` | E1 `:143` `/^500,00/` = **balance histórico absoluto** de la común; E2 `:162` `/^-120,50/` (cierre/KPI, implícito); E3 `:176` `/^1500,00/` = dd «Ingresos» del cierre | E1 (común: sin KPIs) → conteo de filas `[data-testid="movement-item"]` = 4 (filas ya asertadas individualmente); E2 → celda KPI saldo **−120,50 €** explícita; E3 → celda KPI saldo **+1379,50 €** (−120,50 + 1500, determinista; la fila `+1500,00` ya se aserta en `:174`) |
| `kpis-fijos-cuenta.spec.ts` | K2 `:195-201` contraste KPI ↔ panel de cierre | **eliminar** el contraste (la aserción KPI `:191-193` ya existe; coherencia por construcción tras 025); `kpiBalanceText` muerto se borra |
| `cuenta-kpi-gasto-personal.spec.ts` | G2 `:251-258` identidad `cierre «Gastos personales» 640,55 − aportación 440,00 = KPI 200,55` | **eliminar** la pierna del cierre (KPI 200,55 y saldo +1299,45 ya asertados en `:245-249`; la identidad vive en `page.tsx:122` y en unit tests) |
| `porcentaje-ahorro.spec.ts` | A2 `:184-191` lee el saldo **bruto** del cierre para derivar el neto esperado; helper `closureRegion` `:68-70` | bruto = **Σ importes firmados de las filas del listado del mes** (parse con `parseEurCents` ya existente); neto esperado = bruto − 300,00 → celda KPI saldo. Autónomo del estado upstream |
| `panel-cuentas.spec.ts` | N1 `:57` guarda negativa «Cierre de» count 0 en `/` | sustituir por guarda equivalente región «KPIs del mes» count 0 en `/` (paridad con la guarda «Movimientos del mes» `:56`; la de «Cierre de» quedaría vacua) |

**Decisiones transversales**:

- **Espera de cambio de mes**: el cierre era el ancla de «mes establecido» en 3 helpers `selectMonth`; el combobox «Mes visible» (`resumen-global.spec.ts:17-21`) es el reemplazo canónico ya usado por la suite.
- **Cadena de estado B**: `cuenta-kpi-gasto-personal.spec.ts` G1 (barrido defensivo de «Aportación»/«Hipoteca»/«Gasolina») y G7 (restauración `:372-377`) se **conservan intactos**: G1 queda defensivo (al borrar `cierre-mensual`, su E1 ya no crea esos restos) y G7 sigue siendo el proveedor del estado del que depende `porcentaje-ahorro.spec.ts` A2 (verificado: A2 suma «Aportación» +1920,00 y «Gasolina» −60,00 restaurados por G7). Borrar `cierre-mensual.spec.ts` no altera el orden relativo de los demás ficheros (orden alfabético).
- **Importes formateados**: en este Node, `Intl.NumberFormat("es-ES", EUR)` no agrupa millares (1500 → «1500,00 €», verificado por ejecución) — los patrones regex propuestos son consistentes con la suite existente.
- **Flujo crítico de registro** (`registro-movimientos.spec.ts`): sigue cubierto end-to-end con las mismas altas/ediciones/eliminaciones; solo cambian las anclas de agregado (constitución III, FR-005).

**Alternativas rechazadas**: reescribir los e2e afectados contra `/summary` (cambia el flujo verificado — la página de cuenta es el sujeto); mantener `cierre-mensual.spec.ts` re-anclado a KPIs (duplicaría `kpis-fijos-cuenta`/`cuenta-kpi-gasto-personal`; FR-005 lo retira expresamente).

## §5. Aislamiento e2e tras la retirada (FR-007; Assumptions)

**Decisión**: se mantienen `workers: 1`, specs en serie dentro de cada fichero y combinación cuenta/mes propia por spec. La justificación de AGENTS.md se re-escribe: desaparece el motivo «algunas specs asertan el balance histórico absoluto» (la última aserción de esa clase era `registro-movimientos.spec.ts:143`, re-anclada a conteo de filas del mes) y queda como motivo la **BD compartida determinista** entre specs: cada fichero debe encontrar su combinación cuenta/mes en el estado exacto en que la dejó el fichero anterior, y varios specs leen agregados del mes en curso de cuentas que otros escriben (p. ej. `porcentaje-ahorro` A2 depende de los movimientos restaurados por `cuenta-kpi-gasto-personal` G7).

**Rationale**: la retirada es de presentación; el riesgo de contaminación entre specs (movimientos en el mismo mes/cuenta) no cambia. Eliminar `workers: 1` convertiría el orden alfabético — que la suite usa como contrato de estado (024 research §5) — en una carrera.

**Alternativa rechazada**: relajar a paralelismo por fichero — rompería la cadena de estado verificada de la suite actual.

## §6. Cobertura de la aritmética del cierre tras retirar `cierre-mensual.spec.ts` (constitución III)

**Decisión**: la lógica bruta del cierre queda cubierta por (a) unit tests de `GetMonthlyClosure` (3 tests: cálculo completo, mes inválido, mes vacío) y del VO `MonthlyClosure` (dominio); (b) e2e de KPIs 022-024 (`kpis-fijos-cuenta`, `cuenta-kpi-gasto-personal`, `porcentaje-ahorro`), que verifican los importes finales compuestos **sobre el mismo DTO**; (c) `pagina-cuenta.spec.ts` P3 y `porcentaje-ahorro` A5 para el mes vacío. La e2e de cuenta común sin agregados queda como P2 de la propia spec (escenario 2 de la US: sin KPIs, sin balance, sin cierre).

**Rationale**: lo que `cierre-mensual.spec.ts` verificaba en UI (Ingresos/Gastos/Saldo del mes + desglose por tag) tiene hoy superpuesta la cobertura KPI (mismos números compuestos) y unitaria (aritmética exacta); el desglose por tag mensual por cuenta pierde representación UI por decisión de la spec (edge «Desglose por tag»).

## §7. Documentación y ADRs (FR-007)

**Decisión**:

- **AGENTS.md**: (1) párrafo **E2E** — nueva justificación del aislamiento (§5); (2) párrafo **Materialización perezosa** — «cubren listado, cierre y balance del mismo render» → «cubren listado y KPIs del mismo render»; (3) párrafo **KPIs sticky 022/024** — cierre final «KPI y cierre coherentes por construcción…» re-expresado: `GetMonthlyClosure` sobrevive como **fuente interna de composición** (sin panel visible; coherencia por construcción); (4) párrafo **023** — «(cierre/resumen/anual/balance intactos)» → «(resumen/anual intactos)». Se añade una convención corta «Página de cuenta = vista operativa (025)»: stepper + KPIs (personales) + listado; la consulta agregada vive en `/summary` y `/annual`.
- **Roadmap maestro**: fila `025` → **Completada** al cerrar (la nota 2026-11-01 ya registra la decisión). Las notas históricas (011/020) no se reescriben: son registro histórico; la fila 025 es el registro de supersession.
- **docs/architecture/**: `overview.md` (líneas 68, 103, 115, 145, 151, 160 — puerto sin `getBalance`, composición de la página sin balance/cierre, componentes retirados, helper jubilado, índice de diagramas); `diagrams/pagina-cuenta-sequence.md` (intro `:3`, pasos `getBalance` `:37-39`, render `:56`, revalidación `:64,70`, nota de coherencia `:72`); `diagrams/c4.md` (`:17` relación user, `:44` «SUM de balance», `:60` componente panel, `:76,114-115` página/puertos); notas de `panel-cuentas-sequence.md` (`:30,81`), `ingreso-regular-secuencia.md` (`:33,39`), `aportacion-comun-secuencia.md` (`:43,49`), `registro-movimiento-sequence.md` (`:74`) y `domain-model.md` (`:415` «Balance: query derivada»).
- **ADR 0009 (balance derivado)**: se añade **nota de jubilación** (2026-11-02, feature 025): el puerto `getBalance` y la representación UI del balance acumulado se jubilan sin sustituto; el principio subyacente (vistas derivadas, no persistidas) sigue vigente en cierres/resúmenes. No se reescribe el cuerpo del ADR.
- **ADR 0010 (cierre mensual)**: nota breve análoga — el panel UI se retira (025); `GetMonthlyClosure` sobrevive sin cambios como fuente interna de KPIs.
- **README.md:8**: mención caducada («balance acumulado por cuenta» en `/`, stale desde 012) se corrige en el mismo barrido documental.
- Las specs/planes históricos (011, 022-024) son artefactos congelados y **no se editan**; la fila 025 del roadmap es el registro de supersession.

**Rationale**: constitución (DoD: documentación en el mismo cambio; ADRs como registro). Anotar 0009/0010 en vez de crear ADR nuevo: no hay decisión arquitectónica nueva, solo la jubilación de una superficie de producto decidida por el propietario.

**Alternativa rechazada**: ADR nuevo «Retirada del balance y el cierre» — duplicaría lo que spec + roadmap + notas de 0009/0010 ya registran.

## §8. Matriz de tests por capa (SC-002, SC-004)

| Capa | Fichero | Cambio |
|---|---|---|
| Componente (jsdom) | `account-balance.test.tsx` (4) · `monthly-closure-panel.test.tsx` (6) | **ELIMINADOS** con sus SUT |
| Aplicación (node) | 10 dobles de `AccountRepository` | dejan de declarar `getBalance` |
| Aplicación (node) | `GetMonthlyClosure.test.ts` | **INTACTO** (FR-003) |
| Repositorio (node, libsql :memory:) | `DrizzleRepositories.test.ts` | 5 tests de `getBalance` retirados; el resto intacto |
| Repositorio (node) | `DrizzleRegularIncomeRepository.test.ts` · `DrizzleCommonContributionRepository.test.ts` | test de visibilidad re-anclado a `listByMonthAndAccount` (solo la mitad que queda) |
| UI helpers | `format.test.ts` | 2 tests de `monthEndIsoDate` retirados con el helper |
| E2E | 12 ficheros (tabla §4) | 1 retirado, 11 re-anclados sin debilitar flujos |

Gates de cierre: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` en verde; SC-004 verificado por grep (0 apariciones de `AccountBalance`, `MonthlyClosurePanel`, `getBalance`, `monthEndIsoDate` en `src/`).

---

**NEEDS CLARIFICATION**: ninguno — todos los puntos del Technical Context y de la spec quedan resueltos contra código en §1–§8.
