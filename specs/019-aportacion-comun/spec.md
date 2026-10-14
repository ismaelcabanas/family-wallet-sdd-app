# Feature Specification: Aportación porcentual a la cuenta común por miembro

**Feature Branch**: `feature/019-aportacion-comun`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "Para cada usuario/cuenta, no la cuenta común, necesito configurar la aportación que hacen cada mes. Cada usuario, cada mes da un porcentaje de sus ingresos como aportación a la cuenta común. Por tanto, es una característica que se debe configurar a nivel de usuario."

**Fuente**: Petición directa del propietario (2026-10-09), segunda parte del split decidido ese día (primera parte: `018-ingresos-regulares`). **Se construye sobre 018**: el porcentaje se aplica sobre el ingreso del miembro. Revive el alcance que el roadmap maestro dejó diferido sobre aportaciones a la cuenta común (transferencias entre cuentas; `specs/001-family-wallet/spec.md`, sección de alcance diferido, que fijaba provisionalmente que las aportaciones «se anotan como ingresos en dicha cuenta»). Redactada el 2026-10-09 y **actualizada el 2026-10-14**: 018 y `020-menu-configuracion-cuenta` ya están completadas y la superficie de configuración de 018 pasó del panel de la página de cuenta al menú ⋮ de la tarjeta de cuenta (020); esta feature añade su entrada en ese menú.

**Decisiones del propietario (2026-10-09)**:

- **División en dos features**: 018 (ingresos regulares) primero; esta feature (019) después, construyéndose sobre la configuración de ingreso regular de 018. 019 **no puede planificarse ni implementarse antes** de que 018 esté completada.
- La configuración es **a nivel de miembro** (usuario), no de la cuenta común: cada miembro configura su porcentaje de aportación.
- **Base de cálculo**: el porcentaje se aplica **solo sobre el ingreso regular configurado (018)**; los ingresos extra registrados a mano no aumentan la aportación.
- **Representación**: la aportación se anota como **un único gasto en la cuenta personal del miembro, con la etiqueta «Aportación Común»**. Por el momento **no hay doble anotación**: la cuenta común no recibe contrapartida automática (quien quiera reflejar la entrada en la común la registra a mano, como hoy).

**Granularidad** (constitución II): una única user story pequeña con valor propio — configurar una vez el porcentaje y dejar de calcular y registrar la aportación a mano cada mes. No aplica excepción.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar el porcentaje de aportación y verlo generado automáticamente cada mes (Priority: P1)

Como miembro de la familia con ingreso regular, quiero configurar qué porcentaje de mi ingreso aporto cada mes a la cuenta común, para que la aportación se calcule y se registre automáticamente al consultar el mes, sin cálculos ni capturas manuales.

**Why this priority**: Es la única historia de la feature y su razón de ser: hoy la aportación a la cuenta común se calcula mentalmente y se registra a mano cada mes; automatizarla elimina el último asiento repetitivo del ciclo mensual.

**Independent Test**: Se puede probar configurando un ingreso regular de 2.000 € (018) y una aportación del 25 %, y consultando después el mes en curso: la cuenta personal muestra el gasto de 500 € con la etiqueta «Aportación Común» sin captura manual; reconsultar el mes no produce duplicados.

**Acceptance Scenarios**:

