# Research: Cierre Mensual por Cuenta

**Feature**: `005-cierre-mensual` | **Fecha**: 2026-09-10

Investigación de Phase 0 para resolver las incógnitas del Technical Context del [plan.md](./plan.md). Parte de cero incógnitas tecnológicas nuevas (stack fijado por 002 y la constitución); las decisiones aquí son de **ubicación del cálculo, composición de UI y estrategia de tests**. Cada sección documenta: decisión, racional y alternativas consideradas.

---

## 1. Dónde vive el cálculo del cierre (FR-002..FR-006, FR-009)

**Decision**: VO de dominio puro **`MonthlyClosure`** (`src/domain/movement/MonthlyClosure.ts`) con factory `MonthlyClosure.fromMovements(inputs)`; el caso de uso **`GetMonthlyClosure`** (`src/application/movement/GetMonthlyClosure.ts`) recibe los `MovementDTO` del mes **ya cargados por `ListMovements`** en la misma página, los mapea al input del dominio y devuelve un `MonthlyClosureDTO`. La decisión se registrará como **ADR 0010**.

**Rationale**:
- Los KPIs son lógica de negocio (constitución III: totales/cierres MUST estar cubiertos por tests; VII: el dominio se modela con VOs y servicios de dominio). Agregar importes, separar por naturaleza y la regla "multi-etiquetado computa una vez por tag pero no duplica totales" son reglas de negocio, no de presentación.
- La pantalla ya carga los movimientos del mes para el listado (`MovementRepository.listByMonthAndAccount`): el cierre es una **segunda vista sobre los mismos datos**. Calcularlo en memoria evita una segunda query idéntica y un método de puerto nuevo; FR-011 (<3 s / 300 movimientos) queda cubierto con margen enorme (agregación en memoria de 300 items ≈ microsegundos).
- Aritmética con el VO `Money` existente (`add`, `fromCentsOrZero` para saldos que pueden ser negativos): cero coma flotante (ADR 0007).
- El caso de uso toma `MovementDTO[]` (no re-fetcha): `page.tsx` ejecuta `ListMovements` una vez y alimenta listado y cierre con el mismo array — sin doble lectura ni riesgo de divergencia entre listado y KPIs.

**Reglas de implementación**:
- Input del dominio: registro puro `{ type, nature, amountCents, tags: { id, name }[] }` — el VO no conoce DTOs de aplicación (principio VII invertido: aplicación depende de dominio, nunca al revés).
- Invariantes del VO: `incomeTotal = Σ ingresos`; `expenseTotal = Σ gastos`; `shared + personal = expenseTotal` (todo gasto lleva naturaleza, FR-005 de 002); `monthBalance = incomeTotal − expenseTotal` (admite negativos, `Money.fromCentsOrZero`); desglose por tag: cada gasto suma **una vez por cada tag que lleva** (la suma del desglose PUEDE exceder `expenseTotal` si hay multi-etiquetado — esperado, escenario 5); orden del desglose: importe desc, desempate por nombre asc (determinista para tests).
- Los ingresos no computan en naturaleza ni en el desglose (edge case de la spec); `nature` de un ingreso se ignora si llegara poblada.
- Mes/cuenta vacíos → VO con todo a 0 (`Money.fromCentsOrZero(0)`) y desglose vacío.

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Agregación SQL dedicada (nuevo método de puerto `getMonthlySummary` + GROUP BY en `DrizzleMovementRepository`) | Duplica la lectura del mes que ya hace el listado (misma query dos veces por pantalla); nuevo contrato de puerto + implementación + tests de integración para datos que ya están en memoria; la naturaleza y las tags requieren joins idénticos a los del listado. Solo ganaría si el cierre se pintara sin listado. |
| Calcular en el caso de uso (aplicación) sin VO de dominio | Deja lógica de negocio (regla multi-tag, cuadre naturaleza) fuera del dominio, inconsistente con `Money`/`Movement.create`; menos reutilizable para la feature 006 (resumen global reutilizará el VO). |
| Calcular en la página o el componente | Prohibido (constitución VII: PROHIBIDO duplicar lógica de negocio en componentes); in testeable con RTL sin montar todo. |
| Materializar totales (tabla `monthly_closures` o columnas calculadas) | Viola FR-009 y ADR 0009: drift garantizado al editar/eliminar (feature 003); escrituras extra en Turso single-writer. |

---

## 2. Ubicación y composición del panel en la pantalla (FR-001, FR-008, FR-010)

**Decision**: componente **servidor** `MonthlyClosurePanel` (`src/infrastructure/primary/ui/monthly-closure-panel.tsx`) colocado **entre el formulario y el listado**, en el flujo visual: selectores → balance → formulario → **panel de cierre** → listado. Orden interno: tarjeta con título "Cierre de {Mes YYYY}" + grid de KPIs + desglose por tag.

