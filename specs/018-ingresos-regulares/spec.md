# Feature Specification: Ingresos mensuales regulares por miembro

**Feature Branch**: `feature/018-ingresos-regulares`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "Para cada usuario/cuenta, no la cuenta común, necesito configurar la aportación que hacen cada mes. Cada usuario, cada mes da un porcentaje de sus ingresos como aportación a la cuenta común. Por tanto, es una característica que se debe configurar a nivel de usuario. También se debería configurar los ingresos mensuales, que lo normal es que sea algo regular, y que cada mes aparezca como un movimiento generado automáticamente. Quizás se podría dividir en 2 features separadas, primero la de la configuración de los ingresos, y posteriormente la de la aportación común de cada usuario."

**Fuente**: Petición directa del propietario (2026-10-09), sin fila previa en el roadmap maestro. Da por construidas `011-pagina-cuenta` (página propia por cuenta con selector de mes) y `014-formulario-nota-tags` (nota única, etiqueta opcional en ingresos). Hoy **todos los ingresos se registran a mano cada mes**; el más repetitivo es el ingreso habitual del miembro (p. ej. la nómina).

**Decisiones del propietario (2026-10-09)**:

- **División en dos features**: primero la configuración de los ingresos mensuales regulares (esta feature, 018); posteriormente la aportación porcentual a la cuenta común, que se construirá sobre el ingreso regular de 018 (feature hija futura, p. ej. 019). La aportación común revivirá el alcance que el roadmap maestro dejó diferido (transferencias/aportaciones a la cuenta común, `specs/001-family-wallet/spec.md`, sección de alcance diferido).
- La configuración es **a nivel de miembro** (usuario), no de la cuenta común: cada miembro configura su ingreso regular y este se materializa como movimiento de ingreso en su cuenta personal.

**Granularidad** (constitución II): una única user story pequeña con valor propio — configurar una vez el ingreso regular y dejar de registrarlo a mano cada mes. No aplica excepción.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar el ingreso mensual regular y verlo generado automáticamente (Priority: P1)

Como miembro de la familia con un ingreso mensual habitual (p. ej. la nómina), quiero configurarlo una sola vez en mi cuenta personal para que cada mes, al consultar el mes, el ingreso aparezca ya registrado como movimiento, sin tener que darlo de alta a mano.

**Why this priority**: Es la única historia de la feature y su razón de ser: hoy el ingreso de cada miembro se registra manualmente mes a mes; es la captura más repetitiva y predecible de toda la aplicación.

**Independent Test**: Se puede probar configurando un ingreso regular de 2.000 € para un miembro y consultando después el mes en curso en su cuenta personal: el movimiento de ingreso de 2.000 € aparece sin ninguna captura manual; reconsultar el mes (listado, cierre, resumen global, anual) no produce duplicados.

**Acceptance Scenarios**:

1. **Given** un miembro sin ingresos registrados en el mes en curso y sin configuración previa, **When** configura un ingreso regular de 2.000 € y consulta el mes en curso de su cuenta personal, **Then** el listado muestra un movimiento de ingreso de 2.000 € con el día y la nota de la configuración (o sus valores por defecto), sin que medie registro manual.
2. **Given** un mes cuyo ingreso regular ya aparece, **When** el mes se consulta repetidas veces y desde distintas vistas (listado de cuenta, cierre mensual, resumen global, cuenta de resultados anual), **Then** el ingreso aparece exactamente una vez: nunca se duplica.
3. **Given** una configuración activa de 2.000 €, **When** el miembro cambia el importe a 2.100 €, **Then** los meses ya generados conservan su movimiento de 2.000 € (editable a mano como cualquier movimiento) y los meses posteriores aún no generados se materializan con 2.100 €.
4. **Given** un ingreso generado automáticamente, **When** el miembro lo edita (importe, nota, día o etiqueta), **Then** la edición persiste y ninguna consulta posterior la sobrescribe.
5. **Given** el ingreso generado de un mes, **When** el miembro elimina ese movimiento, **Then** el ingreso desaparece de ese mes y no vuelve a generarse al consultar de nuevo ese mes.
6. **Given** una configuración activa, **When** el miembro la desactiva, **Then** no se generan ingresos en meses posteriores y los ya generados permanecen intactos.
7. **Given** el formulario de configuración, **When** se intenta guardar con importe vacío, cero o negativo, **Then** la configuración se rechaza con un mensaje claro y sin guardar nada.
8. **Given** la cuenta común, **When** se busca dónde configurar un ingreso regular, **Then** no existe configuración de ingreso regular para la cuenta común: la configuración vive en los miembros con cuenta personal.
9. **Given** una configuración activa y el mes en curso consultado, **When** se navega a un mes futuro, **Then** ese mes futuro no muestra ningún ingreso regular generado.

