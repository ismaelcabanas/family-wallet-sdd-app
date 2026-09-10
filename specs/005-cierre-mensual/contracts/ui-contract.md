# Contrato de UI: Panel de Cierre Mensual

**Feature**: `005-cierre-mensual` | **Componente**: `src/infrastructure/primary/ui/monthly-closure-panel.tsx` (servidor) | **Integración**: `src/app/page.tsx`

Región nueva de la pantalla principal de 002 ([ui-contract de 002](../002-registro-movimientos/contracts/ui-contract.md)), sin alterar las existentes.

---

## 1. Posición y comportamiento (FR-001, FR-008)

- Orden de la pantalla: selectores → balance de la cuenta → formulario de registro → **panel de cierre** → listado (agregado y detalle del mes, juntos, bajo el input).
- Visible siempre que haya una cuenta y un mes activos (siempre, dado el default de 002: primera cuenta personal + mes actual).
- Se recalcula con cada cambio de cuenta/mes en los selectores y tras cada registro (`revalidatePath('/')` existente), en la misma pantalla y sin navegación (FR-008).
- **Sin balance acumulado** (FR-005): el panel no muestra ningún balance multimes ni a cierre de mes; el único balance de la pantalla sigue siendo el de la cabecera (histórico completo, contrato 002 §2.2).

## 2. Estructura del panel

```text
┌─────────────────────────────────────────────┐
│ Cierre de {Mes YYYY}                        │  ← monthLabel existente ("Cierre de Septiembre 2026")
│                                             │
│ [Ingresos]   [Gastos]   [Saldo del mes]     │  ← KPIs (grid: 3 columnas escritorio / apilado móvil)
│  1.920,00 €   970,50 €   +949,50 €          │
│                                             │
│ Gastos compartidos        Gastos personales │  ← sub-desglose por naturaleza
│ 970,50 €                  0,00 €            │
│                                             │
│ Desglose por tag                            │
│ Vivienda                  850,00 €          │  ← filas: nombre + importe
│ Hipoteca                  850,00 €          │
│ Hogar                     120,50 €          │
└─────────────────────────────────────────────┘
```

- Título: `Cierre de {Mes YYYY}` (primera letra mayúscula vía `monthLabel`). El mes es el seleccionado en el selector (no necesariamente el actual).
- KPIs superiores: **Ingresos**, **Gastos**, **Saldo del mes**. Los dos primeros sin signo; el saldo con signo contable (§3).
- Sub-desglose de naturaleza: **Gastos compartidos** / **Gastos personales**, sin signo. La suma de ambos es siempre el total de Gastos (invariante del VO).
- Desglose por tag: una fila por tag con al menos un gasto en el mes; **solo importe** (sin porcentajes ni recuentos — clarificación 2026-09-10).

## 3. Formato, textos y estados

| Elemento | Texto/Formato exacto |
|---|---|
| KPI Ingresos | label "Ingresos"; importe `Intl es-ES` EUR sin signo: `1.920,00 €` |
| KPI Gastos | label "Gastos"; importe sin signo: `970,50 €` |
| KPI Saldo del mes | label "Saldo del mes"; `+949,50 €` positivo / `−51,20 €` negativo (U+2212) / `0,00 €` cero sin signo — helper nuevo `formatSignedCents` |
| Naturaleza | labels "Gastos compartidos" / "Gastos personales"; importes sin signo |
| Desglose | título "Desglose por tag"; filas `nombre  importe` sin signo |
| Orden del desglose | importe descendente; empate → nombre ascendente (alfabético) |
| Mes sin gastos | KPIs a `0,00 €` / saldo `0,00 €`; desglose muestra "Sin gastos este mes." |
| Mes sin movimientos (KPIs a cero + listado vacío) | El panel se muestra igualmente con ceros y "Sin gastos este mes." (NO se oculta; el estado vacío "Aún no hay movimientos" del contrato 002 §2.5 sigue siendo exclusivo del listado) |
| Idioma | Todo en español (FR-010) |

## 4. Accesibilidad y responsive (guía PoC, mismo criterio que 002 §4)

- Panel como `<section>` con `aria-labelledby` apuntando al título.
- El grid de KPIs y las filas del desglose se apilan en una columna en móvil; sin scroll horizontal.
- Números como texto (mismo patrón que el resto de la pantalla).

## 5. Fuera de este contrato

Balance acumulado (multimes o a cierre de mes) — feature 006; resumen global, cuadre y cuenta de resultados — feature 006; desglose por miembro — feature 006; porcentajes en el desglose — rechazado en clarificación; exportación/impresión del cierre.
