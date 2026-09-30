# Contrato de UI: Formulario de alta en diálogo desde el listado

**Feature**: `013-formulario-dialogo` | **Componentes**: `grouped-movement-list.tsx` (ampliado), `create-movement-dialog.tsx` (nuevo, client), `empty-state.tsx` (ampliado), `movement-form.tsx` (pierde el wrapper embebido `MovementForm`; `MovementFormFields` intacto) | **Integración**: `src/app/accounts/[accountId]/page.tsx`

Sustituye el bloque de alta embebido de 002 por un CTA junto al listado que abre un diálogo, sobre el patrón de diálogos de 003 ([ui-contract de 003](../../003-edicion-movimientos/contracts/ui-contract.md)). Sin cambios en diálogos de edición/eliminación, demás páginas ni navegación.

---

## 1. Integración y composición (FR-001, FR-004, FR-005, FR-007)

- La página `/accounts/[accountId]?month=` queda (escenario 6): cabecera de cuenta → subtítulo de tipo → selector de mes/año → **listado con su CTA** → balance acumulado → cierre mensual. **El bloque «Registrar movimiento» embebido desaparece** (SC-002): el diálogo del CTA es la única vía de alta de la aplicación.
- El CTA **«Nuevo movimiento»** vive en la cabecera de la sección del listado (fila flexible: `h2` «Movimientos del mes» a la izquierda, botón a la derecha, `Button` primario `size="sm"`) y está disponible en **cualquier mes visible, con o sin movimientos** (FR-001): en meses vacíos acompaña al estado vacío dentro del propio listado.
- El diálogo se monta a nivel de `GroupedMovementList` (nunca en una fila), con estado `creating` en el cliente; sobrevive a `revalidatePath` (convención del proyecto).
- Sin cambios en la Server Action `createMovement`, validación Zod (`movementFormSchema`), caso de uso ni `revalidatePath` (FR-005): al guardar, la página revalidada recalcula listado, balance y cierre; si la fecha del movimiento cae fuera del mes visible, la vista visible no cambia.
- Importes en EUR es-ES con los helpers existentes de `format.ts` (FR-007). `/`, `/summary`, `/annual` y la navegación global intactas.

### Estado vacío (FR-001, escenario 5)

```text
┌────────────────────────────────────────────────┐
│  Aún no hay movimientos en este mes.           │
│  Pulsa «Nuevo movimiento» para registrar       │
│  el primero.              [Nuevo movimiento]   │
└────────────────────────────────────────────────┘
```

- `EmptyState` mantiene su marco punteado y texto principal; el texto de apoyo pasa de «Registra el primero con el formulario superior.» a **«Pulsa «Nuevo movimiento» para registrar el primero.»** y el CTA se renderiza junto a él (dentro del área del listado).

## 2. Diálogo de alta

```text
┌─ Nuevo movimiento ─────────────────────────────┐
│  Fecha [2026-09-30]       Importe (€) [    ]   │  ← fecha por defecto HOY (independiente del mes visible)
│  Concepto [                                 ]  │
│  Descripción (opcional) [                   ]  │
│  Cuenta                                         │
│  ┌ Cuenta de Miembro B (se cambia con el     ┐ │  ← FIJADA a la cuenta de la página (sin selector)
│  │ selector superior)                        ┘ │
│  Tipo: (•) Gasto  ( ) Ingreso                  │
│  Naturaleza del gasto: (•) Personal ( ) Compartido │  ← solo con Gasto; fija «Compartido (fijo…)» en cuenta común
│  Etiquetas: [ ] Vivienda [ ] Hipoteca [ ] …     │
│                          [ Cancelar ] [ Registrar ] │
└────────────────────────────────────────────────┘
```

- **Título** (`DialogTitle`, nombre accesible del `role="dialog"`): **«Nuevo movimiento»**.
- Campos, orden, placeholders, labels, valores por defecto, reglas y **mensajes de error idénticos al alta actual** (FR-002): `MovementFormFields` en modo alta (`accountId` oculto, cuenta fijada mostrada como texto, fecha `todayIsoDate()`, «Sin selección → Sin Clasificar»).
- **Botones**: «Cancelar» (`secondaryActions`, cierra sin efectos) y **«Registrar»** (submit; `disabled` + «Guardando…» mientras `isPending`).
- Modales Radix: foco atrapado, cierre con Escape/X, `aria-modal` (mismo comportamiento que 003 §5).

## 3. Comportamiento (FR-003)

| Situación | Comportamiento exacto |
|---|---|
| Guardar con éxito | Diálogo se cierra + toast **«Movimiento guardado»** (sonner, top-center); página revalidada muestra listado/balance/cierre recalculados; el movimiento aparece en su mes (si la fecha cae fuera del mes visible, la vista no cambia) |
| Error de validación de campo | Diálogo **permanece abierto**; errores `role="alert"` bajo cada campo; valores introducidos conservados para corregir y reintentar |
| Error `_form` inesperado | Diálogo permanece abierto; error en el pie del formulario («No se ha podido guardar el movimiento. Inténtalo de nuevo.») |
| Cancelar / X / Escape | Descarta la entrada **sin confirmación**, sin efectos; vuelve a la página tal cual (edge case «cierre con datos a medias») |
| Reabrir tras guardar/cancelar | El diálogo se desmontó: reapertura con formulario **limpio** (fecha hoy, Gasto, sin tags) |
| Envío en curso | «Registrar» deshabilitado («Guardando…»); doble envío imposible |

## 4. Accesibilidad

- CTA: `Button` con nombre accesible «Nuevo movimiento» (texto).
- Diálogo: `role="dialog"` con nombre «Nuevo movimiento»; foco atrapado y devuelto al cerrar (Radix); labels/asociaciones de `MovementFormFields` intactos (`aria-describedby`, `role="alert"`).
- La página queda lectura por defecto: el primer elemento interactivo de escritura es el CTA, tras el selector de mes.

## 5. Páginas y componentes fuera de alcance

Diálogos de edición/eliminación de 003 (intactos); rediseño del formulario (nota única, chips) — `014-formulario-nota-tags`; selector de cuenta en el alta; entrada por lotes/atajos; `/`, `/summary`, `/annual` y navegación global; cambios de dominio/aplicación/persistencia.
