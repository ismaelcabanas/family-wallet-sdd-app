# Feature Specification: KPI de ahorro acumulado del año en la página de cuenta personal

**Feature Branch**: `feature/035-kpi-ahorro-anual`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Actualmente, cuando el usuario entra en su cuenta para ver o añadir los gastos, se muestran 4 KPIs. Me interesa que el usuario pueda ver el ahorro acumulado en el año, que básicamente es el balance del saldo del mes."

**Fuente**: Petición del propietario (2026-11-21), registrada en el roadmap maestro como fila `035-kpi-ahorro-anual` (nota del 2026-11-21). **Construye sobre** `022-kpis-fijos-cuenta` (amendada por 023/024/033): el bloque «KPIs del mes» de las cuentas personales pasa de 4 a 5 métricas. El nuevo KPI es una **agregación de lectura pura** sobre los cierres mensuales existentes: sin configuración, sin materialización y sin reglas nuevas. No revive el «balance acumulado» histórico retirado por 025: el alcance es el **año natural del mes consultado** y solo en cuentas personales.

**Granularidad** (constitución II): una única user story pequeña con valor propio — consultar de un vistazo y de forma continua el ahorro acumulado del año (la suma de los saldos de sus meses) mientras se opera en la cuenta. No aplica excepción de agrupación.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el ahorro acumulado del año junto a los KPIs del mes (Priority: P1)

Como miembro con cuenta personal, al consultar la página de mi cuenta quiero ver de forma destacada —junto a la aportación común, el gasto personal, el ahorro del mes y el saldo del mes— un quinto KPI con el ahorro acumulado del año, es decir, la suma de los saldos de los meses del año, de modo que sepa cuánto llevo ahorrado en el año sin recorrer mes a mes con el selector ‹ mes/año › ni sumar a mano.

**Why this priority**: Es la única historia de la feature y su razón de ser: hoy el «Saldo del mes» solo ofrece la foto del mes consultado; conocer lo acumulado en el año exige visitar cada mes con el stepper y sumar manualmente.

**Independent Test**: Se puede probar registrando en varios meses del año movimientos que dejen saldos mensuales variados (positivos y negativos), abriendo la cuenta personal en cualquier mes del año y verificando que el bloque «KPIs del mes» muestra 5 métricas con el acumulado visible al cargar y durante todo el desplazamiento, igual a la suma de los «Saldo del mes» de cada mes del año.

**Acceptance Scenarios**:

1. **Given** varios meses del año de mi cuenta personal con saldo (positivos y negativos), **When** consulto cualquier mes de ese año, **Then** el bloque «KPIs del mes» muestra 5 métricas (aportación común, gasto personal, ahorro del mes, saldo del mes y ahorro acumulado) y el KPI de ahorro acumulado muestra la **suma con signo de los «Saldo del mes» de los meses del año**, coherente con lo que muestra cada mes al visitarlo.
2. **Given** un mes con un listado largo de movimientos, **When** me desplazo por el listado, **Then** las 5 métricas permanecen visibles en todo momento (visibilidad continua de 022).
3. **Given** el selector ‹ mes/año › posicionado en un mes de otro año (p. ej. 2025), **When** consulto la cuenta, **Then** el KPI de ahorro acumulado refleja el año 2025 completo, coherente con los saldos mensuales de ese año.
4. **Given** dos meses distintos del mismo año, **When** navego entre ellos con el selector, **Then** el ahorro acumulado permanece estable (depende del año consultado, no del mes).
5. **Given** un año sin movimientos en la cuenta, **When** consulto cualquier mes de ese año, **Then** el KPI de ahorro acumulado muestra 0,00 €, presente y sin errores.
6. **Given** altas, ediciones o eliminaciones de movimientos de cualquier mes del año, **When** vuelvo a consultar la página, **Then** el KPI se actualiza en el mismo ciclo de actualización que el resto de la página.
7. **Given** la cuenta común, **When** consulto su página, **Then** no aparece el bloque de KPIs: la página de la cuenta común no cambia.

---

### Edge Cases

