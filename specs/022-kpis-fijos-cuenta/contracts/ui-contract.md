# UI Contract — KPIs fijos y destacados en la página de cuenta personal (022)

**Feature**: `022-kpis-fijos-cuenta` | **Componentes**: `AccountMonthKpis` (NUEVO), `GetMonthNetContribution` + `MonthNetContributionDTO` (NUEVOS, aplicación), `page.tsx` de cuenta (MODIFICADO), `e2e/pagina-cuenta.spec.ts` P1 (MODIFICADO) | **Retirado**: nada | **Intactos**: `MonthStepper`, `GroupedMovementList` y diálogos, `AccountBalance`, `MonthlyClosurePanel`, `GlobalNav`, actions, formularios, menú ⋮ de 020, agregados.

Congela literales, estructura y comportamiento observable. **Extiende** [011 ui-contract](../011-pagina-cuenta/contracts/ui-contract.md) (layout de la página de cuenta) y [021 behavior-contract](../021-descuento-gastos-comunes/contracts/behavior-contract.md) (semántica del neto): todo lo no mencionado queda exactamente como allí.

---

## 1. Presencia y ubicación (FR-001, FR-005; escenarios 1, 7)

- El bloque aparece **solo** en páginas de cuenta **personal** (`account.type === "personal"`), como hijo directo de `<main>`, **entre el selector ‹ mes/año › y el listado** de movimientos. La cuenta común no lo renderiza (ni consulta el caso de uso).
- Orden congelado de `main > *` (personal): `header (h1+nav)` → subtítulo → `section[aria-label="Selección de mes"]` → `section[aria-labelledby="account-month-kpis-title"]` → `section[aria-labelledby="movement-list-title"]` → balance → cierre.

```text
┌──────────────────────────────────────────────┐
│ Cuenta de Miembro B            Panel ▾       │
│ Cuenta personal de Miembro B                 │
│ ‹  [Octubre de 2026 ▾]                    ›  │
│ ╔══════════════════════════════════════════╗ │ ← sticky: se fija top al hacer
│ ║ KPIs del mes              Octubre de 2026║ │   scroll y permanece visible
│ ║ Aportación común      │ Saldo del mes     ║ │   (selector NO incluido)
│ ║ 379,45 €              │ −120,55 €         ║ │
│ ╚══════════════════════════════════════════╝ │
│ Movimientos del mes …                        │
└──────────────────────────────────────────────┘
```

- **Sticky** (clarify 2026-10-21): `position: sticky; top: 0` con capa y fondo propios (`sticky top-0 z-20`, fondo `bg-background` sangrado a lo ancho de `main`, tarjeta interior `rounded-lg border bg-card p-4`). El selector ‹ mes/año › y el resto de la página no cambian de layout. El bloque es **server component** (sin JS de fijación).

## 2. KPI «Aportación común» (FR-002; escenarios 3–5, edges)

| Estado (`MonthNetContributionDTO`) | Valor | Subtexto |
|---|---|---|
| `configured: false` | **0,00 €** | **«Sin aportación configurada»** (`text-xs text-muted-foreground`) |
| `configured: true, amountCents: n > 0` | `formatAmountCents(n)` (p. ej. **379,45 €**) | — |
| `configured: true, amountCents: 0` (retirada por neto 0, borrado del usuario, fuera de ventana, mes futuro) | **0,00 €** | — (sin literal: la config existe) |

- Importe = el del movimiento «Aportación Común» del mes en el listado (neto vigente de 021); **sin desglose bruto/descuento** ni signo (magnitud).
- El mes consultado fuera de la ventana de activación o cerrado/congelado muestra el importe histórico o 0,00 € según exista movimiento enlazado.

## 3. KPI «Saldo del mes» (FR-003; escenarios 1, 5, 8)

- Valor: `formatSignedCents(closure.monthBalanceCents)` — Σ ingresos − Σ gastos del **mes consultado**, incluida la aportación; **no** el balance acumulado (`AccountBalance` sigue mostrándolo aparte).
- Negativo: signo U+2212 + `text-red-600` (convención existente del cierre). Mes vacío: **0,00 €**.

## 4. Mes consultado (FR-004; escenarios 5, SC-004)

- Ambos KPIs reflejan el mes del selector en la misma visita (render de servidor por `?month=`; el stepper intacto sigue usando `router.replace`).
- La barra lleva una **etiqueta pasiva** con `monthLabel(month)` («Octubre de 2026», `text-xs text-muted-foreground`): contexto del KPI al quedar pegada; texto informativo, no el selector.

## 5. Contrato del caso de uso (aplicación)

```ts
interface MonthNetContributionDTO { configured: boolean; amountCents: number }

GetMonthNetContribution.execute(accountId: AccountId, month: string)
  : Promise<MonthNetContributionDTO>
// month inválido (no YYYY-MM) → throw Error (paridad con GetMonthlyClosure)
// Se invoca tras la materialización (orden de página intacto) y nunca la dispara.
```

## 6. Selectores estables para tests

| Elemento | Selector |
|----------|----------|
| Bloque KPIs | `getByRole("region", { name: "KPIs del mes" })` |
| Título | `getByRole("heading", { name: "KPIs del mes" })` |
| KPI aportación | región KPIs → `getByText("Aportación común")` + importe (`/^379,45[\s\u00A0\u202F]€$/`) |
| Sin configuración | región KPIs → `getByText("Sin aportación configurada")` |
| KPI saldo | región KPIs → `getByText("Saldo del mes")` + importe (`/^−120,55[\s\u00A0\u202F]€$/`) |
| Etiqueta de mes | región KPIs → `getByText("Octubre de 2026")` (u `monthLabel`) |
| Ausencia (cuenta común) | `getByRole("region", { name: "KPIs del mes" })` → `toHaveCount(0)` |

## 7. Accesibilidad

- Región etiquetada (`section aria-labelledby` + `h2` «KPIs del mes»), mismo patrón que el resto de bloques de la página.
- Parejas `dt/dd` semánticas (definition list); los importes son texto (tabular-nums), sin dependencia de color para el signo.
- El bloque no captura foco ni interfiere la tabulación (sin controles); sticky no altera el orden DOM.

## 8. Fuera de alcance (this contract)

Cambios en la cuenta común, desglose bruto/descuento, ocultar/sustituir el balance acumulado o el cierre, nuevos KPIs, dark mode/animaciones, y cualquier cambio en selector, listado, formularios, actions o agregados (FR-009).
