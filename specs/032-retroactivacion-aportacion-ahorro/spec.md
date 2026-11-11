# Feature Specification: Registro manual de la aportación común en meses pasados

**Feature Branch**: `feature/032-retroactivacion-aportacion-ahorro` *(identificador original conservado; renombrado pendiente de decisión del propietario)*

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Para meses anteriores, en los que he añadido retroactivamente movimientos de manera manual o importándolos, me veo en la situación que no tengo manera de añadir los movimientos de gasto de aportación común, y tampoco manera de que se contabilice el ahorro". Reencuadrado con el propietario (2026-11-10, misma sesión de clarify): solución de **registro manual** de la aportación común como gasto personal; el ahorro queda fuera de esta feature (mecanismo sin decidir).

**Fuente**: Petición del propietario (2026-11-10). Diagnóstico verificado sobre el código: la aportación común solo se genera por el materializador de 019/021 dentro de la ventana `activatedAtMonth ≤ mes ≤ mesEnCurso`, con `activatedAtMonth` fijado al mes de creación/reactivación de la config — los meses anteriores **nunca** se generan (semántica «solo-adelante»). La etiqueta protegida «Aportación Común» no se ofrece en el formulario de movimiento (no hay vía manual), el importador (028) descarta deliberadamente las filas «Aportación Común», y el KPI «Aportación común» (022–024) lee el **registro** de materialización (`GetMonthNetContribution`), no los movimientos — una aportación añadida a mano "no contaría" aunque la etiqueta se ofreciera. La solución debe, por tanto, **escribir el registro al crear el movimiento manual**.

**Granularidad** (constitución II): una única user story pequeña con valor propio — poder registrar manualmente la aportación común de meses pasados. El ahorro, presente en la petición original, se separa a una feature futura (el propietario no tiene claro su mecanismo: no es un movimiento). El enfoque inicial de retro-activación de configs, especificado primero en esta misma feature, fue descartado en clarify (ver Clarifications).

## Clarifications

### Session 2026-11-10

- Q: ¿Cómo se cubre el gap — registro manual, script one-off, extender la importación o retro-activación de la config? → A: inicialmente se eligió **retro-activación acotada** («aplicar desde {mes}» en las configs de aportación y ahorro); **descartada más tarde en la misma sesión** por el propietario: el enfoque no le convencía.
- Q: ¿Enfoque definitivo para la aportación común? → A: **Registro manual** (decisión del propietario): la aportación común encaja como un gasto personal ordinario — el usuario añade el movimiento a mano (etiqueta protegida «Aportación Común», importe real tecleado) para los meses que no lo tengan; al crearlo, el sistema escribe la fila del registro de materialización enlazada a ese movimiento (`movement_id`), de modo que listado, KPI «Aportación común» y agregados cuentan lo mismo por construcción. Resuelve la objeción inicial al manual («los KPIs leen el registro»): la escritura del registro acompaña a la creación del movimiento en la misma transacción. El importe manual es el **neto real que ocurrió entonces** (fuente: memoria/Excel del propietario); la app no lo calcula ni valida contra porcentajes.
- Q: ¿Y el ahorro? → A: **Fuera de alcance** en esta feature: el propietario no tiene claro el mecanismo (el ahorro no es un movimiento); se retoma como feature futura.
- Q: ¿Retro-activación de configs, botón «generar meses pendientes», reactivación amendada, ingreso regular vetado? → A: **Anulados**: no se toca ninguna config ni su `activatedAtMonth`; el materializador vigente (ventana solo-adelante) queda intacto y sigue siendo el dueño del mes en curso. La decisión previa de acotar el selector «desde» a enero de 2026 queda sin efecto al desaparecer el selector.
- Q: ¿Cuándo se ofrece la aportación en el alta y cómo se evita el duplicado con el materializador? → A: **Regla de unicidad: máximo 1 movimiento de aportación por cuenta y mes** (decisión del propietario), sea manual o del materializador. El alta admite la aportación en cuenta personal con config de aportación activa, sin ocultarla por territorios (la forma concreta de introducirla se precisa más abajo: tipo de gasto independiente); si al guardar ya existe otro movimiento de aportación en ese mes → **error con mensaje al usuario y el movimiento no se guarda**. La fila del registro se escribe al crear el primero y el materializador respeta la fila existente (idempotencia por registro, sin cambios).
- Q: ¿Si borro el movimiento manual de aportación, qué pasa con la fila del registro? → A: **Regla «0 o 1» reversible** (decisión del propietario): cada mes puede tener 0 o 1 movimientos de aportación; borrar el manual elimina también la fila (misma transacción) y el mes vuelve a 0 — **siempre se podrá añadir uno posteriormente**. Incluso un mes con fila huérfana (movimiento generado borrado bajo 021, definitivo para el materializador) admite el registro manual: la fila existente se enlaza al movimiento nuevo.
- Q: ¿Cómo se introduce el gasto de aportación — seleccionando la etiqueta en el alta genérica? → A: **No** (modificación del propietario): la aportación común es un **tipo de gasto independiente** en el alta — la naturaleza **propia** y la etiqueta protegida «Aportación Común» quedan **implícitas y automáticas**; el usuario solo teclea importe (y fecha/nota), nunca selecciona una etiqueta. La etiqueta sigue sin ofrecerse en el flujo de gasto genérico (como hoy). No nace un nuevo `MovementType` de dominio: el tipo es un concepto de la frontera UI que compone gasto + naturaleza propia + etiqueta protegida existentes.
- Q: ¿Al editar un movimiento de aportación puede cambiarse su tipo (degradarlo a gasto normal)? → A: **No — identidad fija** (decisión del propietario): la edición de una aportación solo permite importe, nota y fecha; tipo, naturaleza y etiqueta son inmutables (aplica igual a aportaciones manuales y generadas). Convertir una aportación en gasto normal = borrar y crear uno nuevo (la reversibilidad la da la regla «0 o 1»).

