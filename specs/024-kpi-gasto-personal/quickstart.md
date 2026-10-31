# Quickstart — KPI de gasto personal del mes (024)

**Feature**: `024-kpi-gasto-personal` | Guía de validación manual end-to-end. Contrato congelado: [contracts/ui-contract.md](./contracts/ui-contract.md) · Derivación: [data-model.md](./data-model.md).

## Prerrequisitos

```bash
npm install
npm run db:migrate     # esquema al día (024 no añade migraciones)
npm run seed           # datos base: Miembro A/B + Cuenta común + etiquetas
npm run dev            # http://localhost:3000
```

## Escenarios de validación manual

> Importes congelados del happy path (ui-contract §2; research §7): ingreso regular **2.000,00 €**, aportación **25 %**, gasto común **60,00 €**, gastos personales **120,55 € + 80,00 €** → aportación neta **440,00 €**, KPI gasto personal **200,55 €**, saldo del mes **+1.299,45 €** (sin ahorro configurado).

### Q1 — Cuarta métrica con exclusión de la aportación (FR-001/FR-002; esc. 1, 7)

1. Panel `/` → tarjeta de Miembro B → ⋮ → «Ingreso regular»: **2000,00** → Guardar.
2. ⋮ → «Aportación»: **25** → Guardar.
3. Abrir **Cuenta de Miembro B**: el bloque «KPIs del mes» muestra **4 métricas** en orden *Aportación común · Gasto personal · Ahorro del mes · Saldo del mes*.
4. Registrar gasto común **60,00** (Compartido, tag Vivienda), gastos personales **120,55** y **80,00** (Personal, tag Ocio).
5. **Esperado**: Aportación común **440,00 €** (500 − 60, neta de 021) · Gasto personal **200,55 €** (solo los personales; excluye la aportación y el común) · Saldo del mes **+1.299,45 €**. El movimiento «Aportación común de Miembro B» aparece en el listado pero **no** computa en el KPI. Coherencia: Gasto personal + Aportación + común 60,00 = Σ gastos del cierre (700,55).

### Q2 — Mes sin gastos computables (FR-002; edge)

1. En Q1, selector ‹ mes anterior.
2. **Esperado**: KPI Gasto personal **0,00 €**, presente y sin subtexto; etiqueta pasiva del mes consultado.

### Q3 — Visibilidad continua (FR-001; esc. 2; SC-001)

1. Volver al mes en curso; registrar ≥ 12 movimientos (o los suficientes para desbordar la pantalla).
2. Desplazarse al final del listado.
3. **Esperado**: la región «KPIs del mes» sigue visible (sticky) en todo el desplazamiento, con el importe de Q1 accesible sin scroll adicional.

### Q4 — Alta actualiza el KPI (FR-007; SC-005)

1. Registrar un gasto personal nuevo de **10,00**.
2. **Esperado**: al cerrar el diálogo, el KPI Gasto personal se actualiza en el mismo ciclo (200,55 → 210,55), junto a listado y cierre.

### Q5 — Mes consultado y meses cerrados (FR-003; esc. 4)

1. Navegar con ‹ › por meses con y sin movimientos.
2. **Esperado**: el KPI refleja el mes del selector en la misma visita, coherente con su listado y su cierre; los meses pasados muestran su valor histórico sin cambios.

### Q6 — Cuenta común sin bloque (FR-006; esc. 6; SC-003)

1. Abrir **Cuenta común**.
2. **Esperado**: no aparece la región «KPIs del mes»; página idéntica a la actual.

### Q7 — Agregados intactos (FR-006; SC-003)

1. Visitar `/summary`, `/annual` y el balance acumulado de la cuenta.
2. **Esperado**: cifras idénticas a las de antes de la feature (024 no toca agregados).

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test        # dominio/aplicación/componentes
npm run test:e2e                                          # incluye e2e/kpi-gasto-personal.spec.ts
```

**Criterio de cierre**: Q1–Q7 verificados manualmente + gates en verde + `kpis-fijos-cuenta.spec.ts` y `porcentaje-ahorro.spec.ts` siguen verdes sin cambios (aislamiento e2e, research §5) + roadmap fila 024 «Completada» y AGENTS.md amendado (3 → 4 métricas) en el mismo cambio (FR-009).
