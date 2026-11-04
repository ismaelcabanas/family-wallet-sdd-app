# Feature Specification: Informe anual de gastos por categorías

**Feature Branch**: `feature/015-informe-anual-gastos`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Quiero realizar el informe anual de los gastos por mes."

**Fuente**: Feature `015-anual-agrupada` reservada en el roadmap (2026-09-27) como «cuenta de resultados anual con filas agrupadas por grupos genéricos fijos», que la nota de `026-categorias-tags` (2026-11-02) anticipaba «previsiblemente absorbida por las categorías reales de 026». Replanteada por el propietario (2026-11-04) desde cero: no es un cambio de `/annual` sino un **informe nuevo** de gastos, con las categorías reales de 026 como nivel de agrupación, accesible desde un menú nuevo «Informes» de la navegación global.

**Decisiones del propietario (2026-11-04)**:

- **Informe nuevo, ideado desde cero**: sin ataduras con la página `/annual` existente (009), que permanece invariable; comparte solo la fuente de datos (movimientos).
- **Filas = categorías, sin expansión**: una fila por categoría con el rollup de los gastos de sus etiquetas (la categoría agrupa, la etiqueta clasifica — jerarquía de 026/027). **Todas las categorías** aparecen como fila, aunque no tengan gastos en el año.
- **Columnas = 12 meses fijos + «Media anual»**: enero a diciembre siempre visibles (0,00 € en meses sin gastos) y una columna final con la media anual de cada fila, calculada como **total ÷ 12** (aunque el año esté en curso o haya meses vacíos).
- **Dos filas finales de totales**: «Gasto mensual» (total de gastos del mes, mismas exclusiones que el informe) y **total de gastos personales** (gastos de naturaleza propia registrados en las cuentas de los miembros); ambas con su media anual en la columna final.
- **Computan todos los gastos de todas las cuentas** (personales y común) y ambas naturalezas (propia y común), **excluida la aportación común** (019/021): los gastos con la etiqueta protegida «Aportación Común» no se tienen en cuenta.
- **Selector de año**: el informe consulta el año seleccionado, con el año actual por defecto.
- **Acceso desde un menú nuevo «Informes»** en la navegación global, que contiene **solo este informe** de momento; «Resumen» y «Cuenta de resultados» siguen siendo enlaces directos sin cambios.
- **Informe de aportaciones diferido**: un informe similar de las aportaciones a la cuenta común de cada miembro por mes podría ser interesante, pero se anota como feature futura (no forma parte de esta).

**Granularidad** (constitución II): una única user story pequeña: consultar el informe anual de gastos por mes agrupado por categorías. La tabla, el selector de año y el menú «Informes» no tienen valor por separado: juntos entregan una única vista de análisis. No aplica excepción.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el informe anual de gastos por mes y categoría (Priority: P1)

Como propietario de la aplicación, quiero un informe anual donde cada fila sea una categoría (sumando los gastos de sus etiquetas) y cada columna un mes del año, con una media anual por fila y dos filas finales de totales («Gasto mensual» y total de gastos personales), consultable por año desde la navegación global — para ver de un vistazo cómo se reparte y evoluciona el gasto familiar a lo largo del año sin cruzar los desgloses por etiqueta.

**Why this priority**: Es la única historia de la feature: da la visión anual de gasto por categoría que hoy exige cruzar manualmente el desglose por etiqueta de `/annual`, al nivel de agrupación correcto (el de las categorías creadas en 026).

**Independent Test**: Se puede probar registrando gastos de varias categorías en varios meses y cuentas, abriendo el informe desde el menú «Informes» y verificando que cada fila suma los gastos de sus etiquetas por mes, que las medias dividen por 12 y que las filas finales cuadran con el total de gastos y el total de gastos personales.

**Acceptance Scenarios**:

