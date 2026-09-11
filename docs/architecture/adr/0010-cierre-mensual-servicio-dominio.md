# 10. Cierre mensual calculado como servicio de dominio con lectura propia del mes

- **Fecha**: 2026-09-11
- **Estado**: Aceptado

## Contexto y problema

La feature 005 exige un cierre mensual por cuenta (ingresos, gastos, gastos por naturaleza, saldo del mes y desglose por tag) recalculado en cada consulta (FR-009). La pantalla principal ya carga los movimientos del mes para el listado, de modo que había que decidir **dónde vive el cálculo** y **quién obtiene los datos**.

## Opciones consideradas

1. **Agregación SQL dedicada** (nuevo método de puerto `getMonthlySummary` + `GROUP BY`): duplicaría los joins del listado y añadiría contrato de puerto + tests de integración para datos que se agregan trivialmente en memoria.
2. **Pasar al caso de uso los DTOs ya cargados por el listado** (sin segunda query): aceptada en el primer borrador del plan y **revertida tras el challenge del revisor** — acopla el cierre a la forma de carga del listado (una paginación o filtrado en la feature 003 exigiría reimplementarlo) para ahorrar una lectura sub-milisegundo.
3. **Calcular en el caso de uso o la UI sin VO de dominio**: dejaría reglas de negocio (multi-tag, cuadre por naturaleza) fuera del dominio, inconsistente con `Money`/`Movement.create`.
4. **Materializar totales** (`monthly_closures`): viola ADR 0009 (drift garantizado al editar/eliminar) y FR-009.

## Decisión

El cálculo es un VO de dominio puro `MonthlyClosure` (`src/domain/movement/MonthlyClosure.ts`) con factory `fromMovements(inputs)` y aritmética `Money` (ADR 0007); el caso de uso `GetMonthlyClosure` **obtiene el mes por sí mismo** vía el puerto existente `MovementRepository.listByMonthAndAccount(accountId, month)` y devuelve un `MonthlyClosureDTO`. La página lo ejecuta en paralelo con las demás lecturas; nada se persiste (extensión del ADR 0009 a todo el cierre).

## Consecuencias

- **Positivas**: caso de uso autocontenido con la forma estándar (`execute(accountId, month)`), inmune a cambios del listado; reglas del cierre (invariante `shared + personal = expenseTotal`, multi-etiquetado sin duplicar totales, orden del desglose) en el dominio y cubiertas por tests unitarios; reutilizable por el resumen global de la feature 006.
- **Negativas**: segunda lectura del mes por render de página (query indexada sub-milisegundo, en una página que ya ejecuta 4; coste asumido de forma deliberada frente al acoplamiento).
