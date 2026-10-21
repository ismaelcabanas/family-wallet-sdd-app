# Feature Specification: KPIs fijos y destacados en la página de cuenta personal

**Feature Branch**: `feature/022-kpis-fijos-cuenta`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Quiero que en la página de mi cuenta personal vea siempre, de forma destacada, dos KPIs: la aportación neta del mes a la cuenta común y el saldo del mes en curso. Ahora, con muchos movimientos, la aportación común es un movimiento más del listado y resulta difícil de localizar, y el saldo del mes exige llegar al cierre/balance."

**Fuente**: Petición del propietario (2026-10-21), registrada en el roadmap maestro como fila `022-kpis-fijos-cuenta` (nota del 2026-10-21). **Construye sobre** `018-ingresos-regulares`, `019-aportacion-comun` y `021-descuento-gastos-comunes` (completadas): el KPI de aportación muestra el importe neto resultante de 021.

**Decisiones cerradas con el propietario** (roadmap, nota 2026-10-21):

- Saldo a mostrar: **saldo del mes** (ingresos − gastos del mes consultado), no el balance acumulado.
- El KPI de aportación se muestra **siempre** en cuentas personales; sin configuración muestra «Sin aportación configurada» / 0,00 €.
- La aportación se muestra **solo como importe neto** (coherente con 021), sin desglose bruto/descuento.
- Los KPIs reflejan el **mes consultado** en el selector ‹ mes/año ›.
- Sin cambios en la cuenta común ni en los agregados.

**Granularidad** (constitución II): una única user story pequeña con valor propio — consultar de un vistazo y de forma continua la aportación neta y el saldo del mes sin recorrer el listado ni el cierre. Los dos KPIs conforman una sola necesidad de visibilidad y se entregan juntos; no aplica excepción.

## Clarifications

### Session 2026-10-21

- Q: ¿Cómo deben fijarse los KPIs para que permanezcan visibles mientras se recorre el listado? → A: Bloque KPI sticky (CSS `position: sticky`): se fija al hacer scroll y permanece visible; el selector ‹ mes/año › no se incluye en la barra sticky; el listado y el resto de la página no cambian.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar aportación neta y saldo del mes de forma continua (Priority: P1)

Como miembro con cuenta personal, al consultar la página de mi cuenta quiero ver de forma destacada dos KPIs del mes —la aportación neta a la cuenta común y el saldo del mes (ingresos − gastos)— y que ambos permanezcan a la vista mientras me desplazo por el listado de movimientos, sin tener que localizar la «Aportación Común» entre los movimientos ni llegar al cierre/balance para conocer el saldo.

**Why this priority**: Es la única historia de la feature y su razón de ser: la información clave del mes está hoy enterrada en el listado (aportación) o al final de la página (saldo), y con muchos movimientos resulta difícil de localizar.

**Independent Test**: Se puede probar configurando ingreso regular y aportación (018/019), registrando gastos comunes en el mes (021), abriendo la cuenta personal con un listado largo y verificando que ambos KPIs son visibles al cargar, siguen visibles al desplazarse por el listado, y muestran los importes exactos (aportación = importe neto vigente; saldo = ingresos − gastos del mes consultado).

**Acceptance Scenarios**:

