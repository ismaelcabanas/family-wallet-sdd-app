# Feature Specification: KPI de gasto personal del mes en la página de cuenta personal

**Feature Branch**: `feature/024-kpi-gasto-personal`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "quiero añadir un nuevo kpi al detalle de las cuentas personales, el gasto personal del mes, para cada vez que vaya a hacer un gasto tener en cuenta lo que llevo gastado personalmente y poder compararlo con el balance del mes, para ver si puedo o no llevar a cabo gastos futuros"

**Fuente**: Petición del propietario (2026-10-30), registrada en el roadmap maestro como fila `024-kpi-gasto-personal` (nota del 2026-10-30). **Construye sobre** `022-kpis-fijos-cuenta` (amendada por `023-porcentaje-ahorro`): el bloque «KPIs del mes» de las cuentas personales pasa de 3 a 4 métricas. El nuevo KPI es una **agregación de lectura pura** sobre los movimientos existentes: sin configuración, sin materialización y sin reglas nuevas.

**Granularidad** (constitución II): una única user story pequeña con valor propio — consultar de un vistazo y de forma continua el total gastado personalmente en el mes, junto al saldo del mes, para decidir si caben gastos futuros. No aplica excepción de agrupación.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el gasto personal del mes junto al saldo, de forma continua (Priority: P1)

Como miembro con cuenta personal, al consultar la página de mi cuenta quiero ver de forma destacada —junto a la aportación común, el ahorro del mes y el saldo del mes— un cuarto KPI con el total de mis gastos personales del mes, de modo que antes de registrar un gasto nuevo sepa lo que llevo gastado personalmente y pueda compararlo con el saldo del mes para decidir si puedo o no llevar a cabo gastos futuros.

**Why this priority**: Es la única historia de la feature y su razón de ser: hoy, para saber lo gastado personalmente en el mes, hay que recorrer el listado sumando manualmente (filtrando mentalmente aportación y gastos comunes), y esa cifra no se puede comparar de un vistazo con el saldo del mes.

**Independent Test**: Se puede probar registrando en el mes gastos de distinta naturaleza (personales, comunes y la aportación materializada), abriendo la cuenta personal y verificando que el bloque «KPIs del mes» muestra 4 métricas con el gasto personal visible al cargar y durante todo el desplazamiento por el listado, con el importe exacto según la composición congelada y coherente con el listado y el saldo del mes.

**Acceptance Scenarios**:

1. **Given** mi cuenta personal con gastos personales, gastos de naturaleza común y aportación materializada en el mes, **When** consulto la página de mi cuenta, **Then** el bloque «KPIs del mes» muestra 4 métricas (aportación común, gasto personal, ahorro del mes y saldo del mes) y el KPI de gasto personal muestra la suma de los gastos de naturaleza propia del mes **excluida la aportación común**, coherente con los movimientos del listado.
2. **Given** un mes con un listado largo de movimientos, **When** me desplazo por el listado, **Then** las 4 métricas permanecen visibles en todo momento (visibilidad continua de 022).
3. **Given** un mes sin gastos computables como personales, **When** consulto ese mes, **Then** el KPI de gasto personal muestra 0,00 €, presente y sin errores.
4. **Given** el selector ‹ mes/año › posicionado en un mes distinto al en curso, **When** consulto la cuenta, **Then** el KPI de gasto personal muestra el valor de ese mes consultado, coherente con su listado y su cierre.
5. **Given** altas, ediciones o eliminaciones de gastos del mes, **When** vuelvo a consultar la página, **Then** el KPI se actualiza con la suma recalculada en el mismo ciclo de actualización que el resto de la página.
6. **Given** la cuenta común, **When** consulto su página, **Then** no aparece el bloque de KPIs: la página de la cuenta común no cambia.
7. **Given** un mes con ahorro deducido (023) y aportación materializada (019), **When** consulto el bloque, **Then** el KPI de gasto personal computa solo gastos registrados como movimientos (el ahorro deducido no es movimiento y no computa como gasto) y la comparación visual con el saldo del mes queda libre de dobles conteos dentro del propio KPI.

---

### Edge Cases

