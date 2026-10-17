# Quickstart: Gestión del catálogo de etiquetas

**Feature**: 004-gestion-tags | **Fecha**: 2026-10-17

Guía de validación manual de la feature (contrato congelado en [contracts/ui-contract.md](./contracts/ui-contract.md), escenarios en [spec.md](./spec.md), modelo en [data-model.md](./data-model.md)).

## Prerrequisitos

- Node.js LTS y dependencias instaladas (`npm install`).
- BD con esquema y catálogo: `npm run db:migrate && npm run db:seed` (sin migración nueva en esta feature).

## Arranque

```bash
npm run dev
```

Abrir `http://localhost:3000`. Preparación: entrar en una cuenta, mes a elección, y registrar dos gastos con dos etiquetas creadas en línea (017), p. ej. «super» (−50,00) y «super-casa» (−30,00); anotar el total de gastos del mes y el desglose por etiqueta del cierre.

## Escenarios de validación

Espejo de los 6 escenarios de aceptación + edges clave.

### Q1 — Vista de administración y acceso (escenario 5, FR-001)

1. Desde cualquier página, pulsar **«Etiquetas»** en la navegación global: llega a `/tags` con la lista completa (activas e inactivas), cada fila con su estado («Activa»/«Inactiva») y su recuento de movimientos; «Aportación Común» muestra **«Sistema»** y **no tiene menú** ⋮.

### Q2 — Renombrar sin perder histórico (escenario 1, FR-002, SC-002)

1. En /tags, menú ⋮ de «super» → **Renombrar…**; teclear «supermercado» → Guardar: toast «Etiqueta renombrada», fila con el nombre nuevo.
2. Volver a la cuenta del mes de preparación: la fila del gasto muestra «supermercado»; el desglose del cierre y `/summary?month=` muestran «supermercado» con **los mismos importes y totales exactos** que los anotados.

### Q3 — Duplicado en renombrado (escenario 6, FR-002, SC-004)

1. Renombrar «supermercado» a un nombre existente ignorando caja (p. ej. «OCIO»): error «Ya existe una etiqueta con el nombre "OCIO".» con el nombre tecleado **permaneciendo en el campo**; corregir a otro nombre y guardar con éxito.
2. Edge solo-caja: renombrar la misma etiqueta cambiando solo mayúsculas («Supermercado»): **se permite**.

### Q4 — Fusionar dos etiquetas (escenario 2, FR-003/FR-008, SC-002)

1. Menú ⋮ de «super-casa» → **Fusionar en otra…**: el diálogo explica la consecuencia y el Select de destino ofrece todas menos la propia y «Aportación Común».
2. Elegir «supermercado» → **Fusionar**: toast «Etiquetas fusionadas (1 movimiento reasignado)»; «super-casa» desaparece del catálogo.
3. En la cuenta: el gasto de −30,00 muestra «supermercado»; el desglose acumula −80,00 bajo «supermercado»; **los totales globales no cambian**; ninguna otra etiqueta afectada.

### Q5 — Desactivar con histórico y reactivar (escenarios 3 y 4, FR-004/FR-005, SC-003)

1. Menú ⋮ de una etiqueta con movimientos → **Desactivar…**: AlertDialog con la consecuencia (deja de ofrecerse; los históricos la conservan) → Desactivar: fila «Inactiva».
2. Abrir el alta de movimiento: la etiqueta **no aparece** en el Select; el listado y los desgloses siguen mostrándola en los históricos.
3. En /tags, menú de la inactiva → **Reactivar**: fila «Activa» y vuelve al Select con nombre e histórico intactos.
4. Edge colisión: (si existe una inactiva cuyo nombre colisiona con una activa — crearla desde BD si se quiere probar) Reactivar → toast de error «Ya existe una etiqueta…» y la fila sigue inactiva.

### Q6 — Protección de la etiqueta de sistema (FR-007, clarificación 2026-10-17)

1. «Aportación Común» en /tags: distintivo «Sistema», sin menú (no se ofrecen renombrar/desactivar/fusionar).
2. Verificar en el diálogo de fusión de cualquier etiqueta que «Aportación Común» **no aparece** como destino (protegida también como resultante).

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test
npm run test:e2e
```

Esperado: todo en verde (SC-005). Nueva suite `e2e/gestion-tags.spec.ts` (Cuenta de Miembro B, septiembre 2026 — combinación verificada libre) cubre el flujo crítico: renombrar, fusionar y desactivar verificando el histórico, más reactivar y protección (FR-011, constitución III).

## Resultado esperado

El catálogo se mantiene limpio sin perder histórico (SC-001–SC-004): renombrar y fusionar se reflejan en listados, cierres, resumen y cuenta anual con **cero variación de totales**; desactivar retira la etiqueta del uso diario conservando el histórico; reactivar la devuelve; y la automatización de 019 permanece intacta (SC-002/SC-003).
