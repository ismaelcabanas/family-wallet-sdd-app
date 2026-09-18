# Research: Resumen Mensual Global

**Feature**: `006-resumen-global-mensual` | **Fecha**: 2026-09-15

Investigación de Phase 0 para resolver las incógnitas del Technical Context del [plan.md](./plan.md). Sin incógnitas tecnológicas nuevas (stack fijado por 002/005 y la constitución); las decisiones son de **composición del cálculo global, lectura de datos, ubicación de la vista y estrategia de tests**. Cada sección documenta: decisión, racional y alternativas consideradas.

---

## 1. Cómo se calcula el resumen global: composición del cierre existente (FR-001..FR-004)

**Decision**: VO de dominio **`GlobalMonthlySummary`** (`src/domain/movement/GlobalMonthlySummary.ts`) con factory `fromMovements(inputs, accounts)`. Los KPIs agregados (ingresos, gastos, compartidos, personales, saldo y desglose por tag) **se obtienen por composición**: la factory delega en `MonthlyClosure.fromMovements(inputs)` —la única fuente de las reglas de agregación (005/ADR 0010)— y añade en su propia pasada lo único que el cierre no puede dar: el **desglose por miembro**, atribuyendo cada gasto a `memberName` de la cuenta personal desde la que se pagó (bucket sin atribución para la cuenta común). El caso de uso **`GetGlobalMonthlySummary`** (`src/application/movement/`) orquesta: valida el mes, lee movimientos y cuentas vía puertos y mapea al DTO. La decisión se registrará como **ADR 0012**.

**Rationale**:
- Ninguna de las reglas agregadas depende de la cuenta: naturaleza, totales y desglose por tag sobre la unión de movimientos del mes tienen exactamente la semántica de `MonthlyClosure` (FR-002 queda garantizado **estructuralmente**: cierre global = Σ cierres por cuenta, por asociatividad de las sumas en céntimos). Duplicar esos bucles en un segundo VO crearía riesgo de divergencia entre cierre y resumen (el bug que FR-002 prohíbe).
- El desglose por miembro sí necesita `accountId` → cuenta → miembro, información que los cierres no llevan: se calcula en una pasada propia del VO global, con la misma disciplina (céntimos enteros, `Money`).
- La atribución usa la **identidad del miembro** (`memberId`), expuesta ampliando `AccountDTO` con `memberId: number | null` (el `findAll` ya hace el join de miembros para `memberName`): la fila es del miembro, no de su nombre — dos homónimos no fusionan y varias cuentas personales del mismo miembro sí — y `memberName` viaja al DTO solo para visualización (decisión del revisor, 2026-09-15).
- Mes sin movimientos → VO a ceros y desgloses vacíos (`MonthlyClosure` ya lo garantiza para la parte agregada).

**Reglas de implementación**:
- Inputs de dominio (registros puros junto al VO; la aplicación los construye desde DTOs): `GlobalSummaryMovementInput = ClosureMovementInput + { accountId: number }` y `SummaryAccountRef = { id: number; type: 'personal' | 'shared'; memberName: string | null }`.
- `memberBreakdown`: un registro por miembro con gastos en el mes `{ memberId: number | null; memberName: string | null; personal: Money; shared: Money }`, agrupado por `memberId` (`null` = pagado desde la cuenta común, sin atribución; `memberName` solo visualización); solo filas con datos; orden por total descendente, desempate por nombre ascendente (`localeCompare es`) y la fila sin atribución al final en empates (determinista para tests).
- Los ingresos no computan en el desglose por miembro (FR-004) ni en el de tags (regla de 005).
- Invariante de coherencia (test explícito): el VO global sobre la unión de movimientos del mes = suma de los `MonthlyClosure` por cuenta, KPI a KPI, y el desglose por tag global = fusión de los desgloses por cuenta.

**Alternatives considered**:

| Opción | Contras |
|---|---|
| VO global con sus propios bucles para todo (sin componer `MonthlyClosure`) | Duplica las reglas de agregación (naturaleza, multi-tag, orden): dos fuentes de verdad que pueden divergir; FR-002 pasaría de garantía estructural a compromiso de mantenimiento. |
| Componer en la aplicación: sumar `MonthlyClosureDTO` por cuenta en el caso de uso | Lógica de negocio fuera del dominio (VII); el desglose por miembro seguiría necesitando los movimientos: dos mecanismos y mezcla de capas. |
| Agregación SQL dedicada (GROUP BY cuenta/miembro/tag en `DrizzleMovementRepository`) | Nuevo contrato de puerto de salida + tests de integración para datos que se agregan trivialmente en memoria (005, research §1, ya descartó esta vía); la atribución por miembro exigiría un join adicional con `accounts`/`members`. |
| Calcular en la página o el componente | Prohibido (VII: la UI nunca calcula). |

