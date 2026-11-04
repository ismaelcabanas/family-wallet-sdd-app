# Quickstart: Informe anual de gastos por categorías

**Branch**: `015-informe-anual-gastos` | **Date**: 2026-11-04

Guía de validación manual end-to-end de la feature. Contratos en `contracts/ui-contracts.md`; modelo de cálculo en `data-model.md`.

## Prerrequisitos

```bash
npm install
npm run db:migrate
npm run seed
```

## Validación

```bash
npm run dev
```

1. **Acceso desde el menú «Informes»** (FR-004, SC-003): desde cualquier página (p. ej. el panel `/`), abrir el menú «Informes» de la navegación global y pulsar «Gastos por categoría» → llega a `/reports/annual-expenses` con el año actual seleccionado. Verificar que «Resumen» y «Cuenta de resultados» siguen siendo enlaces directos con su comportamiento actual.

2. **Estructura fija de la tabla** (FR-001, SC-002): la tabla muestra una fila por **cada** categoría del catálogo (genérica «General» primero, resto alfabético; incluidas categorías sin gastos a 0,00 €), las 12 columnas de meses «Ene»…«Dic» y la columna final «Media anual».

3. **Celdas y exclusión** (FR-001, escenario 1 y 3): registrar (o sembrar) gastos de varias etiquetas de la misma categoría en distintos meses y cuentas; verificar que la celda categoría × mes suma todos ellos (todas las cuentas, ambas naturalezas) y que los gastos con la etiqueta «Aportación Común» no computan en ninguna celda, fila ni total.

4. **Medias ÷ 12** (FR-001, edge «año en curso»): la columna «Media anual» de cada fila es el total anual ÷ 12 (redondeo half-up), también con meses vacíos o año en curso.

5. **Filas de totales** (FR-002): al final, «Gasto mensual» (total de gastos del mes, mismas exclusiones) y «Gastos personales» (naturaleza propia en cuentas personales, aportación excluida), ambas con su media anual.

6. **Selector de año** (FR-003): cambiar el año recalcula la tabla; un año sin movimientos muestra la estructura completa a 0,00 € sin errores.

7. **Etiquetas desactivadas** (escenario 8): un gasto histórico con etiqueta desactivada sigue computando en la categoría de su etiqueta.

8. **No-regresión** (FR-005, SC-004): `/summary`, `/annual`, listados de cuenta y KPIs muestran exactamente los mismos números que antes de la feature.

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test
npm run test:e2e   # incluye e2e/informe-anual-gastos.spec.ts (año propio, BD e2e determinista)
```
