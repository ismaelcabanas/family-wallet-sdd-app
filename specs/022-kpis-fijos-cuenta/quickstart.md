# Quickstart — KPIs fijos y destacados en la página de cuenta personal (022)

**Feature**: `022-kpis-fijos-cuenta` | Guía de validación manual end-to-end. Referencias: [spec.md](./spec.md) (escenarios), [contracts/ui-contract.md](./contracts/ui-contract.md) (literales y comportamiento congelado), [data-model.md](./data-model.md) (casos del DTO y flujo del caso de uso).

## Prerrequisitos

```bash
npm install
npm run db:migrate   # sin migraciones nuevas (esquema intacto)
npm run db:seed      # idempotente
```

## Arranque

```bash
npm run dev
```

Abrir `http://localhost:3000` y entrar en una **cuenta personal** (p. ej. «Cuenta de Miembro A»). La validación de aportación usa el **mes en curso** (la activación siempre arranca en el mes en curso); los casos de saldo pueden usarse en cualquier mes.

## Escenarios de validación

Espejo de los 8 escenarios de aceptación + edges clave.

### Q1 — Sin aportación configurada (escenario 3)

1. Cuenta personal sin aportación (si la hay: ⋮ → «Aportación» → «Desactivar»… o usa la otra cuenta personal).
2. ✅ Región **«KPIs del mes»** visible tras el selector; KPI «Aportación común» = **0,00 €** con subtexto **«Sin aportación configurada»**.

### Q2 — Aportación neta destacada (escenario 1; construye sobre 018/019/021)

1. ⋮ de la tarjeta de la cuenta en el panel → «Ingreso regular» `2.000,00` → «Aportación» `25` → «Guardar».
2. Entra en la cuenta (mes en curso): ✅ KPI «Aportación común» = **500,00 €**, idéntico al importe (−500,00 €) del movimiento «Aportación común de {miembro}» del listado.
3. Registra un gasto común de `120,55` en el mes y reconsulta: ✅ KPI = **379,45 €** (re-sincronización de 021) y «Saldo del mes» ha bajado 120,55 (la aportación no cambia de importe neto en el saldo: ya computa el neto).

### Q3 — Saldo del mes y coherencia con el cierre (escenarios 1, 6; FR-003/FR-006)

1. ✅ «Saldo del mes» = Σ ingresos − Σ gastos del mes mostrado, **igual** que la fila «Saldo del mes» del cierre de abajo (incluida la aportación como gasto).
2. Edita/elimina movimientos del mes y reconsulta: ✅ ambos KPIs se actualizan con listado y cierre en el mismo ciclo (FR-007).

### Q4 — Visibilidad continua con listado largo (escenario 2; SC-001)

1. Registra 50+ movimientos en el mes (tanda continua «Guardar y seguir»).
2. Desplázate por el listado de arriba a abajo: ✅ la barra «KPIs del mes» queda **fijada arriba** en todo el recorrido (selector no incluido) con los importes legibles.

### Q5 — Mes consultado distinto (escenario 5; SC-004)

1. Pulsa ‹ hasta un mes anterior a la activación de la aportación: ✅ KPI aportación = **0,00 € sin subtexto** (config existe, mes fuera de ventana), etiqueta de mes actualizada, saldo del mes de ese mes.
2. Vuelve con › al mes en curso: ✅ importes del mes en curso restaurados en la misma visita, sin acciones extra.

### Q6 — Neta cero y meses cerrados (escenarios 4 + edges)

1. Con aportación activa, suma gastos comunes ≥ bruto (p. ej. 500,00 en total): ✅ la aportación desaparece del listado (retirada 021) y el KPI = **0,00 € sin subtexto** (no «Sin aportación configurada»).
2. Baja los gastos: ✅ reaparece movimiento y KPI con el neto vigente. El importe de meses cerrados no cambia al consultarlos.

### Q7 — Mes vacío (escenario 8)

1. Navega a un mes sin movimientos: ✅ «Saldo del mes» = **0,00 €**, aportación según configuración y regla (0,00 € fuera de ventana), sin errores.

### Q8 — Cuenta común sin cambios (escenario 7; FR-005)

1. Abre «Cuenta común»: ✅ **no existe** la región «KPIs del mes»; layout idéntico al anterior.

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test        # suites unitarias y de componentes
npm run test:e2e                                        # incluye e2e/kpis-fijos-cuenta.spec.ts (K0–K7)
```

SC-005 queda verificado con ambas suites en verde + este quickstart manual completado.