---

## 2. Lectura de datos: nuevo método de puerto `listByMonth` (FR-001, FR-008)

**Decision**: añadir **`listByMonth(month: string): Promise<MovementDTO[]>`** al puerto `MovementRepository` (aplicación) e implementarlo en `DrizzleMovementRepository`: la query existente de `listByMonthAndAccount` sin el filtro de cuenta (rango semicerrado `[month-01, mes siguiente)`, mismas joins de tags, mismo `ORDER BY`). El caso de uso lee las cuentas con el puerto existente `AccountRepository.findAll()` (ya devuelve `memberName`).

**Rationale**:
- Una única query trae todo lo que el VO necesita; reutiliza el mapeo `mapJoinedRowsToMovementDTOs` y la convención de rangos sargables de 002/005.
- **Rendimiento (FR-008)**: el índice existente es `(account_id, date)`, que no sirve de índice de busqueda para un rango solo por `date` → la query escanea la tabla. A escala familiar (miles de filas, ≤ ~500/mes) es sub-milisegundo en SQLite/Turso, órdenes de magnitud por debajo del umbral de 3 s; añadir un índice `date` exigiría una migración que la propia spec prohíbe (FR-005: sin persistencia nueva) — YAGNI, se documenta y si algún día escala se plantea como feature propia.
- Breaking change del puerto acotado y deseable: solo `DrizzleMovementRepository` y los dobles de tests implementan `MovementRepository`; se actualizan en el mismo cambio (typecheck lo garantiza).

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Bucle del caso de uso llamando N veces a `listByMonthAndAccount` (una por cuenta) | N queries por render; acopla el resumen a la lista de cuentas para obtener datos que no dependen de ella; N+1 disfrazado de reutilización. |
| Puerto dedicado `getGlobalSummary(month)` con agregación en SQL | Rechazada en §1: contrato nuevo + tests de integración para una agregación trivial en memoria. |
| Cargar todos los movimientos y filtrar mes en memoria | Desaprovecha el rango sargable; carga historia completa contra FR-008 ("sin cargar más meses de los necesarios"). |

---

## 3. Ubicación de la vista: ruta propia `/summary` (FR-007)

**Decision**: **ruta nueva `src/app/summary/page.tsx`** (`/summary?month=YYYY-MM`), con: selector de mes propio (componente cliente reutilizable `month-selector.tsx`, variant del selector de 002 sin cuenta), enlace de vuelta a `/` y el panel **`global-summary-panel.tsx`** (componente servidor, espejo del panel de 005). En la pantalla principal se añade un **enlace "Resumen global"** junto a la cabecera que preserva el mes activo (`/summary?month={mes}`).

**Rationale**:
- La pantalla principal está **scopeada por cuenta** (selectores → balance → cierre de esa cuenta); el resumen global es una vista de **ámbito familiar** que ignora la cuenta: mezclarlo ahí dejaría un selector sin efecto sobre una región, rompiendo el modelo mental de la pantalla.
- El maestro lo describe como vista propia ("abro el resumen global del mes"); la spec (FR-007) delega la ubicación en el plan.
- Ruta fina y barata: adaptador server con `searchParams` validados por Zod (mismo patrón de ADR 0008 que `/`), cero estado cliente salvo el selector.
- Prepara el asentamiento natural de `009-cuenta-resultados-anual` (otra vista de ámbito familiar con su ruta propia).
- El enlace desde `/` preserva el mes para no romper el contexto temporal del usuario.

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Sección "global" en la pantalla principal bajo el cierre | Selector de cuenta sin efecto sobre esa región (confusión); pantalla ya densa (5 regiones) y el global duplicaría en ella KPIs que ya se ven por cuenta. |
| Selector de cuenta "Todas" en el selector existente que conmuta el scope de toda la pantalla | Cambia el significado de balance/cierre/listado existentes (regresión de contrato de 002/005); el formularío de registro no tiene sentido sin cuenta concreta. |
| Client component con fetch a una API route | Frontera nueva innecesaria (I); la página es estática respecto a los searchParams, server component suficiente como `/`. |

---

## 4. Desglose por miembro: regla de atribución y presentación (FR-004)

**Decision**: cada gasto se atribuye al **dueño de la cuenta desde la que se pagó**: cuentas personales → fila de su miembro (clave `memberId`); cuenta común → fila **"Cuenta común"** (bucket sin atribución, `memberId: null` en el DTO; la etiqueta vive en la UI). La fila muestra los dos importes (gastos personales y compartidos de ese ámbito), solo si hay gastos; los ingresos no aparecen (llegan con 009).

