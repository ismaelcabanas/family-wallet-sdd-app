# 12. Resumen global por composición del cierre mensual

- **Fecha**: 2026-09-21
- **Estado**: Aceptado

## Contexto y problema

La feature 006 exige un resumen mensual global que agregue las tres cuentas (ingresos, gastos por naturaleza, saldo del mes y desgloses por tag y por miembro) coherente al céntimo con los cierres por cuenta de 005 (FR-002). Había que decidir **dónde vive el cálculo**, **quién obtiene los datos** y **dónde vive la vista**, sin persistencia nueva ni migraciones (FR-005).

## Opciones consideradas

1. **VO global con sus propios bucles para todo (sin componer `MonthlyClosure`)**: duplicaría las reglas de agregación (naturaleza, multi-tag, orden); dos fuentes de verdad que pueden divergir. FR-002 pasaría de garantía estructural a compromiso de mantenimiento.
2. **Componer en la aplicación** (sumar `MonthlyClosureDTO` por cuenta en el caso de uso): lógica de negocio fuera del dominio (principio VII); el desglose por miembro seguiría necesitando los movimientos: dos mecanismos y mezcla de capas.
3. **Agregación SQL dedicada** (`GROUP BY` cuenta/miembro/tag en `DrizzleMovementRepository`): nuevo contrato de puerto de salida + tests de integración para datos que se agregan trivialmente en memoria (misma razón por la que se descartó en el ADR 0010); la atribución por miembro exigiría joins adicionales.
4. **Bucle del caso de uso llamando N veces a `listByMonthAndAccount`**: N queries por render; acopla el resumen a la lista de cuentas para datos que no dependen de ella (N+1 disfrazado de reutilización).
5. **Sección "global" en la pantalla principal**: la pantalla está scopeada por cuenta (selectores → balance → cierre de esa cuenta); el global ignora la cuenta y dejaría un selector sin efecto sobre esa región.
6. **Calcular en la página o el componente**: prohibido (VII: la UI nunca calcula).

## Decisión

El cálculo es un VO de dominio puro **`GlobalMonthlySummary`** (`src/domain/movement/GlobalMonthlySummary.ts`) con factory `fromMovements(inputs, accounts)` que **compone** `MonthlyClosure.fromMovements(inputs)` —única fuente de las reglas de agregación (ADR 0010)— para los KPIs y el desglose por tag, y calcula en pasada propia lo único que el cierre no puede dar: el **desglose por miembro**, atribuyendo cada gasto al dueño de la cuenta de pago, agrupado por **identidad** (`memberId`, expuesto ampliando `AccountDTO`; `memberId: null` = pagado desde la cuenta común). La coherencia FR-002 es estructural (asociatividad de las sumas en céntimos) y queda clavada con un test de invariante (global = Σ cierres por cuenta).

La lectura de datos es propia del mes vía nuevo método de puerto **`MovementRepository.listByMonth(month)`** (la query de `listByMonthAndAccount` sin filtro de cuenta), orquestada por el caso de uso autocontenido `GetGlobalMonthlySummary` (junto a `AccountRepository.findAll()`). La vista vive en **ruta propia `/summary`** (`src/app/summary/page.tsx`, searchParams con Zod como `/` — ADR 0008) con selector de mes reutilizable (`month-selector.tsx`) y panel servidor (`global-summary-panel.tsx`); el único cambio en `/` es el enlace "Resumen global" que preserva el mes activo.

## Consecuencias

- **Positivas**: una sola fuente de reglas agregadas (el resumen hereda cualquier corrección del cierre); atribución por identidad robusta a homónimos y a varias cuentas por miembro; caso de uso autocontenido reutilizable (p. ej. por la cuenta de resultados anual de 009); sin índices nuevos — el escaneo por rango de fecha es sub-milisegundo a escala familiar (FR-008 documentado, YAGNI).
- **Negativas**: el puerto `MovementRepository` gana un método (breaking change acotado: solo el adaptador Drizzle y los dobles de tests lo implementan, actualizados en el mismo cambio); el desglose por miembro requiere una segunda pasada en memoria sobre los movimientos del mes (trivial a esta escala).
