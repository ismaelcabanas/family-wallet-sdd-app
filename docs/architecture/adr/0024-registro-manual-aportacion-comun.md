# 24. Registro manual de la aportación común: segunda vía de escritura del registro de materialización

- **Fecha**: 2026-11-13
- **Estado**: Aceptado (feature 032, `specs/032-retroactivacion-aportacion-ahorro/`)
- **Relacionados**: [ADR 0017](./0017-aportacion-comun-porcentaje-materializacion.md) (aportación porcentual materializada), [ADR 0019](./0019-aportacion-neta-gastos-comunes.md) (enlace blando `movement_id` y re-sincronización del mes en curso), [ADR 0016](./0016-materializacion-perezosa-ingresos-regulares.md) (disparador único de lectura)

## Contexto y problema

Los meses pasados cargados retroactivamente (a mano o vía 028) nunca reciben aportación común: la ventana del materializador de 019/021 es solo-adelante (`activatedAtMonth ≤ mes ≤ mesEnCurso`), la etiqueta protegida «Aportación Común» no se ofrece en el formulario, el importador descarta esas filas y el KPI «Aportación común» (022–024) lee el **registro** de materialización (`GetMonthNetContribution`), no los movimientos — una aportación añadida a mano «no contaría» aunque la etiqueta se ofreciera. La feature 032 necesita una vía para completar esos meses con el importe real histórico, sin tocar configs ni materializador. El enfoque inicial (retro-activación acotada de configs: selector «aplicar desde {mes}») fue descartado por el propietario en clarify; el **ahorro** (023) queda fuera de alcance (mecanismo sin decidir).

## Opciones consideradas

1. **Ofrecer la etiqueta «Aportación Común» en el flujo de gasto genérico**: el KPI no la contaría (lee el registro, no los movimientos) y degradaría la protección de la etiqueta.
2. **Retro-activación de configs** (retrasar `activatedAtMonth`): descartada por el propietario; reescribe historia según porcentajes actuales en lugar del importe real que ocurrió entonces.
3. **Extender el importador (028)** para traer las filas «Aportación Común»: no cubre meses cargados a mano y acopla la solución al CSV (decidido: no extender).
4. **Nuevo `MovementType` de dominio «CONTRIBUTION»**: la aportación manual es un gasto ordinario con naturaleza y etiqueta fijas — un tipo nuevo en el dominio duplicaría conceptos de la frontera y contaminaría agregados y esquema.
5. **Recalcular el KPI como suma de movimientos con la etiqueta**: rompe el invariante «el KPI lee el registro» (022) y bifurca la fuente de verdad entre materializador y manual.

## Decisión

- **Tipo de gasto independiente como concepto de la frontera UI**: el alta de movimiento ofrece «Aportación común» (solo cuenta personal con config activa — prop `contributionOption: off | available | locked`); elegido el tipo, naturaleza propia y etiqueta protegida quedan implícitas — el usuario teclea importe, fecha y nota. Sin nuevo `MovementType` de dominio: la action despachadora (`create-movement.action.ts`, Zod `type: "expense" | "income" | "contribution"`) rutúa `contribution` al caso de uso `RegisterManualContribution`, que compone `Movement.create` con `nature: "personal"` y `CONTRIBUTION_TAG_SLUG`. La etiqueta sigue sin ofrecerse en el flujo genérico (excluida por `isProtectedTagSlug`, paridad 029).
- **Regla de unicidad «0 o 1»** por cuenta y mes, cualquiera que sea el origen (manual o materializador): pre-check `findMaterializedMovement(config, mes)` + guarda transaccional; el segundo movimiento → `ContributionAlreadyExistsError` («Ya existe una aportación registrada para este mes.»), sin escritura.
- **Segunda vía de escritura del registro**: `CommonContributionRepository.registerManualContribution(config, mes, movement)` en **una sola transacción** — `INSERT ... ON CONFLICT (config, mes) DO UPDATE SET movement_id WHERE movement_id IS NULL RETURNING` (una fila huérfana — movimiento generado borrado bajo 021 — se **enlaza** al movimiento nuevo; una fila con enlace → 0 filas → `null` → error de unicidad) y después `INSERT` del movimiento. Idempotencia por `UNIQUE (config, mes)` intacta: el materializador respeta la fila existente por construcción (ADR 0016/0017/0019 sin cambios).
- **Regla «0 o 1» reversible e identidad fija**: borrar un movimiento de aportación **manual** elimina movimiento y fila en la misma transacción (`DeleteMovement` conoce cuenta y etiqueta; el mes vuelve a 0 y admite otro registro); la edición (`UpdateMovement`) congela tipo, naturaleza y etiqueta — solo importe, nota y fecha (el KPI sigue el movimiento enlazado). El mes en curso conserva la semántica de 021 (re-sincronización sobre el movimiento enlazado, sea cual sea su origen).
- **KPIs y agregados intactos** (FR-002): ninguna lectura cambia; listado, KPI y agregados cuadran por construcción porque el movimiento y la fila nacen juntos.

## Consecuencias

- **Positivas**: el histórico se completa con importes reales (fuente: memoria/Excel del propietario) sin recálculo ni validación contra porcentajes; el materializador, las configs y todos los agregados quedan intactos; la reversibilidad («borrar y volver a registrar») sustituye a la no-existente «degradar a gasto normal».
- **Negativas / trade-offs**: `common_contribution_months` pasa de una vía de escritura (materializador) a dos — el ADR documenta que ambas convergen en la misma guarda `UNIQUE (config, mes)` y que el importe manual puede diferir del porcentual (asumido por diseño); «aportación extraordinaria» (segundo movimiento en un mes) queda bloqueada por regla (iteración futura si surge el caso real).
- El ahorro de meses pasados sigue sin vía (feature futura, mecanismo sin decidir — no es un movimiento).
