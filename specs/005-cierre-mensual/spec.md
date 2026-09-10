# Feature Specification: Cierre Mensual por Cuenta

**Feature Branch**: `feature/005-cierre-mensual`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "Feature `005-cierre-mensual` del roadmap maestro (US2, prioridad P2): consultar el cierre mensual por cuenta con los KPIs equivalentes al Excel de Balance — total de ingresos, gastos compartidos, gastos personales, saldo del mes, balance acumulado y desglose de gastos por tag — para cerrar el mes de cada cuenta sin cálculos manuales."

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (historia US2; requisito FR-006 del maestro —cierre mensual con KPIs—; entidad calculada "Cierre mensual"). Se apoya íntegramente en el modelo de datos y la terminología construidos en `002-registro-movimientos` (naturaleza "personal"/"compartido", mínimo una tag por movimiento con "Sin Clasificar" por defecto, balance derivado de los movimientos —ADR 0009—).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el cierre mensual por cuenta (Priority: P1)

Como miembro de la familia, quiero ver, para el mes y la cuenta seleccionados, un resumen de cierre mensual que recoja: total de ingresos, total de gastos compartidos, total de gastos personales, saldo del mes (ingresos − gastos) y desglose de gastos por tag, para cerrar el mes de cada cuenta sin hacer los cálculos manuales que hoy hago en el Excel de Balance.

**Why this priority**: Es el primer output de valor del sistema: replica los KPIs que hoy se calculan manualmente (Balance, Gastos Comunes, Gastos Personales) sobre los datos ya registrados con la feature 002. Es una feature de solo lectura sobre el modelo existente, sin nuevas escrituras.

**Independent Test**: Se puede probar registrando un mes completo de movimientos en una cuenta y comparando cada KPI del cierre con el cálculo manual sobre el mismo conjunto de movimientos (equivalente al Excel de Balance).

**Acceptance Scenarios**:

1. **Given** un mes con movimientos registrados en la cuenta común (p. ej. un ingreso de 1.920,00 € de aportación y gastos de 850,00 € "Hipoteca" con tags Vivienda+Hipoteca y 120,50 € "Luz" con tag Hogar), **When** abro el cierre de ese mes y esa cuenta, **Then** veo total de ingresos 1.920,00 €, total de gastos 970,50 € (todo compartido: 970,50 € compartidos, 0,00 € personales), saldo del mes +949,50 € y el desglose por tag: Vivienda 850,00 €, Hipoteca 850,00 €, Hogar 120,50 €.
2. **Given** movimientos con gastos de ambas naturalezas en una cuenta personal (gastos "personal" y gastos "compartido" pagados desde ella), **When** abro el cierre de ese mes y cuenta, **Then** los totales de gastos compartidos y personales reflejan la naturaleza de cada gasto con independencia de la cuenta desde la que se pagó (los comunes pagados desde cuenta personal computan como compartidos).
3. **Given** un mes sin movimientos en una cuenta que sí tiene movimientos en meses anteriores, **When** abro su cierre, **Then** veo todos los KPIs a cero (totales, saldo del mes 0,00 €) y el desglose por tag vacío, sin errores.
4. **Given** el cierre mensual de una cuenta, **When** cambio la cuenta o el mes en los selectores, **Then** todos los KPIs y el desglose por tag se recalculan para la nueva cuenta/mes.
5. **Given** un gasto con varias tags (p. ej. 850,00 € con Vivienda+Hipoteca), **When** consulto el desglose de gastos por tag, **Then** el gasto computa en cada una de sus tags (Vivienda 850,00 € e Hipoteca 850,00 €) sin duplicar el total de gastos del mes (970,50 € en el escenario 1, no 1.820,50 €).
6. **Given** un movimiento fechado en un mes posterior al consultado, **When** abro el cierre de un mes anterior, **Then** ese movimiento no computa en ningún KPI ni en el desglose del cierre de ese mes anterior.

### Edge Cases

