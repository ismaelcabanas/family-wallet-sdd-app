# UI Contract — Aportación porcentual a la cuenta común por miembro (019)

**Feature**: `019-aportacion-comun` | **Componentes**: `AccountSettingsMenu` + `AccountCardGrid` (MODIFICADOS), `CommonContributionConfigDialog` (NUEVO), `configureCommonContribution` action (NUEVA), `format.ts` (MODIFICADO) | **Retirado**: nada | **Intactos**: todo lo demás.

Congela literales y comportamientos de la feature. **Extiende** los contratos de 018 (`specs/018-ingresos-regulares/contracts/ui-contract.md`) y 020 (`specs/020-menu-configuracion-cuenta/contracts/ui-contract.md`): todo lo no mencionado aquí (patrón stretched-link, trigger ⋮, diálogo de ingreso regular, formularios de movimiento, cierres y resúmenes) queda exactamente como allí.

---

## 1. El ítem «Aportación» en el menú ⋮ (FR-001, FR-006, FR-007; escenarios 8, 10)

- Segundo ítem del menú de configuración de cada tarjeta de **cuenta personal**, bajo «Ingreso regular». La cuenta común sigue **sin menú** (escenario 8; intacto de 020).
- Estado a la derecha del ítem (`ml-auto text-muted-foreground`), producido por la función pura exportada `commonContributionMenuStatus(contribution, regularIncome)`:

| Condición | Literal (congelado) | Interacción |
|-----------|--------------------|-------------|
| Sin ingreso regular (018) en la cuenta | **«Requiere ingreso regular»** | Ítem **deshabilitado** (`disabled` de `DropdownMenuItem`); no abre diálogo (escenario 10, FR-006) |
| Con ingreso regular, sin aportación configurada | **«Sin configurar»** | Abre el diálogo vacío |
| Aportación con `active: true` | **«Activa»** | Abre el diálogo pre-rellenado |
| Aportación con `active: false` | **«Desactivada»** | Abre el diálogo pre-rellenado (reactivable con «Guardar») |

```text
┌───────────────────────────────┐
│ Configuración de Cuenta de …  ⋮
│ Ingreso regular      Activa   │   ← intacto (020/018)
│ Aportación    Sin configurar  │   ← NUEVO (019); estado atenuado a la derecha
└───────────────────────────────┘
```

- Cada menú mantiene sus diálogos montados condicionalmente **dentro de la tarjeta** (excepción documentada en AGENTS.md; una apertura = una instancia fresca). Solo puede haber un diálogo abierto por tarjeta.

## 2. Diálogo «Aportación a la cuenta común» (FR-001; escenario 7; edge «Doble envío»)

Espejo estructural del diálogo de ingreso regular (focus, guard de éxito único, `useActionState`):

- **Título**: **«Aportación a la cuenta común»**.
- **Único campo**: label **«Porcentaje (%)»**, input `id="common-contribution-percentage"`, `inputMode="decimal"`, **placeholder «25»**. `defaultValue`: vacío sin config; `formatBasisPointsForInput(bp)` con config («25», «12,5»).
- Foco inicial programado en el input (specie `onOpenAutoFocus` + `preventDefault`).
- **Botones** (self-end, orden fijo): **«Cancelar»** (outline, `type="button"`) · **«Desactivar»** (outline, `name="intent" value="deactivate"`, **solo si la config existe y está activa**) · **«Guardar»** (`name="intent" value="save"`). Con `isPending`: todos `disabled` y los submit muestran **«Guardando…»**.
- Errores por campo bajo el input (`role="alert"`, `aria-describedby`) y banner `_form` (mismos estilos que 018).
- **Sin** preview de importe ni campos de día/nota (research §6).

## 3. Literales de validación y toasts (congelados)

