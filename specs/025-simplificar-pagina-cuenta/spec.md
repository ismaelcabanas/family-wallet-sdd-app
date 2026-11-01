# Feature Specification: Simplificación de la página de cuenta — retirada del balance acumulado y del panel de cierre

**Feature Branch**: `feature/025-simplificar-pagina-cuenta`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "En la página de detalle de las cuentas personales, las 2 últimas secciones con balance de cuenta y cierre, no le veo gran sentido en esta página"

**Fuente**: Petición del propietario (2026-11-01), registrada en el roadmap maestro como fila `025-simplificar-pagina-cuenta` (nota del 2026-11-01). **Contexto**: `011-pagina-cuenta` introdujo el balance acumulado y el cierre mensual en la página de cuenta como único resumen de la misma. Desde `022-kpis-fijos-cuenta` (amendada por 023/024), las cuentas personales tienen el bloque «KPIs del mes» que resume el mes y **solapa magnitudes con el cierre con etiquetas casi idénticas y valores distintos por diseño** (dos «Saldo del mes» que difieren en el ahorro deducido; «Gastos personales» del cierre incluye la aportación común mientras el KPI «Gasto personal» la excluye), lo que confunde más de lo que informa. **Decisión del propietario (2026-11-01)**: retirar ambas secciones en **todas** las cuentas (también la común); la página de cuenta pasa a ser una vista operativa (registrar, editar, eliminar) y la consulta financiera agregada vive en el resumen global (`/summary`) y la cuenta de resultados anual (`/annual`).

**Granularidad** (constitución II): una única user story pequeña con valor propio — una página de cuenta sin ruido, centrada en operar el mes. No aplica excepción de agrupación.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Página de cuenta centrada en operar el mes, sin secciones redundantes (Priority: P1)

Como propietario, al entrar en la página de una cuenta quiero ver solo el selector ‹ mes/año ›, el bloque «KPIs del mes» (en cuentas personales) y el listado de movimientos del mes, sin las secciones de balance acumulado y cierre mensual, para operar la cuenta (registrar, editar, eliminar) sin duplicidades que confunden y sin datos de consulta puntual que no pido al entrar.

**Why this priority**: Es la única historia de la feature: eliminar de la página las dos secciones finales que solapan con el bloque KPIs (022-024) con etiquetas casi idénticas y valores distintos por diseño, o que son consulta puntual (balance histórico) sin lugar en una vista operativa.

**Independent Test**: Se puede probar abriendo la página de cualquier cuenta (personal y común) y verificando que no existen las regiones «Balance de {cuenta}» ni «Cierre de {mes}», que el bloque «KPIs del mes» de las personales conserva sus 4 métricas intactas y que el registro, la edición y la eliminación de movimientos funcionan igual que hoy.

**Acceptance Scenarios**:

1. **Given** la página de una cuenta personal, **When** la consulto, **Then** muestra únicamente cabecera, stepper ‹ mes/año ›, bloque «KPIs del mes» (4 métricas de 022-024, contrato intacto) y listado agrupado; no existe región «Balance de {cuenta}» ni región «Cierre de {mes}».
2. **Given** la página de la cuenta común, **When** la consulto, **Then** muestra cabecera, stepper y listado agrupado; sin bloque de KPIs (como hoy), sin balance y sin cierre.
3. **Given** altas, ediciones o eliminaciones de movimientos del mes, **When** vuelvo a consultar la página, **Then** el listado y los KPIs se recalculan en el mismo ciclo de revalidación que hoy (comportamiento de 011/022 intacto).
4. **Given** las vistas agregadas `/summary` y `/annual`, **When** las consulto, **Then** son idénticas a las actuales: la lectura financiera agregada (mes global con desglose por miembro y por tag, y año) no pierde información por esta feature.
5. **Given** un mes sin movimientos en una cuenta personal, **When** consulto ese mes, **Then** el listado muestra su estado vacío y el bloque KPIs sus valores 0,00 € con los subtextos de configuración vigentes; sin regiones de balance ni cierre.

