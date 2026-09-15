# Quickstart: Resumen Mensual Global

**Feature**: `006-resumen-global-mensual` | Guía de verificación manual end-to-end de los escenarios de la [spec](./spec.md). Estructura y textos de la vista: [contracts/ui-contract.md](./contracts/ui-contract.md); modelo de datos: [data-model.md](./data-model.md).

## Prerrequisitos

- Node.js LTS y npm.
- Repositorio con la feature implementada (rama `feature/006-resumen-global-mensual`); 002/003/005 ya entregadas (migraciones, seed y pantalla principal disponibles).
- BD en estado limpio o con importes anotados: E1 y E4 verifican valores exactos globales (conviene partir de un mes conocido o recién empezado).

## Puesta en marcha

```bash
npm install            # dependencias (sin novedades respecto a 005)
npm run db:migrate     # aplica las migraciones (sin cambios nuevos en 006)
npm run db:seed        # precarga cuentas, miembros y tags (idempotente)
npm run dev            # http://localhost:3000
```

**Comprobación inicial (FR-001, FR-007)**: en `/`, junto al título, aparece el enlace "Resumen global". Al abrirlo (`/resumen?month={mes actual}`) se ve "Resumen global de {Mes YYYY}" con Ingresos `0,00 €`, Gastos `0,00 €`, Saldo del mes `0,00 €`, naturaleza a `0,00 €` y "Sin gastos este mes." en ambos desgloses (con la BD recién migrada+sembrada, sin movimientos).

## Verificación de gates automáticos

```bash
npm run lint           # ESLint en verde
npm run typecheck      # tsc --noEmit en verde
npm run test           # Vitest (dominio, aplicación, repositorio, UI) en verde
npm run test:e2e       # Playwright: registro (002) + cierre (005) + edición (003) + resumen global (006)
```

## Escenarios de validación manual (aceptación de la spec)

> E1 y E4 verifican valores exactos: anota los importes que registras o usa un mes sin datos previos.

### E1 — El global es la suma de las tres cuentas (Escenario 1)

1. Abre `/resumen` en el **mes actual** y anota (o fotografía) los KPIs iniciales.
2. En `/`, registra en la **Cuenta común**: gasto "Hipoteca" `850,00` naturaleza compartido, tags Vivienda+Hipoteca.
3. En una **cuenta personal** (Miembro A): ingreso "Nómina" `2.100,00`; gasto "Gasolina" `60,00` naturaleza **personal**, tag Coche.
4. En la otra **cuenta personal** (Miembro B): gasto "Compra semanal" `150,50` naturaleza **compartido**, tag Alimentación.
5. Vuelve a `/resumen` (mismo mes).

- ✅ Ingresos `2.100,00 €`; Gastos `1.060,50 €` (= 850,00 + 60,00 + 150,50, suma exacta de las tres cuentas); Saldo del mes `+1.039,50 €`; Gastos compartidos `1.000,50 €` (850,00 + 150,50 — incluye el pagado desde cuenta personal); Gastos personales `60,00 €`.

### E2 — Desglose por miembro con atribución correcta (Escenario 2)

Con los movimientos de E1, en `/resumen` (mismo mes):

- ✅ Desglose por miembro: fila **Miembro A** con personales `60,00 €` y compartidos `0,00 €`; fila **Miembro B** con personales `0,00 €` y compartidos `150,50 €`; fila **Cuenta común** con compartidos `850,00 €`. Las filas cubren el total de gastos (`60,00 + 150,50 + 850,00 = 1.060,50 €`).

### E3 — Multi-tag sin duplicar el total (Escenario 3)

Con los movimientos de E1 (la Hipoteca lleva Vivienda+Hipoteca):

- ✅ Desglose por tag con **Vivienda `850,00 €`** e **Hipoteca `850,00 €`** (el gasto computa en cada una; empate alfabético) — y el total de Gastos sigue en `1.060,50 €` (NO `1.910,50 €`).

### E4 — Coherencia con los cierres por cuenta de 005 (SC-003)

1. En `/`, recorre las tres cuentas con el selector y anota los KPIs del panel "Cierre de {mes}" de cada una.
2. Compara con `/resumen` del mismo mes.

- ✅ Cada KPI global es exactamente la suma de los tres cierres (ingresos, gastos, compartidos, personales, saldo); el desglose por tag global es la fusión de los tres (mismas reglas de orden).

### E5 — Cuenta vacía aporta cero (Escenario 4)

1. Elige un **mes pasado** sin movimientos en ninguna cuenta y registra movimientos solo en una cuenta personal.
2. Abre `/resumen` de ese mes.

- ✅ El global equivale exactamente a esa cuenta; las otras aportan cero; sin errores.

### E6 — Cambio de mes recalcula (Escenario 5)

1. En `/resumen`, cambia el mes con el selector.

- ✅ Todos los KPIs y desgloses se recalculan para el nuevo mes en la misma vista (URL `/resumen?month=...`), sin recargar la página; "Volver" regresa a `/`.

### E7 — Movimiento de otro mes no contamina (edge case)

1. En `/`, registra un gasto fechado el **mes que viene**.
2. En `/resumen`, revisa el mes actual y el siguiente.

- ✅ El resumen del mes actual no cambia; el gasto computa en el resumen del mes siguiente.

## Verificación adicional recomendada

> FR-008 ("< 3 s con 300 movimientos") se verifica de forma **informal** durante E1 (impresión de respuesta), sin condiciones de medición estrictas (modo PoC, mismo criterio que 005).

- **Saldo negativo**: registra gastos globales mayores que los ingresos de un mes y verifica `−` (U+2212) en Saldo del mes.
- **Tag "Sin Clasificar"**: un gasto sin tags seleccionadas aparece como fila del desglose por tag (tag por defecto de 002).
- **Ingreso con tags**: no aparece en ningún desglose (solo en Ingresos).
- **E2E (ADR 0006/0012)**: `npm run test:e2e` cubre `resumen-global.spec.ts` (KPIs exactos de E1/E2 contra la app compilada, en un mes propio del spec).

## Puesta en marcha (producción Turso)

Sin cambios respecto a [quickstart de 005](../005-cierre-mensual/quickstart.md): no hay migraciones nuevas; el resumen se calcula en cada petición sobre los datos existentes.

## Criterio de cierre (Definition of Done)

- Gates en verde (arriba) en local y en CI (GitHub Actions).
- Los 7 escenarios verificados manualmente.
- Documentación actualizada en el mismo cambio (ADR 0012, `docs/architecture/overview.md` y diagramas afectados; README/AGENTS.md solo si fijan convención nueva).
