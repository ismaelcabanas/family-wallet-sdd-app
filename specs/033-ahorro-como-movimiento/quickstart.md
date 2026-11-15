# Quickstart: El ahorro mensual como movimiento editable (033)

**Feature**: 033-ahorro-como-movimiento | **Fecha**: 2026-11-15

Guía de validación manual de los escenarios de la spec. Referencias: [spec](./spec.md) · [data-model](./data-model.md) · [contracts](./contracts/interfaces.md).

---

## Prerrequisitos

```bash
npm run db:migrate     # aplica drizzle/0009 (columna movement_id + etiqueta «Ahorro», id 101)
npm run db:seed        # idempotente; siembra la etiqueta «Ahorro» en la genérica
npm run dev            # http://localhost:3000
```

**Estado inicial necesario**: cuenta personal con **config de ahorro existente** (activa o inactiva — basta configurarla una vez desde ⋮ → «Ahorro» del panel de cuentas; puede desactivarse después) e ingreso regular configurable para el escenario del materializador.

## Validación end-to-end

### E1. Alta manual en un mes pasado (AS-1, FR-001)

1. Navega a una cuenta personal en un **mes pasado** sin ahorro (p. ej. `/accounts/1?month=2026-05`).
2. «Nuevo movimiento» → el radio **«Ahorro»** aparece (4.ª opción) → selecciónalo.
3. Verifica: **sin** select de naturaleza y **sin** bloque «Etiqueta» (ambos implícitos); importa `250,00`; deja la nota vacía; «Guardar y cerrar».
4. **Esperado**: toast «Ahorro registrado»; fila nueva en el listado con importe `−250,00 €` y chip «Ahorro»; KPI «Ahorro del mes» = `250,00 €`; «Gasto personal» **excluye** los 250; «Saldo del mes» descuenta **una sola vez** (−250).
5. `/summary?month=2026-05` → los 250 cuentan como **gasto** (coherencia por construcción, FR-004).

### E2. Unicidad «0 o 1» (FR-001)

6. En el mismo mes, «Nuevo movimiento» → «Ahorro» → cualquier importe → guardar.
7. **Esperado**: `role="alert"` con «Ya existe un ahorro registrado para este mes.», diálogo abierto, sin escritura (recarga → sigue habiendo exactamente 1).

### E3. Edición con identidad fija (FR-005)

8. Editar la fila de ahorro → los radios están desactivados y marcados en «Ahorro», sin select de etiqueta.
9. Cambia el importe a `275,00` → guardar.
10. **Esperado**: KPI = `275,00 €`; nada más cambia (tipo, naturaleza y etiqueta inmutables).

### E4. Borrado uniforme reversible (FR-005)

11. Elimina la fila (confirmación) → **esperado**: fila y KPI a `0,00 €`; registra otro ahorro (p. ej. `300,00`) → KPI `300,00 €`. Limpia al terminar si el mes es compartido con otros escenarios.

### E5. Materializador con movimiento (FR-003) — mes en curso con config activa

1. Panel de cuentas ⋮ del miembro → «Ingreso regular» `3.000,00` → «Ahorro» `10 %` (activa).
2. Visita `/accounts/1` (mes en curso).
3. **Esperado**: fila «Ahorro» de `−300,00 €` en el listado (10 % de 3.000) y KPI `300,00 €`; recargas y navegación ‹ › **no generan ni ajustan nada** (idempotencia).
4. Borra el ahorro → mes a 0 → vuelve a visitar el mes → **esperado**: el materializador lo regenera (guarda reabierta por borrado uniforme).
5. Desactiva ahorro e ingreso al terminar (restaura el estado).

### E6. Re-enlace de fila congelada legacy (FR-002) — requiere fila huérfana pre-0009

1. (Solo si existe una BD con filas de 023) En un mes con KPI «Ahorro del mes» congelado y **sin** fila en el listado: registra el ahorro manual de ese mes (E1).
2. **Esperado**: sin error de unicidad; el KPI pasa a leer el movimiento; una sola fila en el registro (verificable con tests de repositorio o inspectando la BD).

### E7. Disponibilidad del tipo (edge cases)

- Cuenta común → el radio «Ahorro» **no se ofrece**.
- Cuenta personal sin config de ahorro (nunca configurada) → no se ofrece.
- Cuenta personal con config **desactivada** → **sí se ofrece** (la config es un ancla; E1 funciona con config inactiva).

### E8. Configs intactas (FR-006)

- Tras E1-E5: ⋮ → «Ahorro» mantiene porcentaje, estado y «aplicar desde» exactamente como estaban; el registro manual nunca reabre ni borra meses congelados.

## Comandos de verificación

```bash
npm run lint && npm run typecheck && npm run test        # suites en verde (SC-004)
npm run test:e2e                                         # incluye e2e/ahorro-movimiento.spec.ts
# y e2e/porcentaje-ahorro.spec.ts actualizado al nuevo mundo (fila visible + limpieza)
```

## Resultado esperado (criterios de éxito)

- SC-001: fijar/corregir el ahorro de cualquier mes < 30 s, sin pasos ocultos ni tocar configs.
- SC-002: KPI = importe registrado al céntimo; listado, KPI, saldo (descuento único) y `/summary`/`/annual` cuadran por construcción.
- SC-003: cero duplicados; congelados y configs intactos.
- SC-004: todas las suites en verde.
