# Quickstart: Formulario de alta en diálogo desde el listado

**Feature**: 013-formulario-dialogo | **Fecha**: 2026-09-30

Guía de validación manual de la feature (ver [contracts/ui-contract.md](./contracts/ui-contract.md) para el contrato congelado, [spec.md](./spec.md) para los escenarios de aceptación y [data-model.md](./data-model.md) §1.2/§4 para composición y estados del diálogo).

## Prerrequisitos

- Node.js LTS y dependencias instaladas (`npm install`).
- BD con datos: `npm run db:migrate && npm run db:seed` (idempotentes; seed editable en `src/infrastructure/db/seed-data.ts`).

## Arranque

```bash
npm run dev
```

Abrir `http://localhost:3000`, entrar a una cuenta desde el panel (p. ej. «Cuenta de Miembro B») y usar el selector de mes para fijar un mes con movimientos (p. ej. abril 2026 con el seed).

## Escenarios de validación

### Q1 — El CTA abre el diálogo con el formulario de alta (FR-001/FR-002, escenario 1, SC-001)

1. En la página de una cuenta (mes con movimientos), verificar el botón **«Nuevo movimiento»** en la cabecera del listado (junto a «Movimientos del mes»).
2. Pulsarlo: se abre el diálogo «Nuevo movimiento» con fecha por defecto **hoy**, importe vacío, «Gasto» marcado, cuenta fijada mostrada como texto (sin selector), naturaleza (en cuenta personal) y etiquetas.
3. Verificar que no existe el bloque «Registrar movimiento» embebido en la página (FR-004, SC-002).

### Q2 — Alta feliz: guardar cierra, tuesta y recalcula (FR-003, escenario 2, SC-001/SC-003)

1. Desde Q1, rellenar importe «85,00», concepto «Mercadona», etiqueta «Alimentación» y pulsar «Registrar».
2. Verificar: el diálogo se cierra, aparece el toast «Movimiento guardado» y el movimiento figura en el listado (con su tag) con balance acumulado y cierre mensual recalculados.
3. Reabrir el diálogo: formulario limpio (fecha hoy, sin importe/concepto) para registros consecutivos.

### Q3 — Errores de validación mantienen el diálogo abierto (FR-003, escenario 3)

1. Abrir el diálogo y pulsar «Registrar» con el importe vacío: el diálogo permanece abierto con «El importe es obligatorio.» y «El concepto es obligatorio.» bajo sus campos.
2. Teclear importe «0» y concepto «Inválido», reenviar: error de importe visible, «Inválido» conservado en Concepto.
3. Corregir el importe («10,00») y guardar: éxito como en Q2 (los valores se conservaron para corregir).

### Q4 — Cancelar descarta sin efectos; mes vacío conserva el CTA (FR-001/FR-003, escenarios 4/5)

1. Abrir el diálogo, rellenar datos a medias y pulsar «Cancelar» (o Escape/X): nada se guarda, la página queda tal cual y el CTA sigue disponible; reabrir muestra el formulario limpio.
2. Navegar con el selector a un mes sin movimientos: el estado vacío «Aún no hay movimientos en este mes.» aparece con el texto «Pulsa «Nuevo movimiento» para registrar el primero.» y el CTA operativo; registrar un movimiento con fecha de ese mes y verlo aparecer.

### Q5 — Alta con fecha de otro mes y composición final (FR-003/FR-007, escenarios 2/6, SC-004)

1. Con la vista en un mes pasado, abrir el diálogo: la fecha por defecto sigue siendo hoy (no el mes visible).
2. Guardar un movimiento con la fecha de hoy: el diálogo cierra con toast; la vista del mes pasado no cambia (el movimiento pertenece a otro mes).
3. Recorrer la página: el orden es selector de mes/año → listado (con su CTA) → balance acumulado → cierre mensual; sin formulario embebido; `/`, `/summary`, `/annual` y la navegación global sin cambios.

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test
npm run test:e2e
```

Esperado: todo en verde. Los helpers e2e de alta abren ahora el diálogo del CTA antes de rellenar; `pagina-cuenta.spec.ts` congela además la ausencia del bloque embebido (FR-004).

## Resultado esperado

El alta de movimientos funciona íntegramente desde el diálogo del CTA «Nuevo movimiento» en cualquier mes, la página de cuenta queda limpia (selector + listado protagonistas) y el 100 % de la funcionalidad previa (edición, eliminación, navegación, cierre, balance) sigue operativa con las suites en verde (SC-003).
