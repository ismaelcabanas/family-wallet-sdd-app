# 17. Aportación común porcentual: puntos base, half-up entero y segundo materializador perezoso

- **Fecha**: 2026-10-15
- **Estado**: Aceptado (feature 019, `specs/019-aportacion-comun/`)
- **Relacionados**: [ADR 0007](./0007-dinero-centimos-enteros.md) (aritmética monetaria entera), [ADR 0016](./0016-materializacion-perezosa-ingresos-regulares.md) (patrón de materialización perezosa)

## Contexto y problema

La feature 019 permite a cada miembro aportar un **porcentaje de su ingreso regular** (018) a la cuenta común, materializado perezosamente como un gasto propio al consultar el mes. Tres decisiones técnicas nuevas: (1) cómo representar y calcular un porcentaje respetando la aritmética entera del ADR 0007 con redondeo **half-up** al céntimo (clarify 2026-10-14), (2) cómo replicar la materialización de 018 sin acoplar los dos agregados (ingreso regular y aportación tienen ciclos de vida y dependencias distintos), y (3) cómo garantizar la etiqueta «Aportación Común» (obligatoria en gastos) frente al mantenimiento del catálogo. Research en `specs/019-aportacion-comun/research.md`.

## Opciones consideradas

1. **Flotantes + `Math.round`** para el porcentaje: viola el ADR 0007 (no determinista, errores de representación de 0,1 %).
2. **Librería decimal** (decimal.js/big.js): dependencia nueva para un cálculo que cabe en enteros seguros de 2⁵³ (99 999 999 999 céntimos × 10 000 bp ≈ 10¹⁵ < 2⁵³).
3. **Extender `RegularIncome`** con un campo porcentaje: acopla dos configuraciones con lifecycles distintos y ensucia los invariantes de 018 ya entregados.
4. **Materializador combinado** (ingreso + aportación en un use case): guardas heterogéneas (la aportación depende del ingreso regular activo) y acoplo de agregados.
5. **Etiqueta garantizada solo por seed**: las BD existentes no la tendrían; la primera materialización lanzaría `InvalidMovementError`.
6. **`tagId` persistido en la configuración** al guardar: si la etiqueta se borra y se recrea, la config apuntaría a un id huérfano.

## Decisión

- **`ContributionPercentage` en puntos base enteros** (`basisPoints`, 1–10 000; 1 % = 100 bp): precisión exacta de la spec (≤ 2 decimales de porcentaje) sin coma flotante. El cálculo vive en el VO como **división entera canónica half-up**: `floor((amountCents × basisPoints + 5_000) / 10_000)` — extensión natural del ADR 0007; el `+5_000` (medio divisor) implementa el redondeo .5 hacia arriba (25 % de 1.500,50 € = 375,125 → 375,13 €). El parse de frontera (`parsePercentageToBasisPoints`) manipula cadenas, nunca `parseFloat`.
- **Agregado y casos de uso espejo de 018**, no extensión: `CommonContribution` (id/accountId/percentage/active/activatedAtMonth) con el mismo ciclo (reactivar resetea `activatedAtMonth`; editar no lo toca) y cuatro casos de uso propios (`Configure`/`Deactivate`/`Get`/`Materialize`) sobre su puerto `CommonContributionRepository`. La dependencia del ingreso se lee por su puerto (`MissingRegularIncomeError` al configurar; no-op silencioso al materializar si falta o está inactivo — sin base estable).
- **Segundo materializador perezoso bajo el patrón del ADR 0016**: `MaterializeCommonContributions.ensureForAccountAndMonth` se invoca en la página de cuenta **inmediatamente después** de `MaterializeRegularIncomes` y antes del `Promise.all` (dos awaits secuenciales; mismo disparador único — decisión del propietario 2026-10-12, ADR 0016). Idempotencia en tabla registro propia `common_contribution_months` (`UNIQUE (config, mes)` + `ON CONFLICT DO NOTHING RETURNING` en la misma tx que el movimiento); agregados (`/summary`, `/annual`) sin materializar; `movements` intacta.
- **Etiqueta «Aportación Común» por triple vía**: seed (`SEED_TAGS`), `INSERT OR IGNORE` en la migración `0004` (BDs existentes) y **ensure por slug** en cada generación (`findBySlug("aportacion-comun")` ?? `Tag.create` + `save`) — sobrevive a renombrados/borrados futuros del catálogo sin persistir `tagId` en la config.
- **Base de cálculo leída al generar** (solo-adelante, FR-004): el importe aplicado usa el ingreso regular vigente en el momento de materializar el mes; los meses ya registrados nunca se recalculan.
- **Guarda del céntimo 0**: al configurar, `appliedToCents(ingreso) < 1` se rechaza con `InvalidCommonContributionError` (literal propio); al materializar, no-op **sin registrar el mes** (una subida futura del ingreso permite generarlo después). `currentMonth` entra como parámetro del adaptador (`ui/format.ts`), sin puerto Clock (ADR 0016).

## Consecuencias

- **Positivas**: determinismo aritmético testeable con tabla de casos congelada; dos materializadores desacoplados (borrar/limpiar uno no afecta al otro) con la maquinaria ya verificada de 018; la etiqueta nunca rompe la generación; el borrado del gasto generado es definitivo.
- **Negativas / trade-offs**: duplicación deliberada del patrón de 018 (preferida a una abstracción «materializador genérico», principio I); el dato de etiqueta viaja en la migración `0004` con id fijo fuera del rango de seed para no colisionar con siembras explícitas de tests.
- La cuenta común no recibe contrapartida automática (decisión del propietario 2026-10-09, Out of Scope de 019): el ingreso equivalente se anota a mano si se desea cuadre.