- Mes sin movimientos: cubierto por el escenario de aceptación 3 (totales a cero, desglose vacío).
- Gasto con varias tags en el desglose: cubierto por el escenario de aceptación 5 (computa en cada tag; el total de gastos no se duplica).
- ¿Computan los ingresos en el desglose por tag? (No: el desglose es de gastos; los ingresos solo aparecen como total de ingresos del mes).
- ¿Qué ocurre con un mes futuro seleccionado en el selector? (Si está vacío, se comporta como mes sin movimientos: todos los KPIs a cero; si ya tiene movimientos registrados por adelantado, el cierre los muestra con normalidad).
- ¿Se incluyen las tags desactivadas en el desglose? (Sí, si un movimiento histórico las lleva: el desglose refleja las tags reales de los movimientos del mes; en esta feature todas las tags del catálogo están activas).
- ¿Dónde queda la tag "Sin Clasificar"? (Como una tag más del desglose: todo movimiento lleva al menos una tag —FR-006 de 002—, por lo que todo gasto computa en el desglose).
- Aritmética monetaria: cálculos en céntimos enteros sin coma flotante (ADR 0007); el cuadre de los KPIs contra el cálculo manual debe ser exacto, sin desviaciones de redondeo.
- Rendimiento: el cierre de un mes con hasta 300 movimientos debe visualizarse en menos de 3 segundos (SC-004 del maestro).

## Clarifications

### Session 2026-09-10

- Q: ¿Cómo distinguir el balance acumulado del cierre del balance histórico de la cabecera? → A: El cierre mensual no muestra balance acumulado: se centra en el mes seleccionado (ingresos, gastos, gastos por naturaleza, saldo del mes y desglose por tag). El balance acumulado multimes se pospone a la cuenta de resultados anual (feature 006); el único balance visible sigue siendo el de la cabecera (histórico completo, 002), sin cambios.
- Q: En el desglose de gastos por tag, ¿qué mostramos junto al nombre de cada tag además del importe? → A: Solo el importe total por tag, ordenado de mayor a menor; sin porcentajes ni recuentos (replica el Excel de Balance).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar, para el mes y la cuenta seleccionados en los selectores existentes de la pantalla principal, un panel de cierre mensual con los KPIs: total de ingresos del mes, total de gastos del mes, desglose de gastos por naturaleza (compartidos y personales) y saldo del mes (ingresos − gastos).
- **FR-002**: El sistema MUST calcular el total de ingresos del mes como la suma de los importes de los movimientos de tipo ingreso de esa cuenta fechados en el mes, y el total de gastos como la suma de los de tipo gasto.
- **FR-003**: El sistema MUST desglosar los gastos del mes de la cuenta seleccionada por naturaleza según el campo naturaleza de cada gasto ("personal"/"compartido"): la naturaleza la marca el gasto, no el tipo de cuenta que lo paga (un gasto compartido pagado desde una cuenta personal computa como compartido en el cierre de esa cuenta personal). Los ingresos no se desglosan por naturaleza y el cierre nunca agrega movimientos de otras cuentas (el resumen global llega con la feature 006).
- **FR-004**: El sistema MUST calcular el saldo del mes como ingresos del mes menos gastos del mes, y mostrarlo con signo (positivo, negativo o cero).
- **FR-005**: El cierre mensual MUST limitarse al mes seleccionado: no muestra balance acumulado (ni a cierre de mes ni multimes); el balance acumulado llega con la cuenta de resultados anual (feature 006). El único balance visible en la pantalla sigue siendo el de la cabecera (histórico completo, FR-008 de 002), sin cambios.
- **FR-006**: El sistema MUST mostrar el desglose de gastos del mes por tag: cada tag con el importe total de los gastos del mes que la llevan —solo el importe, sin porcentajes ni recuentos—, ordenado de mayor a menor importe. Un gasto con varias tags computa en cada una de ellas; el total de gastos del mes (FR-002) no se ve afectado por la multi-etiquetación.
- **FR-007**: Todos los cálculos del cierre MUST realizarse con aritmética exacta en céntimos enteros (sin coma flotante) y mostrarse en formato español EUR con dos decimales (Intl es-ES), reutilizando las convenciones de formateo de la feature 002.
- **FR-008**: El cierre mensual MUST actualizarse al cambiar la cuenta o el mes en los selectores, en la misma pantalla y sin navegación adicional.
- **FR-009**: El cierre MUST ser una vista derivada de los movimientos: no se persisten totales ni se crean nuevas tablas; los KPIs se recalculan a partir de los movimientos existentes en cada consulta (extensión del principio "balance derivado, no persistido" del ADR 0009 a todo el cierre).
- **FR-010**: La interfaz del cierre MUST estar en español, con las etiquetas de KPIs equivalentes a las del Excel de Balance: Ingresos, Gastos, Gastos compartidos, Gastos personales, Saldo del mes y Desglose por tag.
- **FR-011**: El sistema MUST presentar el cierre de un mes con hasta 300 movimientos en menos de 3 segundos, con cálculo eficiente sobre los movimientos del mes seleccionado, sin cargar la historia completa de la cuenta.

