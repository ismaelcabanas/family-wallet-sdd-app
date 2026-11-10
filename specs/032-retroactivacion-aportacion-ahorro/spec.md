# Feature Specification: Retro-activación de la aportación común y el ahorro

**Feature Branch**: `feature/032-retroactivacion-aportacion-ahorro`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Para meses anteriores, en los que he añadido retroactivamente movimientos de manera manual o importándolos, me veo en la situación que no tengo manera de añadir los movimientos de gasto de aportación común, y tampoco manera de que se contabilice el ahorro". Acotado con el propietario (2026-11-10): solución de **retro-activación acotada** (ver Clarifications); las nóminas de esos meses ya están importadas y los porcentajes de las configs coinciden con los que hubieran aplicado entonces.

**Fuente**: Petición del propietario (2026-11-10). Diagnóstico verificado sobre el código: las tres configs (ingreso regular 018, aportación 019/021, ahorro 023) materializan solo en la ventana `activatedAtMonth ≤ mes ≤ mesEnCurso`, con `activatedAtMonth` fijado al mes de creación/reactivación de la config — los meses anteriores **nunca** se generan (semántica «solo-adelante»). Agravantes: el importador (028) descarta deliberadamente las filas «Aportación Común» (para no duplicar con un materializador que en esos meses no corre), el ahorro es un registro KPI-only sin vía manual alguna, y los KPIs leen el **registro** de materialización (`GetMonthNetContribution`/`GetMonthSavings`), no los movimientos — una aportación añadida a mano dejaría el KPI a 0 para siempre.

**Granularidad** (constitución II): una única user story pequeña con valor propio — que los meses ya registrados computen aportación y ahorro. Las dos configs se tratan como un solo ajuste: comparten mecanismo (ventana de activación), patrón de diálogo (menú ⋮ de 020) y recorrido (configurar una vez, visitar meses con el stepper); dividirlas duplicaría el recorrido sin valor independiente (mismo criterio que la excepción de 003).

## Clarifications

### Session 2026-11-10

- Q: ¿Cómo se cubre el gap — registro manual puntual por mes, script one-off de backfill, extender la importación o retro-activación de la config? → A: **Retro-activación acotada** (decisión del propietario): permitir elegir «aplicar desde {mes}» en las configs de aportación y ahorro; la maquinaria de materialización ya soporta meses pasados dentro de la ventana, los registros son idempotentes y el neto de 021 se calcula contra los gastos comunes ya registrados de cada mes. El registro manual deja los KPIs a 0 (leen registro), el script no deja capacidad de producto y extender la importación no cubre el ahorro.
- Q: ¿Se retro-activa también el ingreso regular? → A: **No, vetado**: las nóminas de esos meses ya están importadas; retro-activar la config de ingreso duplicaría ingresos. La config de ingreso regular no ofrece la opción.
- Q: ¿Se genera en lote («generar meses pendientes»)? → A: **No (fuera de alcance)**: tras retro-activar, visitar cada mes con el stepper materializa ese mes (cero código extra); un botón de lote queda anotado como posible iteración futura.

### Pendientes de clarify

- Q: ¿Límites del selector «aplicar desde»? → Libre hasta `mesEnCurso`, o acotado al primer mes con movimientos de la cuenta (evita generar aportación/ahorro en meses vacíos, donde el neto saldría = bruto completo). [NEEDS CLARIFICATION]
- Q: ¿El campo «aplicar desde» aparece solo al crear (y reactivar) la config, o también es editable después en una config ya activa? Hoy `activate()` resetea `activatedAtMonth` al mes en curso — la reactivación necesita amend. [NEEDS CLARIFICATION]
- Q: Guarda ante meses con aportación **manual** preexistente (etiqueta protegida «Aportación Común», p. ej. aportación extraordinaria registrada a mano): ¿saltar el mes sin registrar y cómo avisar? (propuesta aceptada en conversación: saltar; el aviso concreto, en el plan). [NEEDS CLARIFICATION]

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retro-activar aportación y ahorro para meses ya registrados (Priority: P1)

Como único usuario de la aplicación, quiero poder configurar la aportación común y el ahorro como vigentes **desde** un mes pasado, para que los meses anteriores ya cargados (a mano o importados de la hoja mensual) computen la aportación neta y el ahorro como si las configs hubieran existido entonces — en el listado, en los KPIs del mes y en los agregados.

**Why this priority**: Es la única historia de la feature y su razón de ser: hoy esos meses anteriores quedan silenciosamente incompletos (sin gasto de aportación, sin ahorro deducido) y no existe vía alguna para completarlos — ni manual (los KPIs leen el registro de materialización), ni por importación (028 descarta las filas «Aportación Común»), ni reaccionando las configs (ventana solo-adelante).

**Independent Test**: Se puede probar importando/registrando un mes pasado con ingresos y gastos comunes en una cuenta personal, configurando aportación y ahorro «desde» ese mes, visitándolo con el stepper y verificando: aparece el gasto de aportación con el importe neto esperado (porcentaje de la nómina − gastos comunes del mes, suelo 0), el KPI «Ahorro del mes» muestra el apartado congelado, el «Saldo del mes» es neto del ahorro, y las nóminas importadas no se han duplicado.