### Pendientes de clarify

- Q: ¿Se extiende la importación (028) para traer las filas «Aportación Común» del Excel (hoy descartadas), o quedan fuera y el usuario las registra a mano? [NEEDS CLARIFICATION]

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar a mano la aportación común de un mes pasado (Priority: P1)

Como único usuario de la aplicación, quiero añadir manualmente el gasto de aportación común de un mes pasado ya cargado (a mano o importado de la hoja mensual), para que ese mes compute la aportación — en el listado, en el KPI «Aportación común» y en los agregados — con el importe real que ocurrió entonces.

**Why this priority**: Es la única historia de la feature y su razón de ser: hoy esos meses anteriores quedan silenciosamente incompletos (sin gasto de aportación) y no existe vía alguna para completarlos — ni manual (la etiqueta no se ofrece en el formulario y, aunque se ofreciera, el KPI lee el registro de materialización), ni por importación (028 descarta las filas «Aportación Común»), ni por config (ventana solo-adelante, 019/021).

**Independent Test**: Se puede probar importando/registrando un mes pasado con ingresos y gastos comunes en una cuenta personal, añadiendo a mano un movimiento de tipo «Aportación común» (importe y fecha) y verificando: el movimiento aparece en el listado del mes, el KPI «Aportación común» muestra exactamente ese importe, el «Gasto personal» lo excluye (composición 024), el «Saldo del mes» es coherente, y `/summary` y `/annual` lo cuentan.

**Acceptance Scenarios**:

1. **Given** un mes pasado de una cuenta personal, sin fila en el registro de aportaciones y fuera de la ventana de la config activa, **When** creo un movimiento de tipo **«Aportación común»** (importe y fecha; naturaleza propia y etiqueta protegida implícitas), **Then** el movimiento se crea visible en el listado y, en la misma transacción, se escribe la fila de `common_contribution_months` enlazada al movimiento (`movement_id`), de modo que el KPI «Aportación común» muestra ese importe y la composición de «Gasto personal» / «Saldo del mes» (024) lo refleja por construcción.
2. **Given** un mes que ya tiene un movimiento de aportación (manual o del materializador), **When** intento guardar otro movimiento de tipo «Aportación común» en ese mes y cuenta, **Then** se produce un error con mensaje al usuario y el movimiento no se guarda (regla de unicidad, FR-001).
3. **Given** el mes en curso con config de aportación activa y sin registro manual previo, **When** el materializador genera o re-sincroniza, **Then** la semántica de 021 queda intacta: el registro manual no la altera (y si el mes ya fue registrado manualmente, el materializador respeta la fila existente por idempotencia).
4. **Given** un mes pasado con su movimiento manual de aportación ya creado, **When** lo revisito o recargo la página, **Then** no se genera ni ajusta nada (idempotencia: la fila ya existe, `UNIQUE (config, mes)`; el materializador nunca actúa fuera de ventana).
5. **Given** las configs (ingreso regular, aportación, ahorro), **When** uso el registro manual, **Then** ninguna config cambia — `activatedAtMonth`, porcentajes y estados intactos — y no se crea ninguna nómina nueva.
6. **Given** varios meses con aportación manual registrada, **When** consulto `/summary` y `/annual`, **Then** cuentan esas aportaciones como gasto y cuadran con listado y KPIs.
7. **Given** un mes pasado cuyo ahorro no está contabilizado, **When** completo su aportación manualmente, **Then** el KPI «Ahorro del mes» sigue sin registro (fuera de alcance de esta feature; feature futura).
8. **Given** un mes con su aportación manual registrada, **When** elimino el movimiento, **Then** se eliminan movimiento y fila del registro en la misma transacción (el mes queda en 0) y puedo registrar una nueva aportación en ese mes (regla «0 o 1», FR-004).