1. **Given** un miembro con ingreso regular de 2.000 € configurado (018) y sin aportación configurada, **When** configura una aportación del 25 % y consulta el mes en curso, **Then** su cuenta personal muestra un movimiento de gasto de 500 € (25 % de 2.000 €) con la etiqueta «Aportación Común», sin que medie registro manual y sin cambio automático en la cuenta común.
2. **Given** un mes cuya aportación ya aparece, **When** el mes se consulta repetidas veces y desde distintas vistas, **Then** la aportación aparece exactamente una vez: nunca se duplica.
3. **Given** una aportación activa del 25 %, **When** el miembro cambia el porcentaje al 30 %, **Then** los meses ya generados conservan su aportación del 25 % (editables a mano como cualquier movimiento) y los meses posteriores aún no generados se materializan con el 30 %.
4. **Given** una aportación generada automáticamente, **When** el miembro la edita, **Then** la edición persiste y ninguna consulta posterior la sobrescribe.
5. **Given** la aportación generada de un mes, **When** el miembro la elimina, **Then** desaparece de ese mes y no vuelve a generarse al consultar de nuevo ese mes.
6. **Given** una aportación activa, **When** el miembro la desactiva, **Then** no se generan aportaciones en meses posteriores y las ya generadas permanecen intactas.
7. **Given** el formulario de configuración, **When** se intenta guardar con porcentaje vacío, cero, negativo o mayor que 100, **Then** la configuración se rechaza con un mensaje claro y sin guardar nada.
8. **Given** la cuenta común, **When** se busca dónde configurar la aportación, **Then** no existe configuración de aportación para la cuenta común: la configuración vive en los miembros con cuenta personal.
9. **Given** una aportación activa y el mes en curso consultado, **When** se navega a un mes futuro, **Then** ese mes futuro no muestra ninguna aportación generada.
10. **Given** un miembro sin ingreso regular configurado (018), **When** consulta un mes, **Then** no se genera ninguna aportación para ese miembro y la configuración de aportación refleja con claridad que falta el ingreso regular.

---

### Edge Cases

