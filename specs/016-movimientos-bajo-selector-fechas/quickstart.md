# Quickstart: Listado de movimientos bajo el selector de fechas

**Feature**: 016-movimientos-bajo-selector-fechas | **Fecha**: 2026-09-30

Guía de validación manual de la reordenación list-first de la página de cuenta (ver [contracts/ui-contract.md](./contracts/ui-contract.md) §1 para el contrato de composición y [spec.md](./spec.md) para los escenarios de aceptación).

## Prerrequisitos

- Node.js LTS y dependencias instaladas (`npm install`).
- BD con datos: `npm run db:migrate && npm run db:seed` (idempotentes; seed editable en `src/infrastructure/db/seed-data.ts`).

## Arranque

```bash
npm run dev
```

Abrir `http://localhost:3000` y entrar a una cuenta desde el panel (p. ej. «Cuenta de Miembro B»).

## Escenarios de validación

### Q1 — El listado aparece justo bajo el selector (FR-001, SC-001/SC-002)

1. Abrir `/accounts/2?month=2026-04` (o un mes con movimientos del seed).
2. Verificar que, de arriba abajo, el orden es: nombre de cuenta + navegación → subtítulo de tipo → selector de mes/año → **«Movimientos del mes»** → balance «Acumulado hasta …» → formulario → cierre.
3. Verificar que ningún bloque (balance, formulario, cierre) aparece entre el selector y el listado, y que selector + primer grupo de movimientos caben en la misma pantalla de escritorio sin hacer scroll.

### Q2 — Cambio de mes mantiene el listado bajo el selector (FR-001)

1. Desde Q1, pulsar ‹ («Mes anterior»).
2. Verificar que la URL pasa a `?month=2026-03`, la página no se desplaza a otra vista y el listado (o su estado vacío) sigue inmediatamente bajo el selector.

### Q3 — Bloques restantes presentes y operativos (FR-002, SC-003/SC-004)

1. Hacer scroll bajo el listado y verificar el orden balance → formulario → cierre.
2. Registrar un movimiento con el formulario embebido; verificar toast «Movimiento guardado», aparición en el listado y recálculo de balance/cierre.
3. Editar y eliminar un movimiento desde su fila (diálogos «Editar movimiento»/«Eliminar movimiento»); verificar toasts y recálculo.

### Q4 — Mes vacío con estado vacío dentro del listado (FR-001/FR-004)

1. Navegar con el picker a un mes futuro permitido (p. ej. dentro del rango sin movimientos).
2. Verificar que «Aún no hay movimientos en este mes» aparece justo bajo el selector, dentro del region «Movimientos del mes», sin bloque intermedio.

### Q5 — Demás páginas intactas (FR-006)

1. Visitar `/`, `/summary?month=2026-04` y `/annual?year=2026`.
2. Verificar que ninguna cambió (panel de tarjetas, resumen, cuenta de resultados) y que la navegación global funciona igual desde la página de cuenta reordenada.

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test
npm run test:e2e
```

Esperado: todo en verde. En e2e, `pagina-cuenta.spec.ts` P1 incluye la aserción de adyacencia selector→listado (FR-001); el resto de specs existentes pasa sin cambios de aserciones.

## Resultado esperado

La página de cuenta muestra el listado bajo el selector con el 100 % de la funcionalidad previa operativa y los mismos datos (SC-003/SC-004); ninguna otra página cambia.
