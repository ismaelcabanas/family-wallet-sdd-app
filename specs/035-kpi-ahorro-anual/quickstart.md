# Quickstart: KPI de ahorro acumulado del año (035)

**Feature**: 035-kpi-ahorro-anual | **Fecha**: 2026-11-22

Guía de validación manual de los escenarios de la spec. Referencias: [spec](./spec.md) · [data-model](./data-model.md) · [contracts](./contracts/interfaces.md) · [ui-contract](./contracts/ui-contract.md).

---

## Prerrequisitos

```bash
npm run db:migrate     # sin migraciones nuevas (0009 es la última); asegura BD al día
npm run db:seed        # idempotente
npm run dev            # http://localhost:3000
```

**Estado inicial necesario**: una cuenta personal con movimientos (o vacía) en varios meses de un mismo año. No se requiere ninguna configuración (lectura pura).

## Validación end-to-end

Usa un año con control total de sus datos (p. ej. el año en curso) y limpia al terminar los movimientos que crees.

### Q1. Quinta métrica visible y año vacío (AS-1/FR-001, edge «Año sin datos»)

1. Abre una cuenta personal en un mes de un año **sin movimientos** (p. ej. `/accounts/1?month=2030-03`).
2. **Esperado**: bloque «KPIs del mes» con **5 métricas** en orden: Aportación común · Gasto personal · Ahorro del mes · Saldo del mes · **Ahorro acumulado**; subtext «Año 2030»; acumulado `0,00 €`, sin estados.

### Q2. Suma con signo de los saldos del año (AS-1/FR-002)

3. En `/accounts/1?month=2030-03`: registra ingreso `2.000,00` y gasto personal `350,50` → «Saldo del mes» = `+1.649,50 €`.
4. Navega con ‹ › a `2030-07` (o abre `/accounts/1?month=2030-07`) y registra gasto personal `1.800,00` → saldo `−1.800,00 €`.
5. **Esperado**: «Ahorro acumulado» = `−150,50 €` (1.649,50 − 1.800,00) con signo − y rojo, **el mismo valor en marzo, julio y cualquier mes de 2030** (estabilidad, AS-4/FR-003).

### Q3. Coherencia con cada mes (SC-002)

6. Visita cada mes de 2030 con datos y compara: el acumulado debe ser exactamente la suma de los «Saldo del mes» mostrados (incluida la composición condicional del ahorro de 033 si hay configs).

### Q4. Cambio de año en la misma visita (SC-004/FR-003)

7. Registra un ingreso `500,00` en un mes de **otro año** (p. ej. `2029-08`) y navega a él.
8. **Esperado**: subtext «Año 2029» y acumulado `+500,00 €` — distinto del de 2030, sin recargar nada más.

### Q5. Visibilidad continua con listado largo (AS-2/SC-001)

9. En un mes de 2030 registra ≥ 12 movimientos y desplázate al final del listado.
10. **Esperado**: las 5 métricas siguen en viewport (sticky) con el acumulado actualizado por las altas.

### Q6. Actualización en el ciclo de la página (FR-007)

11. Da de alta un movimiento en otro mes de 2030 (p. ej. noviembre) y vuelve al mes que estabas viendo.
12. **Esperado**: el acumulado recoge el nuevo movimiento al reconsultar (mismo ciclo de `revalidatePath`).

### Q7. Lectura pura: meses no visitados y materialización (FR-005, edge «Meses nunca visitados»)

13. Con una config de aportación/ahorro activa desde el mes en curso, consulta un mes de un **año pasado** sin visitar.
14. **Esperado**: el acumulado del año pasado computa solo con los movimientos registrados (nada se materializa por consultar); si la visita a un mes del año en curso materializa su aportación/ahorro, el acumulado del año en curso cambia de forma coherente en ese mismo render.

### Q8. Fuera de alcance intacto (FR-006/SC-003)

15. **Esperado**: la cuenta común (`/accounts/3`) sigue sin bloque KPIs; `/summary`, `/annual`, `/reports/*` y formularios no cambian.

### Limpieza

16. Borra todos los movimientos creados (2030 y 2029) y verifica que el acumulado de ambos años vuelve a `0,00 €`.

## Comandos de verificación

```bash
npm run lint && npm run typecheck && npm run test        # suites en verde (SC-005)
npm run test:e2e                                        # incluye e2e/kpi-ahorro-anual.spec.ts (cuenta 2 × 2025)
```