---

### Edge Cases

- **Cuenta común sin agregados en su página**: aceptado por el propietario; su lectura financiera vive en `/summary` (fila «Cuenta común» del desglose por miembro) y los KPIs de aportación de las personales.
- **Coherencia KPI ↔ cierre verificada hoy por e2e**: varias e2e (022-024) contrastan el KPI contra el panel de cierre en la misma página; al desaparecer el ancla del cierre, la coherencia queda garantizada **por construcción** (la página compone los KPIs desde `GetMonthlyClosure`) y las e2e verifican los importes KPI finales.
- **Desglose por tag mensual por cuenta**: deja de verse en la página de cuenta; permanece el desglose global del mes en `/summary` y el desglose por tag y mes de `/annual`.
- **Balance histórico por cuenta**: queda sin representación en la UI (decisión del propietario); su corrección aritmética deja de ser un producto visible y no se crea sustituto en esta feature.
- **Meses cerrados y materialización**: la retirada es de presentación; la materialización perezosa (018/019/023) y la re-sincronización del mes en curso (021) se disparan igual al consultar la página, antes de leer.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (retirada de las secciones)**: La página de cuenta (`/accounts/{id}`) MUST retirar las secciones «Balance de {cuenta}» (balance acumulado hasta el mes consultado) y «Cierre de {mes}» (panel de 005) en **todas** las cuentas, personales y común. La página resultante MUST conservar: cabecera con nombre y subtítulo de cuenta, stepper ‹ mes/año ›, bloque «KPIs del mes» **solo en cuentas personales** (contrato congelado de 022/024 intacto: 4 métricas, sticky, grid) y listado agrupado con sus diálogos de edición/eliminación y estado vacío.
- **FR-002 (jubilación de componentes)**: Los componentes `AccountBalance` y `MonthlyClosurePanel` y sus tests de componente MUST eliminarse del repositorio: tras FR-001 carecen de llamantes (código muerto; YAGNI, misma política de jubilación que aplicó `012-panel-cuentas` a la UI retirada de `/`).
- **FR-003 (`GetMonthlyClosure` conservado como fuente interna)**: El caso de uso `GetMonthlyClosure` MUST permanecer **sin cambios de contrato ni de lógica**: sigue siendo la fuente de composición de los KPIs de cuentas personales (`personalExpenseCents`, `monthBalanceCents`) y sigue cubierto por sus unit tests. La página MUST ejecutarlo (y componer las dos restas de 024/023) **solo para cuentas personales**, y MUST dejar de ejecutarlo y de consultar el balance para la cuenta común (lecturas condicionadas al tipo de cuenta, como ya hace hoy con `netContribution`/`savings`).
- **FR-004 (jubilación del puerto `getBalance`)**: Tras FR-001, `AccountRepository.getBalance` queda **sin llamadas de producción** (la página de cuenta era su único consumidor). El método del puerto, su implementación Drizzle y los tests que lo cubren específicamente MUST jubilarse en el mismo cambio; los dobles de test de `AccountRepository` dejan de declararlo. La verificación de que los movimientos materializados (018/019) son visibles a las lecturas del mes se re-ancla en `listByMonthAndAccount`/agregados existentes. El plan valida el alcance del barrido en Complexity Tracking.
- **FR-005 (re-anclaje y retirada de e2e)**: Las e2e que hoy anclan aserciones en las regiones retiradas MUST adaptarse **sin debilitar el valor de sus flujos**, con este tratamiento:
  - `cierre-mensual.spec.ts`: **retirada** — su sujeto UI (el panel de cierre) desaparece; la lógica bruta del cierre sigue cubierta por los unit tests de `GetMonthlyClosure` y la lectura mensual por KPIs por las e2e de 022-024.
  - `pagina-cuenta.spec.ts`, `edicion-movimientos.spec.ts`, `gestion-tags.spec.ts`, `creacion-tags.spec.ts`, `ingresos-regulares.spec.ts`, `registro-movimientos.spec.ts`, `kpis-fijos-cuenta.spec.ts`, `cuenta-kpi-gasto-personal.spec.ts`, `porcentaje-ahorro.spec.ts`, `panel-cuentas.spec.ts`: re-anclaje de las aserciones que hoy leen el cierre o el balance al listado agrupado, al bloque KPIs o al conteo de filas, conservando los importes y flujos verificados.
  - El flujo crítico de registro de movimientos MUST seguir cubierto end-to-end (constitución III).