- **Año sin datos**: el KPI muestra 0,00 €; siempre presente, sin estado tipo «sin configurar» (no existe configuración detrás: es pura lectura).
- **Saldos mensuales negativos**: acumulan con signo; un mes negativo reduce el total y el acumulado puede ser negativo (formato existente para importes negativos).
- **Mes en curso**: computa como esté (parcial), exactamente igual que su «Saldo del mes» visible.
- **Meses futuros del año**: la suma cubre el año natural completo; los meses sin movimientos computan 0 de facto. Un movimiento fechado a futuro dentro del año computa en su mes (regla general de la aplicación).
- **Meses nunca visitados**: el acumulado computa con los movimientos registrados, sin forzar materializaciones (paridad con los agregados anuales existentes); la materialización perezosa de 018/019/021/033 sigue disparándose solo al visitar cada mes con el selector.
- **Ahorro deducido legacy (fila congelada sin movimiento, pre-033)**: cada mes descuenta su ahorro según la composición condicional del «Saldo del mes» (033); el acumulado usa exactamente la misma fórmula aplicada mes a mes, sin recálculos propios.
- **Doble semántica de «ahorro»**: «Ahorro del mes» (deducción porcentual de 023/033) y «Ahorro acumulado» (suma de saldos) son conceptos distintos con literales distintos; la UI no los mezcla ni deriva uno del otro.
- **Importes con céntimos**: la suma es exacta al céntimo, en EUR con 2 decimales, coherente con el formato existente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (quinta métrica del bloque «KPIs del mes»)**: El bloque «KPIs del mes» de las cuentas personales MUST incorporar el KPI «Ahorro acumulado» junto a la aportación común, el gasto personal, el ahorro del mes y el saldo del mes (**5 métricas**; amend del contrato congelado de 022/023/024), manteniendo el comportamiento de visibilidad continua (sticky de 022) y sin incluir el selector ‹ mes/año › en el bloque. El año de referencia MUST ser evidente para el usuario. Literales, orden y layout de las 5 métricas se congelan en el ui-contract del plan.
- **FR-002 (composición e importe del KPI)**: El KPI MUST mostrar la **suma con signo de los «Saldo del mes» de todos los meses del año natural de referencia** de la cuenta personal, aplicando mes a mes exactamente la misma definición que el KPI «Saldo del mes» visible (incluida la composición condicional del ahorro de 033). Suma exacta al céntimo; cada mes computa como máximo una vez.
- **FR-003 (año de referencia)**: El año de referencia MUST ser el año del mes seleccionado en el selector ‹ mes/año ›, cubriendo el año natural completo (los meses sin datos computan 0). El valor MUST ser estable al navegar entre meses del mismo año y MUST cambiar al navegar a un mes de otro año en la misma visita.
- **FR-004 (coherencia por construcción)**: El importe MUST obtenerse de las mismas reglas y lecturas que alimentan los KPIs del mes existentes, sin recálculos paralelos ni duplicación de lógica de negocio en la UI.
- **FR-005 (lectura pura)**: La feature MUST NOT introducir configuración, disparadores de materialización ni reglas nuevas; MUST NOT alterar la semántica de 018–034 (los meses no visitados computan con los movimientos registrados, en paridad con los agregados anuales existentes).
- **FR-006 (sin cambios fuera de alcance)**: La página de la cuenta común, el resumen global mensual, la cuenta de resultados anual, el informe anual de gastos, los formularios y el catálogo de etiquetas MUST permanecer sin cambios.
- **FR-007 (actualización de la página)**: Las altas, ediciones y eliminaciones de movimientos de cualquier mes del año MUST reflejarse en el KPI al reconsultar la página, en el mismo ciclo de actualización que el resto de la página.
- **FR-008 (cobertura de tests)**: La feature MUST estar cubierta por tests del bloque de KPIs (casos: año con saldos mixtos, año vacío, navegación entre años, estabilidad dentro del mismo año, coherencia de la suma con la composición condicional de 033) y un flujo e2e con su propia combinación cuenta/mes (convención de aislamiento e2e; constitución III) que verifique la visibilidad continua y el importe exacto.
- **FR-009 (actualización de documentación)**: Al completar la feature, el roadmap maestro MUST registrar la fila 035 como Completada y la convención del bloque KPIs de AGENTS.md MUST amendarse (4 → 5 métricas), junto con la documentación de arquitectura afectada.

### Key Entities

No se introducen entidades nuevas: el KPI es una agregación de lectura derivada de los cierres mensuales del año natural en la cuenta personal (misma fuente que compone el «Saldo del mes»).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con un listado de 50 o más movimientos, las 5 métricas del bloque son visibles al cargar la página y siguen visibles en cualquier punto del desplazamiento: 0 desplazamientos adicionales para conocer el ahorro acumulado del año.
- **SC-002**: El 100 % de las comprobaciones muestra un KPI coherente: ahorro acumulado = suma de los «Saldo del mes» de los meses del año consultado, verificable visitando cada mes del año con el selector, sin dobles conteos.
- **SC-003**: El 100 % de las cuentas personales muestra el bloque con 5 métricas; la cuenta común, los agregados y el informe anual presentan 0 cambios.
- **SC-004**: Al cambiar de año en el selector (mes de otro año), el KPI muestra el acumulado del año correcto en la misma visita, sin acciones adicionales del usuario.
- **SC-005**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde, con el flujo «cuenta personal con saldos en varios meses del año → acumulado exacto y visible al recorrer el listado → alta en otro mes del año actualiza el acumulado» cubierto end-to-end.

## Assumptions

- **Definición (cerrada con la petición del propietario, 2026-11-21)**: ahorro acumulado del año = **suma con signo de los «Saldo del mes»** de los meses del año natural (el saldo ya es neto de aportaciones y ahorro según la composición vigente); no se computa ningún importe aparte del saldo mensual.
- **Etiqueta y orden**: título propuesto «Ahorro acumulado», distinto del «Ahorro del mes» de 023/033 para no confundir conceptos; literales, orden y layout de las 5 métricas (y la forma de hacer evidente el año de referencia) se congelan en el ui-contract del plan.
- **Año natural completo**: el acumulado cubre de enero a diciembre del año del mes consultado, no «desde el inicio de los datos» ni rangos personalizados; meses vacíos computan 0.
- **Alcance de cuentas**: solo cuentas personales (el bloque «KPIs del mes» existe solo en ellas, 022).
- **Lectura pura**: la feature depende del bloque existente (022–024, 033) y no fuerza la materialización de meses no visitados (paridad con la decisión del propietario 2026-10-12 sobre agregados).
- **Formato de importes**: EUR con 2 decimales y el formato numérico existente de la aplicación.
- **Los e2e de la feature** operarán en su propia combinación cuenta/mes y en fichero propio, conforme a la convención de aislamiento del proyecto.

## Out of Scope

- KPI de ahorro acumulado en la página de la cuenta común.
- Acumulado desde el inicio de los datos, multi-año o por rango personalizado.
- Desglose mensual del acumulado, histórico por años, gráficos o evolución.
- Media mensual, proyecciones, metas de ahorro o avisos.
- Restaurar el balance acumulado histórico por cuenta retirado por 025.
- Cambios en el resumen global mensual, la cuenta de resultados anual o el informe anual de gastos.