**Rationale**:
- Componente servidor (sin estado ni interactividad): recibe el DTO y pinta; cero JS cliente añadido; se re-renderiza con `revalidatePath('/')` existente al registrar movimientos (FR-008 gratis, sin acción nueva).
- Posición: los dos "outputs" del mes (cierre y listado, agregado + detalle) quedan juntos debajo del input (formulario). No desplaza el formulario —acción primaria, SC-001 de 002 (registro < 30 s)— del tercio superior. Es también el orden de relleno del Excel: se registran movimientos y abajo queda el cierre.
- Reutiliza los helpers de `format.ts`; se añade `formatSignedCents(cents)`: `+` para positivo, `−` (U+2212, como `formatSignedAmountCents` de 002) para negativo, sin signo para 0 — FR-004 ("mostrarlo con signo (positivo, negativo o cero)").

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Panel sobre el formulario (selectores → balance → cierre → form → listado) | Empuja la acción primaria hacia abajo; el cierre cambia con cada registro, movimiento visual mayor durante el registro repetido. |
| Pantalla/ruta propia (`/cierre?account=&month=`) | Rompe FR-008 ("misma pantalla, sin navegación adicional"); duplicaría la lectura del mes o exigiría estado compartido. |
| Client component con fetch | Sin beneficio: no hay interactividad; añade JS, loading states y una frontera más (constitución I). |

---

## 3. Formato numérico y textos (FR-004, FR-007, FR-010)

**Decision**: KPIs de totales sin signo (`1.920,00 €`, `970,50 €`) — el signo lo aporta la etiqueta ("Ingresos"/"Gastos"); **solo el saldo del mes lleva signo contable** (`+949,50 €` / `−51,20 €` / `0,00 €`). Todo con `Intl es-ES` existente; textos exactos en [contracts/ui-contract.md](./contracts/ui-contract.md) §3.

**Rationale**: replica el Excel de Balance (columnas de positivos con etiqueta, saldo con signo); evita ambigüedad de dobles signos; consistente con `formatSignedAmountCents` del listado (U+2212, no hyphen).

*Pitfall heredado de 002 (research.md §1 de 002)*: `Intl es-ES` inserta espacio no rompible (`\u00A0`/`\u202F`) entre cifra y `€` — los tests de UI y e2e comparan con los helpers de formateo o con el código del espacio, nunca con un string literal `"850,00 €"` frágil.

---

## 4. Estrategia de tests (constitución III)

**Decision**: tres niveles + e2e, todos con patrones ya fijados por 002:

1. **Dominio** (`MonthlyClosure.test.ts`, proyecto node): happy path con mezcla de tipos/naturalezas, multi-tag (computa por tag sin duplicar total), ingreso sin naturaleza, mes vacío → ceros, saldo negativo, orden y desempate del desglose, invariante `shared + personal = expenseTotal`.
2. **Aplicación** (`GetMonthlyClosure.test.ts`, proyecto node): mapeo DTO→dominio→DTO, resultados idénticos a los del VO, sin dependencias de BD (entrada: arrays de DTOs).
3. **UI** (`monthly-closure-panel.test.tsx`, proyecto ui jsdom + RTL): KPIs y desglose renderizados con formato es-ES (usando los helpers), estado vacío ("Sin gastos este mes."), orden del desglose.
4. **E2E** (`e2e/cierre-mensual.spec.ts`): fichero nuevo, specs **en serie** dentro del fichero (estado compartido de `e2e.sqlite`, convención de 002); registra vía UI los movimientos del escenario 1 de la spec (ingreso 1.920,00 + hipoteca 850,00 con Vivienda+Hipoteca + luz 120,50 con Hogar en la cuenta común) y verifica los KPIs exactos del panel; luego cambia a una cuenta personal con gastos de ambas naturalezas; verifica mes vacío → ceros.

**Rationale**: el e2e protege el flujo completo registro→cierre (la acción de esta feature) sin repetir la casuística de validación del formulario (ya cubierta por `e2e/registro-movimientos.spec.ts`). No se añade e2e de rendimiento (SC-002 se verifica informalmente como SC-001/002 en 002 — modo PoC).

**Alternatives considered**: reutilizar el fichero e2e de 002 (acoplamiento entre features: el flujo de registro se tocaría al cambiar el cierre); tests de snapshot (frágiles con Intl/NBSP).

---

## Resumen de decisiones (trazabilidad)

| Tema | Decisión | ADR |
|---|---|---|
| Ubicación del cálculo | VO de dominio `MonthlyClosure` + caso de uso sobre DTOs del mes ya cargados | **0010** |
| Persistencia | Ninguna: vista derivada recalculada por consulta (extensión ADR 0009) | 0009 → 0010 |
| Panel UI | Componente servidor entre formulario y listado; solo formatea | — |
| Formato | Totales sin signo; saldo del mes con signo contable U+2212 / `+` / sin signo si 0 | — |
| Orden del desglose | Importe descendente, desempate por nombre ascendente | — |
| Tests | VO + use case + componente RTL + e2e nuevo en serie dentro del fichero | — |