**Acceptance Scenarios**:

1. **Given** una cuenta personal con meses pasados ya registrados (nóminas y gastos comunes importados) y configs de aportación y ahorro creadas este mes, **When** configuro ambas con «aplicar desde {mes pasado}», **Then** el `activatedAtMonth` de cada config retrocede a ese mes y la UI refleja el cambio (estado del ítem del menú ⋮).
2. **Given** configs retro-activadas, **When** visito con el stepper un mes de la nueva ventana con gastos comunes registrados, **Then** se materializa la aportación **neta** de 021 (porcentaje sobre el ingreso regular de la config, descontados los gastos comunes de ese mes, suelo 0) como gasto propio con etiqueta «Aportación Común», visible en listado y KPI «Aportación común».
3. **Given** configs retro-activadas, **When** visito un mes de la nueva ventana, **Then** el ahorro de 023 se registra congelado (porcentaje × importe del ingreso regular de la config) y los KPI «Ahorro del mes» y «Saldo del mes» (neto del ahorro) lo reflejan.
4. **Given** un mes ya materializado (propio o retro-activado), **When** lo revisito, **Then** no se genera ni ajusta nada (idempotencia por registro `UNIQUE (config, mes)`; los meses cerrados siguen congelados — 021/023 intactos).
5. **Given** configs retro-activadas, **When** consulto los meses de la ventana **sin visitar**, **Then** permanecen pendientes (no hay generación en lote) y materializan al visitarlos, también desde entonces en `/summary` y `/annual`.
6. **Given** el ingreso regular con su ventana original, **When** retro-activo aportación y/o ahorro, **Then** el ingreso regular NO retro-activa: no se crea ninguna nómina nueva y las importadas quedan intactas (FR-002).
7. **Given** un mes de la ventana con un movimiento manual previo con la etiqueta protegida «Aportación Común», **When** lo visito, **Then** no se genera aportación para ese mes (guarda anti-duplicado) y el resto del recorrido no se altera (Clarifications pendientes).
8. **Given** el mes en curso tras una retro-activación, **When** edito gastos comunes del mes, **Then** la re-sincronización de 021 funciona exactamente como hoy (la retro-activación no toca la semántica del mes en curso).

---

### Edge Cases

- **Meses vacíos dentro de la ventana** (sin movimientos): al visitarlos, la aportación neta saldría = bruto completo y el ahorro completo (no hay gastos comunes que descontar); los límites del selector «desde» (Clarifications) mitigan cuándo puede ocurrir — decisión registrada en el clarify.
- **Salario real distinto en algún mes retro**: el cálculo usa siempre el **importe actual** de la config de ingreso regular (porcentajes confirmados estables por el propietario); si un mes difirió, el resultado desvía — se documenta, sin importes por mes histórico.
- **Aportación manual preexistente en un mes de la ventana** (etiqueta protegida): el mes se salta (guarda, FR-004); el KPI de ese mes sigue leyendo el registro (sin fila) — el detalle de aviso se cierra en clarify/plan.
- **Neto 0 en un mes retro** (gastos comunes ≥ bruto): igual que hoy — no se registra ni genera movimiento (mes abierto; re-intenta en cada visita) sin error.
- **Reactivación tras desactivar**: hoy `activate()` resetea `activatedAtMonth` al mes en curso; con esta feature la reactivación ofrece «aplicar desde» (amend del reseteo — Clarifications pendientes: disponibilidad también en edición de config activa).
- **Config de ahorro con fila ya congelada en un mes de la ventana** (p. ej. consultado antes de retro-activar con ventana anterior): la fila no se re-congela ni reajusta — el mes ya registrado queda como está (023: sin re-sync jamás).
- **Retro-activación y retirada de aportación (021)**: la retirada por neto 0 solo aplica al mes en curso (re-sync); un mes retro con aportación materializada y luego neto 0 por ediciones queda congelado con su importe — paridad del congelado actual.
- **Doble retro-activación** (el usuario retrasa «desde» aún más): los meses ya registrados no se duplican (registro idempotente); solo los nuevos de la ventana ampliada quedan pendientes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (selector «aplicar desde»)**: Los diálogos de configuración de **aportación** (019/021) y **ahorro** (023) — patrón de diálogo del menú ⋮ de 020 — MUST ofrecer un campo «aplicar desde {mes}» cuyo valor por defecto es el mes en curso y cuya elección fija el `activatedAtMonth` de esa config; los límites del selector quedan [NEEDS CLARIFICATION: libre hasta `mesEnCurso` vs acotado al primer mes con movimientos de la cuenta]. Su disponibilidad en reactivación/edición de una config existente queda [NEEDS CLARIFICATION] (hoy la reactivación resetea al mes en curso).
- **FR-002 (ingreso regular vetado)**: La config de **ingreso regular** (018) MUST NOT ofrecer retro-activación: su `activatedAtMonth` no cambia por esta vía en ninguna circunstancia (las nóminas de los meses pasados ya están registradas — duplicación imposible por construcción).
- **FR-003 (materialización por los cauces existentes)**: Los meses retro-activados MUST materializarse exclusivamente con los materializadores y su semántica vigente: ventana `activatedAtMonth ≤ mes ≤ mesEnCurso`, idempotencia por registro (`UNIQUE (config, mes)` + `ON CONFLICT DO NOTHING`), aportación **neta** de 021 contra los gastos comunes ya registrados del mes y ahorro congelado de 023 (porcentaje × importe del ingreso regular de la config). Queda PROHIBIDO recalcular importes con bases distintas o duplicar la lógica de los materializadores.
- **FR-004 (guarda anti-duplicado de aportación manual)**: Antes de materializar la aportación de un mes de la ventana, el sistema MUST comprobar si el mes ya contiene un movimiento con la etiqueta protegida «Aportación Común» ajeno al registro y, en tal caso, saltar la generación de ese mes (sin registrar); la forma de avisar al usuario se decide en el plan (Clarifications).
- **FR-005 (KPIs y agregados intactos)**: Los KPIs (022–024) y los agregados (`/summary`, `/annual`, informe 015) MUST leer exactamente como hoy: aportación y ahorro por sus registros (nunca recálculo UI), composición del «Saldo del mes» sin cambios. Tras la retro-activación, los meses visitados muestran valores coherentes listado ↔ KPI por construcción.
- **FR-006 (mes en curso y congelados intactos)**: La re-sincronización del mes en curso (021) y el congelado de meses ya registrados MUST permanecer intactos; retro-activar MUST NOT reabrir, reajustar ni borrar meses registrados (ni movimientos ni filas de registro).
- **FR-007 (cobertura de tests)**: La feature MUST estar cubierta por tests: unidad de los casos de uso afectados (ventana retro-activada, idempotencia, guarda de aportación manual, ingreso regular sin retro), action (Zod del campo mes), componentes del diálogo con el nuevo selector, y un e2e del recorrido completo (configurar «desde» → visitar mes → aportación y ahorro visibles y correctos) en combinación cuenta/mes propia (convención de aislamiento e2e; constitución III).
- **FR-008 (documentación)**: Al completar la feature, el roadmap maestro MUST marcar la fila `032-retroactivacion-aportacion-ahorro` como Completada; el amend de la semántica de activación («aplicar desde» retrasa `activatedAtMonth`) se registra como ADR y, si nace convención nueva, en AGENTS.md.

