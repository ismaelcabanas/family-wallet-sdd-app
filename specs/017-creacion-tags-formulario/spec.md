# Feature Specification: Creación de etiquetas desde el formulario de movimiento

**Feature Branch**: `feature/017-creacion-tags-formulario`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Arranca 004: gestión de tags reducida a la creación de tags desde el propio formulario de movimiento. Contexto: la fila 004-gestion-tags del roadmap maestro (US5/FR-005) contemplaba crear, renombrar, fusionar y desactivar tags. Decisión del propietario (hoy): la feature se reduce a la NECESIDAD real surgida con 014 — al registrar movimientos (la tag es obligatoria en gastos desde 014) puede faltar la tag adecuada en el catálogo y hay que salir del flujo para crearla. Alcance: crear una tag nueva desde el formulario de alta y edición de movimientos, junto al Select «Etiqueta» (patrón «+ Nueva etiqueta»); validación de nombre duplicado ignorando mayúsculas (ya existe: índice lower(name) + DuplicateTagNameError) con mensaje claro sin perder los datos introducidos; la tanda continua de 014 no se rompe: crear la tag a mitad de captura y seguir. Fuera de alcance (diferido a una feature futura de mantenimiento de catálogo): fusionar, renombrar y desactivar tags. Nota para la spec: decidir si la creación es una Server Action propia (createTag + revalidación del Select) o parte del envío del movimiento; el catálogo inicial del Excel y «Sin Clasificar» se mantienen intactos."

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (US5 / FR-005, fila `004-gestion-tags`). Da por construida `014-formulario-nota-tags` (Completada): la tag es única y obligatoria en gastos, y el alta es captación continua en diálogo. Hoy **no existe ninguna vía de creación de tags en la aplicación** (el catálogo solo se carga por seed), por lo que un gasto cuya etiqueta adecuada falta obliga a interrumpir el flujo.

**Decisiones del propietario (2026-10-04)**:

- **Reducción de 004-gestion-tags**: la fila 004 contemplaba crear, renombrar, fusionar y desactivar tags; se reduce a la necesidad real surgida con 014: **crear** tags desde el propio formulario de movimiento. Renombrar, fusionar y desactivar quedan diferidos a una feature futura de mantenimiento de catálogo (la fila 004 mantiene el número reservado con ese alcance reducido, mismo criterio de números reservados que los splits de 003/006).
- **Numeración**: esta feature hija toma el siguiente número secuencial libre (017); la rama y el directorio de spec la llevan (013–016 estaban reservados en el roadmap).

**Granularidad** (constitución II): una única user story pequeña con valor propio — la creación inline de etiquetas. No aplica excepción.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear una etiqueta nueva desde el propio formulario del movimiento (Priority: P1)

Como usuario que está registrando (o editando) un movimiento, cuando la etiqueta adecuada no existe en el catálogo, quiero crearla ahí mismo —junto al selector «Etiqueta», con el patrón «+ Nueva etiqueta»— sin cerrar el diálogo ni perder lo que ya he escrito, para no interrumpir la captación, incluida la tanda continua de 014.

**Why this priority**: Es la única historia de la feature y su razón de ser: desde 014 la etiqueta es obligatoria en gastos y el catálogo está cerrado (solo seed), de modo que hoy cualquier etiqueta ausente bloquea o degrada el registro («Sin Clasificar» como parche).

**Independent Test**: Se puede probar registrando un gasto cuya etiqueta no existe: abrir «+ Nueva etiqueta» con el formulario ya rellenado a medias, escribir el nombre, confirmar y guardar el movimiento con la etiqueta recién creada —el diálogo nunca se cierra y los demás campos conservan sus valores—; y repitiéndolo en mitad de una tanda continua, comprobando que la tanda sigue su curso normal.

**Acceptance Scenarios**:

1. **Given** el diálogo de alta con un gasto a medio rellenar (fecha, importe y nota ya escritos), **When** pulso «+ Nueva etiqueta» junto al selector, escribo un nombre válido y confirmo, **Then** la etiqueta queda creada y **seleccionada** en el selector «Etiqueta», los demás campos del formulario conservan exactamente sus valores, el diálogo permanece abierto y el movimiento **no** se guarda todavía.
2. **Given** que el catálogo ya contiene «Luz», **When** intento crear «luz» (o «LUZ»), **Then** la creación se rechaza con un mensaje claro de nombre duplicado, el nombre tecleado permanece en el campo para corregirlo y el resto del formulario no cambia.
3. **Given** la captación de nueva etiqueta abierta, **When** la cancelo, **Then** no se crea nada, el selector vuelve a su estado anterior y el formulario conserva todos sus datos.
4. **Given** una tanda continua en curso, **When** creo una etiqueta en la segunda captura y guardo, **Then** el movimiento se guarda con la etiqueta recién creada, la tanda continúa con su comportamiento habitual (campos estables pegados, variables vacíos, foco en el primer campo vacío) y la nueva etiqueta sigue disponible en las capturas siguientes de la misma tanda.
5. **Given** el diálogo de edición de un movimiento, **When** creo una etiqueta nueva, la selecciono y guardo, **Then** el movimiento queda actualizado con la etiqueta recién creada y el diálogo se cierra como hoy.
6. **Given** la captación de nueva etiqueta abierta, **When** confirmo sin nombre o con solo espacios, **Then** se muestra un error claro, no se crea nada y puedo corregir el nombre.

