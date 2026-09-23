# Feature Specification: Cuenta de Resultados Anual

**Feature Branch**: `feature/009-cuenta-resultados-anual`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Feature `009-cuenta-resultados-anual` del roadmap maestro (US4, prioridad P4): consultar la cuenta de resultados anual equivalente al Excel actual «Cuenta Resultados»: por cada mes, ingresos por miembro, gasto real y saldo; desglose de gastos por tag en columnas mensuales con totales anuales, media mensual y total sin gastos personales. Segunda parte del split de la feature original `006-analisis-agregado` (nota del roadmap, 2026-09-15)."

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (historia US4; requisito FR-013 —cuenta de resultados anual—; entidad calculada "Cuenta de resultados anual"). Se apoya en el modelo y terminología de `002-registro-movimientos` (naturaleza "personal"/"compartido", multi-tag, Miembro/Cuenta/Movimiento/Tag), en el cierre mensual por cuenta de `005-cierre-mensual` (vista derivada, ADR 0009/0010) y en el resumen global mensual de `006-resumen-global-mensual` (agregación familiar, ADR 0012): la vista anual es la extensión multimes del resumen global. El balance acumulado multimes diferido por 005/006 se decide en la clarificación de esta spec (FR-012).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar la cuenta de resultados anual (Priority: P1)

Como familia, queremos ver, para el año seleccionado, la cuenta de resultados anual equivalente al Excel actual "Cuenta Resultados": por cada mes, ingresos desglosados por miembro, gasto real y saldo del mes; más un desglose de gastos por tag con un mes por columna, con totales anuales, media mensual y una fila de gasto mensual excluyendo gastos personales, para seguir la evolución del año sin mantener la hoja manualmente.

**Why this priority**: Es la vista de análisis y seguimiento anual: cierra el ciclo de las vistas derivadas (registro 002 → cierre por cuenta 005 → resumen global 006 → evolución anual) y replica el segundo Excel que hoy se mantiene a mano. Es una vista de solo lectura sobre el modelo existente, sin escrituras nuevas, que entrega valor completa por sí sola.

**Independent Test**: Se puede probar registrando movimientos de varios meses del año en las tres cuentas y comparando los totales mensuales, los totales anuales y la media mensual con el cálculo manual sobre el mismo conjunto (equivalente al Excel "Cuenta Resultados").

**Acceptance Scenarios**:

1. **Given** movimientos registrados en varios meses del año en las tres cuentas (p. ej. enero: ingresos de 2.100,00 € en la cuenta de Isma, 1.600,00 € en la de Ana y 1.920,00 € de aportaciones en la común; gastos por 3.970,00 €), **When** abro la cuenta de resultados anual de ese año, **Then** veo por enero: los ingresos desglosados por miembro (Isma 2.100,00 €, Ana 1.600,00 €) y la fila de la cuenta común (1.920,00 €), el total de ingresos 5.620,00 €, el gasto real 3.970,00 € y el saldo del mes +1.650,00 €; y cada fila muestra además su total anual y su media mensual.
2. **Given** gastos clasificados con tags a lo largo del año, **When** consulto el desglose anual por tag, **Then** veo cada tag como fila y cada mes del año como columna (Ene–Dic), con el importe de gastos de ese mes en la celda, el total anual de la tag y su media mensual, replicando la estructura actual de categorías del Excel.
3. **Given** gastos personales y compartidos mezclados (incluidos compartidos pagados desde cuentas personales), **When** consulto las filas de totales mensuales, **Then** obtengo tanto el gasto mensual total (gasto real) como el gasto mensual excluyendo gastos personales (solo los de naturaleza compartido).
4. **Given** un gasto con varias tags (p. ej. 850,00 € con "vivienda" + "hipoteca" en marzo), **When** consulto el desglose por tag, **Then** el gasto computa en la celda de marzo de cada una de sus tags sin duplicar el gasto real de marzo.
5. **Given** un mes del año sin movimientos, **When** abro la vista anual, **Then** ese mes figura con importes a 0,00 € (celdas en cero o vacías según diseño) sin romper la tabla; un año entero sin movimientos muestra la estructura completa a ceros, sin errores.
6. **Given** el año con datos, **When** comparo cualquier mes de la vista anual con el resumen global mensual (`006`) del mismo mes, **Then** las cifras coinciden al céntimo (total de ingresos, total de gastos, gastos compartidos y saldo del mes).

### Edge Cases

