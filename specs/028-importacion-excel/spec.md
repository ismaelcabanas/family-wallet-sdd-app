# Feature Specification: Importación de movimientos desde Excel (prueba de concepto)

**Feature Branch**: `feature/028-importacion-excel`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "La siguiente feature que me gustaría implementar es la exportación de datos de mis hojas de excel a family wallet". Acotado con el propietario (2026-11-05): **prueba de concepto** importando los movimientos de **una hoja para una cuenta y un mes concretos**; **solo movimientos** (sin configuraciones); las hojas viven en Google Drive con una hoja por cuenta y mes, descargada y subida manualmente.

**Fuente**: Petición del propietario (2026-11-05). Aborda por primera vez el ítem del alcance diferido «Importación de histórico desde Excel» del roadmap maestro (asunción «No se migra el histórico de los Excel: se empieza de cero»): esta feature **revoca parcialmente** esa asunción como prueba de concepto — una hoja, una cuenta, un mes — para validar la vía de migración antes de plantear la importación masiva del histórico. **Reutiliza** el alta existente (`CreateMovement`, validaciones de `Movement`) sin crear vías paralelas de escritura.

**Granularidad** (constitución II): una única user story pequeña con valor propio — subir la hoja mensual de una cuenta y ver sus movimientos registrados en la app sin teclearlos a mano. No aplica excepción de agrupación.

## Clarifications

### Session 2026-11-06

- Q: ¿Qué formato de fichero debe soportar la subida en el PoC: CSV o `.xlsx` nativo? → A: CSV exportado de Google Sheets (más eficiente, sin dependencias nuevas); el propietario aporta la muestra real «Balance 2026.xlsx - Enero Isma.csv» como referencia de estructura.
- Q: ¿Qué fecha reciben los movimientos si «Fecha de Operación» viene vacía y cómo se determina el mes de destino? → A: El mes se selecciona en la UI al subir el fichero; fecha vacía → día 1 del mes seleccionado; una fila con fecha debe pertenecer al mes seleccionado o es error de fila.
- Q: ¿Qué hacemos con las filas de configuración de la hoja (concepto «Aportación Común», tipo «Ahorro»)? → A: Se excluyen de la importación y se listan en la previsualización como filas ignoradas; SC-002 se mide sobre las filas importables.
- Q: Cuando la categoría de una fila no tiene etiqueta equivalente en el catálogo, ¿qué hacemos? → A: Se crea automáticamente la etiqueta (nombre de la categoría de la hoja) en la categoría genérica «General», dentro de la misma importación transaccional; los ingresos sin categoría quedan sin etiqueta.
- Q: ¿La cuenta de destino se elige en la UI o se deduce del nombre del fichero? → A: Selector explícito de cuenta (y de mes) en la UI al subir; el nombre del fichero es irrelevante para el parseo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Importar los movimientos de una hoja mensual de una cuenta (Priority: P1)

Como único usuario de la aplicación, quiero subir el fichero de la hoja mensual de una cuenta (descargado de Google Drive), revisar los movimientos que la aplicación ha detectado en él y confirmar la importación, para que todos esos movimientos queden registrados en la cuenta y el mes correspondientes sin darlos de alta uno a uno a mano.

**Why this priority**: Es la única historia de la feature y su razón de ser: hoy el histórico vive en Excel y cada fila tendría que re-teclearse con el formulario de alta (002/014). La importación valida la vía de migración que permitiría abandonar el Excel como registro (SC-006 del maestro).

**Independent Test**: Se puede probar exportando una hoja real de un mes de una cuenta, subiéndola desde la aplicación, confirmando la importación y verificando que los movimientos aparecen en el listado de esa cuenta y mes con fecha, nota, importe, tipo, naturaleza y etiqueta correctos, y que los totales del mes coinciden al céntimo con los de la hoja.

**Acceptance Scenarios**:

1. **Given** un fichero válido con los movimientos de un mes de una cuenta, **When** lo subo y confirmo la importación, **Then** se crean los movimientos en esa cuenta y mes, visibles en el listado agrupado de la página de cuenta con sus campos correctos (fecha, nota, importe con signo de gasto/ingreso, naturaleza y etiqueta según el mapeo).
2. **Given** un fichero con alguna fila inválida o no reconocible, **When** lo proceso, **Then** la aplicación señala las filas con problema (fila y motivo) y **no se crea ningún movimiento** (todo-o-nada; ver FR-005).
3. **Given** un fichero cuyo contenido no responde a la estructura esperada (p. ej. columnas que no casan), **When** lo subo, **Then** obtengo un error claro de formato sin que se cree nada y sin tratar de interpretar filas al azar.
4. **Given** la importación confirmada de una hoja, **When** consulto la página de esa cuenta y mes, **Then** los KPIs, cierres y agregados existentes (002/005/006/009/022–024) reflejan los movimientos importados sin cambios en sus reglas: la importación solo añade movimientos corrientes.
5. **Given** movimientos importados, **When** los edito o elimino con las herramientas existentes (003), **Then** se comportan como cualquier movimiento manual.

---

### Edge Cases