- **FR-006 (invariantes intactos)**: La feature MUST NOT alterar la materialización perezosa (018/019/023), la re-sincronización del mes en curso (021), la composición de KPIs (022-024), ni `/summary` y `/annual`. Sin cambios de modelo de dominio, sin migraciones, sin cambios de formulario o diálogos.
- **FR-007 (actualización de documentación)**: En el mismo cambio MUST actualizarse: AGENTS.md (página de cuenta resultante; re-justificación del aislamiento e2e, que pierde el motivo del «balance histórico absoluto» pero conserva `workers: 1` y combinaciones cuenta/mes por spec por la BD compartida; retiro de referencias a secciones desaparecidas), el roadmap maestro (fila 025 a Completada) y la documentación de arquitectura afectada (diagramas que muestren la página de cuenta). El plan valora cómo anotar ADR 0009 (balance derivado) respecto al balance acumulado retirado del producto.

### Key Entities

No se introducen ni modifican entidades, value objects ni tablas: la feature es una retirada de presentación y de código muerto resultante (componentes UI y un método de puerto sin llamantes). `MonthlyClosure` y `GetMonthlyClosure` se conservan tal cual como agregado de lectura interno.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 apariciones de las regiones «Balance de» y «Cierre de» en las páginas de cuenta (personal y común); el bloque «KPIs del mes» de las personales presenta exactamente sus 4 métricas con el comportamiento sticky intacto.
- **SC-002**: Todas las suites (dominio, aplicación, componentes, e2e) en verde, con el flujo crítico de registro cubierto end-to-end y las e2e re-ancladas verificando los mismos importes que hoy.
- **SC-003**: 0 cambios de esquema, 0 migraciones y 0 cambios de comportamiento en `/summary`, `/annual`, materialización y KPIs; `GetMonthlyClosure` conserva sus unit tests en verde.
- **SC-004**: 0 restos de código muerto: ni `AccountBalance`, ni `MonthlyClosurePanel`, ni `getBalance` en producción tras el cambio.

## Assumptions

- **Decisión del propietario (2026-11-01)**: retirada en **todas** las cuentas, incluida la común (que queda como vista operativa sin agregados); la consulta financiera vive en `/summary` y `/annual`.
- **Sin sustituto del balance histórico**: no se crea un nuevo hogar UI para el balance acumulado por cuenta en esta feature; si se echa de menos, se planificará como feature propia.
- **Aislamiento e2e vigente**: se mantienen `workers: 1`, specs en serie por fichero y combinación cuenta/mes propia por spec (BD compartida); solo se re-justifica el motivo en AGENTS.md al desaparecer las aserciones de balance histórico absoluto de `registro-movimientos.spec.ts`.
- **Convenciones de diálogos por fila y estado vacío del listado** intactas (AGENTS.md): el estado vacío sigue renderizándose dentro de `GroupedMovementList`.
- **Cobertura unitaria suficiente para el cierre bruto**: los unit tests de `GetMonthlyClosure` y de los agregados son la garantía de la aritmética que hoy reforzaban las e2e de panel.

## Out of Scope

- Nuevo hogar UI para el balance histórico por cuenta (tarjetas del panel, `/summary`, `/annual`).
- Bloque de KPIs o cualquier agregado en la página de la cuenta común.
- Cambios en `/summary`, `/annual`, formularios (013/014/017), menús de configuración (020/023) o materializaciones (018/019/021/023).
- Cambios de contrato o de lógica de `GetMonthlyClosure` y del resto de agregados.
