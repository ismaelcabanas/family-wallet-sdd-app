# Quickstart: Cierre Mensual por Cuenta

**Feature**: `005-cierre-mensual` | Guía de verificación manual end-to-end de los escenarios de la [spec](./spec.md). Estructura y textos del panel: [contracts/ui-contract.md](./contracts/ui-contract.md); modelo de datos: [data-model.md](./data-model.md).

## Prerrequisitos

- Node.js LTS y npm.
- Repositorio con la feature implementada (rama `feature/005-cierre-mensual`); 002 ya entregada (migraciones y seed disponibles).
- BD en estado limpio o con datos de prueba: los escenarios usan importes exactos, conviene partir de un mes conocido.

## Puesta en marcha

```bash
npm install            # dependencias (sin novedades respecto a 002)
npm run db:migrate     # aplica las migraciones (sin cambios nuevos en 005)
npm run db:seed        # precarga cuentas y tags (idempotente)
npm run dev            # http://localhost:3000
```

**Comprobación inicial (FR-001, FR-010)**: al abrir `/` aparece el panel "Cierre de {mes actual}" entre el formulario y el listado, con Ingresos `0,00 €`, Gastos `0,00 €`, Saldo del mes `0,00 €`, Gastos compartidos/personales `0,00 €` y "Sin gastos este mes." (con la BD recién migrada+sembrada, sin movimientos).

## Verificación de gates automáticos

```bash
npm run lint           # ESLint en verde
npm run typecheck      # tsc --noEmit en verde
npm run test           # Vitest (dominio, aplicación, UI) en verde
npm run test:e2e       # Playwright: registro (002) + cierre mensual (005)
```

## Escenarios de validación manual (aceptación de la spec)

> Conviene ejecutarlos sobre un mes recién empezado o con importes anotados: E1 verifica valores exactos.

### E1 — Cierre del mes con movimientos y multi-etiquetado (Escenarios 1 y 5)

1. Selecciona la **Cuenta común** y el mes actual.
2. Registra tres movimientos (mismo flujo que 002):
   - Ingreso "Aportación" de `1.920,00` (sin naturaleza).
   - Gasto "Hipoteca" de `850,00`, naturaleza compartido (fija), tags **Vivienda** + **Hipoteca**.
   - Gasto "Luz" de `120,50`, tag **Hogar**.
3. Observa el panel de cierre.

- ✅ Ingresos `1.920,00 €`; Gastos `970,50 €` (no `1.820,50 €`: el gasto multi-tag NO duplica el total — escenario 5); Saldo del mes `+949,50 €`; Gastos compartidos `970,50 €`; Gastos personales `0,00 €`; Desglose por tag: **Vivienda `850,00 €`**, **Hipoteca `850,00 €`** (el gasto computa en cada una), **Hogar `120,50 €`**, en ese orden (importe descendente).

### E2 — Gastos de ambas naturalezas desde cuenta personal (Escenario 2)

1. Cambia a una **cuenta personal**.
2. Registra: gasto "Gasolina" `60,00` naturaleza **personal**, tag Coche; y gasto "Compra semanal" `120,50` naturaleza **compartido**, tag Alimentación.

- ✅ Gastos `180,50 €`; Gastos personales `60,00 €`; Gastos compartidos `120,50 €` (computa como compartido aunque se pagó desde cuenta personal); desglose con Coche `60,00 €` y Alimentación `120,50 €` (Alimentación primero: mayor importe).

### E3 — Mes sin movimientos (Escenario 3)

1. Con movimientos ya registrados en el mes actual, cambia el selector de mes a un **mes pasado sin movimientos** (misma cuenta).

- ✅ Panel con Ingresos/Gastos/Saldo `0,00 €`, naturaleza a `0,00 €` y "Sin gastos este mes."; el panel NO se oculta. (El listado muestra su estado vacío propio, sin cambio.)

### E4 — Cambio de cuenta y mes recalcula (Escenario 4)

1. Alterna entre las tres cuentas y varios meses con el selector.

- ✅ Todos los KPIs y el desglose corresponden en cada momento a la cuenta/mes activos, en la misma pantalla y sin recargar (URL `/?account=&month=`).

### E5 — Movimiento de otro mes no contamina (Escenario 6)

1. Registra un gasto fechado el **mes que viene** en la cuenta activa (mes actual en el selector).

- ✅ El cierre del mes actual no cambia en ningún KPI (el movimiento computa en su mes); navega al mes siguiente y verifica que aparece ahí.

### E6 — Ingreso con tags no computa en el desglose (edge case)

1. Registra un ingreso con una o varias tags seleccionadas (p. ej. "Nómina" con tag Alimentación).

- ✅ El ingreso suma a Ingresos; el desglose por tag NO incluye esas tags por su causa (solo gastos alimentan el desglose).

## Verificación adicional recomendada

> SC-002 ("cierre < 3 s con 300 movimientos") se verifica de forma **informal** durante E1 (impresión de respuesta), sin condiciones de medición estrictas (modo PoC, mismo criterio que 002).

- **Saldo negativo (FR-004)**: registra gastos mayores que los ingresos de un mes y verifica `−51,20 €` (signo U+2212, guion menos) en Saldo del mes.
- **Orden determinista**: dos tags con el mismo importe aparecen ordenadas alfabéticamente.
- **Mes futuro (edge case)**: selecciona un mes futuro sin movimientos → mismo comportamiento que E3.
- **E2E (ADR 0006/0010)**: `npm run test:e2e` cubre `cierre-mensual.spec.ts` (KPIs exactos de E1/E2 contra la app compilada).

## Puesta en marcha (producción Turso)

Sin cambios respecto a [quickstart de 002](../002-registro-movimientos/quickstart.md): no hay migraciones nuevas; el cierre se calcula en cada petición sobre los datos existentes.

## Criterio de cierre (Definition of Done)

- Gates en verde (arriba) en local y en CI (GitHub Actions).
- Los 6 escenarios verificados manualmente.
- Documentación actualizada en el mismo cambio (ADR 0010, `docs/architecture/overview.md` y diagramas si procede, README/AGENTS.md solo si fijan convención nueva).
