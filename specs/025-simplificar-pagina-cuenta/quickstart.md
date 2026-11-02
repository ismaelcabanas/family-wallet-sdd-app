# Quickstart — Simplificación de la página de cuenta (025)

**Feature**: `025-simplificar-pagina-cuenta` | Guía de validación manual end-to-end. Contrato congelado: [contracts/ui-contract.md](./contracts/ui-contract.md) · Jubilaciones y puerto resultante: [data-model.md](./data-model.md).

## Prerrequisitos

```bash
npm install
npm run db:migrate     # esquema al día (025 no añade ni quita migraciones)
npm run seed           # datos base: Miembro A/B + Cuenta común + etiquetas
npm run dev            # http://localhost:3000
```

## Escenarios de validación manual

### Q1 — Cuenta personal: vista operativa sin balance ni cierre (FR-001; esc. 1; SC-001)

1. Abrir **Cuenta de Miembro B** (mes en curso).
2. **Esperado**: la página muestra únicamente cabecera (nombre + nav), subtítulo «Cuenta personal de {miembro}», selector ‹ mes/año ›, bloque **«KPIs del mes»** con sus **4 métricas** intactas (Aportación común · Gasto personal · Ahorro del mes · Saldo del mes, sticky al desplazar) y listado «Movimientos del mes». **No existe** región «Balance de {cuenta}» ni región «Cierre de {mes}» (buscar visualmente al final de la página: el listado es el último bloque).

### Q2 — Cuenta común: idéntica simplificación (FR-001; esc. 2)

1. Abrir **Cuenta común**.
2. **Esperado**: cabecera, subtítulo «Cuenta común», selector ‹ mes/año › y listado. Sin bloque KPIs (como hoy), **sin balance y sin cierre**.

### Q3 — Ciclo operativo intacto (FR-006; esc. 3)

1. En la cuenta personal: registrar un gasto, editar su importe y eliminar otro movimiento (diálogos del listado).
2. **Esperado**: listado y KPIs se recalculan en el mismo ciclo de revalidación que hoy (mismos importes que antes de la feature para los mismos movimientos).

### Q4 — Mes vacío (FR-001; esc. 5)

1. Navegar con ‹ a un mes sin movimientos de la cuenta personal.
2. **Esperado**: listado en estado vacío y KPIs a 0,00 € con sus subtextos de configuración vigentes; sin balance ni cierre al final.

### Q5 — Materialización intacta (FR-006; edge «Meses cerrados y materialización»)

1. Con ingreso regular y/o aportación configurados, abrir el mes en curso de esa cuenta.
2. **Esperado**: el ingreso regular materializado (y la aportación neta, si procede) aparece en el listado tras la consulta, exactamente como antes de la feature; los KPIs lo reflejan.

### Q6 — Consulta agregada intacta (FR-006; esc. 4)

1. Visitar `/summary` (mes global con desglose por miembro y tag) y `/annual` (año en curso).
2. **Esperado**: cifras idénticas a las actuales; la fila «Cuenta común» del desglose por miembro sigue dando la lectura financiera de la común.

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test        # dominio/aplicación/repositorios/componentes
npm run test:e2e                                          # suite re-anclada (cierre-mensual.spec.ts retirado)
```

**Criterio de cierre**: Q1–Q6 verificados manualmente + gates en verde + SC-004 verificado por grep (0 apariciones de `AccountBalance`, `MonthlyClosurePanel`, `getBalance` y `monthEndIsoDate` en `src/`) + documentación actualizada en el mismo cambio (AGENTS.md, roadmap fila 025 «Completada», diagramas vivos, notas ADR 0009/0010 — FR-007).