---

### Edge Cases

- **Alta a mitad de mes en curso**: la configuración creada con el mes ya avanzado materializa el ingreso del mes en curso en la siguiente consulta del mes.
- **Día de cobro posterior a la consulta**: el ingreso del mes en curso se genera completo aunque el día configurado no haya llegado aún (p. ej. día 25 consultado el día 9); no hay generación parcial ni aplazada.
- **Meses anteriores a la activación**: no se generan nunca, aunque se consulten; evita duplicar el histórico ya registrado a mano.
- **Pagas extra e ingresos irregulares** (p. ej. 14 pagas, extras de junio/diciembre): quedan fuera del ingreso regular; se registran a mano como hoy.
- **Dos miembros**: configuraciones completamente independientes (importe, día, nota, estado); lo que ocurre con una no afecta a la otra.
- **Importe con céntimos** (p. ej. 1.500,50 €): se admite y se guarda con precisión de 2 decimales; los cálculos tratan céntimos enteros, como el resto de la app.
- **Borrado + reactivación**: si se desactiva la configuración y se reactiva después, los meses sin generar del periodo inactivo no se rellenan retroactivamente; solo se materializa a partir de la reactivación (mismo criterio que el alta).
- **Doble envío del formulario de configuración**: los controles se deshabilitan mientras se guarda (mismo patrón anti-doble-envío que el guardado de movimiento).
- **Rendimiento**: la materialización del ingreso no degrada apreciablemente la apertura del mes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (configuración por miembro)**: El sistema MUST permitir configurar, para cada miembro con cuenta personal, un ingreso regular mensual definido por: importe (obligatorio, mayor que cero, EUR con 2 decimales), día del mes (opcional, con valor por defecto razonable) y nota (opcional, con valor por defecto descriptivo). La configuración MUST poder editarse y desactivarse en cualquier momento. La cuenta común MUST carecer de configuración de ingreso regular.
- **FR-002 (generación automática e idempotente)**: El sistema MUST garantizar que, para cada mes desde el mes de activación de la configuración hasta el mes en curso inclusive, al consultar el mes exista el movimiento de ingreso con el importe configurado. La generación MUST ser idempotente: consultas repetidas del mismo mes, desde cualquier vista, nunca producen duplicados.
- **FR-003 (un movimiento como cualquier otro)**: El ingreso generado MUST comportarse como un movimiento de ingreso corriente: aparece en el listado de la cuenta, cierre mensual, resumen global mensual y cuenta de resultados anual computando como cualquier ingreso, y puede editarse y eliminarse con los flujos existentes. Las ediciones manuales MUST respetarse: ninguna consulta posterior las sobrescribe.
- **FR-004 (semántica solo hacia adelante)**: Los cambios de importe MUST aplicar únicamente a los meses aún no generados; los meses ya generados conservan su movimiento. La eliminación del movimiento generado de un mes MUST ser definitiva para ese mes (no se regenera). La desactivación de la configuración MUST detener la generación futura conservando los movimientos ya existentes.
- **FR-005 (sin retroactivo ni futuro)**: El sistema MUST no generar ingresos regulares para meses anteriores a la activación ni para meses futuros, aunque dichos meses se consulten.
- **FR-006 (acceso desde la cuenta personal)**: La configuración del ingreso regular MUST ser accesible desde la página de la cuenta personal del miembro, con literales en español. La colocación exacta en la interfaz es decisión del plan.
- **FR-007 (actualización del roadmap maestro)**: Al completar la feature, el roadmap maestro MUST registrar la fila 018 (Completada) y dejar constancia de que la aportación porcentual a la cuenta común queda planificada como feature hija futura que se construye sobre el ingreso regular de 018 (revive el alcance diferido sobre aportaciones a la cuenta común).
- **FR-008 (cobertura de tests)**: La feature MUST estar cubierta por tests: unidad/dominio-aplicación de la configuración y su generación (idempotencia, semántica solo-adelante, sin retroactivo ni futuro, validación de importe), componentes de la interfaz de configuración, y un flujo e2e que configure el ingreso, consulte el mes y verifique el movimiento generado sin duplicados, con su propia combinación cuenta/mes (convención de aislamiento e2e del proyecto; constitución III).

