# Feature Specification: Formulario de alta en diálogo desde el listado

**Feature Branch**: `feature/013-formulario-dialogo`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "En la página de cada cuenta en la que aparece el listado de movimientos, quiero una especificación en la que el listado tenga un botón/link de añadir un nuevo movimiento de manera que al pulsarlo aparezca un dialogo con el formulario para añadir un nuevo movimiento. El formulario debería ser similar al que ya existe cuando se edita un movimiento. El objetivo es eliminar el formulario de registro que aparece en la página de detalle de la cuenta."

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (fila `013-formulario-dialogo`, rediseño UX 2026-09-27, reducida al CTA con diálogo tras el adelanto del «list-first» en `016-movimientos-bajo-selector-fechas`). Da por construidas `011-pagina-cuenta`, `012-panel-cuentas` y `016-movimientos-bajo-selector-fechas` (Completadas): la página de cuenta `/accounts/[accountId]?month=` muestra hoy el selector de mes/año, el listado agrupado por fecha, el balance acumulado, el formulario de alta embebido y el cierre mensual. Esta feature convierte el alta embebida en un CTA junto al listado que abre el formulario en un diálogo (patrón ya entregado por el diálogo de edición de `003-edicion-movimientos`) y elimina el formulario embebido. El FR-002 de 016 (mantener el formulario embebido) estaba acotado al alcance de esa reordenación; esta feature lo sustituye deliberadamente. Feature de presentación pura: reutiliza el flujo de alta existente (002) sin cambios de dominio, aplicación ni persistencia.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar un movimiento desde un diálogo junto al listado (Priority: P1)

Como usuario, en la página de una cuenta quiero un botón **«Nuevo movimiento»** junto al listado de movimientos que abra un **diálogo con el formulario de alta** (igual en campos y comportamiento que el formulario que aparece al editar un movimiento), para registrar movimientos bajo demanda sin que el formulario ocupe sitio permanentemente en la página: al terminar (guardar o cancelar) el diálogo se cierra y la página queda limpia con el listado como protagonista.

**Why this priority**: Es la única historia de la feature y cierra el rediseño list-first iniciado en 016: la página de cuenta pasa a ser lectura por defecto (selector + listado) y escritura bajo demanda (CTA + diálogo). Todo el valor es de presentación sobre el flujo de alta ya entregado por 002; el patrón de diálogo ya existe en 003.

**Independent Test**: Se puede probar abriendo la página de cualquier cuenta, pulsando «Nuevo movimiento», rellenando el formulario del diálogo y verificando que el movimiento aparece en el listado (y en balance/cierre) tras cerrarse el diálogo; y que la página ya no muestra el formulario de registro embebido.

**Acceptance Scenarios**:

1. **Given** la página de una cuenta (cualquier mes visible), **When** pulso «Nuevo movimiento», **Then** se abre un diálogo con el formulario de alta con los mismos campos, valores por defecto y validaciones que el formulario de edición: fecha (por defecto hoy), importe, concepto, descripción opcional, tipo Gasto/Ingreso, naturaleza del gasto cuando aplique y etiquetas; la cuenta es la de la página, sin selector.
2. **Given** el diálogo de alta abierto, **When** envío datos válidos, **Then** el movimiento se guarda, el diálogo se cierra, aparece la confirmación y el listado, el balance acumulado y el cierre mensual muestran los datos recalculados (el movimiento aparece en su mes; si su fecha cae fuera del mes visible, la vista visible no cambia).
3. **Given** el diálogo de alta abierto, **When** envío datos inválidos (importe vacío, fecha ausente…), **Then** el diálogo permanece abierto con los errores de campo del flujo de alta actual y los valores introducidos conservados, para corregir y reintentar.
4. **Given** el diálogo de alta abierto, **When** lo cancelo o lo cierro, **Then** no se guarda nada y vuelvo a la página tal cual estaba, con el CTA disponible para volver a empezar con el formulario limpio.
5. **Given** un mes sin movimientos, **When** abro la página de la cuenta en ese mes, **Then** el estado vacío del listado se muestra junto a un CTA «Nuevo movimiento» operativo: el alta nunca queda inaccesible por no haber movimientos.
6. **Given** la página de una cuenta tras esta feature, **When** la recorro, **Then** ya no existe el bloque de formulario de registro embebido: el orden es selector de mes/año → listado (con su CTA) → balance acumulado → cierre mensual.

### Edge Cases