- **Redondeo al céntimo**: porcentajes que no producen importes exactos (p. ej. 33,33 % de 2.000 € = 666,60 €; 25 % de 1.500,50 €) se resuelven con una regla de redondeo determinística al céntimo; la misma entrada produce siempre el mismo importe.
- **Porcentaje con decimales** (p. ej. 12,5 %): se admite con precisión limitada (hasta 2 decimales); precisiones mayores se rechazan o redondean con mensaje claro.
- **Alta a mitad de mes en curso**: la configuración creada con el mes ya avanzado materializa la aportación del mes en curso en la siguiente consulta del mes.
- **Meses anteriores a la activación**: no se generan nunca, aunque se consulten; evita duplicar el histórico ya registrado a mano.
- **Cambio del importe del ingreso regular (018)**: los meses ya generados no cambian; los meses aún no generados calculan la aportación sobre el nuevo importe cuando se materialicen.
- **Ingreso regular editado manualmente en un mes**: la aportación de ese mes no se recalcula por el cambio — se calcula sobre la configuración en el momento de generarse (mismas semánticas solo-adelante de 018).
- **Ingreso regular eliminado en un mes** (018: borrado definitivo): la aportación ya generada de ese mes permanece; es editable/eliminable a mano.
- **Aportaciones extraordinarias** (importes extra puntuales): quedan fuera de la generación automática; se registran a mano como hoy.
- **Dos miembros**: porcentajes completamente independientes; lo que ocurre con una configuración no afecta a la otra.
- **Etiqueta «Aportación Común»**: el gasto generado la necesita (obligatoria en gastos); el sistema la garantiza disponible. Si el usuario la desactiva o modifica en el futuro (mantenimiento de catálogo), la generación existente no se rompe (detalle de resolución en el plan).
- **Doble envío del formulario de configuración**: los controles se deshabilitan mientras se guarda (mismo patrón anti-doble-envío que el guardado de movimiento).
- **Rendimiento**: la materialización de la aportación no degrada apreciablemente la apertura del mes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (configuración por miembro)**: El sistema MUST permitir configurar, para cada miembro con cuenta personal, una aportación mensual a la cuenta común definida por: porcentaje de los ingresos (obligatorio, mayor que cero y como máximo 100, hasta 2 decimales) y estado (activa/inactiva). La configuración MUST poder editarse y desactivarse en cualquier momento. La cuenta común MUST carecer de configuración de aportación.
- **FR-002 (cálculo y generación automática e idempotente)**: El sistema MUST garantizar que, para cada mes desde el mes de activación de la configuración hasta el mes en curso inclusive, al consultar el mes exista la aportación del miembro con importe igual al porcentaje aplicado sobre su ingreso regular configurado (018), redondeado al céntimo con regla determinística. La generación MUST ser idempotente: consultas repetidas del mismo mes, desde cualquier vista, nunca producen duplicados.
- **FR-003 (representación contable)**: La aportación generada MUST materializarse como **un único movimiento de gasto en la cuenta personal del miembro, con la etiqueta «Aportación Común»** (la etiqueta MUST existir en el catálogo), sin contrapartida automática en la cuenta común. La aportación MUST computar en cierre mensual, resumen global mensual y cuenta de resultados anual con las reglas actuales de cada vista, y MUST ser editable y eliminable con los flujos existentes.
- **FR-004 (semántica solo hacia adelante)**: Los cambios de porcentaje o del importe del ingreso regular (018) MUST aplicar únicamente a los meses aún no generados; los meses ya generados conservan su aportación. La eliminación de la aportación de un mes MUST ser definitiva para ese mes (no se regenera). La desactivación MUST detener la generación futura conservando lo ya generado.
- **FR-005 (sin retroactivo ni futuro)**: El sistema MUST no generar aportaciones para meses anteriores a la activación ni para meses futuros, aunque dichos meses se consulten.
- **FR-006 (requisito: ingreso regular)**: Si el miembro no tiene ingreso regular configurado (018) y la base de cálculo lo requiere, el sistema MUST no generar aportaciones y la interfaz de configuración MUST indicar con claridad esa dependencia.
- **FR-007 (acceso desde el menú de configuración de la tarjeta)**: La configuración de la aportación MUST ser accesible desde el menú de configuración (⋮) de la tarjeta de la cuenta personal en el panel de cuentas (`/`), añadiendo su entrada junto a «Ingreso regular» y con indicación de su estado (sin configurar / activa / desactivada), conforme al menú definido en `020-menu-configuracion-cuenta`. La página de la cuenta MUST permanecer libre de configuración (020). Los literales exactos y el marcado del estado se congelan en el ui-contract del plan.
- **FR-008 (actualización del roadmap maestro)**: Al completar la feature, el roadmap maestro MUST registrar la fila 019 (Completada) y amendar la línea de alcance diferido sobre aportaciones a la cuenta común: la aportación mensual porcentual queda cubierta por esta feature como gasto en la cuenta personal con la etiqueta «Aportación Común», revocando la asunción provisional de anotarla como ingreso en la cuenta común (la contrapartida en la común, si se quiere reflejar, sigue siendo manual).
- **FR-009 (cobertura de tests)**: La feature MUST estar cubierta por tests: unidad/dominio-aplicación de la configuración, el cálculo del porcentaje (redondeo determinístico, límites 0–100, base de cálculo) y la generación (idempotencia, solo-adelante, sin retroactivo ni futuro), componentes de la interfaz de configuración, y un flujo e2e que configure ingreso regular y porcentaje, consulte el mes y verifique la aportación sin duplicados, con su propia combinación cuenta/mes (convención de aislamiento e2e; constitución III).

### Key Entities