---

### Edge Cases

- **Mes dentro de la ventana de una config activa** (p. ej. el mes en curso): el registro manual está permitido también ahí — la fila se escribe al crear y el materializador la respeta (idempotencia por registro, sin cambios); la re-sincronización de 021 del mes en curso trata el movimiento enlazado como hoy (recalcula el neto sobre él) — matices a confirmar en el plan.
- **Segundo movimiento de aportación en un mes** («aportación extraordinaria»): bloqueado por la regla de unicidad (error al guardar, sin movimiento ni fila); posible iteración futura si surge el caso real.
- **Sin config de aportación activa**: el tipo «Aportación común» no se ofrece en el alta (no hay registro enlazable — la fila referencia la config por FK); paridad con la guarda del materializador.
- **Borrado del movimiento manual**: elimina movimiento y fila juntos (regla «0 o 1» reversible); si el mes está en la ventana activa, el materializador puede volver a generarlo en una visita posterior (dueño del mes sin registro) — matiz a confirmar en el plan.
- **Edición del movimiento de aportación** (manual o generado): identidad fija — solo importe, nota y fecha; el KPI lee el movimiento enlazado, así que un cambio de importe se refleja. Confirmar en el plan el efecto de mover la fecha a otro mes (la fila queda registrada para el mes original).
- **Cuenta común**: la aportación es un gasto de naturaleza propia en cuenta personal (paridad del materializador); en la cuenta común el tipo «Aportación común» no se ofrece.
- **Importe manual «equivocado»**: la app no valida contra porcentajes; corregir = editar el movimiento (el KPI sigue el enlazado). Asumido por diseño (fuente: realidad histórica).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (tipo de gasto «Aportación común» con registro y regla de unicidad)**: El alta de movimiento MUST ofrecer un **tipo de gasto independiente «Aportación común»** (cuenta personal con config de aportación activa): elegido el tipo, la naturaleza **propia** y la etiqueta protegida «Aportación Común» quedan implícitas — el usuario solo teclea importe (y fecha/nota); la etiqueta MUST NOT ser seleccionable a mano en el flujo de gasto genérico (permanece oculta, como hoy). El sistema MUST aplicar la regla de dominio **máximo 1 movimiento de aportación por cuenta y mes** («0 o 1»), cualquiera que sea su origen: al guardar un segundo → error con mensaje al usuario y el movimiento no se guarda. La creación del primer movimiento de aportación de un mes MUST escribir, en la misma transacción, la fila de `common_contribution_months` enlazada al movimiento (`movement_id`), reutilizando el registro existente (sin migraciones); el importe lo teclea el usuario (neto real, sin recálculo ni validación contra porcentajes).
- **FR-002 (KPIs y agregados intactos)**: Los KPIs (022–024) y los agregados (`/summary`, `/annual`, informe 015) MUST leer exactamente como hoy: aportación por su registro (`GetMonthNetContribution`, nunca recálculo UI), composición de «Gasto personal» y «Saldo del mes» sin cambios. Tras el registro manual, listado, KPI y agregados son coherentes por construcción.
- **FR-003 (materializador y configs intactos)**: El materializador de 019/021 MUST permanecer intacto (ventana solo-adelante, idempotencia por registro, re-sync del mes en curso, congelados). El registro manual MUST NOT cambiar `activatedAtMonth` ni ningún otro campo de ninguna config, y MUST NOT reabrir, reajustar ni borrar meses ya registrados por el materializador.
- **FR-004 (borrado y edición — regla «0 o 1» reversible, identidad fija)**: Cada mes puede tener **0 o 1** movimientos de aportación. Borrar un movimiento de aportación **manual** MUST eliminar también su fila del registro en la misma transacción (el mes vuelve a «sin aportación» y admite registrar otro). Un mes con fila huérfana (movimiento generado borrado bajo 021 — definitivo para el materializador) MUST seguir admitiendo el registro manual: la fila existente se enlaza al movimiento nuevo. La edición de un movimiento de aportación (manual o generado) MUST limitarse a **importe, nota y fecha** — tipo, naturaleza y etiqueta inmutables; convertirlo en gasto normal = borrar y crear. El importe editado se refleja en el KPI por construcción (el KPI lee el movimiento enlazado).
- **FR-005 (cobertura de tests)**: La feature MUST estar cubierta por tests: unidad del caso de uso (crea movimiento + fila en la misma transacción; regla de unicidad con error; idempotencia), action (Zod), componente del formulario (tipo «Aportación común» ofrecido con config activa; importe/naturaleza/etiqueta implícitos; error de unicidad con `role="alert"`), y un e2e del recorrido completo (alta manual en mes pasado → listado + KPI correctos) en combinación cuenta/mes propia (convención de aislamiento e2e; constitución III).
- **FR-006 (documentación)**: Al completar la feature, el roadmap maestro MUST marcar la fila `032-retroactivacion-aportacion-ahorro` como Completada; el registro manual como segunda vía de escritura del registro de materialización se registra como ADR y, si nace convención nueva, en AGENTS.md.

