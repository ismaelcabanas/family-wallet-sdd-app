# UI Contract — Porcentaje de ahorro por miembro con apartado mensual (023)

**Feature**: `023-porcentaje-ahorro` | **Componentes**: `AccountSettingsMenu` + `AccountCardGrid` (MODIFICADOS), `SavingsConfigDialog` (NUEVO), `configureSavingsAllocation` action + `savings-form.schema.ts` (NUEVAS), `AccountMonthKpis` (MODIFICADO — **amenda el contrato de 022**), `page.tsx` de cuenta y de `/` (MODIFICADOS) | **Retirado**: nada | **Intactos**: `MonthStepper`, listado y diálogos de movimiento, `AccountBalance`, `MonthlyClosurePanel`, actions y formularios existentes, agregados, cuenta común.

Congela literales, estructura y comportamiento observable. **Extiende** los contratos de 018 (`specs/018-ingresos-regulares/contracts/ui-contract.md`), 019 (`specs/019-aportacion-comun/contracts/ui-contract.md`) y 020 (`specs/020-menu-configuracion-cuenta/contracts/ui-contract.md`), y **amenda** el de 022 (`specs/022-kpis-fijos-cuenta/contracts/ui-contract.md`) en su sección de KPIs (§4 de este contrato): todo lo no mencionado queda exactamente como allí.

---

## 1. El ítem «Ahorro» en el menú ⋮ (FR-001, FR-006; escenarios 6, 8)

- Tercer ítem del menú de configuración de cada tarjeta de **cuenta personal**, bajo «Ingreso regular» (020/018) y «Aportación» (019). La cuenta común sigue **sin menú** (esc. 6; intacto de 020).
- Estado a la derecha del ítem (`ml-auto text-muted-foreground`), producido por la función pura exportada `savingsMenuStatus(savings, regularIncome)`:

| Condición | Literal (congelado) | Interacción |
|-----------|--------------------|-------------|
| Sin ingreso regular (018) en la cuenta | **«Requiere ingreso regular»** | Ítem **deshabilitado** (`disabled` de `DropdownMenuItem`); no abre diálogo (esc. 8) |
| Con ingreso regular, sin ahorro configurado | **«Sin configurar»** | Abre el diálogo vacío |
| Ahorro con `active: true` | **«Activo**" | Abre el diálogo pre-rellenado |
| Ahorro con `active: false` | **«Desactivado»** | Abre el diálogo pre-rellenado (reactivable con «Guardar») |

```text
┌───────────────────────────────┐
│ Configuración de Cuenta de …  ⋮
│ Ingreso regular      Activa   │   ← intacto (020/018)
│ Aportación    Sin configurar  │   ← intacto (019)
│ Ahorro       Sin configurar   │   ← NUEVO (023); estado atenuado a la derecha
└───────────────────────────────┘
```

- El diálogo se monta condicionalmente **dentro de la tarjeta** (excepción documentada en AGENTS.md; una apertura = una instancia fresca). Solo puede haber un diálogo abierto por tarjeta.

## 2. Diálogo «Ahorro mensual» (FR-001; esc. 5; edge «Doble envío»)

Espejo estructural del diálogo de aportación (focus, guard de éxito único, `useActionState`):

- **Título**: **«Ahorro mensual»**.
- **Único campo**: label **«Porcentaje (%)»**, input `id="savings-percentage"`, `inputMode="numeric"`, **placeholder «10»**. `defaultValue`: vacío sin config; `String(config.percentage)` con config («10»). **Entrada entera**: sin decimales.
- Foco inicial programado en el input (`onOpenAutoFocus` + `preventDefault`).
- **Botones** (self-end, orden fijo): **«Cancelar»** (outline, `type="button"`) · **«Desactivar»** (outline, `name="intent" value="deactivate"`, **solo si la config existe y está activa**) · **«Guardar»** (`name="intent" value="save"`). Con `isPending`: todos `disabled` y los submit muestran **«Guardando…»**.
- Errores por campo bajo el input (`role="alert"`, `aria-describedby`) y banner `_form` (mismos estilos que 018/019).
- **Sin** preview de importe (paridad 019).

## 3. Literales de validación y toasts (congelados)

| Situación | Mensaje exacto |
|-----------|----------------|
| Porcentaje vacío | **«El porcentaje es obligatorio.»** |
| Formato inválido (decimales como «12,5», texto, negativos) | **«Introduce un porcentaje entero entre 1 y 100 (ej. 10).»** |
| Porcentaje = 0 | **«El porcentaje debe ser mayor que cero.»** |
| Porcentaje > 100 | **«El porcentaje no puede ser mayor que 100.»** |
| Importe resultante < 0,01 € (dominio) | **«El porcentaje aplicado a tu ingreso regular debe resultar en al menos 0,01 €.»** |
| Sin ingreso regular (`MissingRegularIncomeError`, `_form`) | **«Configura primero el ingreso regular de este miembro.»** |
| Cuenta común (`SharedAccountSavingsError`, `_form`) | **«La cuenta común no puede tener ahorro.»** |
| Sin ahorro al desactivar (`_form`) | **«No existe ahorro configurado para esta cuenta.»** |
| Error inesperado / accountId inválido (`_form`) | **«No se ha podido guardar el ahorro. Inténtalo de nuevo.»** |
| Toast éxito guardado | **«Ahorro guardado»** |
| Toast éxito desactivado | **«Ahorro desactivado»** |

## 4. Bloque «KPIs del mes» — AMENDA al contrato de 022 (FR-005; escenarios 1, 2, 7, 9, 10, 11)

