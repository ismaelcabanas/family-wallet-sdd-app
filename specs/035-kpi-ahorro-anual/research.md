# Research: KPI de ahorro acumulado del año (035)

**Feature**: 035-kpi-ahorro-anual | **Fecha**: 2026-11-22

Resolución de las decisiones técnicas del plan. Cada sección: decisión, racional y alternativas descartadas.

---

## R1. Definición operativa del acumulado y fórmula mes a mes

**Decisión**: `ahorro acumulado del año Y = Σ (m = Y-01 … Y-12) netMonthBalance(m)` donde `netMonthBalance(m) = closure(m).monthBalanceCents − (savings(m).backedByMovement ? 0 : savings(m).amountCents)` — exactamente la fórmula vigente del «Saldo del mes» (033, `page.tsx`). Cada `closure(m)` se computa con el **mismo servicio de dominio** que usa `GetMonthlyClosure`: `MonthlyClosure.fromMovements(inputs de los movimientos de m)`. Meses sin movimientos computan cierre 0; meses con fila de ahorro congelada legacy (sin movimiento, pre-033) descuentan su `amountCents`; meses con ahorro respaldado por movimiento no descuentan nada (el gasto ya está en el cierre). La suma es entera en céntimos (VO `Money`, ADR 0007) — exacta al céntimo, sin coma flotante.

**Racional**: FR-002/FR-004 exigen la misma definición mes a mes «incluida la composición condicional del ahorro de 033»; reutilizar `MonthlyClosure.fromMovements` hace la coherencia **por construcción** (mismo código, cero recálculo paralelo). El edge «Ahorro deducido legacy» queda cubierto sin código especial.

**Alternativas descartadas**: calcular el año con una única pasada de sumas SQL por tipo/naturaleza (duplicaría la semántica del cierre fuera del dominio); reutilizar `AnnualIncomeStatement` (agrega las 3 cuentas juntas y no expone saldo neto mensual por cuenta con la composición condicional; acoplamiento grande para un número).

## R2. Hogar de la fórmula compartida: helper puro en aplicación

**Decisión**: extraer la fórmula condicional a **una función pura** `netMonthBalanceCents(monthBalanceCents: number, savings: { amountCents: number; backedByMovement: boolean }): number` en `src/application/movement/net-month-balance.ts` (+ test propio). **La página pasa a usarla** para el mes en curso (sustituye la resta inline de `page.tsx`) y el caso de uso nuevo la aplica 12 veces. `MonthSavingsDTO` satisface estructuralmente el parámetro.

**Racional**: la fórmula pasa a necesitarse en 2 sitios (página y caso de uso); FR-004 prohíbe duplicarla. Es composición de DTOs de lectura (no una regla de dominio nueva: la regla nació como «resta de composición» de la página en 023/033), así que vive en aplicación junto a `GetMonthlyClosure`; el dominio queda intacto (constitución I/VII: sin VO nuevo para una resta).

**Alternativas descartadas**: VO/servicio de dominio `NetMonthBalance` (abstracción nueva para una resta; YAGNI); mantener la resta inline en la página y otra copia en el caso de uso (duplicación prohibida por FR-004); que el caso de uso devuelva los 12 saldos y sume la página (lógica de negocio en la UI, constitución VII).

## R3. Caso de uso `GetAnnualAccumulatedSavings` (aplicación/movement)

**Decisión**: `GetAnnualAccumulatedSavings.execute(accountId: number, year: string): Promise<AnnualAccumulatedSavingsDTO>` con `AnnualAccumulatedSavingsDTO = { accumulatedCents: number }` (en `movement/dto.ts`). Valida `year` con `YEAR_PATTERN = /^\d{4}$/` (paridad `GetAnnualIncomeStatement`); lee en paralelo los movimientos del año de la cuenta y las filas de ahorro del año; agrupa por `date.slice(0, 7)`; itera los 12 meses aplicando `MonthlyClosure.fromMovements` + `netMonthBalanceCents` (R1/R2); devuelve la suma. Sin config de ahorro → mapa vacío → cero deducciones (año cubierto solo por movimientos). No valida existencia de cuenta (paridad `GetMonthlyClosure`: la página ya resolvió la cuenta).

**Racional**: la página no puede albergar el bucle de 12 meses (constitución VII); un caso de uso de lectura es el patrón de la casa (`GetMonthSavings`, `GetMonthNetContribution`). DTO monodcampo: la UI solo pinta el total; el año ya lo sabe la página (lo derivó) — sin `months[]` (nadie lo consume; YAGNI).