- Mes visible vacío: el CTA debe seguir disponible aunque no haya movimientos (el estado vacío se renderiza dentro del propio listado, conforme a la convención; el CTA acompaña al listado, no a una fila).
- Alta con la vista puesta en un mes pasado: la fecha por defecto es hoy (comportamiento actual del formulario); el movimiento se registra en la fecha elegida y aparece en el listado del mes de esa fecha, no necesariamente en el mes visible.
- Errores de validación: el diálogo no se cierra; los errores por campo y los valores persisten igual que en el formulario embebido actual.
- Doble envío / envío en curso: el botón de guardado se deshabilita mientras se procesa, igual que en los formularios actuales.
- Registros consecutivos: tras guardar, el diálogo se cierra; para registrar otro movimiento se vuelve a abrir con el formulario limpio.
- Cierre con datos a medias: se descarta sin confirmación (mismo comportamiento que el diálogo de edición de 003).
- Movimiento guardado que pertenece a otro mes/cuenta distinta de la vista: la revalidación existente ya actualiza las vistas afectadas; la página visible solo cambia si el movimiento le corresponde.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La sección del listado de movimientos de la página de cuenta MUST incluir un CTA «Nuevo movimiento» que abre un diálogo con el formulario de alta. El CTA MUST estar disponible en cualquier mes visible, incluidos los meses sin movimientos.
- **FR-002**: El formulario del diálogo MUST ser el flujo de alta actual (002) con los mismos campos, valores por defecto, reglas y mensajes de validación que hoy, presentado como el diálogo de edición de 003: fecha (hoy por defecto), importe, concepto, descripción opcional, tipo Gasto/Ingreso, naturaleza del gasto cuando aplique y etiquetas múltiples. La cuenta MUST quedar fijada a la cuenta de la página (sin selector de cuenta), como hace hoy el formulario embebido.
- **FR-003**: Al guardar con éxito, el diálogo MUST cerrarse, mostrarse la confirmación correspondiente y la vista MUST reflejar los datos recalculados (listado, balance acumulado y cierre mensual) mediante la revalidación existente. Ante errores de validación, el diálogo MUST permanecer abierto con los errores por campo y los valores introducidos. Cancelar o cerrar MUST descartar la entrada sin efectos.
- **FR-004**: El formulario de registro embebido MUST eliminarse de la página de detalle de la cuenta: el CTA con diálogo pasa a ser la única vía de alta de movimientos en la aplicación.
- **FR-005**: El alcance MUST limitarse a la capa de presentación de la página de cuenta: reutilización del caso de uso de alta y de su Server Action sin cambios de dominio, aplicación ni persistencia; sin migraciones; sin consultas nuevas. Los diálogos se montan a nivel del componente listado, nunca dentro de una fila, conforme a la convención del proyecto.
- **FR-006**: Los tests existentes del flujo de alta (unitarios, de componentes y e2e) MUST adaptarse al nuevo punto de entrada (abrir el diálogo antes de rellenar) manteniendo lo que verifican; el flujo crítico de registro MUST seguir cubierto por e2e (constitución III). El CTA y el diálogo (apertura, alta feliz, error de validación, cancelación) MUST tener cobertura automatizada.
- **FR-007**: Interfaz en español; importes en formato EUR es-ES con dos decimales, reutilizando los helpers de formateo existentes. Las demás páginas (`/`, `/summary`, `/annual`) y la navegación global MUST permanecer sin cambios.

### Key Entities

- Ninguna nueva. Reutiliza **Cuenta**, **Movimiento** y **Tag** tal cual; la feature cambia el punto de entrada UI del caso de uso `CreateMovement` existente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede registrar un movimiento completo desde la página de la cuenta en una única interacción continua (abrir diálogo → rellenar → guardar → ver el movimiento en el listado), sin recargar ni salir de la página.
- **SC-002**: La página de cualquier cuenta ya no muestra el formulario de registro embebido en ningún mes: el formulario solo existe dentro del diálogo del CTA «Nuevo movimiento».
- **SC-003**: El 100 % de la funcionalidad previa sigue operativa (alta vía diálogo, edición, eliminación, navegación de meses, cierre, balance) y las suites de pruebas quedan en verde tras adaptar el punto de entrada del alta.
- **SC-004**: La página de cuenta sin formulario embebido reduce su altura visible: selector + listado + CTA son alcanzables con menos desplazamiento que antes en un viewport de escritorio estándar.

## Assumptions

- El CTA es un botón situado junto al listado (cabecera de la sección «Movimientos del mes»/estado vacío); la posición y apariencia exactas se deciden en el plan, manteniéndolo visible también en meses vacíos.
- El diálogo replica el patrón del diálogo de edición: se cierra con éxito (con toast de confirmación) y permanece abierto ante errores de campo; se descarta sin confirmación al cancelar.
- La fecha por defecto del alta sigue siendo hoy, con la vista del mes que sea (comportación actual); no se pre-rellena con el mes visible.
- La cuenta queda fijada a la de la página (como el formulario embebido actual); un selector de cuenta en el alta queda fuera de alcance.
- El flujo de alta (Server Action, validación Zod, caso de uso, revalidación) se reutiliza sin cambios: solo cambia el componente de UI que lo invoca.
- Los e2e existentes que hoy usan el botón «Registrar» del formulario embebido (registro, edición, cierre, resumen, anual, página de cuenta) se actualizan para abrir primero el diálogo del CTA; las verificaciones que hacen no se debilitan. El aislamiento entre specs (combinación propia cuenta/mes, orden alfabético sobre `e2e.sqlite`) se mantiene.
- Escritorio primero (decisión del propietario, 2026-09-27): usable en móvil, sin optimización específica.
- El rediseño del formulario en sí (nota única, chips, selector de fecha propio) es `014-formulario-nota-tags`; esta feature usa el formulario actual tal cual.
- La numeración 013 coincide con la fila reservada del roadmap maestro; al completar la feature, su fila pasa a «Completada».

## Out of Scope

- Formulario rediseñado con nota única y chips (`014-formulario-nota-tags`).
- Selector de cuenta dentro del diálogo de alta (registrar en otra cuenta sin salir de la página).
- Modo de entrada por lotes (diálogo que permanece abierto tras guardar), atajos de teclado y autoguardado.
- Cambios en `/`, `/summary`, `/annual`, en la navegación global o en los diálogos de edición/eliminación existentes.
- Cambios de dominio, aplicación, persistencia o de datos; migraciones.
- Optimización móvil específica, dark mode y animaciones de transición.