- **Mes sin gastos computables**: el KPI muestra 0,00 €; siempre presente, sin estado tipo «sin configurar» (no existe configuración detrás: es pura lectura).
- **Composición cerrada y única**: computan solo los gastos de naturaleza propia excluida la aportación común (FR-002); cualquier gasto del listado computa como máximo una vez en el KPI, sin dobles conteos.
- **Importes con céntimos**: la suma es exacta al céntimo, en EUR con 2 decimales, coherente con el formato existente.
- **Meses cerrados**: al ser pura lectura sobre movimientos existentes, un mes cerrado muestra su valor histórico sin recálculo ni congelación adicionales.
- **Ahorro deducido (023)**: el apartado de ahorro no es movimiento; no computa como gasto personal y no altera el KPI (el «Saldo del mes» ya es neto del ahorro).
- **Ingresos**: nunca computan en el KPI, tampoco los ingresos regulares materializados (018).
- **Comparación con el saldo**: la comparación gasto personal ↔ saldo del mes es visual, dentro del bloque; no se calcula ni muestra un «disponible restante» nuevo (fuera de alcance).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (cuarta métrica del bloque «KPIs del mes»)**: El bloque «KPIs del mes» de las cuentas personales MUST incorporar el KPI «Gasto personal» junto a la aportación común, el ahorro del mes y el saldo del mes (**4 métricas**; amend del contrato congelado de 022/023), manteniendo el comportamiento de visibilidad continua (sticky de 022) y sin incluir el selector ‹ mes/año › en el bloque. Literales y orden exactos se congelan en el ui-contract del plan.
- **FR-002 (composición e importe del KPI)**: El KPI MUST mostrar la suma de los gastos del mes consultado registrados en la cuenta personal con **naturaleza propia, excluida la aportación común** (el movimiento de aportación de 019 del mes consultado, que ya tiene KPI propio y es un traspaso a la cuenta común, no consumo personal) — decisión del propietario, 2026-10-30. Los gastos de naturaleza común no computan (quedan reflejados en la aportación neta de 021). MUST excluir los ingresos en todos los casos. MUST mostrarse siempre en cuentas personales (0,00 € si no hay gastos computables), sin estado de «sin configurar». Cada euro del listado computa como máximo en un KPI de gasto del bloque (gasto personal o aportación), sin dobles conteos.
- **FR-003 (mes consultado)**: El KPI MUST reflejar el mes seleccionado en el selector ‹ mes/año ›, con los mismos datos que el listado, el cierre y el resto de KPIs de ese mes.
- **FR-004 (coherencia por construcción)**: El importe MUST obtenerse de los mismos movimientos y reglas que alimentan las vistas existentes (listado y cierre del mes), sin recálculos paralelos ni duplicación de lógica de negocio en la UI.
- **FR-005 (lectura pura)**: La feature MUST NOT introducir configuración, disparadores de materialización ni reglas nuevas; MUST NOT alterar la semántica de 018/019/021/023 (la materialización perezosa sigue produciéndose al consultar la página de cuenta, antes de leer).
- **FR-006 (sin cambios fuera de alcance)**: La página de la cuenta común, el cierre mensual, el resumen global mensual, la cuenta de resultados anual y el balance acumulado MUST permanecer sin cambios.
- **FR-007 (actualización de la página)**: Las altas, ediciones y eliminaciones de movimientos MUST reflejarse en el KPI al reconsultar la página, en el mismo ciclo de actualización que el resto de la página.
- **FR-008 (cobertura de tests)**: La feature MUST estar cubierta por tests del bloque de KPIs (casos: mes con gastos de distinta naturaleza, mes sin gastos computables, mes consultado distinto al en curso, composición congelada sin dobles conteos) y un flujo e2e con su propia combinación cuenta/mes (convención de aislamiento e2e; constitución III) que verifique la visibilidad continua y el importe exacto.
- **FR-009 (actualización de documentación)**: Al completar la feature, el roadmap maestro MUST registrar la fila 024 como Completada y la convención del bloque KPIs de AGENTS.md MUST amendarse (3 → 4 métricas), junto con la documentación de arquitectura afectada.

### Key Entities

No se introducen entidades nuevas: el KPI es una agregación de lectura derivada de los movimientos existentes del mes consultado (tipo gasto, naturaleza y fecha) en la cuenta personal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con un listado de 50 o más movimientos, las 4 métricas del bloque son visibles al cargar la página y siguen visibles en cualquier punto del desplazamiento: 0 desplazamientos adicionales para consultar el gasto personal del mes o el saldo.
- **SC-002**: El 100 % de las comprobaciones muestra un KPI coherente: gasto personal = suma de los gastos del mes consultado según la composición congelada, coincidente con los movimientos del listado, sin dobles conteos.
- **SC-003**: El 100 % de las cuentas personales muestra el bloque con 4 métricas; la cuenta común, los agregados y el balance acumulado presentan 0 cambios.
- **SC-004**: Al cambiar el mes en el selector, el KPI muestra el mes consultado en la misma visita, sin acciones adicionales del usuario.
- **SC-005**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde, con el flujo «cuenta personal con gastos de distinta naturaleza → KPI exacto y visible al recorrer el listado → alta de un gasto actualiza el KPI» cubierto end-to-end.

## Assumptions

- **Composición (cerrada con el propietario, 2026-10-30)**: solo gastos de **naturaleza propia excluida la aportación común** — la aportación ya tiene KPI propio (es un traspaso a la cuenta común, no consumo personal) y los gastos comunes quedan reflejados en la aportación neta (021); así cada euro del listado computa como máximo en un KPI de gasto y la comparación con el saldo es significativa.
- **Etiqueta y orden**: título propuesto «Gasto personal»; orden propuesto Aportación común · Gasto personal · Ahorro del mes · Saldo del mes (grid de 4); literales y orden exactos se congelan en el ui-contract del plan.
- **Formato de importes**: EUR con 2 decimales y el formato numérico existente de la aplicación.
- **Alcance de lectura**: la feature depende de 022/023 (bloque existente) y no modifica formularios (013/014/017), menú de configuración (020) ni agregados.
- **Los e2e de la feature** operarán en su propia combinación cuenta/mes y en fichero propio, conforme a la convención de aislamiento del proyecto.

## Out of Scope

- KPI de gasto (total o personal) en la página de la cuenta común.
- Cálculo o KPI de «disponible restante», proyecciones, presupuestos o avisos de gasto.
- Desglose del gasto personal por etiqueta, por día o por miembro.
- Comparativas entre meses o histórico del KPI.
- Cambios en cierre mensual, resumen global mensual, cuenta de resultados anual o balance acumulado.