**Alternativas descartadas**: `GetAccountMonthKpis` agregado que recalcule cierre+KPIs del mes (research 023 §3 ya lo rechazó: input derivado, rompe el orden materialización→lectura); devolver también los 12 saldos mensuales (YAGNI, FR-002 se verifica con tests del total); ejecutar 12× `GetMonthlyClosure` + 12× `GetMonthSavings` (24 queries y re-validaciones por render; funciona pero innecesariamente costoso y difícil de testear).

## R4. Puertos de lectura nuevos (2 métodos, simetría con los existentes)

**Decisión**:
- `MovementRepository.listByYearAndAccount(accountId: AccountId, year: string): Promise<MovementDTO[]>` — espejo exacto de `listByYear` + filtro de cuenta (rango `date` `[Y-01-01, Y+1-01-01)`, mismo `selectMonthRows` con join a tags).
- `SavingsAllocationRepository.findDeductedMonthsOfYear(allocationId: SavingsAllocationId, year: string): Promise<readonly DeductedMonthEntry[]>` con `DeductedMonthEntry = { month: string; amountCents: number; backedByMovement: boolean }`, exportado del propio fichero del puerto. El adaptador hace `LEFT JOIN movements ON movement_id = movements.id` y computa `backedByMovement = movimiento existe` — **misma semántica de existencia** que `findDeductedMovement` (fila huérfana con `movement_id` apuntando a un movimiento borrado computa como congelada, paridad con lo que pinta el KPI del mes al visitarlo, SC-002). Devuelve solo los meses **con fila** (los demás no descuentan).

**Racional**: el año se lee en 2 queries (1 por agregado); los puertos ya exponen lecturas acotadas por cuenta (`listByMonthAndAccount`) y por año (`listByYear`) — los métodos nuevos cierran la matriz. `backedByMovement` calculado en el adaptador evita exponer `movementId` crudo y mantiene la regla de existencia en un solo sitio por vía de lectura.

**Alternativas descartadas**: reutilizar `listByYear` (todas las cuentas) y filtrar por `accountId` en el caso de uso (funciona con 3 cuentas, pero filtra datos a posteriori y lee de más; el método explícito es una línea en Drizzle); 12× `findDeductedAmount`/`findDeductedMovement` (hasta 24 queries); `isDeducted`+`findDeductedAmount` por mes (no distingue respaldo por movimiento).

## R5. UI: 5.ª celda «Ahorro acumulado», layout y evidencia del año

**Decisión**: `AccountMonthKpis` (server component presentacional puro, sticky intacto) gana la prop `accumulatedSavingsCents: number`. `dl` pasa a `grid grid-cols-2 gap-3 sm:grid-cols-5`; orden congelado de las 5 métricas: **Aportación común · Gasto personal · Ahorro del mes · Saldo del mes · Ahorro acumulado** (la agregación, última). La celda nueva lleva `col-span-2 sm:col-span-1` (móvil: fila propia a ancho completo tras el 2×2; ≥`sm`: 5.ª columna). Valor con `formatSignedCents` + `text-red-600` si es negativo (mismo tratamiento que «Saldo del mes», edge «saldos negativos»). Evidencia del año (FR-001): subtext permanente `Año {year}` con `year = month.slice(0, 4)` derivado de la prop `month` existente (slice de presentación, como `monthLabel`). Sin estados ni subtextos condicionales: lectura pura, siempre presente (año vacío → `0,00 €`).

**Racional**: el acumulado es de año, no de mes: colocarlo al final y con su año visible lo distingue del «Ahorro del mes» (edge «doble semántica»). `sm:grid-cols-5` mantiene una fila única en desktop con 5 valores cortos; en móvil el col-span evita un hueco suelto bajo el 2×2.

**Alternativas descartadas**: `sm:grid-cols-4` con 4+1 (quinta celda huérfana en su propia fila en desktop); tarjetón aparte fuera del bloque sticky (rompería la visibilidad continua de 022 y el contrato congelado); año solo en la cabecera del bloque («Noviembre de 2025» — FR-001 lo quiere evidente por sí mismo); `formatAmountCents` sin signo (el acumulado puede ser negativo).

## R6. Cableado de la página (composición, cuenta común intacta)