### Key Entities

- **Ingreso regular (nuevo)**: Configuración propiedad de un miembro: importe mensual, día del mes, nota, estado (activa/inactiva) y mes de activación. Materializa movimientos de ingreso en la cuenta personal de su miembro. Término de dominio; nombre en código (p. ej. `RegularIncome`) y glosario definitivo en el data-model del plan.
- **Miembro (sin cambios)**: gana la relación «configura un ingreso regular».
- **Movimiento (sin cambios estructurales)**: los generados son movimientos de ingreso corrientes (tipo ingreso, sin naturaleza, etiqueta opcional); puede requerirse una marca de origen para sostener la idempotencia — decisión del plan.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Configurar el ingreso regular por primera vez toma menos de 1 minuto y elimina la captura manual mensual: tras configurar, el mes en curso ya muestra el ingreso sin ningún alta manual.
- **SC-002**: Consultas repetidas del mismo mes (5 o más) desde distintas vistas producen exactamente 1 movimiento de ingreso regular por miembro configurado: 0 duplicados.
- **SC-003**: El 100 % de los meses desde la activación hasta el mes en curso muestra el ingreso del miembro configurado al consultarse por primera vez.
- **SC-004**: Cierre mensual, resumen global mensual y cuenta de resultados anual computan el ingreso generado exactamente igual que un ingreso manual.
- **SC-005**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde, con el flujo «configurar → consultar mes → ver ingreso sin duplicados» cubierto end-to-end.

## Assumptions

- **Generación perezosa al consultar** (default informado, aplicable a una app serverless sin planificador): el comportamiento observable es «al consultar el mes, el ingreso ya está»; el mecanismo interno (materialización en lectura u otra vía equivalente) es decisión del plan.
- **Un único ingreso regular por miembro** (decisión del propietario, 2026-10-09): un solo importe/día/nota por miembro; ingresos adicionales o irregulares se registran a mano como hoy.
- **El borrado no regenera** (decisión del propietario, 2026-10-09): si se elimina el movimiento generado de un mes, no vuelve a generarse; la eliminación es la vía para dejar un mes sin ese ingreso.
- **Mes de activación** = mes en curso en el momento de crear (o reactivar) la configuración; sin relleno retroactivo del histórico.
- **Valores por defecto** del día y la nota: día 1 del mes y una nota descriptiva ligada al miembro (literal exacto en el plan); la etiqueta del ingreso generado queda vacía por defecto (es opcional en ingresos desde 014) y puede añadirse editando.
- Moneda EUR con aritmética en céntimos enteros, como el resto de la app (ADR 0007).
- La configuración es un flujo propio: no toca los formularios de alta/edición de movimiento (013/014) ni la tanda de captación continua.
- Los e2e de la feature operarán en su propia combinación cuenta/mes y en fichero propio, conforme a la convención de aislamiento del proyecto.

## Out of Scope

- **Aportación porcentual a la cuenta común** (feature hija futura, p. ej. 019): el % de los ingresos que cada miembro aporta mensualmente a la cuenta común. Construirá sobre 018 y revivirá el alcance diferido del roadmap maestro (transferencias/aportaciones).
- Múltiples ingresos regulares por miembro (si se confirma el default de un único ingreso).
- Transferencias entre cuentas y seguimiento del ahorro (siguen diferidos en el roadmap maestro).
- Notificaciones, recordatorios o generación por calendario real (cron).
- Relleno retroactivo o importación de histórico de ingresos.
- Cambios en cierre mensual, cuadre, resumen global o cuenta de resultados anual: los ingresos generados computan con las reglas actuales.
- Optimización móvil específica, dark mode y animaciones.
