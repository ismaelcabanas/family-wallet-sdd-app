# Feature Specification: Alta continua de movimientos con formulario simplificado (nota única, tag única y sin campo cuenta)

**Feature Branch**: `feature/014-formulario-nota-tags`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "El caso de uso más normal al registrar movimientos es dar de alta varios a la vez, 2 o 3 veces al mes. Quiero que el alta sea más ágil: que el diálogo de alta permanezca abierto tras guardar (modo de captación continua). Además: eliminar el campo descripción y sustituir el campo concepto por nota; eliminar el campo cuenta (la cuenta ya está implícita en la página); las tags pasan a selección única y obligatoria."

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (fila `014-formulario-nota-tags`, rediseño UX 2026-09-27). Da por construidas `013-formulario-dialogo` y `016-movimientos-bajo-selector-fechas` (Completadas): el alta es hoy un CTA «Nuevo movimiento» que abre un diálogo junto al listado de la página de cuenta. Esta feature redefine ese formulario y su comportamiento para la captación por lotes. Reutiliza el patrón de diálogo y el flujo de alta existentes; **a diferencia de 013, sí modifica dominio, aplicación y persistencia** (nota única y tag única cambian el modelo de `Movement`).

**Decisiones del propietario (2026-10-01)** que amendent el roadmap maestro y quedan registradas en su tabla de notas:

- **Modo de captación continua** absorbido por esta feature (estaba explícitamente fuera de alcance en 013).
- **Nota única**: fusión de concepto y descripción en un solo campo «Nota» (amenda la asunción «Concepto/Descripción» del maestro, como ya anticipaba la nota del 2026-09-27).
- **Tag única**: como máximo 1 tag por movimiento, **obligatoria en gastos** y opcional en ingresos (mantiene la decisión «tags opcionales en ingresos» del 2026-09-27; amenda FR-004 del maestro, que permitía múltiples tags).
- **Sin campo cuenta**: en alta ya era implícita; desaparece también del diálogo de edición, por lo que un movimiento ya no puede cambiar de cuenta tras crearse (amenda el edge case de edición entre cuentas del maestro).

**Excepción de granularidad** (constitución II): la spec agrupa dos historias con valor por separado (simplificación del formulario y captación continua). La agrupación la decide el propietario: ambas nacen de la misma necesidad —agilizar la captación por lotes que hace 2-3 veces al mes—, comparten formulario y recorrido UI, y la simplificación carece de sentido de entrega sin el modo continuo que la motiva (mismo criterio que la fusión edición/eliminación de 003).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar varios movimientos seguidos sin cerrar el diálogo (Priority: P1)

Como usuario, tras pulsar «Nuevo movimiento» y guardar un movimiento válido, quiero que el diálogo **permanezca abierto y prepare el siguiente**, conservando los campos que no cambian entre movimientos del mismo lote (fecha, tipo, naturaleza) y limpiando los que sí cambian (nota, importe, tag), para registrar toda una tanda de movimientos con una sola apertura del diálogo y sin clics de más.

**Why this priority**: Es el corazón de la feature: el patrón de uso real (2-3 sesiones al mes con varios movimientos) hace que el coste dominante sea reabrir el diálogo N veces. La simplificación del formulario (US2) aguza cada captura; este modo elimina la fricción entre capturas.

**Independent Test**: Se puede probar abriendo el diálogo de alta y registrando 3 movimientos seguidos: tras cada guardado el diálogo sigue abierto, los campos pegados conservan su valor, los variables quedan vacíos con el foco listo, y cada movimiento aparece en el listado de la página (que se revalida en vivo) sin cerrar el diálogo.

**Acceptance Scenarios**:

1. **Given** el diálogo de alta abierto, **When** guardo un movimiento válido, **Then** el movimiento se persiste, aparece la confirmación correspondiente sin cerrar el diálogo, el listado/balance/cierre de la página se recalculan, y el formulario queda listo para el siguiente: nota, importe y tag vacíos; fecha, tipo y naturaleza (cuando aplique) conservan el valor del guardado anterior; el foco queda en el primer campo vacío.
2. **Given** una tanda en curso, **When** pulso la acción secundaria «Guardar y cerrar», **Then** el movimiento en curso se guarda, el diálogo se cierra y la página refleja los datos recalculados.
3. **Given** una tanda en curso, **When** cancelo o cierro el diálogo (X/Escape), **Then** se descarta solo la entrada en curso, sin confirmación; los movimientos ya guardados en la tanda permanecen.
4. **Given** una tanda en curso, **When** envío datos inválidos, **Then** el diálogo permanece abierto con los errores de campo y los valores introducidos conservados, igual que hoy; corregir y guardar continúa la tanda.
5. **Given** un guardado en curso, **When** la acción se procesa, **Then** los botones de guardado se deshabilitan para impedir doble envío, igual que hoy.

### User Story 2 - Formulario simplificado: nota única, tag única obligatoria en gastos y sin campo cuenta (Priority: P2)

Como usuario, quiero un formulario de alta (y de edición) con menos campos y decisiones más simples —una única nota en lugar de concepto+descripción, exactamente una tag en los gastos, y sin campo de cuenta—, para que cada captura de la tanda requiera menos interacciones y menos pensamiento.

**Why this priority**: Reduce el coste de cada captura individual; entrega valor incluso sin el modo continuo, pero es en la captación por lotes donde más se nota (se paga N veces por tanda).

**Independent Test**: Se puede probar registrando un gasto: el formulario pide fecha, importe, nota, tipo, naturaleza (si aplica) y una tag (obligatoria); no muestra campo de cuenta ni descripción. Y editando un movimiento existente: mismos campos simplificados, sin selector de cuenta.

**Acceptance Scenarios**:

1. **Given** el diálogo de alta, **When** lo recorro, **Then** los campos son: fecha (hoy por defecto), importe, nota, tipo Gasto/Ingreso, naturaleza del gasto cuando aplique y **una única tag** (selección simple). No existe campo descripción ni mención a la cuenta: la cuenta del movimiento es la de la página.
2. **Given** un gasto sin tag seleccionada, **When** envío, **Then** la validación falla con un error claro que señala la tag y no se guarda; el mensaje actual «Sin selección, el movimiento se guarda con la etiqueta Sin Clasificar» desaparece de la UI.
3. **Given** un ingreso, **When** lo guardo sin tag, **Then** se guarda correctamente (tag opcional en ingresos) y sin naturaleza, como hoy.
4. **Given** el diálogo de edición de un movimiento, **When** lo recorro, **Then** presenta los mismos campos simplificados que el alta (nota única, tag única) y **sin selector de cuenta**: editar ya no permite mover un movimiento entre cuentas.
5. **Given** un movimiento existente con concepto y descripción, **When** se ejecuta la migración, **Then** queda una sola nota que no pierde información: sin descripción, la nota es el concepto; con descripción, la nota las fusiona en un único texto.
6. **Given** un movimiento existente con varias tags, **When** se ejecuta la migración, **Then** conserva exactamente una (la de menor id); y uno sin tags queda con la tag «Sin Clasificar».
7. **Given** cualquier vista que muestre el movimiento (listado agrupado, edición), **When** lo consulto, **Then** muestra la nota única y la tag única; ninguna vista muestra ya concepto y descripción por separado ni múltiples tags por movimiento.

### Edge Cases