- **Importe 0, negativo o no numérico**: la fila se rechaza con error de fila (paridad del dominio: importe > 0; los abonos se registran como ingresos en la propia hoja).
- **Fecha ausente, ilegible o de otro mes**: el mes de la importación se **declara en la UI al subir** (selector de mes); la fecha vacía —la situación de la muestra real— resuelve a **día 1 del mes seleccionado**; una fecha ilegible o de otro mes/año es error de fila (toda fila debe caer dentro del mes declarado).
- **Nota vacía**: error de fila (el dominio exige nota obligatoria desde 014); el mapeo debe producir una nota a partir de las columnas de concepto/descripción de la hoja.
- **Categoría de la hoja sin etiqueta equivalente en el catálogo**: se crea automáticamente la etiqueta (nombre de la categoría de la hoja) en la categoría genérica «General» (026/027), dentro de la misma importación transaccional (FR-005); la previsualización indica qué etiquetas se crearán. Los ingresos sin categoría quedan sin etiqueta (opcional en ingresos).
- **Reimportación del mismo fichero**: los duplicados son responsabilidad del usuario en el PoC — la deduplicación entre importaciones está explícitamente fuera de alcance (ver Out of Scope); la previsualización con totales sirve como comprobación previa.
- **Fichero vacío o sin filas de movimientos**: error claro, nada creado.
- **Mes importado = mes en curso de una cuenta personal**: la re-sincronización de la aportación neta (021) y las materializaciones (018/019/023) se aplican al consultar la página como siempre — la importación no las dispara ni las inhibe; los meses cerrados quedan congelados (regla existente).
- **Importes con céntimos**: la muestra real exporta con **punto decimal y separador de campo coma** («7.85», «42.21»); el parseo a céntimos enteros debe ser exacto (VO `Money`, sin aritmética de coma flotante); cualquier importe que no case con el dialecto congelado es error de fila.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (subida de fichero)**: La aplicación MUST ofrecer una vía para subir el fichero de una hoja mensual (una cuenta, un mes) con **selectores explícitos de cuenta y mes de destino** en la UI (decisión 2026-11-06; el nombre del fichero es irrelevante para el parseo; resolución de fechas en Edge Cases). El fichero proviene de una descarga manual de Google Drive **exportada como CSV** (decisión 2026-11-06: sin dependencias de lectura de Excel; la muestra real de FR-002 es un CSV).
- **FR-002 (parseo estricto de la hoja)**: La aplicación MUST parsear el fichero contra una **estructura de columnas declarada y versionada en la spec/plan**, sin inferencias frágiles: cualquier columna o fila que no case se reporta como error, no se interpreta. Estructura congelada a partir de la muestra real «Balance 2026.xlsx - Enero Isma.csv» (aportada 2026-11-06): **13 columnas en orden fijo** — 6 de movimiento (`Fecha de Operación`, `Concepto`, `Descripción`, `Tipo de Transacción`, `Importe`, `Categoría`) + 7 **columnas derivadas de la propia hoja** (`Balance`, `Aportación Común`, `Gastos Comunes`, `Gastos Personales`, `Ahorro`, `Gastos Alimentación`, `Ahorro Total`) que se ignoran siempre (cálculos de la hoja, jamás se importan ni validan). La cabecera debe coincidir exactamente o el fichero se rechaza con error de formato. Las filas totalmente vacías se ignoran. Valores de `Tipo de Transacción` observados: `Gasto`, `Gasto Común`, `Gasto Fijo`, `Ingreso`, `Ahorro`. Importes con **punto decimal** y separador de campo coma («7.85»).
- **FR-003 (mapeo fila → movimiento)**: Cada fila válida MUST mapearse a los campos del movimiento existente aplicando las reglas del maestro: los tipos del Excel (`Gasto`, `Gasto Común`, `Gasto Fijo`) se mapan a **tipo + naturaleza + etiqueta** (FR-002 de 001), `Ingreso` a ingreso (etiqueta opcional), nota única a partir de concepto/descripción (014), importe positivo en céntimos (`Money`), y **una única etiqueta** obligatoria en gastos y opcional en ingresos (FR-004 amendado por 014). **Filas de configuración excluidas** (decisión 2026-11-06): las filas con concepto «Aportación Común» o con tipo «Ahorro» no se importan — la aportación vive en su configuración (019/021) y el ahorro en el KPI informativo (023). La tabla de mapeo exacta de tipos/categorías de la hoja → naturaleza/etiqueta se congela en el plan con la muestra real.
- **FR-004 (revisión previa)**: Antes de persistir, la aplicación MUST mostrar una **previsualización** de los movimientos detectados, de las filas con error (si las hay) y de las **filas ignoradas** por configuración (FR-003), con totales por tipo, de modo que la confirmación sea informada; no se persiste nada sin confirmación explícita del usuario.
- **FR-005 (atomicidad)**: La importación confirmada MUST ser transaccional **todo-o-nada**: o se crean todos los movimientos de la previsualización, o no se crea ninguno. La detección de errores (parseo/validación) ocurre íntegramente **antes** de la confirmación.
- **FR-006 (vía de escritura única)**: Los movimientos importados MUST crearse a través del dominio y la capa de aplicación existentes (validaciones de `Movement`, resolución de naturaleza por tipo de cuenta y de etiqueta activa — `CreateMovement` o un caso de uso que los reutilice), sin bypass del dominio ni escrituras SQL directas; las reglas de negocio (importe > 0, nota obligatoria, naturaleza por defecto en cuenta común, etiqueta obligatoria en gastos) son las vigentes, sin excepciones para la importación; la creación de etiquetas en caliente (Edge Cases) reutiliza la vía existente (`CreateTag`, nace en la genérica).
- **FR-007 (aislamiento de materializaciones)**: La importación MUST NOT disparar ni inhibir las materializaciones perezosas (018/019/021/023) ni alterar agregados: solo crea movimientos corrientes; el comportamiento posterior es el ya definido (re-sync del mes en curso al consultar la página, meses cerrados congelados).
- **FR-008 (alcance PoC)**: La feature MUST limitarse a una hoja por importación para una cuenta y un mes; la importación masiva del histórico (múltiples meses/cuentas) queda explícitamente fuera y será objeto de una feature futura si el PoC valida la vía.
- **FR-009 (cobertura de tests)**: El parseo y el mapeo MUST estar cubiertos por tests unitarios con fixtures derivados de la muestra real (casos: fila válida de cada tipo, importe con céntimos —punto decimal—, fila inválida de cada clase, estructura no reconocida); el caso de uso de importación con tests de integración (todo-o-nada incluido); y el flujo completo (subida → previsualización → confirmación → listado) con un e2e en combinación cuenta/mes propia (convención de aislamiento e2e; constitución III).
- **FR-010 (actualización de documentación)**: Al completar la feature, el roadmap maestro MUST registrar la fila 028 como Completada y MUST amendarse la asunción «No se migra el histórico de los Excel» y el ítem del alcance diferido conforme al resultado del PoC; la decisión de librería/formato de parseo (si introduce dependencia nueva) se registra como ADR.

