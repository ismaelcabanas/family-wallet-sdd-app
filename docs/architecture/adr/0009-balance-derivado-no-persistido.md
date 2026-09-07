# 9. Balance derivado on-the-fly, no persistido

- **Fecha**: 2026-09-03
- **Estado**: Aceptado

## Contexto y problema

FR-008 exige mostrar el balance acumulado por cuenta (histórico completo: ingresos − gastos) actualizado tras cada registro. Con ~100–500 movimientos/mes por unidad familiar, había que decidir entre calcularlo o almacenarlo.

## Opciones consideradas

1. **Columna `balance` persistida en `accounts`**: requiere recalcular/transaccionar en cada escritura, introduce riesgo de drift y serializa escrituras (Turso es single-writer).
2. **Snapshot mensual materializado**: complejidad de mantenimiento injustificada en el volumen actual (YAGNI); se agregaría si el histórico creciera órdenes de magnitud.
3. **Derivado on-the-fly con `SUM` agregada** e índice `(account_id, date)`.

## Decisión

El balance no es un campo de la entidad `Account`: es una query derivada del puerto `AccountRepository.getBalance(accountId)`, implementada como:

```sql
SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents ELSE -amount_cents END), 0)
FROM movements WHERE account_id = ?;
```

El signo contable lo determina `type` en la query; el movimiento siempre almacena `amount_cents > 0`.

## Consecuencias

- **Positivas**: imposible que exista drift por definición (no hay dato duplicado); SC-003 ("coincidencia 100% con la suma de movimientos") cierto por construcción y verificado en tests de integración del repositorio; la edición/eliminación (feature 003) no requerirá recálculo.
- **Negativas**: coste de agregación por lectura (sub-milisegundo con el índice en el volumen previsto); si el histórico creciera sustancialmente, se evaluaría un snapshot materializado sin tocar el dominio.