1. **Given** mi cuenta personal con aportación configurada (019) y gastos comunes registrados en el mes (021), **When** consulto la página de mi cuenta, **Then** veo de forma destacada la aportación neta del mes y el saldo del mes, sin necesidad de desplazarme ni abrir el cierre.
2. **Given** un mes con un listado largo de movimientos, **When** me desplazo por el listado, **Then** ambos KPIs permanecen visibles en todo momento.
3. **Given** una cuenta personal sin aportación configurada, **When** consulto cualquier mes, **Then** el KPI de aportación está presente y muestra «Sin aportación configurada» con 0,00 €.
4. **Given** una aportación configurada cuyo neto del mes es cero por gastos comunes (021), **When** consulto ese mes, **Then** el KPI de aportación muestra 0,00 €, sin el mensaje de «sin configurar» (la configuración existe).
5. **Given** el selector ‹ mes/año › posicionado en un mes distinto al en curso, **When** consulto la cuenta, **Then** ambos KPIs muestran los valores de ese mes consultado (aportación neta y saldo de ese mes), coherentes con su listado y su cierre.
6. **Given** altas, ediciones o eliminaciones de movimientos del mes (p. ej. un gasto común que reduce la aportación), **When** vuelvo a consultar la página, **Then** los KPIs se actualizan con los importes recalculados, en coherencia con listado y cierre.
7. **Given** la cuenta común, **When** consulto su página, **Then** no aparece este bloque de KPIs: la página de la cuenta común no cambia.
8. **Given** un mes sin movimientos en la cuenta personal, **When** lo consulto, **Then** el saldo del mes muestra 0,00 € y la aportación su valor según configuración y regla, sin errores.

---

### Edge Cases

- **Mecanismo de fijación (clarified 2026-10-21)**: bloque KPI con CSS `position: sticky` — se fija al hacer scroll y permanece visible durante todo el listado; el selector ‹ mes/año › NO se incluye en la barra sticky; el listado y el resto de la página no cambian de layout.
- **Aportación configurada sin movimiento materializado en el mes consultado** (neto cero por 021, borrado definitivo del usuario, mes fuera de la ventana de activación o mes futuro): el KPI muestra 0,00 €, distinto del caso «sin configuración» («Sin aportación configurada»).
- **Meses cerrados**: la aportación de un mes cerrado está congelada (021); el KPI muestra su importe histórico.
- **Aportación desactivada a mitad de mes**: si el movimiento del mes en curso existe, el KPI muestra su importe neto vigente (021); si no existe, 0,00 €.
- **Composición del saldo del mes**: computa todos los movimientos del mes de la cuenta, incluida la propia aportación neta como gasto que es.
- **Importes con céntimos**: formato EUR con 2 decimales, coherente con el resto de la aplicación.
- **Saldo negativo**: se muestra tal cual (gastos > ingresos), con la convención visual de importes existente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (bloque de KPIs en cuentas personales)**: El sistema MUST mostrar en la página de cada cuenta personal un bloque destacado con dos KPIs del mes: la aportación neta a la cuenta común y el saldo del mes. El bloque MUST ser visible de forma continua mientras el usuario se desplaza por el listado de movimientos, implementado como bloque sticky (CSS `position: sticky`, sin incluir el selector ‹ mes/año › en la barra sticky).
- **FR-002 (KPI de aportación neta)**: El KPI de aportación MUST mostrarse siempre en cuentas personales con el importe neto final del mes según la regla de 021 (bruto porcentual − gastos comunes del mes, suelo 0): sin configuración de aportación MUST mostrar «Sin aportación configurada» y 0,00 €; con configuración MUST mostrar el importe neto del mes (0,00 € si no existe aportación materializada ese mes). MUST NOT mostrar desglose bruto/descuento.
- **FR-003 (KPI de saldo del mes)**: El KPI de saldo MUST mostrar el saldo del mes consultado: suma de ingresos menos suma de gastos de ese mes en la cuenta (todos sus movimientos, incluida la aportación). MUST NOT mostrarse el balance acumulado en este KPI.
- **FR-004 (mes consultado)**: Ambos KPIs MUST reflejar el mes seleccionado en el selector ‹ mes/año ›, con los mismos datos que el listado y el cierre de ese mes.
- **FR-005 (cuenta común sin cambios)**: La página de la cuenta común MUST permanecer sin cambios: sin este bloque de KPIs.
- **FR-006 (coherencia de datos)**: Los importes de los KPIs MUST obtenerse con las mismas reglas y datos que las vistas existentes (materialización de 018/019/021 y cálculo del cierre), de modo que coinciden siempre con el listado y el cierre del mes consultado.
- **FR-007 (actualización de la página)**: Las altas, ediciones y eliminaciones de movimientos MUST reflejarse en los KPIs al reconsultar la página, en el mismo ciclo de actualización que el resto de la página.
- **FR-008 (materialización intacta)**: La feature MUST NOT introducir nuevos disparadores de materialización ni alterar la semántica de 018/019/021: la materialización sigue produciéndose al consultar la página de cuenta, antes de leer los datos.
- **FR-009 (agregados sin cambios)**: Cierre mensual, resumen global mensual y cuenta de resultados anual MUST permanecer sin cambios.
- **FR-010 (cobertura de tests)**: La feature MUST estar cubierta por tests de componentes del bloque de KPIs (casos: con aportación, sin configuración, neto cero, mes consultado distinto al en curso, mes vacío) y un flujo e2e con su propia combinación cuenta/mes (convención de aislamiento e2e; constitución III) que verifique la visibilidad continua y los importes exactos.
- **FR-011 (actualización de documentación)**: Al completar la feature, el roadmap maestro MUST registrar la fila 022 como Completada y, si la implementación fija una convención de UI nueva (p. ej. la fijación de KPIs), MUST documentarse en AGENTS.md.