### Key Entities

No se introducen entidades nuevas de dominio ni de esquema: la importación produce **movimientos** existentes en una cuenta existente. Conceptualmente aparecen:

- **Hoja importable**: fichero CSV de una cuenta y un mes con una fila por movimiento (fecha, concepto/descripción, importe, tipo/categoría) — estructura congelada en la spec a partir de la muestra real (FR-002).
- **Previsualización de importación** (DTO de aplicación, sin persistencia): lista de movimientos detectados (campos ya mapeados y validados) + lista de errores por fila (número de fila y motivo) + totales informativos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una hoja real de un mes de una cuenta (~50–100 filas) se importa en menos de 1 minuto incluyendo la revisión de la previsualización, y el 100 % de los movimientos creados coincide con la hoja en nota, importe al céntimo, tipo, naturaleza y etiqueta (fecha conforme a la resolución de Edge Cases).
- **SC-002**: Los totales del mes importado (gastos por naturaleza, ingresos, saldo) coinciden al céntimo con los calculados sobre las **filas importables** de la misma hoja (excluidas las filas de configuración ignoradas, FR-003), sin ajustes manuales.
- **SC-003**: El 100 % de los ficheros con filas inválidas termina sin crear movimientos y con un error que identifica la fila y el motivo; ningún fichero con estructura no reconocida produce altas parciales.
- **SC-004**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde tras la feature.

## Assumptions

- **Alcance acotado a PoC** (decisión del propietario, 2026-11-05): una hoja = una cuenta + un mes por importación; solo movimientos (no se importan configuraciones de ingreso regular, aportación ni ahorro).
- **Sin integración con Google Drive/Sheets**: el usuario descarga la hoja y sube el fichero; no hay lectura online ni credenciales de Google.
- **Estructura de la hoja estable**: cada hoja mensual por cuenta comparte la misma estructura de columnas que la **muestra real aportada en clarify** («Balance 2026.xlsx - Enero Isma.csv», 2026-11-06; hojas «Balance» equivalentes a la analizada para 001).
- **La importación no crea cuentas ni miembros**: las 3 cuentas existentes son el destino posible; el catálogo de etiquetas es el vigente y una categoría de la hoja sin equivalente crea su etiqueta en la genérica «General» (decisión 2026-11-06).
- **Validación en frontera**: el fichero subido se valida (Zod) en el adaptador de entrada conforme a la estructura declarada; el mapeo a campos de dominio reutiliza las validaciones existentes.
- **Los e2e de la feature** operarán en su propia combinación cuenta/mes y en fichero propio, conforme a la convención de aislamiento del proyecto.

## Out of Scope

- Importación masiva del histórico completo (múltiples meses, las 3 cuentas, varios años) — feature futura tras validar el PoC.
- Integración directa con Google Drive/Sheets (API, OAuth, lectura online).
- Importación de configuraciones (ingresos regulares, aportación %, ahorro %) o de saldos declarados (010).
- Deduplicación entre importaciones y actualización/merge de movimientos ya existentes.
- Importación de los Excel agregados («Cuenta Resultados»): son vistas derivadas de los movimientos, ya cubiertas por la app.
- Exportación de datos de la app a Excel/CSV.