---

### Edge Cases

- **Duplicado de una etiqueta inactiva**: la regla de unicidad por nombre ignora el estado; crear «Luz» existiendo una «LUZ» inactiva se rechaza como duplicado con mensaje claro. Reactivar etiquetas inactivas queda para la feature futura de mantenimiento de catálogo.
- **Colisión del identificador derivado**: el usuario solo introduce el nombre; el identificador interno (slug) se deriva automáticamente y, si colisiona con otro (p. ej. por acentos), se resuelve sin fricción ni decisiones del usuario (detalle de derivación en el plan).
- **Etiqueta creada y movimiento cancelado**: la creación de la etiqueta es inmediata e independiente del envío del movimiento; si después se cancela el movimiento (o se cierra el diálogo a mitad de tanda), la etiqueta creada permanece en el catálogo.
- **Acentos**: «Alimentación» y «Alimentacion» no son duplicados (la regla vigente solo ignora mayúsculas/minúsculas; comportamiento actual del catálogo).
- **Cambio Gasto↔Ingreso con la captación de etiqueta abierta**: el formulario permanece íntegro y la captación de etiqueta nueva se cierra o continúa de forma limpia, sin perder el resto de datos (comportamiento concreto decidido en el plan; en ingresos la etiqueta es opcional, pero poder crearla sigue siendo válido).
- **Doble envío de la creación**: los controles se deshabilitan mientras la creación se procesa (mismo patrón de doble envío que el guardado del movimiento).
- **Nombre con espacios al inicio/fin**: se recortan (trim) antes de validar y guardar; la etiqueta se crea con el nombre ya limpio.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (entrada «+ Nueva etiqueta» junto al selector)**: Los formularios de alta y de edición de movimiento MUST ofrecer junto al selector «Etiqueta» una acción «+ Nueva etiqueta» que abre la captura del nombre **dentro del propio formulario, sin cerrar ni navegar fuera del diálogo**. Cancelar la captación MUST devolver al selector sin crear nada y sin alterar ningún dato del formulario.
- **FR-002 (creación con solo el nombre)**: La creación MUST pedir únicamente el nombre de la etiqueta (con trim); un nombre vacío o de solo espacios MUST rechazarse con mensaje claro. El identificador interno (slug) MUST derivarse automáticamente sin pedirlo al usuario y la etiqueta MUST crearse activa.
- **FR-003 (duplicados ignorando mayúsculas)**: La creación MUST impedir nombres duplicados ignorando mayúsculas/minúsculas —reutilizando la regla y el error de dominio ya existentes del catálogo— con un mensaje claro que conserve tanto el nombre tecleado (editable para corregir) como el resto de datos del formulario.
- **FR-004 (inmediatez y selección)**: Tras confirmar una creación válida, la etiqueta MUST quedar persistida en el catálogo, **disponible inmediatamente en el selector y seleccionada** como etiqueta del movimiento en curso, conservando íntegros todos los demás datos del formulario. La creación de la etiqueta por sí sola MUST no guardar el movimiento ni cerrar el diálogo.
- **FR-005 (tanda continua intacta)**: El modo de captación continua de 014 MUST conservarse íntegro: una etiqueta creada a mitad de tanda MUST seguir disponible en las capturas siguientes de la misma tanda (incluidas las que ocurren tras el remonte del formulario tras cada guardado) y el ciclo guardado → siguiente captura (campos estables/variables, foco, «Guardar y cerrar») MUST funcionar igual con etiquetas recién creadas.
- **FR-006 (misma vía en edición)**: El diálogo de edición MUST ofrecer el mismo patrón «+ Nueva etiqueta»; un movimiento editado puede pasar a llevar una etiqueta creada en el momento, y el diálogo de edición sigue cerrándose tras el guardado, como hoy.
- **FR-007 (catálogo intacto)**: El catálogo inicial del Excel y la etiqueta «Sin Clasificar» MUST permanecer sin cambios: esta feature no añade renombrar, fusionar ni desactivar (diferidos a la feature futura de mantenimiento de catálogo), ni altera el seed ni las etiquetas existentes.
- **FR-008 (actualización del roadmap maestro)**: Al completar la feature, el roadmap maestro MUST registrar la nueva fila (017, Completada) y la reducción de la fila `004-gestion-tags` a mantenimiento de catálogo (renombrar, fusionar, desactivar), dejando constancia de que la creación de tags queda cubierta por esta feature (decisión del propietario 2026-10-04).
- **FR-009 (cobertura de tests)**: La feature MUST estar cubierta por tests: unidad/dominio-aplicación de la creación de etiquetas (nombre vacío, duplicado case-insensitive, alta activa), componentes del selector con «+ Nueva etiqueta» (éxito, error, cancelación, conservación de datos) y un flujo e2e que registre un gasto creando su etiqueta en línea dentro de una tanda continua (constitución III).