- Mes sin movimientos: cero en todas sus celdas; el resto del año no se ve afectado (escenario 5 de US1).
- Año sin movimientos o año futuro seleccionado: se comporta como un año vacío — estructura completa (12 meses, filas de miembros del catálogo) a ceros, sin errores (misma regla que 005/006 con meses vacíos).
- Gasto multi-tag: computa en cada una de sus tags en el mes correspondiente sin duplicar el gasto real mensual ni el total anual (escenario 4 de US1; regla de 005/006).
- Gastos compartidos pagados desde cuentas personales: computan como compartidos en la fila "sin gastos personales" (la naturaleza la marca el gasto, no la cuenta; semántica de 002/005/006).
- Ingresos de la cuenta común (p. ej. aportaciones): no se atribuyen a ningún miembro; figuran en la fila de la cuenta común (misma convención de atribución que el desglose por miembro de 006).
- Miembros homónimos y varias cuentas personales del mismo miembro: una única fila por identidad de miembro (agrupación por `memberId`, decisión de 006); los meses sin ingresos de un miembro figuran a cero.
- Movimientos fechados en años contiguos (p. ej. diciembre 2025 o enero 2027 consultando 2026): no computan en el año consultado.
- ¿Computan los ingresos en el desglose por tag? (No: el desglose es de gastos, como en 005/006; los ingresos solo aparecen desglosados por miembro en la tabla mensual).
- Media mensual con año en curso o incompleto: se calcula igualmente como total anual / 12 (réplica del Excel, ver Assumptions).
- Aritmética monetaria: cálculos en céntimos enteros sin coma flotante (ADR 0007); totales mensuales, anuales y medias exactos al céntimo, sin desviaciones de redondeo.
- Rendimiento: la vista anual de un año con hasta 12 × 300 movimientos se visualiza en menos de 3 segundos (extensión de SC-004 del maestro al ámbito anual).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar, para el año seleccionado mediante un selector de año, la cuenta de resultados anual en ámbito familiar: agrega todas las cuentas (como el resumen global de 006) y se recalcula al cambiar de año. La selección de años ofrecida y la ubicación/ruta de la vista se deciden en el plan.
- **FR-002**: El sistema MUST mostrar la tabla mensual del año con una columna por cada uno de los 12 meses (Ene–Dic) y una fila por: cada miembro del catálogo (ingresos registrados en sus cuentas personales), la cuenta común (ingresos registrados en la cuenta común, sin atribución a miembro), total de ingresos, gasto real (total de gastos del mes), gasto sin gastos personales (solo gastos de naturaleza compartido, incluidos los pagados desde cuentas personales) y saldo del mes (ingresos − gastos, con signo). La atribución de ingresos sigue al dueño de la cuenta donde se registran (convención de 006).
- **FR-003**: Cada fila de la tabla mensual MUST mostrar su total anual (suma de los 12 meses) y su media mensual (total anual / 12).
- **FR-004**: El sistema MUST mostrar el desglose anual de gastos por tag: una fila por tag con gastos en el año, una columna por mes (Ene–Dic) con el importe de gastos de ese tag en ese mes, columna de total anual y media mensual por tag. Un gasto con varias tags computa en cada una de sus tags sin duplicar el gasto real mensual ni el total anual. Orden por total anual descendente, con desempate alfabético (convención de 005/006).
- **FR-005**: El desglose por tag MUST incluir filas de totales mensuales con el gasto real de cada mes y el gasto mensual sin gastos personales (excluyendo los de naturaleza personal), replicando las filas de total del Excel actual.
- **FR-006**: Las cifras de cada mes de la vista anual MUST coincidir al céntimo con el resumen global mensual de 006 del mismo mes (total de ingresos, total de gastos, gastos compartidos, gastos personales y saldo): la cuenta de resultados anual es la extensión multimes del resumen global, con las mismas reglas de agregación.
- **FR-007**: Los meses sin movimientos MUST presentarse con importes a cero sin romper la estructura; un año sin movimientos MUST mostrar la vista completa a ceros, sin errores.
- **FR-008**: La vista MUST ser una vista derivada de los movimientos (extensión del ADR 0009): no se persisten totales ni desgloses; se recalculan a partir de los movimientos existentes en cada consulta. No hay persistencia nueva ni migraciones de esquema en esta feature.
- **FR-009**: Todos los cálculos MUST realizarse con aritmética exacta en céntimos enteros (sin coma flotante) y mostrarse en formato español EUR con dos decimales (Intl es-ES), reutilizando las convenciones de formateo existentes.
- **FR-010**: La interfaz MUST estar en español, con etiquetas equivalentes a las del Excel "Cuenta Resultados" (Ingresos por miembro, Gasto real, Saldo, Sin gastos personales, Media mensual, Total año).
- **FR-011**: El sistema MUST presentar la cuenta de resultados anual de un año con hasta 12 × 300 movimientos en menos de 3 segundos, sin cargar más años de los necesarios.
- **FR-012**: La vista anual MUST incluir el balance acumulado multimes diferido por 005/006 en la forma [NEEDS CLARIFICATION: ¿saldo acumulado global de la familia por mes (ámbito familiar, como el resto de la vista), balance acumulado por cuenta (una fila por cuenta, literal del diferido de US2), o excluirlo de esta feature?].