**Rationale**:
- Es la única atribución derivable del modelo sin inventar repartos: la regla de reparto de gastos comunes entre miembros está expresamente diferida (decisión del usuario en el maestro).
- La fila "Cuenta común" hace el desglose exhaustivo (las filas cubren todos los gastos del mes), manteniendo la coherencia visual con los totales; su etiqueta vive en la UI (contract), el dominio solo conoce `null`.
- Miembros sin gastos en el mes no generan fila (igual que tags sin uso en el desglose de 005): menos ruido, estado vacío compartido.

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Sin fila "Cuenta común" (omitir gastos de la común) | Las filas de miembros no cubrirían el total de gastos: parece un error ("¿dónde está el resto?"). |
| Repartir los gastos comunes de la cuenta común entre miembros | Regla de reparto diferida por decisión del usuario; inventarla aquí violaría el alcance. |
| Atribuir por miembro que registra el movimiento | No existe relación movimiento→miembro registrante en el modelo (US6 de 002: registro en nombre de); sería inventar dato. |

---

## 5. Estrategia de tests (constitución III)

**Decision**: cuatro niveles con los patrones de 002/005:

1. **Dominio** (`GlobalMonthlySummary.test.ts`, node): happy path con movimientos de varias cuentas; atribución por miembro (personales y compartidos desde cuenta personal; cuenta común al bucket null); **agrupación por identidad** (dos miembros homónimos → dos filas distintas; dos cuentas personales del mismo miembro → una fila); **invariante de coherencia** (global = Σ cierres por cuenta, KPI a KPI, y desglose por tag fusionado); multi-tag sin duplicar total; ingresos fuera de desgloses; mes vacío → ceros; orden y desempates de ambos desgloses; gastos con naturaleza personal pagados desde la común (caso teórico admitido por el modelo) al bucket null con su naturaleza.
2. **Aplicación** (`GetGlobalMonthlySummary.test.ts`, node): doble en memoria de `MovementRepository` (con `listByMonth`) y de `AccountRepository`; validación de mes; mapeo DTO→dominio→DTO; resultados idénticos a los del VO.
3. **Persistencia** (`DrizzleMovementRepository.test.ts`, ampliación): `listByMonth` contra libsql `:memory:` con migraciones: devuelve movimientos de todas las cuentas del mes (rango exacto, sin meses contiguos) con sus tags; mes vacío → [].
4. **UI** (`global-summary-panel.test.tsx` y `month-selector.test.tsx`, ui jsdom + RTL): KPIs y desgloses con formato es-ES vía helpers, fila "Cuenta común" para `memberId: null` (homónimos como filas distintas), estados vacíos, y navegación del selector a `/summary?month=`.
5. **E2E** (`e2e/resumen-global.spec.ts`): fichero nuevo, specs **en serie** dentro del fichero (convención de 002/005) y **mes propio sin colisión** (p. ej. 2026-06, libres 2026-07/2026-08): registra vía UI movimientos en las tres cuentas, abre `/summary?month=...` desde el enlace de la pantalla principal y verifica KPIs exactos (suma de cuentas, compartidos incluyendo pagados desde personales, desglose por tag fusionado y desglose por miembro con "Cuenta común"); después verifica mes vacío → ceros. El cambio de mes queda en verificación manual (quickstart), como en 005 (decisión del revisor 2026-09-10, misma línea).

**Rationale**: el e2e protege el flujo completo registro→resumen global (la acción de la feature) sin repetir la casuística del formulario (ya cubierta por `e2e/registro-movimientos.spec.ts`); la coherencia con los cierres por cuenta queda clavada en el test de dominio (más barato y determinista que en e2e).

**Alternatives considered**: reutilizar el fichero e2e de 005 (acoplamiento entre features); e2e de rendimiento (SC-002/FR-008 se verifica informalmente en el quickstart, modo PoC como en 005).

---

## Resumen de decisiones (trazabilidad)

| Tema | Decisión | ADR |
|---|---|---|
| Cálculo global | VO `GlobalMonthlySummary` que **compone** `MonthlyClosure` (única fuente de reglas) + pasada propia para el desglose por miembro | **0012** |
| Coherencia FR-002 | Garantía estructural por composición + test de invariante (global = Σ cierres) | 0012 |
| Lectura de datos | Puerto `MovementRepository.listByMonth(month)`; cuentas vía `AccountRepository.findAll()` | 0012 |
| Persistencia | Ninguna: vista derivada (FR-005, ADR 0009); sin índice nuevo (escala familiar, YAGNI) | 0009 → 0012 |
| Vista | Ruta propia `/summary?month=` + panel servidor + selector de mes; enlace desde `/` | — |
| Desglose por miembro | Atribución por dueño de la cuenta de pago, agrupada por identidad (`memberId`); "Cuenta común" como fila sin atribución | — |
| Tests | VO + use case + repo (libsql :memory:) + RTL + e2e nuevo en serie, mes propio | — |
