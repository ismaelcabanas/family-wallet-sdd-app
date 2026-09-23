# Quickstart: Cuenta de Resultados Anual

**Feature**: `009-cuenta-resultados-anual` | Guía de verificación manual end-to-end de los escenarios de la [spec](./spec.md). Estructura y textos de la vista: [contracts/ui-contract.md](./contracts/ui-contract.md); modelo de datos: [data-model.md](./data-model.md).

## Prerrequisitos

- Node.js LTS y npm.
- Repositorio con la feature implementada (rama `feature/009-cuenta-resultados-anual`); 002/003/005/006 ya entregadas (migraciones, seed y pantallas disponibles).
- BD en estado limpio o con importes anotados: E1 verifica valores exactos globales (conviene partir de un año sin datos previos, p. ej. usando fechas de un año libre).

## Puesta en marcha

```bash
npm install            # dependencias (sin novedades respecto a 006)
npm run db:migrate     # aplica las migraciones (sin cambios nuevos en 009)
npm run db:seed        # precarga cuentas, miembros y tags (idempotente)
npm run dev            # http://localhost:3000
```

**Comprobación inicial (FR-001, FR-007)**: en `/`, junto a "Resumen global", aparece el enlace "Cuenta de resultados". Al abrirlo (`/annual?year={año actual}`) se ve "Cuenta de resultados de {Año}" con la tabla completa (12 columnas + Total año + Media mensual; filas de los miembros del catálogo, Cuenta común, Total ingresos, Gasto real, Sin gastos personales, Saldo y Saldo acumulado) toda a `0,00 €` y el desglose por tag mostrando "Sin gastos este año." (con la BD recién migrada+sembrada, sin movimientos).

## Verificación de gates automáticos

```bash
npm run lint           # ESLint en verde
npm run typecheck      # tsc --noEmit en verde
npm run test           # Vitest (dominio, aplicación, repositorio, UI) en verde
npm run test:e2e       # Playwright: registro (002) + cierre (005) + edición (003) + resumen global (006) + cuenta anual (009)
```

## Escenarios de validación manual (aceptación de la spec)

> E1 y E5 verifican valores exactos: usa fechas de un año sin datos previos y anota los importes que registras.

### E1 — Tabla mensual con ingresos por miembro, totales y saldo (Escenario 1)

En un año sin datos (p. ej. el actual recién empezado o uno libre elegido con fechas manuales), en `/` registra en **enero**:

1. Cuenta personal de Miembro A: ingreso "Nómina" `2.100,00` (fecha 5 de enero).
2. Cuenta personal de Miembro B: ingreso "Nómina" `1.600,00` (fecha 5 de enero).
3. Cuenta común: ingreso "Aportaciones" `1.920,00` (fecha 3 de enero).
4. Gastos por `3.970,00` repartidos entre cuentas (p. ej. Hipoteca `850,00` compartido en la común, Gasolina `60,00` personal en A, Compra `3.060,00` compartido en B).

Abre `/annual?year={ese año}`:

- ✅ Fila de enero del **Miembro A**: `2.100,00 €`; **Miembro B**: `1.600,00 €`; **Cuenta común**: `1.920,00 €`; **Total ingresos** enero: `5.620,00 €`; **Gasto real** enero: `3.970,00 €`; **Saldo** enero: `+1.650,00 €`; **Saldo acumulado** enero: `+1.650,00 €` (coincide con el saldo del mes en enero).
- ✅ Cada fila muestra su **Total año** y su **Media mensual** (p. ej. Miembro A: total `2.100,00 €`, media `175,00 €` = 2.100/12).

### E2 — Saldo acumulado acumula desde enero (FR-012, Escenario 1)

Con E1 registrado, añade en **febrero** gastos por `1.000,00` compartidos y sin ingresos:

- ✅ **Saldo** febrero: `−1.000,00 €`; **Saldo acumulado** enero: `+1.650,00 €`, febrero: `+650,00 €` (1.650 − 1.000); el Total año de «Saldo acumulado» = Total año de «Saldo» (acumulado a diciembre); la fila «Saldo acumulado» no muestra media (celda "—").

### E3 — Desglose por tag con columnas mensuales y multi-tag (Escenarios 2 y 4)

1. Con E1 (Hipoteca `850,00` tags Vivienda+Hipoteca en enero), añade en **marzo** un gasto `850,00` compartido tags Vivienda+Hipoteca en la cuenta común.
2. Abre el "Desglose de gastos por tag" de `/annual`.