### Key Entities

No se introducen entidades nuevas: los KPIs son agregaciones de lectura derivadas de las entidades existentes (Movimiento y la configuración de aportación de 019 con el cálculo neto de 021) para el mes consultado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con un listado de 50 o más movimientos, ambos KPIs son visibles al cargar la página y siguen visibles en cualquier punto del desplazamiento: 0 desplazamientos adicionales para consultar la aportación neta o el saldo del mes.
- **SC-002**: El 100 % de las comprobaciones muestra KPIs coherentes: aportación neta = importe de la aportación vigente del mes (o 0,00 € / «Sin aportación configurada» según el caso) y saldo del mes = ingresos − gastos del mes consultado, coincidentes con listado y cierre.
- **SC-003**: El 100 % de las cuentas personales muestra el bloque de KPIs; la cuenta común presenta 0 cambios.
- **SC-004**: Al cambiar el mes en el selector, los KPIs muestran el mes consultado en la misma visita, sin acciones adicionales del usuario.
- **SC-005**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde, con el flujo «cuenta personal con aportación y gastos comunes → KPIs visibles y exactos al recorrer el listado → cambio de mes actualiza los KPIs» cubierto end-to-end.

## Assumptions

- **Mecanismo de fijación (clarified 2026-10-21)**: bloque KPI con CSS `position: sticky` (sin el selector ‹ mes/año › en la barra); resuelto en clarify, pendiente solo de detalle técnico en el plan.
- **Fuente del KPI de aportación (default informado)**: el importe mostrado es el neto vigente de la regla de 021 para el mes consultado; en la práctica coincide con el movimiento «Aportación Común» del mes cuando existe. Sin movimiento (neto cero, borrado definitivo, fuera de ventana o mes futuro): 0,00 € si hay configuración; «Sin aportación configurada» si no la hay.
- **Saldo del mes (decisión del propietario)**: ingresos − gastos del mes consultado, no el balance acumulado; computa todos los movimientos del mes de la cuenta, incluida la aportación.
- **Etiquetas y formato**: títulos de los KPIs en español («Aportación común», «Saldo del mes» o equivalentes a decidir en el plan); importes en EUR con 2 decimales y el formato numérico existente de la aplicación.
- **Dependencias**: 018/019/021 completadas; la feature es de lectura/UI y no modifica formularios (013/014/017), menú de configuración (020) ni agregados.
- **Los e2e de la feature** operarán en su propia combinación cuenta/mes y en fichero propio, conforme a la convención de aislamiento del proyecto.

## Out of Scope

- Cambios en la página de la cuenta común (incluidos KPIs propios de saldo).
- Desglose bruto/descuento del KPI de aportación.
- Sustituir u ocultar el balance acumulado existente o el cierre mensual.
- Nuevos KPIs adicionales (p. ej. gasto total del mes, comparativas entre meses).
- Notificaciones, recordatorios o exportación de KPIs.
- Optimización móvil específica más allá del comportamiento responsivo estándar, dark mode y animaciones.
