# 7. Dinero como céntimos enteros (VO `Money`, sin coma flotante)

- **Fecha**: 2026-09-03
- **Estado**: Aceptado

## Contexto y problema

FR-003 exige aritmética monetaria exacta (sin errores de redondeo) en una app EUR-only con sumas/restas y 2 decimales. La aritmética binaria de coma flotante produce errores silenciosos (`0.29 * 100 === 28.999999999999996`), inaceptables para cuadrar cuentas frente al Excel actual (criterio de aceptación explícito de la constitución, principio III).

## Opciones consideradas

1. **`number` en euros con `toFixed(2)`**: redondeos silenciosos garantizados; descartado de raíz.
2. **Librerías decimales (`decimal.js`, `dinero.js`)**: dependencia externa prohibida en dominio (principio VII), modelo multi-divisa irrelevante (EUR-only) y overkill para sumas/restas.
3. **Céntimos enteros en un VO de dominio `Money`** (`amountCents: number`): exacto por construcción, `number` es seguro hasta `Number.MAX_SAFE_INTEGER` (margen astronómico frente al máximo de 999.999.999,99 €) y mapea 1:1 con la columna `INTEGER` de SQLite.

## Decisión

VO inmutable `Money` en `src/domain/movement/Money.ts` con céntimos enteros:

- `Money.fromCents` (importes de movimiento, > 0) y `Money.fromCentsOrZero` (balances, admite 0/negativos); ambos validan `Number.isInteger` y el máximo 99.999.999.999 céntimos.
- `add`/`subtract` devuelven un nuevo `Money`; jamás `parseFloat(x) * 100` ni `Math.round`.
- Frontera (Zod, Server Action): el importe llega como string, se valida con regex `^\d{1,9}([.,]\d{1,2})?$` y se parsea a céntimos manipulando el string (pad a 2 decimales).
- Persistencia: columna `movements.amount_cents INTEGER`.
- Formateo: `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })` exclusivamente en adaptadores de UI (`src/infrastructure/primary/ui/format.ts`), nunca en dominio.

## Consecuencias

- **Positivas**: exactitud aritmética por construcción en todas las capas (input → céntimos → BD → céntimos → formato); dominio puro sin dependencias; tests unitarios triviales del acarreo de céntimos (10,29 + 0,01 = 10,30).
- **Negativas**: todo cruce de frontera debe convertir string/BD ↔ céntimos explícitamente; el formateo con `Intl` produce espacio no rompible (`\u00A0`/`\u202F`) antes del `€`, a tener en cuenta en tests y selectores.
