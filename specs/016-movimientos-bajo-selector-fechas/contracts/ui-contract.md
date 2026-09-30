# UI Contract: Listado de movimientos bajo el selector de fechas

**Feature**: 016-movimientos-bajo-selector-fechas | **Fecha**: 2026-09-30

Contrato de composición de la página de cuenta tras la reordenación. La feature no crea interfaces nuevas: congela el **orden de los bloques existentes** como contrato verificable (FR-001/FR-002) y declara intocables el resto de páginas y las convenciones internas del listado (FR-004/FR-006). Los textos, roles y comportamientos de cada bloque son los ya entregados por 002/003/005/011/012.

## 1. Composición de `/accounts/[accountId]?month=YYYY-MM` (contrato congelado)

Orden obligatorio de bloques dentro de `main`:

1. Cabecera: `h1` con el nombre de la cuenta + `GlobalNav` (`navigation "Navegación principal"`, `active="panel"`).
2. Subtítulo de tipo de cuenta («Cuenta común» / «Cuenta personal de {miembro}»).
3. Selector de mes/año: `MonthStepper` — botones ‹ («Mes anterior») / › («Mes siguiente») + `combobox "Mes visible"`.
4. **Listado de movimientos del mes**: `region "Movimientos del mes"` (`GroupedMovementList`), agrupado por fecha con `heading level 3` por día; filas con editar/eliminar; **estado vacío dentro del propio region** («Aún no hay movimientos en este mes»).
5. Balance acumulado: `region` con «Acumulado hasta {mes}» (`AccountBalance`).
6. Formulario de alta embebido: `form` con labels «Fecha», «Concepto», «Importe (€)», … (`MovementForm`) y botón «Registrar».
7. Cierre mensual: `region` «Cierre de {mes}» (`MonthlyClosurePanel`).

**Invariantes**:
- Entre 3 y 4 no existe ningún otro elemento de bloque (FR-001; SC-001).
- 5, 6 y 7 conservan este orden relativo (el actual antes de la feature) bajo el listado (FR-002).
- Con viewport de escritorio estándar, 3 y el primer grupo de 4 son visibles sin desplazamiento (SC-002).

## 2. Datos mostrados

Sin cambios respecto a 011 (SC-004): mismos movimientos del mes visible (`ListMovements`), mismo balance acumulado a fin de mes (`getBalance`), mismo cierre (`GetMonthlyClosure`), mismas tags y formularios. La reordenación no altera qué se calcula ni cuándo.

## 3. Interacciones del listado (intocables, FR-004)

- Edición: botón «Editar {concepto}» por fila → `dialog "Editar movimiento"`; al guardar, toast «Movimiento actualizado», cierre del diálogo y recálculo de listado/balance/cierre en la misma vista.
- Eliminación: botón «Eliminar {concepto}» por fila → `alertdialog "Eliminar movimiento"`; al confirmar, toast «Movimiento eliminado» y recálculo.
- Ambos diálogos se montan a nivel del componente listado (nunca en la fila); el estado vacío también vive dentro del listado (convención AGENTS.md).
- Navegación de meses: ‹/›/picker con las reglas de 011 (› deshabilitado en el mes actual real; sin meses futuros en el picker); la navegación re-renderiza la misma página con el listado bajo el selector.

## 4. Páginas fuera de alcance (FR-006)

`/` (panel de cuentas), `/summary`, `/annual`, `layout` y la navegación global permanecen funcional y visualmente idénticos.

## 5. Textos

Sin textos nuevos ni modificados: la reordenación no añade, quita ni retoca copy; los literales existentes de cada bloque (documentados en los contracts de 002/003/005/011/012) se conservan exactos.