1. **Given** gastos de varias etiquetas de la misma categoría registrados en distintos meses y cuentas (personales y común, naturaleza propia y común), **When** abro el informe de ese año, **Then** la fila de la categoría muestra en cada columna mensual la suma de todos ellos y en la columna final su media anual (total ÷ 12, redondeo half-up al céntimo).
2. **Given** el informe de un año, **When** observo las filas, **Then** aparece una fila por **cada categoría** del catálogo — también las que no tienen gastos (fila a 0,00 €) — en el orden vigente del catálogo (genérica primero, resto alfabético es-ES).
3. **Given** gastos con la etiqueta protegida «Aportación Común» materializados por 019/021 en el mes consultado, **When** abro el informe, **Then** esos importes no computan en ninguna fila, columna ni total.
4. **Given** la tabla del informe, **When** llego al final, **Then** encuentro la fila «Gasto mensual» (total de gastos de cada mes con las mismas exclusiones) y la fila de **total de gastos personales** (gastos de naturaleza propia registrados en las cuentas de los miembros), ambas con su media anual en la columna final.
5. **Given** un año con meses sin gastos, **When** abro el informe, **Then** las 12 columnas mensuales están siempre presentes con 0,00 € en los meses vacíos.
6. **Given** la navegación global desde cualquier página, **When** abro el menú «Informes», **Then** puedo llegar a este informe — el único ítem del menú de momento — y «Resumen» y «Cuenta de resultados» siguen siendo enlaces directos con su comportamiento actual.
7. **Given** dos años con movimientos distintos, **When** cambio el año en el selector, **Then** la tabla se recalcula para el año seleccionado, con el año actual seleccionado por defecto al entrar.
8. **Given** gastos históricos con etiqueta desactivada (ciclo de vida 004), **When** abro el informe de su año, **Then** siguen computando en la categoría de su etiqueta: el informe es lectura de histórico y no filtra por estado de etiqueta.
9. **Given** `/summary`, `/annual`, los listados de cuenta, los KPIs y las materializaciones, **When** la feature está completa, **Then** producen exactamente los mismos números y comportamientos que antes.

---

### Edge Cases

- **Año sin movimientos**: el informe muestra la estructura completa (todas las categorías, 12 columnas, 2 filas de totales) a 0,00 € y medias a 0,00 €, sin errores.
- **Categoría sin gastos en el año**: la fila aparece a 0,00 € en todas las columnas (decisión del propietario: todas las categorías como filas).
- **Etiquetas desactivadas**: sus gastos históricos computan igualmente (el estado activa/inactiva solo filtra la captura de nuevos movimientos, no el histórico).
- **Identificación de la exclusión**: la aportación común se identifica por su **etiqueta protegida** (constante de dominio con slug fijo, la misma que la protege en 004); si un usuario registrara a mano otro gasto con esa etiqueta, quedaría igualmente excluido (regla declarativa por etiqueta).
- **Gasto personal y aportación**: la aportación común es un gasto de naturaleza propia, pero queda excluida de todo el informe — también de la fila de gastos personales.
- **Media anual de año en curso o con meses vacíos**: siempre total ÷ 12 (decisión cerrada; no se divide por meses transcurridos ni con datos).
- **Años navegables**: el selector permite consultar otros años además del actual; el conjunto exacto de años ofrecidos y la ruta/URL del informe son detalle del plan.
- **Meses futuros del año en curso**: columnas visibles a 0,00 € (estructura fija tipo Excel).
- **Tabla ancha en móvil**: 12 columnas + media; la presentación responsive (p. ej. scroll horizontal) es detalle del plan.
- **Doble envío / renderizado**: el informe es lectura pura sin estado mutable; no hay envíos que duplicar.
- **Aislamiento e2e**: el informe lee los gastos de **todas** las cuentas y meses del año, por lo que su spec e2e opera en un **año propio** que no colisione con los años usados por el resto de ficheros e2e (convención de BD compartida determinista; detalle de ubicación en el plan).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (tabla por categoría y mes)**: El informe MUST mostrar, para el año seleccionado, una fila por cada categoría del catálogo (todas, también sin gastos; orden del catálogo: genérica primero, resto alfabético es-ES) y una columna por cada uno de los 12 meses (siempre presentes) más una columna final «Media anual». El importe de cada celda MUST ser la suma de los gastos (importe positivo del gasto) de las etiquetas de esa categoría fechados en ese mes y año, de todas las cuentas y ambas naturalezas, **excluida la etiqueta protegida «Aportación Común»**. La media anual de cada fila MUST ser el total anual de la categoría ÷ 12, redondeado half-up al céntimo.
- **FR-002 (filas de totales)**: Al final de la tabla MUST existir una fila «Gasto mensual» con el total de gastos de cada mes (mismas exclusiones de FR-001) y una fila con el total de **gastos personales** de cada mes (gastos de naturaleza propia registrados en las cuentas de los miembros, aportación común excluida). Ambas filas MUST incluir su media anual (total ÷ 12) en la columna final.
- **FR-003 (selector de año)**: El informe MUST permitir seleccionar el año consultado, con el año actual seleccionado por defecto al entrar y actualización de la tabla al cambiarlo. La forma de navegación entre años (reutilización del patrón vigente) es detalle del plan.
- **FR-004 (menú «Informes»)**: La navegación global MUST incorporar un menú «Informes» que contiene como único ítem este informe anual de gastos. Los enlaces directos existentes («Resumen», «Cuenta de resultados», «Etiquetas») y el enlace del panel MUST permanecer invariables en destino y comportamiento.
- **FR-005 (lectura pura, no-regresión)**: El informe MUST ser una agregación de lectura calculada en la capa de aplicación a partir de movimientos, etiquetas y categorías existentes: sin materialización, sin persistencia nueva, sin cambios de esquema ni migraciones, y sin tocar `/summary`, `/annual`, listados de cuenta, KPIs o materializaciones (005/009/016–025 intactos).
- **FR-006 (actualización del roadmap maestro)**: Al completar la feature, el roadmap maestro MUST registrar la fila 015 como Completada con su alcance final (realización de `015-anual-agrupada` mediante las categorías reales de 026) y anotar el informe de aportaciones a la cuenta común por miembro y mes como feature futura.
- **FR-007 (cobertura de tests)**: La feature MUST estar cubierta por tests: la agregación del caso de uso (celdas por categoría/mes, exclusión de la aportación común, gastos de etiquetas desactivadas, medias ÷ 12, año vacío, filas de totales), los componentes de la tabla y el selector, y un flujo e2e que registre gastos en varias categorías/meses/cuentas y verifique filas, medias y totales en su año propio (constitución III).