**Decisión**: `page.tsx` deriva `year = month.slice(0, 4)` tras resolver `month`; añade al `Promise.all` —solo en la rama `account.type === "personal"`— la 6.ª lectura `new GetAnnualAccumulatedSavings(movementRepository, savingsAllocationRepository).execute(account.id, year)`; sustituye la resta inline `closure.monthBalanceCents − (savings.backedByMovement ? 0 : savings.amountCents)` por `netMonthBalanceCents(closure.monthBalanceCents, savings)` (R2); pasa `accumulatedSavingsCents={…}` al bloque. Los 3 awaits secuenciales de materialización quedan **intactos y antes** de las lecturas (así, si la visita materializa el mes consultado, el acumulado del año ya lo refleja en ese render — clarify 2026-11-21). La cuenta común no consulta el caso de uso ni renderiza el bloque (FR-006/AS-7).

**Racional**: espejo del patrón de lecturas condicionadas por tipo de cuenta (022/025); la derivación del año en la página es la misma figura que `currentMonth()` en el adaptador.

**Alternativas descartadas**: que el caso de uso reciba `month` y derive el año internamente (dúplica la derivación; `year` explícito paridad `GetAnnualIncomeStatement`); pasarle los 12 saldos al componente para que sume (lógica en UI).

## R7. e2e: aislamiento determinista en cuenta 2 × 2025 (+2024), con limpieza total

**Decisión**: fichero propio `e2e/kpi-ahorro-anual.spec.ts` (serial), **cuenta 2 («Cuenta de Miembro B») × año 2025** para el flujo principal y **2024-08** para el cambio de año — combinación que ningún otro spec escribe (verificado: `importacion-excel` escribe cuenta 3 × 2027-03; `cuenta-resultados-anual` usa 2027; los demás specs de cuenta 2 usan mes en curso/anteriores o 2026-02/2027; los specs que **leen** agregados de 2025 —`panel-cuentas`, `resumen-global`— corren **después** alfabéticamente). Flujo: año vacío → 0,00 €; altas en 2025-03 y 2025-07 con saldos de signo opuesto → acumulado = suma exacta y coherente con cada «Saldo del mes» visitado; estabilidad navegando meses del mismo año; cambio a 2024 (año con dato propio) → acumulado distinto en la misma visita; tanda de 12 movimientos + scroll a fondo → región KPIs en viewport con el acumulado visible (SC-001); alta en otro mes del año → acumulado actualizado (FR-007). **Limpieza total UI-driven al final**: borrado de todos los movimientos creados (2024 y 2025) y verificación de acumulado 0,00 — obligatoria porque specs posteriores leen `/?month=2025-01`, `/summary?month=2025-01` y `/annual?year=2025` sobre la BD compartida.

**Racional**: convención e2e de la casa (combinación propia + `workers: 1`); el año pasado (decisión del propietario en clarify) hace el acumulado inmutable entre runs.

**Alternativas descartadas**: año en curso (los otros specs de cuenta 2 escriben en él → acumulado no determinista); usar la cuenta 1 (knapsack de estados de `kpis-fijos-cuenta`); navegar a 2027 para el cambio de año (estado dejado por `cuenta-resultados-anual`, dependencia frágil de su limpieza).

## R8. Sin materialización y determinismo en años pasados (FR-005)

**Decisión**: `GetAnnualAccumulatedSavings` es **solo lectura**: jamás materializa (paridad ADR 0016/0017 — los agregados nunca materializan; los meses no visitados computan con los movimientos registrados). Si la página visita un mes no visitado, los materializadores existentes (018/019/033, intactos) corren **antes** de la lectura del caso de uso y el acumulado del año se recalcula con los datos vigentes en ese mismo render (clarify 2026-11-21). Los tres materializadores guardan `activatedAtMonth > month || month > currentMonth` → **visitar meses de un año pasado con configs activadas después jamás materializa nada**: el e2e en 2025/2024 es determinista aunque specs anteriores hayan dejado configs activas en la cuenta 2.

**Alternativas descartadas**: materializar el año entero al consultar (viola FR-005 y la decisión del propietario 2026-10-12); congelar el acumulado por visita (rechazado en clarify).

## R9. Documentación y sin ADR nuevo

**Decisión**: en la implementación (FR-009): amend del bloque «Bloque KPIs sticky» de `AGENTS.md` (4 → 5 métricas, fórmulas vigentes con el helper compartido y la 6.ª lectura), fila 035 → Completada en el roadmap maestro, y actualización de `docs/architecture/overview.md` + `docs/architecture/diagrams/pagina-cuenta-sequence.md` (5.ª celda, nuevo caso de uso y puertos). **Sin ADR nuevo**: no hay decisión arquitectónica inédita — es la extensión natural de los patrones de lectura agregada de 022–024 (que tampoco registraron ADR).

**Alternativas descartadas**: ADR «KPI de año» (documentaría una no-decisión; ruido en `docs/architecture/adr/`).