- **Aportación común (nuevo)**: Configuración propiedad de un miembro: porcentaje, estado (activa/inactiva) y mes de activación. Calcula un importe mensual (porcentaje sobre el ingreso regular) y materializa el gasto de la aportación. Término de dominio; nombre en código (p. ej. `CommonContribution`) y glosario definitivo en el data-model del plan.
- **Ingreso regular (018, sin cambios)**: base sobre la que se aplica el porcentaje.
- **Menú de configuración de la tarjeta (020, afectado)**: gana el ítem «Aportación» (o literal equivalente) con su estado, junto a «Ingreso regular»; la aportación no añade superficies de configuración nuevas.
- **Movimiento (sin cambios estructurales)**: la aportación generada es un movimiento de gasto corriente (etiqueta «Aportación Común», obligatoria en gastos); su naturaleza se fija en las suposiciones de esta spec.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Configurar la aportación por primera vez toma menos de 1 minuto y elimina el cálculo y captura manuales: tras configurar, el mes en curso ya muestra la aportación sin ningún alta manual.
- **SC-002**: Consultas repetidas del mismo mes (5 o más) desde distintas vistas producen exactamente 1 aportación por miembro configurado: 0 duplicados.
- **SC-003**: El 100 % de los meses desde la activación hasta el mes en curso muestra la aportación con el importe correcto (porcentaje sobre la base decidida, redondeado al céntimo) al consultarse por primera vez.
- **SC-004**: Cierre mensual, resumen global mensual y cuenta de resultados anual computan la aportación conforme a las reglas actuales: el saldo de la cuenta personal refleja la salida, y la cuenta común no cambia automáticamente.
- **SC-005**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde, con el flujo «configurar ingreso regular + porcentaje → consultar mes → ver aportación sin duplicados» cubierto end-to-end.

## Assumptions

- **Generación perezosa al consultar** (mismo default informado que 018, aplicable a una app serverless sin planificador): el comportamiento observable es «al consultar el mes, la aportación ya está»; el mecanismo interno (materialización en lectura u otra vía equivalente) es decisión del plan.
- **Sin doble anotación** (decisión del propietario, 2026-10-09): la aportación solo genera el gasto en la cuenta personal; la cuenta común no recibe contrapartida automática. Reflejar la entrada en la común queda manual, como hoy.
- **Naturaleza del gasto generado** (default informado): común — la aportación es dinero destinado a los gastos comunes; coherente con la etiqueta «Aportación Común». Si el plan detecta distorsión en los agregados (p. ej. doble cómputo frente a los gastos anotados en la cuenta común), se revisa en clarify/plan.
- **Base de cálculo** (decisión del propietario, 2026-10-09): el ingreso regular configurado (018), estable y predecible; los extras manuales no la alteran.
- **Aportaciones extraordinarias** (p. ej. la aportación fija extraordinaria del histórico): se registran a mano como hoy; la generación automática solo cubre el porcentaje mensual.
- **Valores por defecto** de día y nota de las anotaciones generadas: coherentes con 018 (día 1 y nota descriptiva; literales exactos en el plan).
- Moneda EUR con aritmética en céntimos enteros y redondeo al céntimo (ADR 0007).
- La configuración es un flujo propio: no toca los formularios de alta/edición de movimiento (013/014) ni la tanda de captación continua.
- Esta feature depende de 018: no se planifica ni implementa antes de que 018 esté completada; esta spec fija el contrato sobre la configuración de ingreso regular definida allí.
- Los e2e de la feature operarán en su propia combinación cuenta/mes y en fichero propio, conforme a la convención de aislamiento del proyecto.

## Out of Scope

- **Contrapartida automática en la cuenta común (doble anotación)**: diferida por decisión del propietario (2026-10-09); posible feature futura si se quiere reflejar automáticamente la entrada en la común.
- Transferencias arbitrarias entre cuentas y seguimiento del ahorro (siguen diferidos en el roadmap maestro, salvo la amenda de FR-008).
- Aportaciones extraordinarias o variables automáticas (reglas distintas del porcentaje mensual).
- Configuración de aportación en la cuenta común o a la inversa (de la común a las personales).
- Relleno retroactivo o importación de histórico de aportaciones.
- Cambios en las reglas de cierre mensual, cuadre, resumen global o cuenta de resultados anual: las anotaciones generadas computan con las reglas actuales.
- Notificaciones, recordatorios o generación por calendario real (cron).
- Optimización móvil específica, dark mode y animaciones.