### Key Entities

- **Categoría** (sin cambios de modelo): nivel de agrupación del informe; cada fila es una categoría (todas, genérica incluida).
- **Etiqueta** (sin cambios de modelo): clasifica el gasto; su categoría determina la fila donde computa. El estado activa/inactiva es irrelevante para el informe (histórico íntegro).
- **Movimiento** (sin cambios de modelo): fuente de los importes; todo gasto tiene exactamente una etiqueta (014) y, por tanto, computa en exactamente una categoría — salvo la aportación común, excluida por etiqueta protegida.
- **Informe anual de gastos por categoría**: agregación calculada (read model) por año: matriz categoría × mes + media anual por fila + totales mensuales («Gasto mensual», gastos personales).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los importes del informe coinciden al 100 % con el cálculo manual sobre el mismo conjunto de movimientos (celdas, medias ÷ 12 y las dos filas de totales), excluida sistemáticamente la etiqueta «Aportación Común».
- **SC-002**: El 100 % de las categorías del catálogo aparece como fila en cualquier año consultado, con las 12 columnas mensuales presentes.
- **SC-003**: El informe es alcanzable desde cualquier página de la aplicación en un máximo de 2 clics (abrir «Informes» + ítem), sin cambios en el resto de la navegación.
- **SC-004**: Todas las suites (agregación, componentes, e2e aislado por año) en verde y sin regresiones en `/summary`, `/annual`, listados, KPIs ni materializaciones.

## Assumptions

- La exclusión de la aportación común se resuelve por **etiqueta protegida** (constante de dominio con slug fijo), no por introspección de los registros internos de materialización (019/021): el informe declara «excluye la etiqueta Aportación Común» y es agnostic de cómo nació el movimiento.
- «Todas las categorías» significa todas las existentes: las categorías no tienen estado activa/inactiva (026).
- Todo gasto tiene exactamente una etiqueta (obligatoria desde 014) y toda etiqueta pertenece a exactamente una categoría (026): no existen gastos «sin clasificar» ni dobles cómputos por fila.
- El orden de las filas replica el del catálogo (genérica primero, resto alfabético es-ES, convención de 026/027).
- La media anual divide siempre por 12, también en año en curso (decisión del propietario).
- La ruta/URL del informe, el patrón del selector de año (reutilizable del vigente), el diseño responsive de la tabla ancha y la lista concreta de años navegables son detalle del plan.
- La UI es solo anidadora de datos ya agregados por la capa de aplicación (constitución VII): ningún total ni media se calcula en componentes.
- Literales de UI en español; escritorio primero, usable en móvil sin optimización específica.
- La spec e2e de la feature usa un fichero propio y un año propio, conforme a la convención de aislamiento del proyecto (BD compartida determinista, `workers: 1`).

## Out of Scope

- **Informe de aportaciones a la cuenta común por miembro y mes**: feature futura anotada en el roadmap a raíz de esta conversación (FR-006).
- **Informe mensual por categoría con drill-down** (~028 en el roadmap, nota 2026-11-02): independiente de esta feature.
- **Desglose por etiqueta dentro del informe** (expansión de filas, drill-down categoría → etiqueta → movimientos): las filas son solo categorías, sin expansión (decisión 2026-11-04).
- **Ingresos, saldos, balance acumulado y KPIs**: el informe contiene exclusivamente gastos y sus totales.
- **Cambios en `/annual` y `/summary`**: permanecen invariables, incluida su agrupación por etiqueta.
- **Agrupar el menú «Informes» con Resumen/Anual**: el menú contiene solo este informe (decisión 2026-11-04); ampliarlo es una conversación futura.
- Exportación (CSV/Excel), impresión, gráficos y visualizaciones alternativas.
- Cambios en el modelo de datos, esquema o migraciones.
