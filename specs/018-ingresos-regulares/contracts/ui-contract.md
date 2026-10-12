# Contrato de UI: Ingresos mensuales regulares por miembro

**Feature**: `018-ingresos-regulares` | **Componentes**: `regular-income-panel.tsx` (NUEVO, client) montado en `src/app/accounts/[accountId]/page.tsx`; Server Action `configureRegularIncome` (NUEVA) | **Intactos**: `GroupedMovementList` y diálogos de movimiento, `/summary` y `/annual` (no materializan: muestran los movimientos existentes — decisión del propietario 2026-10-12)

Congela literales y comportamientos de la feature. Extiende los contratos de [014](../../014-formulario-nota-tags/contracts/ui-contract.md) (patrón `useActionState`, intents en botones submit, toasts) y [016](../../016-movimientos-bajo-selector-fechas/spec.md) (list-first); todo lo no mencionado queda como en ellos.

---

## 1. Ubicación y visibilidad (FR-001, FR-006, escenario 8)

- El panel **«Ingreso regular»** se renderiza **solo en cuentas personales**, al final de la página de cuenta (debajo de «Cierre de {mes}»): es configuración de la cuenta, no dato del mes; el orden list-first de 016 queda intacto (`MonthStepper → listado → balance → cierre → ingreso regular`).
- En la **cuenta común no existe** ningún elemento de configuración de ingreso regular (ni panel ni CTA): la única vía de configuración es la página de una cuenta personal.

## 2. Estados del panel

```text
┌─ Ingreso regular ────────────────────────────────┐
│ Sin config:                                      │
│   Configura tu ingreso mensual habitual y        │
│   aparecerá cada mes sin registrarlo a mano.     │
│   [ Configurar ingreso ]                         │
│                                                  │
│ Con config activa:                               │
│   2.000,00 € el día 1 de cada mes                │
│   Nota: Ingreso regular de Miembro A · Activa    │
│   [ Editar ingreso ]  [ Desactivar ]             │
│                                                  │
│ Con config inactiva:                             │
│   Ingreso regular desactivado.                   │
│   [ Editar ingreso ]                             │
└──────────────────────────────────────────────────┘
```

- **Sin configuración**: descripción + CTA «Configurar ingreso» (abre el diálogo vacío: importe vacío, día `1`, nota vacía con placeholder «Ingreso regular de {miembro}»).
- **Configuración activa**: resumen `{importe} el día {día} de cada mes` (formato `Intl es-ES` existente), nota y estado «Activa»; «Editar ingreso» abre el diálogo precargado; «Desactivar» desactiva **sin abrir el diálogo** (acción directa del panel con confirmación inline del botón deshabilitado en `isPending`; toast al terminar).
- **Configuración inactiva**: «Ingreso regular desactivado.» + «Editar ingreso»; al guardar, la configuración se **reactiva** desde el mes en curso (edge «borrado + reactivación»: sin relleno retroactivo).
- El panel es independiente del mes consultado: se muestra igual en cualquier mes de la misma cuenta.

## 3. Diálogo de configuración (FR-001, escenario 7, edges doble envío)

```text
┌─ Ingreso regular ────────────────────────────────┐
│  Importe (€) [ 2.000,00 ]                        │
│    ⚠ El importe es obligatorio.                  │  ← solo con error (ver §4)
│  Día del mes [ 1 ]                               │
│  Nota [ Ingreso regular de Miembro A           ] │  ← opcional; placeholder = default
│                    [ Cancelar ] [ Guardar ]      │
│  (con config activa, además: [ Desactivar ])     │
└──────────────────────────────────────────────────┘
```

- Campos: **«Importe (€)»** (mismo formato ES y parseo que el formulario de movimiento — `2000`, `2000,5`, `2000,50`), **«Día del mes»** (número 1–31, default 1), **«Nota»** (opcional; vacía → default del §2).
- Botones submit con `name="intent"` (patrón 014): **«Guardar»** (`save`) y, si la config está activa, **«Desactivar»** (`deactivate`: secundario, no valida importe/día — desactiva con los valores actuales). **«Cancelar»** cierra sin guardar.
- Durante el envío (`isPending`): todos los controles deshabilitados y «Guardar» muestra **«Guardando…»** (edge anti doble envío).
- Éxito («Guardar»): toast **«Ingreso regular guardado»**, el diálogo se cierra y el panel refleja los nuevos valores; la revalidación hace que el mes en curso muestre el ingreso materializado de inmediato si procede (SC-001). Éxito («Desactivar»): toast **«Ingreso regular desactivado»**, cierre y panel en estado inactivo; los movimientos ya generados permanecen (FR-004).
- Día por defecto 1 y nota por defecto «Ingreso regular de {miembro}» se aplican en el guardado (defaults de la spec); la etiqueta del movimiento generado queda **vacía** (opcional en ingresos desde 014).