- Guardado con la vista en un mes distinto al del movimiento: comportamiento actual; la revalidación existente actualiza las vistas afectadas y el diálogo continúa la tanda.
- Nota vacía o de solo espacios: se rechaza con error de campo (misma regla que hoy aplica al concepto), con el mensaje renombrado a «nota».
- Tag inexistente o desactivada enviada al servidor: la validación de frontera (Zod) la rechaza; la UI solo ofrece tags activas.
- Movimientos históricos tras la migración: los desgloses por tag (cierre mensual, resumen global, cuenta de resultados anual) computan cada gasto exactamente en una tag; desaparece el reparto de un gasto entre varias tags.
- Doble envío y cierre con datos a medias: comportamiento actual (botones deshabilitados durante el envío; descarte sin confirmación).
- Naturaleza en captación continua: si el lote alterna tipos, cambiar Gasto↔Ingreso oculta/muestra naturaleza y la tag pasa de obligatoria a opcional según el tipo actual del formulario, no del movimiento anterior.
- Validación de tag en ingresos: ausente (0 tags válido); si el usuario seleccionó una y cambia a ingreso, la selección se conserva como válida (máximo 1).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (captación continua)**: Tras un guardado con éxito en el diálogo de alta, el diálogo MUST permanecer abierto con confirmación visible del guardado, los campos variables (nota, importe, tag) MUST vaciarse, los campos estables (fecha, tipo, naturaleza cuando aplique) MUST conservar el último valor guardado y el foco MUST situarse en el primer campo vacío. Debe existir una acción secundaria «Guardar y cerrar» que guarde la entrada en curso y cierre el diálogo. Cancelar/cerrar MUST descartar únicamente la entrada en curso. Ante error de validación, el diálogo MUST permanecer abierto con errores y valores, igual que el comportamiento actual.
- **FR-002 (nota única)**: El formulario de alta y el de edición MUST sustituir los campos concepto y descripción por un único campo «Nota», obligatorio (no vacío tras trim), con trim al guardarse. La entidad `Movement`, los DTOs y la persistencia MUST reflejar un único atributo nota; la columna(s) actual(es) de concepto/descripción MUST migrarse sin pérdida de información (fusión). Todas las vistas que muestren el movimiento MUST renderizar la nota.
- **FR-003 (tag única)**: Los formularios de alta y edición MUST limitar la selección de tags a exactamente una como máximo (selección simple, sin checkboxes múltiples). En gastos la tag MUST ser obligatoria (validación de frontera y de dominio con error claro); en ingresos MUST ser opcional. El modelo de persistencia MUST garantizar como máximo una tag por movimiento; la migración de datos existentes MUST conservar la tag de menor id para movimientos con varias, y asignar «Sin Clasificar» a los que no tengan ninguna. El texto de ayuda sobre «Sin Clasificar» automático MUST eliminarse de la UI.
- **FR-004 (sin campo cuenta)**: El diálogo de alta MUST eliminar el bloque informativo de cuenta (la cuenta es implícitamente la de la página). El diálogo de edición MUST eliminar el selector de cuenta: la edición no permite cambiar un movimiento de cuenta. Los casos de uso `CreateMovement`/`UpdateMovement` y sus Server Actions MUST continuar validando que la cuenta del movimiento es la de la página.
- **FR-005 (revalidación en vivo)**: Cada guardado con éxito de la tanda MUST revalidar las vistas afectadas (listado, balance, cierre) mediante el mecanismo existente, de modo que la página quede actualizada al cerrar el diálogo sin refresco manual.
- **FR-006 (solo alta es continua)**: El modo de captación continua aplica exclusivamente al diálogo de alta. El diálogo de edición MUST mantener el comportamiento actual: cerrarse tras el guardado con éxito.
- **FR-007 (adaptación de tests)**: Los tests existentes (dominio, aplicación, componentes, e2e) MUST adaptarse al nuevo modelo (nota única, tag única, sin cuenta en edición) manteniendo lo que verifican; el flujo crítico de registro MUST seguir cubierto por e2e incluida la captación continua (varios movimientos seguidos) y el error por tag ausente en un gasto (constitución III).
- **FR-008 (actualización del roadmap maestro)**: Al completar la feature, el roadmap maestro MUST registrar las enmiendas: FR-004 (tag única obligatoria en gastos/opcional en ingresos en sustitución de múltiples tags), asunción «Concepto/Descripción» (nota única), edge case de edición entre cuentas (ya no posible) y la fila 014 pasa a «Completada».
- **FR-009 (resto intacto)**: La estructura de la página de cuenta (selector, listado con CTA, balance, cierre), `/`, `/summary`, `/annual`, la navegación y los diálogos de edición/eliminación en cuanto a montaje a nivel del listado MUST permanecer conforme a las convenciones del proyecto. Interfaz en español; importes EUR es-ES con dos decimales.