### Key Entities

- **Tag** (sin cambios estructurales): nombre único ignorando mayúsculas, slug derivado, estado (activa/inactiva). La feature añade una **vía de creación desde el formulario de movimiento** (hoy inexistente: solo seed); nace activa y con el nombre como único dato pedido.
- **Movimiento** (sin cambios): la etiqueta sigue siendo única, obligatoria en gastos y opcional en ingresos (014); la creación inline no modifica su modelo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registrar un gasto cuya etiqueta no existe en el catálogo se completa con **una sola apertura del diálogo** (misma métrica que SC-001 de 014): los únicos pasos extra son abrir «+ Nueva etiqueta», teclear el nombre y confirmar; cero navegaciones fuera del formulario y cero pérdidas de datos.
- **SC-002**: Tras una creación con éxito, el 100 % de los datos del formulario previos a la creación (fecha, importe, nota, tipo, naturaleza) permanecen intactos y la etiqueta nueva queda seleccionada.
- **SC-003**: Tras un rechazo por duplicado (ignorando mayúsculas) o por nombre vacío, el 100 % de los datos introducidos —nombre tecleado incluido— permanece disponible para corregir y reintentar.
- **SC-004**: Una etiqueta creada durante una tanda está disponible en el 100 % de las capturas posteriores de esa misma tanda y en aperturas futuras de los formularios de alta y edición.
- **SC-005**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde y el flujo «registrar gasto creando su etiqueta en línea dentro de una tanda» queda cubierto end-to-end.

## Assumptions

- **Creación inmediata a mitad de captura** (resuelve la nota de la descripción): el patrón fija el comportamiento observable —la etiqueta se crea y queda seleccionada al confirmar, antes del envío del movimiento, y persiste aunque este se cancele—. El mecanismo técnico (acción de creación propia con actualización del selector vs. creación en el envío del movimiento) es una decisión de diseño que corresponde al plan; esta spec solo fija el comportamiento anterior.
- El usuario introduce únicamente el nombre; la derivación del slug (normalización de acentos/espacios y resolución de colisiones) es detalle del plan, con la regla de unicidad de nombre case-insensitive como única validación de negocio visible.
- La nueva etiqueta nace activa y es inmediatamente elegible en gastos e ingresos (en estos últimos, opcional).
- No hay migración de datos ni cambios de esquema previstos por la spec (el modelo de Tag ya soporta creación); cualquier ajuste que el plan detecte irá versionado como migración si toca esquema.
- Los desgloses por etiqueta (cierre mensual, resumen global, cuenta de resultados anual) no cambian: la etiqueta nueva computa como cualquier otra en cuanto se usa.
- Literales de UI en español («+ Nueva etiqueta», mensajes de duplicado y de nombre vacío); escritorio primero, usable en móvil sin optimización específica (decisión del propietario 2026-09-27).
- Los e2e de la feature operarán en su propia combinación cuenta/mes y en fichero propio, conforme a la convención de aislamiento del proyecto.

## Out of Scope

- **Mantenimiento de catálogo** (diferido a la feature futura que herede la fila 004): renombrar, fusionar y desactivar etiquetas, y reactivar etiquetas inactivas.
- Página o vista de administración del catálogo de etiquetas: la única vía de creación es la inline en los formularios de movimiento.
- Autocompletado, sugerencias, creación en masa o importación de etiquetas.
- Asignación automática de etiquetas (la asignación automática a «Sin Clasificar» desapareció con 014 y no vuelve).
- Cambios en el modelo del movimiento, en la obligatoriedad/opcionalidad de la etiqueta, en los desgloses, o en `/`, `/summary`, `/annual`, cierre y cuadre.
- Optimización móvil específica, dark mode y animaciones.