- ✅ Filas Vivienda e Hipoteca con `850,00 €` en las celdas de enero **y** marzo (multi-tag computa en cada tag); Total año `1.700,00 €` cada una; media `141,67 €` (1.700/12); orden por total anual desc, empate alfabético.
- ✅ Las filas de totales del desglose ("Gasto real" y "Sin gastos personales") de marzo suman el gasto de marzo **una sola vez** (no `1.700,00 €`).

### E4 — Sin gastos personales y coherencia con 006 (Escenarios 3 y 6, SC-003)

Con E1–E3 registrados:

1. Añade un gasto compartido `120,50` pagado **desde una cuenta personal** (semántica de 002/005/006: la naturaleza la marca el gasto).
2. En `/annual`, revisa la fila **"Sin gastos personales"** de ese mes.
3. Abre `/summary?month={mes}` del mismo mes y compara.

- ✅ "Sin gastos personales" incluye el `120,50` (compartido aunque pagado desde personal); "Gasto real" = total de gastos; **Total ingresos, Gasto real, compartidos y Saldo del mes coinciden al céntimo** con el resumen global de 006 de ese mes.

### E5 — Año vacío y meses a cero (Escenario 5, FR-007)

1. Con el selector de año, elige un año sin movimientos (p. ej. uno futuro dentro de la ventana).
2. Vuelve al año con datos y observa un mes intermedio sin movimientos.

- ✅ El año vacío muestra la estructura completa a `0,00 €` (12 meses, filas del catálogo) y "Sin gastos este año." sin errores; el mes vacío figura a cero sin afectar a los demás (ni al acumulado: los meses a cero no alteran la acumulación).

### E6 — Cambio de año recalcula (FR-001)

1. En `/annual`, cambia el año con el selector.

- ✅ Toda la vista se recalcula para el nuevo año en la misma URL (`/annual?year=...`), sin recargar la página; "Volver" regresa a `/`.

### E7 — Movimientos de años contiguos no contamina (edge case)

1. En `/`, registra un gasto fechado el **31 de diciembre del año anterior** al consultado y otro el **1 de enero del año siguiente**.
2. Revisa `/annual` de los tres años implicados.

- ✅ Cada gasto computa solo en su año; el año central no cambia.

### E8 — Miembros del catálogo y homónimos (edge cases)

1. Sin registrar ingresos de Miembro B en el año, revisa su fila.
2. (Si el catálogo tiene homónimos o varias cuentas por miembro) registra ingresos en ambas.

- ✅ Miembro B figura con `0,00 €` todos los meses (fila siempre presente); homónimos generan filas distintas y varias cuentas del mismo miembro fusionan en una (agrupación por identidad, decisión de 006).

## Verificación adicional recomendada

> FR-011 ("< 3 s con 12 × 300 movimientos") se verifica de forma **informal** durante E1 (impresión de respuesta), sin condiciones de medición estrictas (modo PoC, mismo criterio que 005/006).

- **Media con año en curso**: la media es siempre total/12 aunque el año esté incompleto (réplica del Excel, clarificación 2026-09-23) — visible en E1.
- **Saldo negativo**: la fila "Saldo" usa `−` (U+2212) en meses con más gasto que ingreso (E2).
- **Tag "Sin Clasificar"**: un gasto sin tags aparece como fila del desglose por tag.
- **Ingreso con tags**: no aparece en el desglose por tag (solo en la tabla mensual por miembro).
- **E2E (ADR 0006/0013)**: `npm run test:e2e` cubre `cuenta-resultados-anual.spec.ts` (cifras exactas de E1–E3 contra la app compilada, en año/cuenta propios sin colisión con las demás specs).

## Puesta en marcha (producción Turso)

Sin cambios respecto a [quickstart de 006](../006-resumen-global-mensual/quickstart.md): no hay migraciones nuevas; la cuenta de resultados se calcula en cada petición sobre los datos existentes.

## Criterio de cierre (Definition of Done)

- Gates en verde (arriba) en local y en CI (GitHub Actions).
- Los 8 escenarios verificados manualmente.
- Documentación actualizada en el mismo cambio (ADR 0013, `docs/architecture/overview.md` y diagramas afectados; README/AGENTS.md solo si fijan convención nueva).
