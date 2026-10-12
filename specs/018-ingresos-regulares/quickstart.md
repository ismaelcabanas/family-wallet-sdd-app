# Quickstart: Ingresos mensuales regulares por miembro

**Feature**: 018-ingresos-regulares | **Fecha**: 2026-10-12

Guía de validación manual de la feature (contrato congelado en [contracts/ui-contract.md](./contracts/ui-contract.md), escenarios en [spec.md](./spec.md), modelo en [data-model.md](./data-model.md)).

## Prerrequisitos

- Node.js LTS y dependencias instaladas (`npm install`).
- BD con el esquema al día (incluye la migración nueva de 018): `npm run db:migrate && npm run db:seed`.

## Arranque

```bash
npm run dev
```

Abrir `http://localhost:3000` y entrar a una cuenta **personal** (p. ej. «Cuenta de Miembro A»). Trabajar sobre el **mes en curso** (el que abre por defecto).

## Escenarios de validación

Espejo de los 9 escenarios de aceptación de la spec + edges clave.

### Q1 — Configurar y ver el ingreso generado sin alta manual (escenario 1, FR-001/FR-002, SC-001)

1. Con el mes en curso **sin ingresos registrados**, ir al panel «Ingreso regular» (final de la página) → «Configurar ingreso».
2. Importe `2.000,00`, día `1`, nota vacía → «Guardar»: toast «Ingreso regular guardado».
3. Sin ninguna captura manual, el listado del mes muestra el ingreso de **2.000,00 €** con fecha día 1 y nota **«Ingreso regular de Miembro A»**, sin etiqueta; cierre del mes, balance y resumen global lo computan (SC-004).

### Q2 — Consultas repetidas nunca duplican (escenario 2, FR-002, SC-002)

1. Recargar la página de cuenta 5 veces; navegar a `/summary?month={mes en curso}` y `/annual?year={año en curso}` y volver.
2. El ingreso aparece **exactamente una vez** en cada vista; `/summary` muestra el ingreso en la fila/totales del miembro; el panel de cuenta anual acumula el ingreso del miembro.

### Q3 — Cambio de importe: solo hacia adelante (escenario 3, FR-004, clarificación 2026-10-12)

1. Con el mes ya generado a 2.000,00 €, «Editar ingreso» → `2.100,00` → «Guardar».
2. El mes consultado **conserva** el movimiento de 2.000,00 € (editable a mano como cualquier movimiento).
3. (Unidad/integración) Los meses aún no generados tomarán 2.100,00 €: verificar el mes siguiente cambiando la fecha del sistema o confiando en `MaterializeRegularIncomes.test.ts`.

### Q4 — El generado es un movimiento corriente (escenario 4, FR-003)

1. Editar el ingreso generado desde su fila (✏️): cambiar nota/día/etiqueta → «Guardar cambios».
2. Reconsultar el mes: la edición persiste; ninguna vista la sobrescribe.

### Q5 — Borrar el generado es definitivo (escenario 5, FR-004)

1. Eliminar el ingreso generado desde su fila (🗑️) con su confirmación.
2. Recargar el mes y `/summary`: el ingreso **no reaparece** en ese mes.

### Q6 — Desactivar y reactivar (escenario 6, FR-004, edge reactivación)

1. «Desactivar» en el panel: toast «Ingreso regular desactivado»; el panel muestra «Ingreso regular desactivado».
2. Los movimientos ya generados siguen en el listado (no se borran).
3. (Edge) «Editar ingreso» → «Guardar»: reactiva **desde el mes en curso**; los meses del periodo inactivo no se rellenan retroactivamente.

### Q7 — Validación del formulario (escenario 7, FR-001)

1. Probar importes ``, `0`, `-5`, `abc`: mensajes exactos «El importe es obligatorio.» / «El importe debe ser mayor que cero.» / «Introduce un importe válido (ej. 2000,00).»; nada se guarda y los valores permanecen.
2. Día `0` y `32`: «El día del mes debe estar entre 1 y 31.»
3. Doble clic en «Guardar»: los controles se deshabilitan mientras se envía (edge).

### Q8 — La cuenta común no tiene configuración (escenario 8, FR-001)

1. Entrar en «Cuenta común»: no existe panel ni CTA de ingreso regular en ningún mes.

### Q9 — Sin retroactivo ni futuro (escenario 9, FR-005, edges)

1. Con config activa, navegar a un mes **anterior** a la configuración (`‹` repetidamente): nunca aparece el ingreso regular.
2. Abrir `/summary?month={mes futuro}` directamente por URL: el mes no genera ingreso (y no rompe).

### Q10 — Edges de calendario y precisión (edges, FR-002)

1. (Integración) Día `31`: en febrero materializa el 28/29 y en abril el 30, sin alterar el día configurado; el mes siguiente lo aplica tal cual.
2. Importe con céntimos `1.500,50`: se guarda y muestra con 2 decimales; los totales lo integran (aritmética en céntimos, ADR 0007).
3. Alta a mitad de mes: el ingreso del mes en curso aparece completo en la primera consulta tras configurar (sin generación parcial).

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test
npm run test:e2e
```

Esperado: todo en verde (SC-005). Nueva spec e2e `e2e/ingresos-regulares.spec.ts` (Cuenta de Miembro A + mes en curso, con limpieza final por borrado+desactivación — [research §7](./research.md)) cubre el flujo crítico «configurar → consultar mes → ver ingreso sin duplicados → borrar no regenera → desactivar» (FR-008, constitución III).

## Resultado esperado

Configurar el ingreso habitual lleva menos de 1 minuto y elimina la captura manual mensual (SC-001): desde la configuración, cada mes consultado desde la activación ya trae el ingreso, exactamente una vez (SC-002/SC-003), computando en todas las vistas como un ingreso manual (SC-004).
