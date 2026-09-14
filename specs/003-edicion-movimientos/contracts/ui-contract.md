# Contrato de UI: Edición y Eliminación de Movimientos

**Feature**: `003-edicion-movimientos` | **Componentes**: `movement-list.tsx` (ampliado), `edit-movement-dialog.tsx` y `delete-movement-dialog.tsx` (nuevos, client), `movement-form.tsx` (ampliado con modo edición) | **Integración**: `src/app/page.tsx`

Añade acciones de fila al listado de la pantalla principal de 002 ([ui-contract de 002](../002-registro-movimientos/contracts/ui-contract.md)), sin alterar las regiones existentes (selectores, balance, formulario de alta, panel de cierre de 005, listado).

---

## 1. Integración y flujo (FR-001, FR-006, FR-007)

- Cada fila del listado muestra a la derecha **dos botones de icono**: ✏️ editar y 🗑️ eliminar (solo icono con `aria-label`; ver §5). Los campos y chips de cada fila NO cambian respecto al contrato de 002; las acciones se añaden sin alterar su contenido.
- Los botones de acción y la confirmación de borrado quedan `disabled` (la confirmación muestra "Eliminando…") mientras su action está pendiente.
- Ambos diálogos son **modales** (bloquean la interacción con la página subyacente): el contexto oculto `currentAccountId`/`currentMonth` no puede desfasar mientras un diálogo está abierto.
- **Editar** abre un diálogo en la misma pantalla (FR-006: sin navegación a ruta nueva) con el formulario precargado; **Eliminar** abre un diálogo de confirmación con los datos del movimiento (clarificación 2026-09-14).
- Tras guardar o eliminar: `revalidatePath("/")` refresca listado, balance y cierre en la misma visualización (FR-004); la pantalla **permanece** en la cuenta/mes de los selectores (FR-007).
- Si tras editar o eliminar el mes/cuenta activo queda sin movimientos, el listado pasa al estado vacío de 002 ("Aún no hay movimientos"), sin error.
- El formulario de alta ("Registrar movimiento") no cambia: mismas secciones, textos y comportamiento que el contrato de 002.

## 2. Diálogo de edición

```text
┌─ Editar movimiento ────────────────────────────┐
│  Fecha [2026-09-14]      Importe [78,50]       │  ← prefijados con el movimiento
│  Concepto [Mercadona]                          │
│  Descripción (opcional) [Compra semanal]       │
│  Cuenta [Cuenta común ▾]                       │  ← Select con TODAS las cuentas (cambia en edición)
│  Tipo: (•) Gasto  ( ) Ingreso                  │
│  Naturaleza del gasto: ( ) Personal (•) Compartido │  ← dinámica según la cuenta ELEGIDA (§2.1)
│  Etiquetas: [x] Vivienda [x] Hipoteca [ ] …    │
│                          [ Cancelar ] [ Guardar cambios ] │
└────────────────────────────────────────────────┘
```

- **Título**: "Editar movimiento". Campos, orden, placeholders y mensajes de error **idénticos al alta** (FR-002; schema compartido `movement-form.schema`). El importe se prellena con formato de entrada — coma decimal, sin separador de miles: "78,50" (helper `formatCentsForInput`).
- **Cuenta**: en edición es un `Select` (`name="accountId"`) con todas las cuentas activas de la página; el movimiento puede cambiarse a cualquiera (FR-001). Campo oculto `movementId`.
- **Campos ocultos de contexto** (para el aviso de FR-007): `currentAccountId` y `currentMonth` (`YYYY-MM`) de los selectores de la pantalla.
- **Botones**: "Cancelar" (cierra sin cambios) y "Guardar cambios" (submit; `disabled` + "Guardando…" mientras pendiente).
- Errores de campo: se muestran en línea bajo cada campo igual que el alta; error `_form` (p. ej. "El movimiento ya no existe.") en el pie del formulario; el diálogo **no cierra** en error.

### 2.1 Naturaleza dinámica en edición

- Cuenta elegida de tipo común → naturaleza fija "Compartido (fijo en la cuenta común)" (mismo bloqueo visual que el alta).
- Cuenta elegida personal + tipo gasto → radios Personal/Compartido habilitados; al cambiar de común a personal se conserva la elección explícita si la hay.
- Tipo ingreso → el bloque de naturaleza no se muestra (mismo comportamiento que el alta).

## 3. Diálogo de confirmación de borrado

```text
┌─ Eliminar movimiento ──────────────────────────┐
│  ¿Eliminar este movimiento?                    │
│  Concepto:  Mercadona                          │
│  Importe:   −85,00 €                           │
│  Fecha:      14 de septiembre de 2026          │
│                 [ Cancelar ] [ Eliminar ]       │
└────────────────────────────────────────────────┘
```

- **Datos obligatorios** (clarificación 2026-09-14): concepto, importe con signo contable según tipo (`formatSignedAmountCents`, U+2212) y fecha en formato largo es-ES (helper nuevo `formatDate` en `format.ts`: "14 de septiembre de 2026").
- "Cancelar" cierra sin efectos; "Eliminar" invoca la action y muestra el toast de éxito o error.

## 4. Mensajes (toasts sonner) y estados

| Situación | Texto exacto |
|---|---|
| Edición guardada (visible en la vista actual) | `Movimiento actualizado` |
| Edición que cambia de mes (misma cuenta) | `Movimiento actualizado: ahora está en {Mes YYYY}` (p. ej. "…en Agosto 2026") |
| Edición que cambia de cuenta (mismo mes) | `Movimiento actualizado: ahora está en {nombre de cuenta}` |
| Edición que cambia cuenta y mes | `Movimiento actualizado: ahora está en {nombre de cuenta} · {Mes YYYY}` |
| Movimiento eliminado | `Movimiento eliminado` |
| Edición/eliminación de movimiento inexistente | `El movimiento ya no existe.` (toast de error + revalidación de pantalla; el diálogo de edición o borrado se cierra tras el error) |
| Error inesperado de la action | `No se ha podido guardar el movimiento. Inténtalo de nuevo.` (edición) / `No se ha podido eliminar el movimiento. Inténtalo de nuevo.` (borrado) |

- La action **compone** el mensaje de "movido" comparando cuenta/mes finales con `currentAccountId`/`currentMonth` (data-model §3); la UI solo lo muestra (nunca decide).
- Toast de éxito en edición: cierra el diálogo; el listado pierde la fila si salió de la vista (comportamiento esperado, avisado por el mensaje).

## 5. Accesibilidad y responsive (guía PoC, mismo criterio que 002 §4)

- Botones de fila: `aria-label="Editar {concepto}"` / `aria-label="Eliminar {concepto}"`; `title` con el mismo texto.
- Diálogos shadcn (Radix): foco atrapado, cierre con Escape, `role="dialog"`; el de borrado usa `AlertDialog` (acción destructiva).
- En móvil los botones de fila se mantienen en la misma fila (iconos compactos); los diálogos ocupan el ancho con scroll vertical si procede.
- Los errores de campo mantienen `role="alert"` y `aria-describedby` como el alta.

## 6. Fuera de este contrato

Filtrado y búsqueda de movimientos — feature `007-filtrado-busqueda`; edición/eliminación masiva (multi-selección); deshacer/papelera; historial de cambios; edición de cuentas/miembros — feature `008-gestion-cuentas-miembros`; gestión de tags — feature `004-gestion-tags`.
