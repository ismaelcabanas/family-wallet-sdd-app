# Quickstart: Reasignación masiva de etiquetas de movimientos

**Feature**: `029-retag-masivo` | 2026-11-07

Guía de validación manual end-to-end de la feature (escenarios Q1–Q7). Los contratos congelados viven en [contracts/ui-contract.md](contracts/ui-contract.md) y los DTOs/validaciones en [data-model.md](data-model.md).

## Prerrequisitos

```bash
npm run db:migrate && npm run db:seed   # BD dev con catálogo (etiquetas del seed, categoría General)
npm run dev                             # http://localhost:3000
```

Si el mes actual está vacío, registra 4–5 gastos con la misma etiqueta (p. ej. «Ocio») y 1 gasto con la etiqueta **«Aportación Común»** en una cuenta personal, más un ingreso sin etiqueta.

## Q1 — Modo de selección y reasignación feliz

1. En `/` entra en una cuenta personal con movimientos → junto a «Nuevo movimiento» aparece **«Seleccionar»**.
2. Pulsar «Seleccionar» → cada fila muestra un checkbox; la barra contextual indica «0 seleccionados» y «Cambiar etiqueta…» deshabilitado.
3. Marcar 3 movimientos con «Ocio» → «3 seleccionados» → «Cambiar etiqueta…».
4. Diálogo: «Se cambiará la etiqueta de 3 movimientos.»; Select agrupado por categorías **sin** «Aportación Común» ni «Sin etiqueta»; elegir «Hogar» → «Reasignar».

**Esperado**: toast «3 movimientos actualizados», diálogo cerrado, modo de selección salido; las 3 filas muestran «Hogar» y el resto queda igual (ui-contract §1/§2).

## Q2 — Totales intactos (SC-002)

Tras Q1, comparar `/summary?month={mes}` y el bloque «KPIs del mes» antes/después (o reasignar y volver): importes por etiqueta movidos (−Ocio / +Hogar por lo reasignado), **todos los totales idénticos al céntimo**.

## Q3 — Protección de «Aportación Común»

En modo selección, la fila del gasto con «Aportación Común» **no muestra checkbox** (hueco en su lugar); «Seleccionar todo» no la incluye; y el Select del diálogo jamás la ofrece (ui-contract §1.2).

## Q4 — Ingresos sin etiqueta

Marcar el ingreso sin etiqueta junto a otros → reasignar a «Ocio»: el ingreso pasa a mostrar «Ocio» (asignación a posteriori válida — spec Edge Cases).

## Q5 — No-op con destino igual (Clarifications)

Seleccionar 1 movimiento que ya tenga «Hogar» → destino «Hogar» → «Reasignar».

**Esperado**: se ejecuta igualmente; toast «1 movimiento actualizado» (singular — data-model §4).

## Q6 — Validación y errores

1. «Cambiar etiqueta…» con 0 seleccionados: no disponible (botón deshabilitado).
2. En el diálogo, «Reasignar» sin elegir destino: deshabilitado.
3. Abrir el diálogo, elegir destino, y antes de confirmar eliminar uno de los seleccionados en otra pestaña → confirmar.

**Esperado** (3): la action re-valida, reasigna los existentes y el toast avisa «2 de 3 movimientos actualizados» (decisión «ignorar con aviso» — spec FR-003).

## Q7 — Suites en verde (SC-004)

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```

**Esperado**: todo en verde; la spec nueva `e2e/retag-masivo.spec.ts` (Cuenta de Miembro B + **febrero 2026**, combinación verificada libre — research §5; corre la última del orden alfabético) cubre seleccionar → confirmar → listado y desglose verificados, protección, seleccionar todo y no-op (FR-007).