| Situación | Mensaje exacto |
|-----------|----------------|
| Porcentaje vacío | **«El porcentaje es obligatorio.»** |
| Formato inválido (>2 decimales, texto, negativos) | **«Introduce un porcentaje válido (ej. 25 o 12,5).»** |
| Porcentaje = 0 | **«El porcentaje debe ser mayor que cero.»** |
| Porcentaje > 100 | **«El porcentaje no puede ser mayor que 100.»** |
| Importe resultante < 0,01 € (dominio) | **«El porcentaje aplicado a tu ingreso regular debe resultar en al menos 0,01 €.»** |
| Sin ingreso regular (`MissingRegularIncomeError`, `_form`) | **«Configura primero el ingreso regular de este miembro.»** |
| Cuenta común (`SharedAccountContributionError`, `_form`) | **«La cuenta común no puede tener aportación.»** |
| Sin aportación al desactivar (`_form`) | **«No existe aportación configurada para esta cuenta.»** |
| Error inesperado / accountId inválido (`_form`) | **«No se ha podido guardar la aportación. Inténtalo de nuevo.»** |
| Toast éxito guardado | **«Aportación guardada»** |
| Toast éxito desactivado | **«Aportación desactivada»** |

## 4. El movimiento generado (FR-002, FR-003; escenarios 1–6)

Aparece en el listado del mes de la cuenta personal como un movimiento corriente (sin badge de origen):

- Nota: **«Aportación común de {memberName}»** (p. ej. «Aportación común de Miembro B»).
- Etiqueta: **«Aportación Común»**.
- Fecha: día **1** del mes materializado; firma **−importe** (p. ej. −500,00 €) al ser gasto de naturaleza **propia** (clarify 2026-10-14; no suma a «Gastos compartidos»).
- Editable y eliminable con los flujos existentes; el borrado es definitivo (no se regenera).

## 5. Contrato de la Server Action (espejo de la de 018)

```ts
type ConfigureCommonContributionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; errors: Partial<Record<"percentage" | "accountId" | "_form", string[]>>;
      values: { percentage: string } };

// FormData: accountId (hidden), percentage, intent ("save" | "deactivate")
// Éxito → revalidatePath("/", "layout") + message de la tabla §3.
```

Parse de frontera: `parsePercentageToBasisPoints("25" | "25,0" | "25.00") = 2500`, `("12,5") = 1250`, `("33,33") = 3333` (manipulación de cadenas, nunca `parseFloat`; research §1).

## 6. Selectores estables para tests

| Elemento | Selector |
|----------|----------|
| Ítem «Aportación» | `getByRole("menuitem", { name: /Aportación/ })` + literal de estado (p. ej. `/Aportación\s*Activa/`) |
| Ítem deshabilitado sin ingreso regular | ítem anterior con `«Requiere ingreso regular»` → `toBeDisabled()` |
| Diálogo | `getByRole("dialog", { name: "Aportación a la cuenta común" })` |
| Input de porcentaje | `getByLabel("Porcentaje (%)")` |
| Botones | `getByRole("button", { name: "Guardar" \| "Desactivar" \| "Cancelar" })` |
| Movimiento generado | `getByRole("listitem").filter({ hasText: "Aportación común de Miembro B" })` (nota de la spec e2e) |

## 7. Accesibilidad

- Errores por campo con `role="alert"` + `aria-describedby` (espejo 018); banner `_form` también `role="alert"`.
- Ítem deshabilitado expone estado deshabilitado nativo de Radix (`data-disabled`/`aria-disabled`).
- Foco inicial en el input del porcentaje; cierre con Escape/Cancelar devuelven el foco (Dialog Radix).
- El trigger ⋮ y el stretched-link siguen intactos (020): el clic en ⋮ nunca navega.

## 8. Fuera de alcance (this contract)

Doble anotación en la cuenta común, badge «generado automáticamente», preview de importe en el diálogo, cambios en el ítem «Ingreso regular»/su diálogo, cambios en formularios de movimiento, cierres, resúmenes o anual, y configuración desde la página de cuenta (020 la dejó libre de configuración).
