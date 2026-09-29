# Quickstart: Panel de Cuentas

**Feature**: `012-panel-cuentas` | Guía de verificación manual end-to-end de los escenarios de la [spec](./spec.md). Estructura, textos y estados: [contracts/ui-contract.md](./contracts/ui-contract.md); el modelo no cambia: [data-model.md](./data-model.md).

## Prerrequisitos

- Node.js LTS y npm.
- Repositorio con la feature implementada (rama `feature/012-panel-cuentas`); 002/003/005/011 ya entregadas.
- BD migrada y sembrada (3 cuentas: Cuenta de Miembro A, Cuenta de Miembro B, Cuenta común).

## Puesta en marcha

```bash
npm install            # dependencias (sin novedades)
npm run db:migrate     # aplica las migraciones (sin cambios nuevos en 012)
npm run db:seed        # precarga cuentas, miembros y tags (idempotente)
npm run dev            # http://localhost:3000
```

**Comprobación inicial (FR-001, SC-001)**: abre `/`: se muestra el panel de tarjetas (una por cuenta). `/accounts/2` sigue abriendo la página de esa cuenta (URL directa válida, FR-004).

## Verificación de gates automáticos

```bash
npm run lint           # ESLint en verde
npm run typecheck      # tsc --noEmit en verde
npm run test           # Vitest (UI jsdom incluida) en verde
npm run test:e2e       # Playwright: 6 specs adaptadas + panel-cuentas.spec.ts nueva
```

> SC-005: las e2e existentes deben pasar **adaptadas a la nueva puerta de entrada** (helper `openAccount` por el panel o URL directa) **sin debilitar aserciones** (FR-005); el flujo crítico de registro sigue cubierto end-to-end.

## Escenarios de validación manual (aceptación de la spec)

### N1 — Panel lanzador puro (US1-1, US1-3, US1-4, FR-001, FR-002)

En `/`:

1. Una tarjeta por cuenta del seed, en orden fijo (Miembro A, Miembro B, común): nombre + tipo («Cuenta personal de Miembro A», …; «Cuenta común»).
2. La tarjeta común y las personales son equivalentes en tamaño y contenido; si una cuenta tiene movimientos y otra no, sus tarjetas no difieren.
3. No hay selector «Cuenta activa», ni formulario «Registrar», ni «Movimientos del mes», ni «Cierre de» en `/`; ningún importe («€») en toda la vista.

### N2 — Un clic hasta la cuenta (US1-2, SC-001, SC-002)

1. Pulsa la tarjeta «Cuenta común»: URL `/accounts/3`, h1 «Cuenta común», stepper en el **mes actual**.
2. Vuelve a `/` y pulsa «Cuenta de Miembro B»: URL `/accounts/2`. Ningún selector intermedio (SC-001).

### N3 — Navegación global presente y activa en el 100% de páginas (US2-1, US2-2, US2-3, SC-004)

Visita `/`, `/accounts/2`, `/summary`, `/annual`:

1. Las cuatro muestran la misma navegación «Panel · Resumen global · Cuenta de resultados» (ninguna retiene nav local: los antiguos enlaces «Volver» de summary/annual han desaparecido).
2. Destino activo distinguible en cada una: Panel (también en `/accounts/2`), Resumen global, Cuenta de resultados — con `aria-current="page"` y peso tipográfico.
3. «Panel» desde cualquier página vuelve al panel de tarjetas.

### N4 — Conservación del mes visible al navegar (US2-4, FR-003)

1. En `/accounts/2?month=2026-03`: «Resumen global» → `/summary?month=2026-03`; «Cuenta de resultados» → `/annual?year=2026`.
2. En `/summary?month=2025-01`: «Cuenta de resultados» → `/annual?year=2025`.
3. En `/annual?year=2027`: «Resumen global» → `/summary?month=2027-01`.
4. En `/` (sin mes): los enlaces apuntan al mes/año actual.

### N5 — `/summary` y `/annual` intactas funcionalmente (FR-003)

1. En `/summary`: selector de mes, KPIs y desgloses como antes (quickstart de 006).
2. En `/annual`: selector de año, tablas y desglose por tag como antes (quickstart de 009).

### N6 — Página de cuenta sin selectores de cuenta (FR-004)

1. `/accounts/2`: ningún selector/enlace de cambio de cuenta; stepper, balance acumulado a mes, formulario, cierre y listado agrupado operativos como en 011.
2. Edita un movimiento: el selector de cuenta **dentro del diálogo** sigue presente (edición, no navegación).

### N7 — Edge cases

1. `/?month=2025-01` (residuo de la pasarela antigua): panel normal, sin error.
2. `/accounts/999` y `/accounts/abc`: 404 (011, sin cambios).

## Verificación adicional recomendada

- **Rejilla responsiva**: estrecha la ventana — las tarjetas colapsan a 2 y luego a 1 columna; usable en móvil sin scroll horizontal.
- **E2E (ADR 0006)**: `npm run test:e2e` cubre `panel-cuentas.spec.ts` (tarjetas, un clic, nav global y propagación de mes) y las 6 specs previas entrando por la nueva puerta.
- **SC-003 (rendimiento)**: el panel carga sustancialmente más rápido que la antigua `/` (solo consulta cuentas); verificación informal < 1 s.

## Puesta en marcha (producción Turso)

Sin cambios respecto a [quickstart de 011](../011-pagina-cuenta/quickstart.md): no hay migraciones nuevas; `/` se calcula en cada petición (`connection()`).

## Criterio de cierre (Definition of Done)

- Gates en verde (arriba) en local y en CI (GitHub Actions), con las e2e adaptadas y la nueva spec del panel.
- Los 7 escenarios verificados manualmente.
- Documentación actualizada en el mismo cambio (`docs/architecture/overview.md`, diagramas afectados; README/AGENTS.md solo si fijan convención nueva — p. ej. la jubilación del listado plano).