## 4. Errores de validación (escenario 7) — literales congelados

| Situación | Mensaje exacto (`role="alert"` bajo el campo) |
|---|---|
| Importe vacío | «El importe es obligatorio.» |
| Importe con formato inválido («abc», «-5», «1.234,56», 3 decimales) | «Introduce un importe válido (ej. 2000,00).» |
| Importe cero («0», «0,00») | «El importe debe ser mayor que cero.» |
| Día fuera de 1–31 (vacío aplica default 1, no es error) | «El día del mes debe estar entre 1 y 31.» |
| Cuenta común (inalcanzable por UI; defensa del dominio) | «La cuenta común no puede tener ingreso regular.» |
| Error inesperado | «No se ha podido guardar el ingreso regular. Inténtalo de nuevo.» |

En error: los valores tecleados **permanecen** en el formulario y el diálogo sigue abierto (mismo criterio que el alta de movimiento).

## 5. Contrato de la Server Action `configureRegularIncome` (frontera)

```ts
configureRegularIncome(_prevState, formData): Promise<ConfigureRegularIncomeState>
// FormData: accountId (dígitos), amount, dayOfMonth, note, intent ("save" | "deactivate" — default "save")

type ConfigureRegularIncomeState =
  | { status: "idle" }
  | { status: "success"; message: string }   // «Ingreso regular guardado» | «Ingreso regular desactivado»
  | { status: "error"; errors: { amount?: string[]; dayOfMonth?: string[]; note?: string[]; _form?: string[] };
      values: { amount: string; dayOfMonth: string; note: string } };
```

- Validación Zod en frontera (`regularIncomeFormSchema` en la propia action, IV): reutiliza `parseAmountToCents` de `movement-form.schema.ts`; `intent="deactivate"` valida solo `accountId` y delega en `DeactivateRegularIncome`.
- Éxito → `revalidatePath("/", "layout")` (refresca la página de cuenta — donde el re-render dispara la materialización del mes en curso — y las vistas agregadas en caché; [data-model §1.3](../data-model.md)).
- Las actions de movimiento y de tags **no cambian**.

## 6. Comportamiento observable de la materialización (FR-002/FR-003/FR-004/FR-005)

- Tras guardar (o al entrar a la cuenta con config activa), el mes en curso del listado muestra **un** movimiento de ingreso con importe, día y nota de la configuración, sin etiqueta y con el mismo aspecto que un ingreso manual (computa en cierre, resumen global y cuenta anual; SC-004).
- La materialización se dispara **solo al abrir la página de la cuenta del mes** (decisión del propietario 2026-10-12): `/summary` y `/annual` muestran el ingreso una vez materializado, sin generar movimientos.
- El día del movimiento se clampa al último día del mes si el configurado no existe (31 → 30 en abril, 28/29 en febrero); el día configurado no se altera.
- Reconsultar el mes (listado, `/summary`, `/annual`, recargas) **nunca duplica** el ingreso (SC-002). Meses anteriores a la activación y meses futuros no muestran ingreso regular (FR-005; `/summary` permite meses futuros por URL: quedan vacíos, sin generación).
- El ingreso generado se **edita** y se **elimina** con los flujos existentes (diálogos de 003/014, sin cambios): las ediciones persisten y no se sobrescriben; si se elimina, **no vuelve a generarse** ese mes (FR-004).
- Los cambios de configuración (importe/día/nota) solo aplican a meses aún no materializados: el mes ya generado conserva su movimiento (clarificación 2026-10-12).
- Desactivar detiene la generación futura; los movimientos existentes permanecen (FR-004).

## 7. Accesibilidad

- El panel es una `section` con `aria-labelledby` al título «Ingreso regular» (`data-testid="regular-income-panel"`).
- El diálogo se abre con foco en «Importe (€)»; errores `role="alert"` asociados por `aria-describedby`; Escape/overlay cierran sin guardar (Radix existente).
- Los botones «Guardar»/«Desactivar»/«Configurar ingreso»/«Editar ingreso» son botones reales con nombres accesibles; el estado deshabilitado durante el envío es visible.

## 8. Fuera de alcance

Aportación porcentual a la cuenta común (feature futura 019), múltiples ingresos regulares por miembro, generación por calendario/cron, relleno retroactivo, badge visual de «generado automáticamente» en la fila del movimiento, cambios en los formularios de movimiento, en cierres/resúmenes o en el seed.