### Key Entities

- **Movimiento** (modificado): tipo, fecha, **nota** (fusiona concepto y descripción), importe, cuenta (inmutable tras el alta), naturaleza para gastos, **una tag** (obligatoria en gastos, opcional en ingresos). La relación N:M con tags pasa a ser 0..1.
- **Tag** (sin cambios de catálogo): sigue existiendo como catálogo; cambia su cardinalidad respecto al movimiento. «Sin Clasificar» permanece como tag del catálogo seleccionable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registrar N movimientos en una tanda requiere exactamente 1 apertura de diálogo y N envíos (frente a N aperturas antes); ningún clic adicional entre guardado y siguiente captura.
- **SC-002**: El formulario de alta muestra 6 controles como máximo (fecha, importe, nota, tipo, naturaleza cuando aplique, tag) frente a los ~9 actuales, y ninguno redundante para la cuenta.
- **SC-003**: El 100 % de los gastos existentes queda, tras la migración, con exactamente 1 tag (menor id o «Sin Clasificar») y con una nota que no pierde la información de concepto/descripción; verificado por tests de migración.
- **SC-004**: Las suites (unit, componentes, e2e) quedan en verde tras la adaptación y el flujo crítico de registro sigue cubierto end-to-end, incluida la tanda continua.
- **SC-005**: Ninguna vista de la aplicación muestra concepto y descripción por separado ni más de una tag por movimiento tras la feature.

## Assumptions

- La fusión migratoria de nota es `concepto — descripción` cuando existe descripción, y `concepto` en caso contrario (formato exacto afinable en el plan; requisito: sin pérdida de información).
- En la captación continua la tag se limpia tras cada guardado (obliga a elegir conscientemente en cada gasto, siendo obligatoria); si el plan justifica mantenerla pegada por agilidad, se documenta la desviación.
- La confirmación por guardado es un feedback discreto dentro/ junto al diálogo (toast o contador de tanda); la forma exacta se decide en el plan.
- «Guardar y cerrar» es acción secundaria; la acción primaria guarda y continúa la tanda. Los literales exactos se refinan en el plan.
- La fecha sigue defaults a hoy y es editable en cada captura; naturaleza por defecto según cuenta (fijo «Compartido» en cuenta común, elección en personal), como hoy.
- La tag «Sin Clasificar» sigue existiendo en el catálogo como opción seleccionable (válida para gastos); la asignación automática sin selección desaparece.
- El modelo de tag única se materializa como FK en la tabla de movimientos o como tabla de unión con restricción de unicidad; lo decide el data-model del plan.
- Los desgloses por tag (cierre, resumen global, anual) no requieren cambios de cálculo: al haber una única tag, cada gasto computa en ella; los tests que usaban múltiples tags se adaptan.
- Los e2e que hoy cubren edición con cambio de cuenta se adaptan: ese recorrido desaparece del producto (decisión del propietario 2026-10-01).
- Escritorio primero (decisión del propietario, 2026-09-27): usable en móvil, sin optimización específica.

## Out of Scope

- Rediseño visual de controles del formulario (chips Gasto/Ingreso y Personal/Común, selector de fecha propio): la nota 2026-09-27 los preveía en esta fila; si el propietario sigue queriéndolos, se planifican como feature propia posterior.
- Inline editing/alta directamente en las filas del listado (evaluado y descartado en favor del modo continuo, conversación 2026-10-01).
- Cambio de cuenta de un movimiento por otra vía (recolocación masiva, etc.).
- Tags en catálogo: gestión (crear/renombrar/fusionar/desactivar) sigue siendo `004-gestion-tags`.
- Atajos de teclado adicionales (más allá del envío nativo por Enter), autoguardado y borradores.
- Cambios en `/`, `/summary`, `/annual`, navegación global, cierre mensual y cuadre.
- Optimización móvil específica, dark mode y animaciones.