### Key Entities *(include if feature involves data)*

- **Cierre mensual**: Agregación CALCULADA por cuenta y mes (no se persiste): total de ingresos, total de gastos, gastos compartidos, gastos personales, saldo del mes y desglose de gastos por tag. Deriva por completo de los movimientos del mes (Miembro, Cuenta, Movimiento y Tag no cambian: se reutilizan las entidades de 002 tal cual).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los KPIs del cierre mensual de cualquier cuenta/mes coinciden al 100% (desviación cero, céntimo a céntimo) con los calculados manualmente sobre el mismo conjunto de movimientos (SC-002 del roadmap maestro).
- **SC-002**: El cierre de un mes con hasta 300 movimientos se visualiza en menos de 3 segundos (SC-004 del roadmap maestro).
- **SC-003**: El cambio de cuenta o mes en los selectores recalcula y presenta el nuevo cierre sin recargar la página ni navegar a otra pantalla.
- **SC-004**: Los gastos con varias tags computan en cada una de sus tags en el desglose sin alterar el total de gastos del mes (verificable con un gasto multi-etiquetado).

## Assumptions

- El cierre se presenta como un panel de KPIs integrado en la pantalla principal existente, asociado a los selectores de cuenta y mes ya construidos en 002 (FR-017 de 002); no se crea una ruta ni pantalla nueva. La disposición concreta (posición respecto a listado y formulario) se decide en el plan.
- El cierre mensual no muestra balance acumulado: se centra exclusivamente en el mes seleccionado. Desviación deliberada de la US2 del roadmap maestro (que incluía el "balance acumulado de la cuenta" entre los KPIs del cierre): el balance acumulado multimes llega con la cuenta de resultados anual (feature 006). El único balance visible sigue siendo el de la cabecera (histórico completo, FR-008 de 002), sin cambios.
- Terminología alineada con 002: la naturaleza del roadmap "propio/común" se muestra como "personal"/"compartido" (decisión de clarificación de 002); los KPIs del Excel "Gastos Comunes/Gastos Personales" se etiquetan "Gastos compartidos/Gastos personales".
- El desglose por tag usa el nombre de la tag tal cual figura en el catálogo (p. ej. "Sin Clasificar"); no se agrupa ni fusiona tags.
- Los KPIs se calculan en la capa de aplicación/servidor mediante agregación (SQL o recuento sobre repositorio); la UI solo formatea, nunca calcula (principio VII: PROHIBIDO duplicar lógica de negocio en componentes).
- No se incluye la comprobación de cuadre con saldo real ni resumen global agregado (feature 006), ni cuenta de resultados anual (feature 006), ni edición/eliminación de movimientos (feature 003), ni gestión del catálogo de tags (feature 004).
- No se persiste ningún dato nuevo: el cierre es una proyección de solo lectura del modelo de 002; no hay migraciones de esquema en esta feature.
- Moneda única EUR con dos decimales; formato español Intl es-ES (reutiliza el helper de formateo de 002).
- Al no existir aún edición/eliminación (feature 003), los cierres se recalculan automáticamente con cada nuevo registro mediante la revalidación existente.

## Out of Scope

- Resumen mensual global agregado de todas las cuentas y comprobación de cuadre con saldo real (feature 006).
- Balance acumulado multimes o a cierre de mes en el panel de cierre (llega con la cuenta de resultados anual, feature 006).
- Cuenta de resultados anual con columnas mensuales y medias (feature 006).
- Desglose por miembro (llega con el resumen global de la feature 006).
- Edición y eliminación de movimientos con recálculo (feature 003).
- Gestión del catálogo de tags: crear, renombrar, fusionar, desactivar (feature 004).
- Exportación del cierre (PDF, CSV) o impresión.
- Registro de usuarios, login y multiusuario.
- Importación de histórico desde Excel, presupuestos, metas de ahorro, proyecciones e integración bancaria.
