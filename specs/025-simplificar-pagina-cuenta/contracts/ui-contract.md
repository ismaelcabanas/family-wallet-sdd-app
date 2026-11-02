# UI Contract — Página de cuenta simplificada: vista operativa sin balance ni cierre (025)

**Feature**: `025-simplificar-pagina-cuenta` | **Componentes**: `page.tsx` de cuenta (MODIFICADO — retira secciones y condiciona lecturas) | **Retirados**: `AccountBalance`, `MonthlyClosurePanel` (+ tests) | **Nuevos**: nada | **Intactos**: `MonthStepper`, `AccountMonthKpis` (contrato congelado 022/023/024), `GroupedMovementList` y diálogos de edición/eliminación + estado vacío, `GlobalNav`, actions y formularios (013/014/017), menús ⋮ (020/023), materializadores (018/019/023).

Congela la estructura y el comportamiento observable de la página resultante. **Supersede** la estructura de [011 ui-contract §1.2](../../011-pagina-cuenta/contracts/ui-contract.md) y el final del orden congelado de [022 ui-contract §1](../../022-kpis-fijos-cuenta/contracts/ui-contract.md) («… → balance → cierre»); todo lo no mencionado queda exactamente como allí.

---

## 1. Estructura resultante de `/accounts/{id}` (FR-001; escenarios 1, 2, 5)

Orden congelado de `main > *` (índices dinámicos vía `aria-labelledby`, patrón existente de `pagina-cuenta.spec.ts`):

```text
Cuenta personal:
┌──────────────────────────────────────────────────────────────┐
│ h1 {nombre de cuenta}            GlobalNav (active="panel")  │
│ «Cuenta personal de {miembro}»                               │
│ [‹ Mes visible (combobox) ›]         ← MonthStepper          │
│ ╔════════════════════════════════════════════╗               │
│ ║ KPIs del mes              {Mes de YYYY}    ║ ← sticky      │
│ ║ Aportación común · Gasto personal ·        ║   (022/024)   │
│ ║ Ahorro del mes · Saldo del mes (4 celdas)  ║               │
│ ╚════════════════════════════════════════════╝               │
│ Movimientos del mes (agrupado por fecha; CTA                 │
│ «Nuevo movimiento»; diálogos editar/eliminar; estado vacío)  │
└──────────────────────────────────────────────────────────────┘

Cuenta común: idéntica sin el bloque «KPIs del mes»
              (subtítulo «Cuenta común»).
```

- **No existen** las regiones «Balance de {cuenta}» ni «Cierre de {mes}» en **ninguna** cuenta (SC-001). No hay sección nueva que las sustituya.
- El bloque «KPIs del mes» y el listado conservan **íntegros** sus contratos: 4 métricas en orden congelado, `sticky top-0 z-20`, grid `grid-cols-2 sm:grid-cols-4`, subtextos de configuración, diálogos por fila a nivel del listado y estado vacío dentro de `GroupedMovementList` (AGENTS.md).

## 2. Lecturas condicionadas al tipo de cuenta (FR-003; data-model §2.2)

```ts
// page.tsx (adaptador; misma figura que netContribution/savings desde 022)
closure = account.type === "personal"
  ? await new GetMonthlyClosure(movementRepository).execute(account.id, month)
  : null;
// getBalance: JUBILADO (FR-004) — la página no consulta balance ni para personales ni para la común
```

- `GetMonthlyClosure` sigue **sin cambios de contrato ni lógica**; sus `personalExpenseCents`/`monthBalanceCents` alimentan las dos restas de composición de 024/023, que la página sigue calculando una única vez para las personales.
- La cuenta común ejecuta: resolución de cuenta, 3 materializaciones, `ListMovements` y `ListActiveTags`. Nada más.
- Las 3 materializaciones (018/019/023) se disparan igual para **todas** las cuentas, antes de leer (FR-006).

## 3. Comportamiento observable intacto (FR-001, FR-006; escenarios 3, 4, 5)

- Altas, ediciones y eliminaciones revalidan listado y KPIs en el mismo ciclo de `revalidatePath` que hoy (escenario 3).
- `/summary` y `/annual` no cambian en absoluto (escenario 4): la lectura financiera agregada vive allí.
- Mes sin movimientos (personal): listado en estado vacío + KPIs a 0,00 € con sus subtextos de configuración vigentes (escenario 5).
- Materialización y re-sincronización del mes en curso intactas: consultar la página sigue materializando/aportando/deduciendo antes de leer (edge «Meses cerrados y materialización»).

## 4. Selectores estables para tests (re-anclaje e2e; research §4)

| Elemento | Selector |
|----------|----------|
| Bloque KPIs (personales) | `getByRole("region", { name: "KPIs del mes" })` |
| Celda KPI por etiqueta | región KPIs → `getByText("Saldo del mes" \| "Gasto personal" \| …).locator("..")` (patrón `balanceCell`) |
| Listado | `getByRole("region", { name: "Movimientos del mes" })`; filas `[data-testid="movement-item"]` con importes firmados |
| Mes establecido (tras navegar ‹ ›) | `getByRole("combobox", { name: "Mes visible" })` → `toContainText("{Mes de YYYY}")` (patrón canónico `resumen-global.spec.ts`) |
| Ausencias (SC-001) | `getByRole("region").filter({ hasText: "Balance de" })` → `toHaveCount(0)`; ídem `"Cierre de"` — en **toda** cuenta |
| Ausencia KPIs (común y `/`) | `getByRole("region", { name: "KPIs del mes" })` → `toHaveCount(0)` |

Formatos vigentes sin cambios: KPI «Saldo del mes» firmado (`+`/`−` U+2212, rojo solo en negativo), «Gasto personal» magnitud, filas del listado firmadas por movimiento.

## 5. Accesibilidad

- Estructura de encabezados y regiones existente conservada (`h1` cuenta, regiones KPIs/listado con `aria-labelledby`); desaparecen dos `section` finales — el orden del DOM no se altera para los bloques vivos.
- Sin controles nuevos ni captura de foco; los diálogos de fila siguen montándose a nivel del listado (AGENTS.md).

## 6. Fuera de alcance (this contract)

Nuevo hogar UI para el balance histórico por cuenta, KPIs o cualquier agregado en la cuenta común, cambios en `/summary`//`/annual`, formularios, menús ⋮, actions, materializaciones, `GetMonthlyClosure` (contrato/lógica), `AccountMonthKpis` y `GroupedMovementList` (contratos congelados), y cambios de esquema/migraciones (spec «Out of Scope»; FR-006).
