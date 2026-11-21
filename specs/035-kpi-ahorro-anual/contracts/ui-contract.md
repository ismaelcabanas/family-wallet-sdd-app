# UI Contract: KPI de ahorro acumulado del año (035)

**Feature**: 035-kpi-ahorro-anual | **Componentes**: `AccountMonthKpis` (MODIFICADO — **amenda el contrato congelado de 022 §2/§3, 023 §4, 024 §2 y 033**), `page.tsx` de cuenta (MODIFICADO — 6.ª lectura + helper compartido) | **Nuevos**: nada visible más allá de la 5.ª celda | **Retirado**: nada | **Intactos**: `MonthStepper`, `GroupedMovementList` y diálogos, `GlobalNav`, actions y formularios, menús ⋮, materializadores (018/019/021/033), `GetMonthlyClosure`, `/summary`, `/annual`, `/reports/*`, `/tags`, importador, cuenta común completa.

---

## 1. Contrato de datos del componente

```typescript
interface AccountMonthKpisProps {
  netContribution: MonthNetContributionDTO;   // sin cambios
  personalExpenseCents: number;               // sin cambios (024/033)
  savings: MonthSavingsDTO;                   // sin cambios (033)
  netMonthBalanceCents: number;               // sin cambios (ahora vía helper compartido)
  month: string;                              // sin cambios (etiqueta pasiva + derivación del año)
  accumulatedSavingsCents: number;            // [nuevo] ya calculado por la página (GetAnnualAccumulatedSavings)
}
```

Sigue siendo un **server component presentacional puro**: sin JS, sin estado, sin selector dentro; el acumulado viaja calculado (la UI jamás recalcula ni suma — constitución VII).

## 2. Estructura renderizada (congelada)

`<section aria-labelledby="account-month-kpis-title">` sticky (`sticky top-0 z-20 -mx-4 bg-background px-4 sm:-mx-6 sm:px-6`, intacto de 022) con tarjeta interior y cabecera «KPIs del mes» + `monthLabel(month)` (intactos). El `dl` pasa a **5 métricas**:

| # | `dt` (literal exacto) | Valor | Subtexto / estado | Orden y layout |
|---|---|---|---|---|
| 1 | «Aportación común» | `formatAmountCents(netContribution.amountCents)` | «Sin aportación configurada» si `!configured` | 1.ª celda |
| 2 | «Gasto personal» | `formatAmountCents(personalExpenseCents)` | — (nunca estados, 024) | 2.ª celda |
| 3 | «Ahorro del mes» | `formatAmountCents(savings.amountCents)` | «Sin ahorro configurado» si `!configured` | 3.ª celda |
| 4 | «Saldo del mes» | `formatSignedCents(netMonthBalanceCents)`, `text-red-600` si < 0 | — | 4.ª celda |
| 5 | **«Ahorro acumulado»** | `formatSignedCents(accumulatedSavingsCents)`, `text-red-600` si < 0 | **«Año {year}» permanente** (`year = month.slice(0, 4)`) | 5.ª celda, `col-span-2 sm:col-span-1` |

- `dl` = `mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5` (antes `sm:grid-cols-4`): móvil 2×2 + la 5.ª a ancho completo; ≥`sm` una fila de 5.
- Las 4 celdas existentes quedan **pixel-idénticas** salvo el ancho de columna compartido.
- La celda 5 no tiene estados ni subtextos condicionales: lectura pura siempre presente; año vacío → `0,00 €`; acumulado negativo → signo «−» + rojo (espejo de «Saldo del mes»).
- Literales «Ahorro del mes» y «Ahorro acumulado» conviven sin mezclarse (edge «doble semántica» de la spec).

## 3. Comportamiento

- **Visibilidad continua (SC-001)**: sticky intacto — las 5 métricas visibles al cargar y en cualquier punto del scroll con listados largos.
- **Año de referencia (FR-001/FR-003)**: `Año {year}` deriva del mes consultado; navegar a otro año dentro de la misma visita cambia el KPI en el render siguiente sin acciones del usuario.
- **Actualización (FR-007)**: altas/ediciones/borrados de cualquier mes del año se reflejan al reconsultar la página (mismo ciclo de `revalidatePath` existente).
- **Cuenta común (AS-7)**: la página común no renderiza el bloque ni consulta el caso de uso (comportamiento ya congelado en 022/025; sin cambios).

## 4. Anclas de test/e2e

- Región accesible: `getByRole("region", { name: "KPIs del mes" })` (intacta).
- Celda acumulada: `getByText("Ahorro acumulado").locator("..")`; año visible: `getByText(/^Año \d{4}$/)`; valores con el patrón EUR de la casa (`[\s\u00A0\u202F]€`) y «−» U+2212 para negativos.
- Orden congelado de `dt`: Aportación común → Gasto personal → Ahorro del mes → Saldo del mes → Ahorro acumulado.

## 5. Fuera de contrato

Nuevo hogar UI para el acumulado fuera del bloque (tarjetón propio, /summary, /annual), estados («Sin datos»), desglose mensual/gráficos del acumulado, acumulado en la cuenta común, y cualquier selector o control dentro del bloque (spec «Out of Scope»; FR-006).
