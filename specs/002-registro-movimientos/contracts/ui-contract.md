# Contrato de UI: Pantalla Principal (`/`)

**Feature**: `002-registro-movimientos` | **Ruta**: `src/app/page.tsx` (adaptador fino) | **Componentes**: `src/infrastructure/primary/ui/`

Única pantalla de la aplicación. Renderizada en servidor; estado de contexto (cuenta activa + mes) en la URL.

---

## 1. URL y estado de contexto (FR-017)

```text
/?account=<accountId>&month=<YYYY-MM>
```

- `account`: parámetro **primario** (se elige primero). Si falta o es inválido → primera cuenta personal (orden estable del seed).
- `month`: parámetro secundario. Si falta o es inválido → **mes actual** (obligatorio al abrir, FR-017).
- Cambiar cualquiera de los dos actualiza la URL (`router.replace` + `useTransition`) y re-renderiza en servidor listado, balance y defaults del formulario con el nuevo contexto.
- La cuenta activa es la cuenta del movimiento a registrar: el formulario la muestra y **no es editable ahí** (FR-017). Este selector es la **única** forma de elegir la cuenta (fuente única de verdad).

## 2. Regiones de la pantalla

### 2.1 Selectores de contexto
- **Selector de cuenta**: dropdown con las 3 cuentas (nombre + tipo personalizable visible: "Cuenta de {miembro}", "Cuenta común").
- **Selector de mes**: dropdown de meses (`YYYY-MM`, navegables hacia el pasado y futuro; meses futuros permitidos).
- Ambos visibles en la parte superior, vinculados a listado y formulario.

### 2.2 Balance de la cuenta (FR-008)
- Balance acumulado de la **cuenta activa**: ingresos − gastos de TODOS sus movimientos (histórico completo, no solo el mes visible).
- Formato español: `850,00 €` (Intl es-ES). Puede ser negativo (`-12,50 €`).
- Se actualiza tras cada registro (mismo roundtrip de la action).

### 2.3 Formulario de registro — SIEMPRE visible (FR-014, FR-016)

| Campo | Control | Default al abrir / tras éxito |
|---|---|---|
| Fecha | input date | **Hoy** (FR-016) |
| Concepto | input text, obligatorio | vacío |
| Descripción | input text, opcional | vacío |
| Importe | input text, placeholder "0,00" | vacío |
| Cuenta | información **no editable** (badge/texto con nombre de la cuenta activa; viaja al servidor como campo oculto `accountId`) | **Cuenta activa** (contexto); para cambiarla se usa el selector 2.1 |
| Tipo | gasto / ingreso (radio o toggle) | gasto |
| Naturaleza | personal / compartido | Si cuenta personal: **personal** (FR-016); si cuenta común: **compartido**, deshabilitado (no editable) |
| Tags | checkboxes del catálogo activo (12) | ninguno |
| Enviar | botón "Registrar" con estado `pending` | — |

Comportamiento:
- **Validación por campo** (FR-011): cada error se muestra **junto a su campo**; mensajes exactos en [create-movement-action.md](./create-movement-action.md) §3.
- **Fallo**: valores introducidos permanecen; nada se guarda.
- **Éxito** (FR-015): toast de confirmación ("Movimiento guardado"), formulario reseteado a los defaults (fecha = hoy, cuenta activa, tipo gasto, naturaleza según cuenta), permanencia en la misma pantalla; listado y balance actualizados.
- **Cuenta con contexto único**: la cuenta no se edita en el formulario; el selector de contexto (2.1) es la única forma de elegirla y actualiza a la vez listado, balance, formulario y su naturaleza por defecto. Sin divergencia posible entre la cuenta registrada y la vista.

### 2.4 Listado de movimientos del mes (FR-009)

- Columnas visibles por movimiento: **fecha, concepto, importe, tipo, naturaleza y tags** (descripción visible como secundaria si existe).
- Importe con signo contable explícito: gasto `−85,00 €` / ingreso `+1.500,00 €` (formato es-ES).
- Tipo: "Gasto" / "Ingreso". Naturaleza: "Personal" / "Compartido" (solo gastos).
- Tags: chips con el nombre; **sin tags → chip "Sin clasificar"** (FR-006).
- Orden: fecha descendente (más reciente primero) dentro del mes.
- Solo movimientos de la cuenta activa y del mes seleccionado (por fecha del movimiento, FR-004).

### 2.5 Estado vacío (FR-018)

Cuando el mes/cuenta no tienen movimientos:

```text
Aún no hay movimientos en este mes.
Registra el primero con el formulario superior.
```

## 3. Estados y textos globales

| Estado | Texto/Comportamiento |
|---|---|
| Toast éxito | "Movimiento guardado" (auto-descarte) |
| Envío en curso | Botón deshabilitado con "Guardando…" (`pending`) |
| Error inesperado | Mensaje `_form` bajo el formulario (ver contrato de la action §3) |
| Idioma | Toda la UI en español (FR-012); etiquetas cortas y sin tecnicismos |

## 4. Accesibilidad y mínimos de calidad

- Labels asociados a cada input; errores de campo anunciados con `aria-describedby` / rol `alert`.
- Navegable por teclado (tab order natural: selectores → formulario → listado).
- Targets táctiles suficientes para uso móvil.

## 5. Fuera de este contrato

Edición/eliminación de movimientos, filtros, gestión de tags/cuentas/miembros, KPIs mensuales (features 003–006). El listado no incluye acciones por fila en esta feature.
