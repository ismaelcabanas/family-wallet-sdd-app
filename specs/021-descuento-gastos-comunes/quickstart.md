# Quickstart — Descuento de gastos comunes en la aportación mensual (021)

**Feature**: `021-descuento-gastos-comunes` | Guía de validación manual end-to-end. Referencias: [spec.md](./spec.md) (escenarios), [contracts/behavior-contract.md](./contracts/behavior-contract.md) (comportamiento congelado), [data-model.md](./data-model.md) (reglas y flujo de guardas §1.2.1).

## Prerrequisitos

```bash
npm install
npm run db:migrate   # aplica drizzle/0005_descuento-gastos-comunes.sql (columna movement_id)
npm run db:seed      # idempotente (sin cambios de datos)
```

## Arranque

```bash
npm run dev
```

Abrir `http://localhost:3000`. Trabaja sobre una **cuenta personal** con ingreso regular y aportación configurados; usa el **mes en curso** (la activación siempre arranca en el mes en curso).

## Escenarios de validación

Espejo de los 13 escenarios de aceptación + edges clave.

### Q1 — Aportación neta por primera consulta (escenarios 1 y 7)

1. ⋮ de la cuenta personal → «Ingreso regular» `2.000,00` → «Aportación» `25` → «Guardar».
2. Entra en la cuenta (mes en curso): aportación **−500,00 €** única, como en 019 (sin gastos comunes aún).

### Q2 — Registrar un gasto común descuenta (escenario 2; SC-001)

1. «Nuevo movimiento»: gasto `120,00`, naturaleza **Compartido**, etiqueta cualquiera, fecha del mes en curso.
2. Al volver al listado: la aportación pasa a **−380,00 €**, un único movimiento, sin edición manual.

### Q3 — Suma, céntimos y otras cuentas (escenarios 3, 8, 9; edge céntimos)

1. Segundo gasto común de `80,55` → aportación **−298,95 €** (suma exacta al céntimo).
2. Un gasto **Personal** o un **Ingreso** en la misma cuenta: la aportación no cambia.
3. Un gasto común en la **Cuenta común** o en la cuenta del otro miembro: la aportación no cambia.

### Q4 — Editar y eliminar gastos comunes (escenario 5; SC-003)

1. Edita el gasto de 120,00 → 150,00 → aportación **−350,00 €**.
2. Elimina el de 80,55 → aportación sube en la siguiente consulta.

### Q5 — Suelo cero y reaparición (escenario 4; SC-004)

1. Registra gastos comunes que igualen o superen 500,00 en total (p. ej. 400 + 380,55… del ejemplo: total ≥ 500).
2. La aportación **desaparece** (el mes no tiene movimiento de aportación); ningún otro mes cambia.
3. Elimina el último gasto para bajar del bruto → la aportación **reaparece** con el neto vigente.

### Q6 — Idempotencia (escenario 11; SC-002)

1. Recarga la cuenta 5+ veces, visita `/summary?month={mes}` y `/annual?year={año}` y vuelve.
2. Exactamente 1 aportación con el mismo importe; sin duplicados.

### Q7 — Meses cerrados congelados (escenario 6)

1. Navega a un mes **anterior** con aportación ya materializada.
2. Registra/edita/elimina un gasto común fechado en ese mes: la aportación de ese mes **no cambia**.

### Q8 — Fecha del descuento (edge «mes al que pertenece»)

1. Registra hoy un gasto común **fechado el mes pasado**: solo podría afectar a ese mes (cerrado ⇒ congelado); el mes en curso no cambia.

### Q9 — Borrado definitivo de la aportación (escenario 10)

1. Elimina la aportación desde su fila (⋮ → Eliminar) en el mes en curso.
2. No reaparece al reconsultar, aunque registres o elimines gastos comunes después.

### Q10 — Desactivación a mitad de mes (escenario 13; clarify 2026-10-18)

1. Con la aportación del mes generada, «Desactivar» desde el diálogo.
2. Registra un gasto común nuevo: la aportación del mes en curso **sigue reduciéndose**; meses futuros ya no se generan.

### Q11 — Cambio de porcentaje/ingreso en pleno mes (edge)

1. Edita el porcentaje (p. ej. 30 %): el mes en curso recalcula con la config vigente en la siguiente consulta.

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test
npm run test:e2e   # incluye e2e/descuento-gastos-comunes.spec.ts (Cuenta de Miembro B + mes en curso; research §8)
```

Esperado: todo en verde (SC-005).

## Resultado esperado

Con la configuración hecha una vez (018/019), cada gasto común del mes en curso queda reflejado automáticamente en la aportación al consultar la cuenta (SC-001), sin duplicados ni importes obsoletos (SC-002), con meses cerrados intactos (SC-003), sin aportaciones negativas ni arrastres (SC-004) y todas las suites en verde (SC-005).