Presencia, sticky, etiqueta de mes y accesibilidad de 022 §1 quedan **intactos**. La `dl` pasa de 2 a **3 métricas** (`grid grid-cols-3 gap-3`), en este orden congelado:

```text
╔══════════════════════════════════════════════════════╗
║ KPIs del mes                          Octubre de 2026║
║ Aportación común │ Ahorro del mes │ Saldo del mes    ║
║ 379,45 €         │ 300,00 €       │ −420,55 €        ║
╚══════════════════════════════════════════════════════╝
```

- **«Aportación común»** (intacta de 022 §2): `formatAmountCents(netContribution.amountCents)`; subtexto «Sin aportación configurada» solo con `configured: false`.
- **«Ahorro del mes»** (NUEVA):

| Estado (`MonthSavingsDTO`) | Valor | Subtexto |
|---|---|---|
| `configured: false` | **0,00 €** | **«Sin ahorro configurado»** (`text-xs text-muted-foreground`) |
| `configured: true, amountCents: n` | `formatAmountCents(n)` (p. ej. **300,00 €**; 0,00 € si el mes no tiene deducción) | — (sin literal: la config existe) |

- **«Saldo del mes»** (label intacto de 022 §3; valor **amendado a neto**): `formatSignedCents(netMonthBalanceCents)` donde `netMonthBalanceCents = closure.monthBalanceCents − savings.amountCents` (resta compuesta una única vez en la página; research §4). Negativo: signo U+2212 + `text-red-600`. **Sin** KPI «Disponible» propio (clarify 2026-10-26). Con ahorro sin configurar, neto = bruto (coincide con el cierre); con ahorro > 0, KPI y cierre difieren exactamente en el importe deducido (FR-007, edge «Sin doble cómputo»).
- Ambas métricas nuevas reflejan el **mes consultado** en el selector (022 §4 intacto) y se muestran **siempre** en cuentas personales. La cuenta común no renderiza el bloque (intacto 022 §1).

## 5. Contrato de la Server Action (espejo de la de 019)

```ts
type ConfigureSavingsAllocationState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; errors: Partial<Record<"percentage" | "accountId" | "_form", string[]>>;
      values: { percentage: string } };

// FormData: accountId (hidden), percentage, intent ("save" | "deactivate")
// Éxito → revalidatePath("/", "layout") + message de la tabla §3.
```

Parse de frontera (`savings-form.schema.ts`): `INTEGER_PERCENTAGE_PATTERN = /^\d{1,3}$/`; `parseIntegerPercentage("10") = 10`, `"100" = 100`; **«12,5» y «12.5» no matchean el patrón** → error de formato (manipulación de cadenas, nunca `parseFloat`; paridad `contribution-form.schema.ts`).

## 6. Contrato del caso de uso de lectura (aplicación)

```ts
interface MonthSavingsDTO { configured: boolean; amountCents: number }

GetMonthSavings.execute(accountId: AccountId, month: string)
  : Promise<MonthSavingsDTO>
// month inválido (no YYYY-MM) → throw Error (paridad con GetMonthlyClosure)
// Se invoca tras MaterializeSavingsAllocations (tercer await secuencial de la página,
// tras 018 y 019) y nunca lo dispara; importe = fila del registro, sin recálculo.
```

## 7. Selectores estables para tests

| Elemento | Selector |
|----------|----------|
| Ítem «Ahorro» | `getByRole("menuitem", { name: /Ahorro/ })` + literal de estado (p. ej. `/Ahorro\s*Activo/`) |
| Ítem deshabilitado sin ingreso regular | ítem anterior con «Requiere ingreso regular» → `toBeDisabled()` |
| Diálogo | `getByRole("dialog", { name: "Ahorro mensual" })` |
| Input de porcentaje | `getByLabel("Porcentaje (%)")` |
| Botones | `getByRole("button", { name: "Guardar" \| "Desactivar" \| "Cancelar" })` |
| KPI ahorro | región «KPIs del mes» → `getByText("Ahorro del mes")` + importe (`/^300,00[\s\u00A0\u202F]€$/`) |
| Sin configuración | región KPIs → `getByText("Sin ahorro configurado")` |
| KPI saldo neto | región KPIs → `getByText("Saldo del mes")` + importe neto (`/^−420,55[\s\u00A0\u202F]€$/`) |
| Ausencia de movimiento de ahorro | listado del mes → `getByRole("listitem")` **sin** ningún ítem nuevo tras activar el ahorro |

## 8. Accesibilidad

- Errores por campo con `role="alert"` + `aria-describedby` (espejo 018/019); banner `_form` también `role="alert"`.
- Ítem deshabilitado expone estado deshabilitado nativo de Radix (`data-disabled`/`aria-disabled`).
- Foco inicial en el input del porcentaje; Escape/Cancelar devuelven el foco (Dialog Radix).
- El trigger ⋮ y el stretched-link intactos (020): el clic en ⋮ nunca navega.
- La tercera celda del `dl` mantiene las parejas `dt/dd` semánticas y `tabular-nums` (022 §7 intacto).

## 9. Fuera de alcance (this contract)

Materializar el ahorro como movimiento (etiqueta «Ahorro», cómputo en agregados), desglose bruto/neto del ahorro, metas de ahorro, cambios en la cuenta común, cambios en cierre/resumen/anual/balance acumulado, cambios en los ítems «Ingreso regular»/«Aportación» y sus diálogos, formularios de movimiento, y configuración desde la página de cuenta (020 la dejó libre de configuración).