### Key Entities

No se introducen entidades nuevas de dominio ni de esquema (sin migraciones: `activatedAtMonth` ya existe en ambas configs y los registros ya garantizan idempotencia). Cambia el papel de:

- **`activatedAtMonth` (aportación y ahorro)**: pasa de fijado por el sistema al mes de creación/reactivación a **editable por el usuario en la frontera** (selector «aplicar desde»), convirtiéndose en el dato que abre la ventana de materialización hacia atrás; el de ingreso regular permanece de solo escritura interna.
- **Registros de materialización** (`common_contribution_months`, `savings_allocation_months`): reutilizados tal cual — cada mes retro-activado visitado añade su fila/movimiento por los cauces existentes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Configurar «aplicar desde» en ambas configs y recorrer con el stepper hasta 6 meses pasados toma menos de 1 minuto en total; cada mes materializa al visitarse sin pasos adicionales.
- **SC-002**: Los importes materializados de los meses retro-activados coinciden al céntimo con el cálculo manual equivalente (aportación: porcentaje × nómina − gastos comunes del mes, suelo 0; ahorro: porcentaje × nómina) sobre los mismos datos registrados.
- **SC-003**: Cero duplicados garantizados: nóminas importadas y aportaciones manuales preexistentes intactas tras el recorrido completo, y las re-visitas no generan filas ni movimientos nuevos.
- **SC-004**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde tras la feature.

## Assumptions

- El **importe** del ingreso regular de la config coincide con el salario real de los meses retro-activados (porcentajes confirmados por el propietario; importes estables) — el cálculo usa siempre el importe de la config, no hay histórico de importes por mes.
- Los **gastos comunes** de los meses retro-activados ya están registrados (importados con 028 o a mano): la aportación neta se calcula contra ellos al visitar cada mes.
- La retro-activación es una operación **consciente y excepcional** (migración/carga de histórico), no un flujo frecuente: la UI prioriza claridad sobre optimización del recorrido.
- Un solo usuario sin concurrencia real; aún así toda escritura re-valida en servidor (frontera de confianza).
- Sin cambios de esquema ni migraciones: todo lo soporta el modelo actual.

## Out of Scope

- **Botón «generar meses pendientes» en lote** (materializar toda la ventana de golpe): posible iteración futura anotada; v1 materializa al visitar con el stepper.
- **Retro-activación del ingreso regular** (018): vetada por diseño (FR-002).
- Extender el importador (028) para traer las filas «Aportación Común» del Excel.
- Registro manual puntual de aportación o ahorro por mes (la vía es la retro-activación de la config).
- Reabrir, reajustar o borrar meses ya registrados (congelados por 021/023).
- Configs por mes histórico (porcentajes o importes distintos por mes): una única config vigente, como hoy.
