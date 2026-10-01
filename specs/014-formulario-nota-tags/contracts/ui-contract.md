# Contrato de UI: Alta continua con nota única y tag única

**Feature**: `014-formulario-nota-tags` | **Componentes**: `movement-form.tsx` (`MovementFormFields` simplificado), `create-movement-dialog.tsx` (captación continua), `edit-movement-dialog.tsx` (sin cuenta), `grouped-movement-list.tsx` (nota + tag única), `delete-movement-dialog.tsx` (nota), paneles (sin TAG_NOTE) | **Integración**: `src/app/accounts/[accountId]/page.tsx` (composición sin cambios, FR-009)

Congela los literales y comportamientos de la feature. Extiende los contratos de [002](../../002-registro-movimientos/contracts/) y [013](../../013-formulario-dialogo/contracts/ui-contract.md); diálogos siempre a nivel de `GroupedMovementList` (convención AGENTS.md).

---

## 1. Formulario simplificado (alta y edición, FR-002/FR-003/FR-004, SC-002)

```text
┌─ Nuevo movimiento ────────────── Guardados: 2 ─┐
│  Fecha [2026-10-01]        Importe (€) [    ]  │  ← fecha por defecto HOY (editable en cada captura)
│  Nota [                                      ]  │  ← obligatoria; placeholder «Mercadona»
│  Tipo: (•) Gasto  ( ) Ingreso                   │
│  Naturaleza del gasto: (•) Personal ( ) Compartido │ ← solo con Gasto; fija «Compartido (fijo en la cuenta común)»
│  Etiqueta: ( ) Alimentación (•) Hogar ( ) …     │  ← RadioGroup simple (exactamente 1 como máximo)
│                                                 │     con Ingreso: añade opción ( ) Sin etiqueta
│              [ Cancelar ] [ Guardar y cerrar ] [ Guardar y seguir ] │
└─────────────────────────────────────────────────┘
```

- **Campos (orden congelado)**: fecha, importe, **Nota**, tipo, naturaleza (solo gastos), **etiqueta**. Máximo 6 controles visibles (SC-002). **No existe** campo descripción, bloque informativo de cuenta (alta) ni selector de cuenta (edición) — FR-004.
- Labels: **«Nota»** (`name="note"`), **«Etiqueta»** (`name="tagId"`, radio). Naturaleza y tipo conservan sus literales. La etiqueta no es «(opcional)» en el literal: su obligatoriedad depende del tipo visible.
- **Tag única**: `RadioGroup` con una opción por tag activa del catálogo; sin opción marcada por defecto. Con **Ingreso** aparece además la opción **«Sin etiqueta»** (`value=""`); con **Gasto** no existe y el envío sin selección falla. Cambiar Gasto→Ingreso conservando una tag marcada es válido (máximo 1, edge case).
- Mensajes de error nuevos/renombrados: «La nota es obligatoria.» (nota vacía/solo espacios), «Selecciona una etiqueta para el gasto.» (gasto sin tag, frontera Zod y dominio), «Una de las etiquetas seleccionadas ya no está disponible.» (tag inexistente/inactiva — se mantiene), «El movimiento ya no pertenece a esta cuenta.» (edición con cuenta inesperada). El resto de mensajes (fecha, importe, tipo, naturaleza) sin cambios.
- **Desaparece** el texto «Sin selección, el movimiento se guarda con la etiqueta «Sin Clasificar».» (FR-003).
- Hidden inputs: alta `accountId` (cuenta de la página); edición `movementId`, `currentAccountId`, `currentMonth`.

## 2. Diálogo de edición (FR-002/FR-003/FR-004, FR-006)

- Mismos campos simplificados que el alta (nota única, etiqueta única, sin selector de cuenta), prefijados con el movimiento; submit **«Guardar cambios»**; éxito **cierra** el diálogo con toast (comportamiento actual, FR-006).
- El mensaje de éxito pierde la rama de cuenta: «Movimiento actualizado» +, si cambió de mes, «: ahora está en {Mes año}».
- Props: pierde `accounts`; `GroupedMovementList` deja de pasarlas al diálogo de edición.

## 3. Captación continua — diálogo de alta (FR-001, SC-001)

