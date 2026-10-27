# Quickstart — Porcentaje de ahorro por miembro con apartado mensual (023)

**Feature**: `023-porcentaje-ahorro` | Guía de validación manual end-to-end. Referencias: [spec.md](./spec.md) (escenarios), [contracts/ui-contract.md](./contracts/ui-contract.md) (literales y comportamiento congelado), [data-model.md](./data-model.md) (casos del VO y guardas del materializador).

## Prerrequisitos

```bash
npm install
npm run db:migrate   # aplica drizzle/0006_porcentaje-ahorro.sql (2 tablas nuevas)
npm run db:seed      # idempotente (sin datos nuevos)
```

## Arranque

```bash
npm run dev
```

Abrir `http://localhost:3000`. La validación usa una **cuenta personal** (p. ej. «Cuenta de Miembro A») y el **mes en curso** (la activación del ahorro siempre nace en el mes en curso; FR-004). Para el happy path se necesita ingreso regular (018) activo.

## Escenarios de validación

Espejo de los 12 escenarios de aceptación + edges clave.

### Q1 — Ítem «Ahorro» sin ingreso regular (escenario 8)

1. Cuenta personal sin ingreso regular (⋮ → «Ingreso regular» → «Desactivar»… o usa una cuenta sin config).
2. ✅ En el panel, ⋮ de la tarjeta: ítem **«Ahorro»»** presente y **deshabilitado** con **«Requiere ingreso regular»**; no abre diálogo.

### Q2 — Happy path: 10 % de 3.000 € (escenario 1; SC-001/SC-003)

1. ⋮ → «Ingreso regular» `3000,00` → «Guardar». ⋮ → «Ahorro» `10` → «Guardar» → toast **«Ahorro guardado»**.
2. Entra en la cuenta (mes en curso): ✅ bloque «KPIs del mes» con 3 métricas: «Aportación común» (según 019), **«Ahorro del mes» = 300,00 €**, **«Saldo del mes» = saldo de movimientos − 300,00 €** (neto).
3. ✅ El listado no contiene ningún movimiento nuevo por el ahorro (solo el ingreso regular de 018, si aplica); el cierre de abajo mantiene su «Saldo del mes» bruto — KPI y cierre difieren exactamente en 300,00 € (edge «Sin doble cómputo»).

### Q3 — Idempotencia (escenario 2; SC-002)

1. Con la deducción visible, reconsulta el mes 5+ veces (recarga, ‹ ›, navegación desde el panel).
2. ✅ La deducción aparece exactamente una vez, importe estable (300,00 €); nunca se duplica ni acumula.

### Q4 — Edición del porcentaje: solo-adelante (escenario 3; FR-004)

1. Con 10 % y el mes en curso consultado, cambia a `15` en ⋮ → «Ahorro».
2. ✅ El mes ya consultado conserva 300,00 € (fila congelada); un mes posterior aún no consultado (avanza el tiempo o usa reactivación en otro mes) deduciría el 15 %.

### Q5 — Desactivar y reactivar (escenarios 4)

1. «Desactivar» → toast «Ahorro desactivado»; ✅ meses posteriores sin deducción y ya consultados intactos.
2. Reactiva con «Guardar»: ✅ el mes de activación se resetea al mes en curso (el hueco inactivo nunca se deduce).

### Q6 — Validación del formulario (escenario 5)

1. ⋮ → «Ahorro» e intenta guardar: vacío, `0`, `-5`, `101`, `abc` y **`12,5`**.
2. ✅ Cada caso se rechaza con su mensaje de [ui-contract §3](./contracts/ui-contract.md) («Introduce un porcentaje entero entre 1 y 100 (ej. 10).» para decimales) y nada se guarda; controles deshabilitados mientras guarda (anti-doble-envío).

### Q7 — Meses fuera de ventana (escenarios 7, 10)

1. Con ahorro activo, navega con › a un mes futuro: ✅ sin deducción (0,00 € sin subtexto).
2. Navega con ‹ a un mes anterior a la activación: ✅ sin deducción; con ‹ › al mes consultado, KPIs coherentes con ese mes.

### Q8 — Sin ahorro configurado (escenario 9)

1. Cuenta personal sin ahorro (o tras desactivar): ✅ «Ahorro del mes» = **0,00 €** con subtexto **«Sin ahorro configurado»** y «Saldo del mes» neto = bruto (coincide con el cierre).

### Q9 — Cuenta común y agregados sin cambios (escenarios 6, 12; FR-007)

1. Abre «Cuenta común»: ✅ sin menú ⋮ (intacto), sin bloque «KPIs del mes», layout idéntico.
2. Con ahorro activo, revisa cierre mensual, resumen global y cuenta de resultados anual: ✅ ninguno computa el ahorro ni cambia importes (siguen basados en movimientos).

### Q10 — Coexistencia con la aportación común (escenarios 11; FR-006)

1. Configura aportación (019) y ahorro a la vez (p. ej. 25 % y 10 %).
2. ✅ Ambos coexisten como configs independientes: la aportación es un movimiento más y el ahorro solo la deducción informativa; sin validación cruzada de porcentajes.

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test        # dominio, aplicación, actions, componentes
npm run test:e2e                                        # incluye e2e/porcentaje-ahorro.spec.ts
```

SC-005 queda verificado con ambas suites en verde + este quickstart manual completado. Al terminar la validación, dejar el estado limpio (desactivar ahorro e ingreso, borrar movimientos de prueba) si se comparte BD con los e2e.
