# UI Contract — KPI de gasto personal del mes en la página de cuenta personal (024)

**Feature**: `024-kpi-gasto-personal` | **Componentes**: `AccountMonthKpis` (MODIFICADO — **amenda el contrato de 022 §2/§3 y 023 §4**), `page.tsx` de cuenta (MODIFICADO — compone la nueva prop) | **Nuevos**: nada | **Retirado**: nada | **Intactos**: `MonthStepper`, `GroupedMovementList` y diálogos, `AccountBalance`, `MonthlyClosurePanel`, `GlobalNav`, actions y formularios, menú ⋮ de 020, materializadores y casos de uso (018/019/021/023), agregados, cuenta común.

Congela literales, estructura y comportamiento observable. **Extiende** [022 ui-contract](../022-kpis-fijos-cuenta/contracts/ui-contract.md) y [023 ui-contract](../023-porcentaje-ahorro/contracts/ui-contract.md), y **amenda** la sección del bloque «KPIs del mes» (§1): todo lo no mencionado queda exactamente como allí.

---

## 1. Bloque «KPIs del mes» — AMENDA 3 → 4 métricas (FR-001; escenarios 1, 2, 6, 7)

Presencia, ubicación, sticky, etiqueta pasiva de mes y accesibilidad de 022 §1 quedan **intactos** (solo cuentas personales, hijo directo de `<main>` entre selector y listado, `sticky top-0 z-20`, fondo sangrado, server component sin JS, selector ‹ mes/año › NO incluido). La `dl` pasa de 3 a **4 métricas** con grid **`grid grid-cols-2 gap-3 sm:grid-cols-4`** (móvil 2×2, ≥`sm` una fila de 4; research §2), en este orden congelado:

```text
╔══════════════════════════════════════════════════════════════╗
║ KPIs del mes                                  Octubre de 2026║
║ Aportación común   │ Gasto personal                           ║
║ 440,00 €           │ 200,55 €                                 ║
║ Ahorro del mes     │ Saldo del mes                            ║
║ 0,00 €             │ +1.299,45 €                              ║
╚══════════════════════════════════════════════════════════════╝
        (≥ sm: las 4 celdas en una sola fila)
```

- **«Aportación común»**, **«Ahorro del mes»** y **«Saldo del mes»** quedan exactamente como en 022 §2/§3 y 023 §4 (literales, subtextos de «Sin … configurar», saldo neto con U+2212 y `text-red-600` solo en negativo).
- **«Gasto personal»** (NUEVA, segunda posición):

| Estado | Valor | Subtexto |
|---|---|---|
| Cualquiera (lectura pura, sin configuración detrás) | `formatAmountCents(personalExpenseCents)` — p. ej. **200,55 €**; mes sin gastos computables → **0,00 €** | — (nunca hay subtexto ni estado «Sin configurar») |

- Sin signo ni `text-red-600` (magnitud; el rojo queda reservado al saldo negativo).
- La visibilidad continua de 022 se mantiene con el grid de 4: la región sigue fija y visible durante todo el desplazamiento del listado (SC-001), con independencia de las 2 filas en móvil.

## 2. Composición e importe (FR-002, FR-004; escenarios 1, 3, 4, 5, 7; edges)

```ts
// page.tsx de cuenta (adaptador; resta única de composición — precedent 022/023)
personalExpenseCents = closure.personalExpenseCents − netContribution.amountCents;
// celda: formatAmountCents(personalExpenseCents)
```

- **Computan**: gastos del mes consultado con `nature = "personal"`, **excluida la aportación común** del mes consultado (movimiento enlazado de 019, cuyo importe ya es el neto vigente de 021).
- **No computan**: gastos `nature = "shared"` (reflejados en la aportación neta), la aportación común (tiene KPI propio; es un traspaso, no consumo), los ingresos en todos los casos (incluido el ingreso regular materializado de 018) y el ahorro deducido de 023 (no es movimiento).
- **Sin dobles conteos**: cada euro del listado computa como máximo en un KPI de gasto del bloque (aportación o gasto personal).
- **Mes consultado** (FR-003): el valor refleja el mes del selector en la misma visita (render de servidor por `?month=`); meses cerrados muestran su valor histórico sin recálculo ni congelación adicionales.
- **Actualización** (FR-007): altas, ediciones y eliminaciones se reflejan al reconsultar la página, en el mismo ciclo de `revalidatePath` que el resto.
- Invariante: la composición es exacta mientras el movimiento de aportación conserve la `nature: "personal"` con la que lo crea el materializador (019/021 la preservan; research §1).

## 3. Contrato de props (UI)

```ts
interface AccountMonthKpisProps {
  netContribution: MonthNetContributionDTO; // intacto (022)
  personalExpenseCents: number;             // NUEVO — compuesto por la página (§2); el componente solo formatea
  savings: MonthSavingsDTO;                 // intacto (023)
  netMonthBalanceCents: number;             // intacto (023)
  month: string;                            // intacto (022)
}
```

El componente es presentacional puro: no resta, no clasifica por naturaleza ni accede a casos de uso (constitución VII; convención 022 «la UI jamás recalcula ni resta»).

## 4. Selectores estables para tests

| Elemento | Selector |
|----------|----------|
| Bloque KPIs | `getByRole("region", { name: "KPIs del mes" })` (intacto 022) |
| KPI gasto personal | región KPIs → `getByText("Gasto personal")` + importe (`/^200,55[\s\u00A0\u202F]€$/`) |
| Mes sin gastos computables | celda gasto personal → `/^0,00[\s\u00A0\u202F]€$/` y **sin** texto «Sin configurar» de ningún tipo |
| Orden de las 4 métricas | `getAllByRole("definition")` → `["Aportación común", "Gasto personal", "Ahorro del mes", "Saldo del mes"]` (vía `previousElementSibling`) |
| Grid | `dl.className` contiene `grid-cols-2` y `sm:grid-cols-4` |
| Ausencia (cuenta común) | `getByRole("region", { name: "KPIs del mes" })` → `toHaveCount(0)` (intacto 022) |
| Coherencia con cierre | cierre del mes → «Gastos personales» incluye la aportación; KPI = cierre − KPI aportación (aserción e2e, research §7 G2) |

## 5. Accesibilidad

- Cuarta pareja `dt/dd` semántica en el mismo `dl` (`tabular-nums`); la región, el `h2` «KPIs del mes» y la etiqueta pasiva de mes quedan intactos (022 §7).
- Sin controles nuevos ni captura de foco; el sticky no altera el orden del DOM (022 §7).
- El valor no depende del color para informar (magnitud con formato EUR).

## 6. Fuera de alcance (this contract)

KPI de gasto en la cuenta común, «disponible restante»/proyecciones/presupuestos/avisos, desgloses por etiqueta/día/miembro, comparativas históricas, cambios en cierre mensual, resumen global, cuenta de resultados anual, balance acumulado, formularios/menú ⋮/actions, y cualquier cambio en la semántica de 018/019/021/023 (FR-005, FR-006; spec «Out of Scope»).