| Situación | Comportamiento exacto |
|---|---|
| «Guardar y seguir» con datos válidos | Movimiento persistido; `revalidatePath` recalcula listado/balance/cierre en vivo (FR-005); el diálogo **permanece abierto**; toast «Movimiento guardado»; contador **«Guardados: N»** (junto al título) incrementa; nota/importe/etiqueta quedan **vacíos**; **fecha, tipo y naturaleza (si aplica) conservan** el último valor guardado; **foco en el primer campo vacío (Nota)** |
| «Guardar y cerrar» | Guarda la entrada en curso con `intent="close"`; cierra el diálogo; toast «Movimiento guardado»; página revalidada |
| Error de validación de campo | Diálogo **abierto**: errores `role="alert"` por campo y valores introducidos **conservados**; la tanda no se rompe (corregir y seguir) |
| Cancelar / X / Escape | Descarta **solo la entrada en curso**, sin confirmación; los movimientos ya guardados en la tanda permanecen (ya revalidados) |
| Envío en curso | Ambos botones de guardado `disabled` («Guardando…»); doble envío imposible |
| Cambio de tipo a mitad de tanda | Naturaleza se oculta con Ingreso y la etiqueta pasa a opcional según el **tipo actual del formulario** (no del movimiento anterior) |
| Guardado en mes distinto al visible | Comportamiento actual: la revalidación actualiza lo afectado; la tanda continúa |

Botonera (orden congelado): `[Cancelar] [Guardar y cerrar] [Guardar y seguir]` — «Guardar y seguir» primario (submit), «Guardar y cerrar» secundario (submit con `intent="close"`), «Cancelar» outline. En edición la botonera sigue siendo `[Cancelar] [Guardar cambios]`.

## 4. Estados del diálogo de alta (UI)

```text
[cerrado] --CTA «Nuevo movimiento»--> [abierto: limpio, fecha hoy, Gasto, sin etiqueta, Guardados oculto]
[abierto] --«Guardar y seguir» éxito--> [abierto: remontado (nota/importe/etiqueta vacíos, fecha/tipo/naturaleza pegados), Guardados: N, foco en Nota]
[abierto] --«Guardar y cerrar» éxito--> toast + página revalidada --> [cerrado]
[abierto] --error de campo--> [abierto: errores + valores conservados, sin remonte]
[abierto] --Cancelar/X/Escape--> descartar entrada en curso (sin confirmación) --> [cerrado]
[abierto] --envío--> botones disabled «Guardando…»
```

## 5. Contrato del FormData y la Server Action `createMovement` (frontera)

```ts
// FormData del alta
{ date, amount, note, accountId, type, nature?, tagId | "", intent?: "continue" | "close" }

// CreateMovementState
| { status: "idle" }
| { status: "success"; message: "Movimiento guardado"; intent: "continue" | "close" }  // intent ausente en el envío → "close"
| { status: "error"; errors: MovementFieldErrors; values: MovementFormValues }          // values: { date, note, amount, accountId, type, nature, tagId }
```

- `MovementFieldKey = "date" | "note" | "amount" | "accountId" | "type" | "nature" | "tagId" | "_form"`.
- Validación Zod (`movementFormSchema`): nota no vacía tras trim; `tagId` vacío→`null`, si presente entero; `superRefine`: gasto sin tag → error en `tagId`; naturaleza igual que hoy.
- DTO enviado al caso de uso: `CreateMovementDTO { accountId, type, date, note, amountCents, nature, tagId: number | null }` (data-model §4).
- `updateMovement`: mismo schema de formulario + contexto `movementId`/`currentAccountId`/`currentMonth`; DTO `UpdateMovementDTO { movementId, expectedAccountId: currentAccountId, type, date, note, amountCents, nature, tagId }`.
- Revalidación sin cambios: `/` + `/accounts/[accountId]` page en cada guardado con éxito (FR-005).

## 6. Vistas del movimiento (SC-005)

- **Listado agrupado**: chip de la tag única (si hay) + **nota** + badge naturaleza (gastos) + importe con signo. `aria-label`/`title` de editar/eliminar: «Editar {nota}» / «Eliminar {nota}».
- **Diálogo de eliminación**: «Nota: …», Importe, Fecha.
- **Cierre mensual, resumen global, cuenta de resultados anual**: desgloses por tag sin cambios de cálculo; **desaparece** la nota «Los gastos con varias tags computan en cada una; las filas pueden no sumar el total de gastos.» (TAG_NOTE) de los tres paneles; el header sr-only «Concepto» del anual pasa a «Nota».
- Ninguna vista muestra concepto y descripción por separado ni más de una tag (SC-005).

## 7. Accesibilidad

- RadioGroup de etiqueta: labels asociados por opción (`Label htmlFor`), mensaje de error con `role="alert"`; los radios comparten `name="tagId"`.
- Foco tras guardado continuo: el primer campo vacío (Nota) recibe `.focus()` programático tras el remonte; el diálogo Radix conserva foco atrapado/Escape/`aria-modal` (003/013 sin cambios).
- Contador «Guardados: N» como texto del header del diálogo (fuera del `DialogTitle`, que sigue siendo «Nuevo movimiento»).

## 8. Fuera de alcance

Rediseño visual de controles (chips, selector de fecha propio), inline editing, recolocación masiva entre cuentas, gestión de catálogo de tags (`004-gestion-tags`), atajos/autoguardado, cambios en `/`, `/summary`, `/annual`, navegación, cierre y cuadre, optimización móvil/dark mode.