### Key Entities *(include if feature involves data)*

- **Cuenta de resultados anual**: Agregación CALCULADA por año (no se persiste): tabla mensual (ingresos por miembro y cuenta común, gasto real, gasto sin gastos personales, saldo del mes), totales anuales, medias mensuales y desglose de gastos por tag y mes. Deriva de los movimientos del año de todas las cuentas (coherente con los cierres por cuenta de 005 y los resúmenes globales de 006). No se crean entidades nuevas: Miembro, Cuenta, Movimiento y Tag se reutilizan tal cual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los totales mensuales, anuales y las medias de la cuenta de resultados anual reproducen con desviación cero los valores del Excel "Cuenta Resultados" calculados manualmente sobre el mismo conjunto de movimientos (extensión de SC-002 del roadmap maestro al ámbito anual).
- **SC-002**: La vista anual de un año con hasta 12 × 300 movimientos se visualiza en menos de 3 segundos (extensión de SC-004 del roadmap maestro al ámbito anual).
- **SC-003**: Cada mes de la vista anual coincide exactamente, al céntimo, con el resumen global mensual de 006 del mismo mes, verificable en cualquier mes con datos.

## Assumptions

- Terminología alineada con 002/005/006: la naturaleza "propio/común" del maestro se muestra como "personal"/"compartido"; "gasto real" es el total de gastos del mes (ambas naturalezas) y "sin gastos personales" equivale a los gastos compartidos (incluidos los pagados desde cuentas personales), etiquetados como en el Excel.
- La media mensual se calcula como total anual / 12 aunque el año esté en curso o incompleto, replicando el comportamiento del Excel actual (12 columnas); no se divide por meses con datos.
- La tabla mensual muestra una fila por cada miembro del catálogo (aunque un mes concreto esté a cero) más la fila de la cuenta común, replicando las columnas "Sueldo 1/Sueldo 2" del Excel; los miembros se agrupan por identidad (`memberId`), no por nombre (decisión de 006).
- La vista reutiliza el patrón de ruta propia de 006 (ámbito familiar); la ruta concreta, el selector de año y la presentación de celdas vacías (0,00 € o celda vacía) se deciden en el plan.
- Reutilización del dominio y la aplicación existentes (`Money`, `MonthlyClosure`, `GlobalMonthlySummary`); se prevé un caso de uso de cuenta de resultados anual sobre los puertos de lectura existentes (p. ej. `listByMonth`). Como en 005/006, es una proyección de solo lectura: sin escrituras ni migraciones.
- Los KPIs se calculan en la capa de aplicación/servidor; la UI solo formatea (principio VII).
- El plan valora un e2e de consulta de la vista anual, en línea con los de 005/006 (constitución III); al no haber flujo de escritura nuevo, no hay flujo crítico adicional obligatorio.
- Moneda única EUR con dos decimales; formato español Intl es-ES (helpers existentes).
- Edición/eliminación de movimientos (003) ya garantiza el recálculo de vistas derivadas; esta feature no añade lógica de invalidación especial.

## Out of Scope

- Cuadre mensual con declaración de saldos reales por cuenta y descuadres (feature `010-cuadre-mensual`).
- Gestión del catálogo de tags (feature `004-gestion-tags`), filtrado y búsqueda de movimientos (`007-filtrado-busqueda`), gestión de cuentas y miembros (`008-gestion-cuentas-miembros`).
- Exportación de la vista anual (PDF, CSV) o impresión.
- Comparativas entre años, proyecciones y presupuestos (diferido, decisión del usuario en el maestro).
- Registro de usuarios, login y multiusuario; importación de histórico desde Excel, metas de ahorro e integración bancaria.