### Key Entities

No se introducen entidades nuevas de dominio ni de esquema (sin migraciones). Cambia el papel de:

- **Etiqueta protegida «Aportación Común»**: sigue protegida (no renombrable ni eliminable, 004/026) y **no seleccionable a mano**; el nuevo tipo de gasto «Aportación común» de la frontera UI la asigna automáticamente junto con la naturaleza propia (sin nuevo `MovementType` de dominio).
- **`common_contribution_months` (registro de materialización)**: gana una segunda vía de escritura — además del materializador, la creación manual de un movimiento de aportación escribe la fila enlazada; idempotencia por `UNIQUE (config, mes)`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registrar la aportación de un mes pasado (diálogo de alta habitual: tipo «Aportación común» + importe) toma menos de 30 segundos y no requiere pasos ocultos ni tocar configs.
- **SC-002**: El KPI «Aportación común» muestra exactamente el importe tecleado, al céntimo; listado, KPI y agregados (`/summary`, `/annual`) cuadran por construcción.
- **SC-003**: Cero duplicados: re-visitas y recargas no generan nada nuevo; el mes en curso del materializador y los meses congelados quedan intactos.
- **SC-004**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde tras la feature.

## Assumptions

- El importe manual es el **neto real que ocurrió entonces** (fuente: memoria/Excel del propietario); la app no lo calcula ni valida contra porcentajes de la config.
- Los gastos comunes y nóminas de esos meses ya están registrados (importados con 028 o a mano); esta feature solo añade el gasto de aportación que falta.
- El registro manual es una operación **consciente y excepcional** (carga de histórico), no un flujo frecuente.
- Un solo usuario sin concurrencia real; aún así toda escritura re-valida en servidor (frontera de confianza).
- Sin cambios de esquema ni migraciones: todo lo soporta el modelo actual (la fila ya tiene `movement_id`).

## Out of Scope

- **Ahorro (023) para meses pasados**: feature futura (mecanismo sin decidir; no es un movimiento).
- **Retro-activación de configs** (selector «aplicar desde», amend de `activate()`): enfoque descartado en clarify.
- **Botón «generar meses pendientes» en lote**: anulado junto con la retro-activación.
- **Extender el importador (028) para traer las filas «Aportación Común»**: [NEEDS CLARIFICATION] dentro/fuera.
- **Segundo movimiento de aportación en un mes** («aportación extraordinaria»): bloqueado por la regla de unicidad; posible iteración futura si surge el caso real.
- Reabrir, reajustar o borrar meses ya registrados por el materializador (congelados por 021).
- Cualquier cambio en las configs o su ventana de activación.
