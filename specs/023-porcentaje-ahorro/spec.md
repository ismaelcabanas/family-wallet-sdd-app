# Feature Specification: Porcentaje de ahorro por miembro con apartado mensual

**Feature Branch**: `feature/023-porcentaje-ahorro`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Porcentaje de ahorro por miembro sobre su ingreso regular: configuración única del porcentaje (requiere ingreso regular de 018) desde un ítem «Ahorro» del menú ⋮ de la tarjeta de la cuenta personal (patrón 020/019) y apartado mensual del importe resultante (p. ej. 10 % de una nómina de 3.000 € = 300 €) con la mecánica de la aportación común (019: materialización perezosa e idempotente al consultar el mes, descontando el importe del balance) y KPI propio en el bloque «KPIs del mes» junto a la aportación común y el saldo del mes (amienda el contrato congelado de 022)."

**Fuente**: Petición del propietario (2026-10-26), registrada en el roadmap maestro como fila `023-porcentaje-ahorro` (nota del 2026-10-26). **Construye sobre** `018-ingresos-regulares` (base de cálculo), `019-aportacion-comun` (mecánica perezosa e idempotente; superficie de configuración vía `020-menu-configuracion-cuenta`) y `022-kpis-fijos-cuenta` (bloque «KPIs del mes», cuyo contrato congela esta feature al añadir la métrica de ahorro y la deducción del disponible). Todas completadas.

**Decisiones del propietario (2026-10-26)**:

- **Motivación**: pagarse a uno mismo primero — apartar sistemáticamente una fracción del ingreso del mes antes de gastar, con el importe descontado del disponible para que el usuario sepa cuánto puede gastar durante el mes.
- Configuración única del **porcentaje de ahorro** por miembro (requiere ingreso regular de 018), desde un ítem «Ahorro» del menú ⋮ de la tarjeta de la cuenta personal (patrón 020/019).
- **KPI propio en el bloque «KPIs del mes»** junto a la aportación común y el saldo del mes (amienda el contrato congelado de 022).
- **No equivale** al «seguimiento del ahorro como tipo de movimiento» del alcance diferido del roadmap maestro, que sigue pendiente.
- Sin cambios esperados en la cuenta común.

**Decisiones cerradas durante la especificación (respuestas del propietario, 2026-10-26)**:

- **Forma del apartado**: **únicamente informativo y restado del disponible** — no se materializa como movimiento; el importe se muestra descontado de lo que el usuario puede gastar en el mes, para que tenga conocimiento de ello de forma continua.
- **Base de cálculo**: **plana sobre el ingreso bruto regular configurado** (10 % de 3.000 € = 300 €), sin interacción con el descuento de gastos comunes de 021 ni con la aportación de 019.
- **Régimen temporal**: **paridad plena con 018/019**, adaptada a que no existe movimiento que borrar (solo-adelante, desactivación/reactivación con reset del mes de activación, meses cerrados congelados).

La realización UI de la deducción quedó cerrada en clarify (2026-10-26): **el KPI de saldo se muestra neto de ahorro** (saldo de movimientos − ahorro), sin KPI «Disponible» propio; los literales exactos y el orden de las 3 métricas se congelan en el ui-contract del plan. La spec exige el resultado observable: el saldo visible del mes, neto del ahorro, coherente y continuo.

**Granularidad** (constitución II): una única user story pequeña con valor propio — configurar una vez el porcentaje y ver automáticamente el apartado restado de lo que se puede gastar cada mes, de forma continua. No aplica excepción.

## Clarifications

### Session 2026-10-26

- Q: ¿Realización UI de la deducción: KPI «Disponible» propio junto al «Saldo del mes» intacto, o saldo mostrado neto de ahorro? → A: **«Saldo del mes» neto de ahorro** — sin KPI «Disponible» propio: el bloque «KPIs del mes» muestra 3 métricas (aportación común, ahorro del mes y saldo neto = ingresos − gastos − ahorro).
- Q: ¿Bloquear la configuración de ahorro sin ingreso regular activo o permitir guardarla sin efecto? → A: **Bloquear, espejo de 019**: ítem «Ahorro» deshabilitado con «Requiere ingreso regular» y guardado rechazado con error claro (`MissingRegularIncomeError`).
- Q: Si el ingreso regular está desactivado al consultar por primera vez un mes dentro de la ventana, ¿qué pasa con su deducción? → A: **No-op sin registrar (paridad 019)**: 0,00 € en ese mes y el mes queda abierto; si el ingreso se reactiva, una consulta posterior puede deducirlo.
- Q: ¿Rechazar o redondear porcentajes con decimales? → A: **El porcentaje de ahorro MUST ser un número entero** (sin decimales, 1–100): cualquier decimal (p. ej. 12,5 %) se rechaza con mensaje claro.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar el porcentaje de ahorro y verlo restado del disponible cada mes (Priority: P1)

Como miembro de la familia con ingreso regular (018), quiero configurar qué porcentaje de mi ingreso aparto cada mes como ahorro, para que el importe resultante se calcule automáticamente al consultar el mes y se muestre restado de lo que puedo gastar —de forma informativa, sin generar un movimiento— y de forma continua en el bloque «KPIs del mes», sin cálculos manuales.

**Why this priority**: Es la única historia de la feature y su razón de ser: hoy el ahorro es una intención que exige cálculo mental para saber cuánto queda disponible para gastar; automatizar el apartado y restarlo del disponible visible convierte «pagarse a uno mismo primero» en el comportamiento por defecto.

**Independent Test**: Se puede probar configurando un ingreso regular de 3.000 € (018) y un ahorro del 10 %, y consultando después el mes en curso: el bloque «KPIs del mes» muestra el ahorro de 300 € y el saldo del mes reducido en 300 € (neto de ahorro), sin ningún movimiento nuevo en el listado ni cambio en los agregados; reconsultar el mes no varía la deducción.

**Acceptance Scenarios**:

1. **Given** un miembro con ingreso regular de 3.000 € configurado (018) y sin ahorro configurado, **When** configura un ahorro del 10 % y consulta el mes en curso, **Then** su cuenta personal muestra el KPI de ahorro de 300 € y el saldo del mes neto (saldo visible = saldo de movimientos − 300 €), sin ningún movimiento nuevo en el listado y sin cambio alguno en la cuenta común.
2. **Given** un mes cuya deducción ya se muestra, **When** el mes se consulta repetidas veces y desde distintas vistas, **Then** la deducción aparece exactamente una vez y con importe estable: nunca se duplica ni se acumula.
3. **Given** un ahorro activo del 10 %, **When** el miembro cambia el porcentaje al 15 %, **Then** los meses ya consultados conservan su deducción del 10 % y los meses posteriores aún no consultados se calculan con el 15 %.
4. **Given** un ahorro activo, **When** el miembro lo desactiva, **Then** no se deduce ahorro en meses posteriores y los ya consultados conservan su deducción intacta; al reactivar, el mes de activación se resetea al mes en curso y el hueco inactivo no se deduce nunca.
5. **Given** el formulario de configuración, **When** se intenta guardar con porcentaje vacío, cero, negativo, mayor que 100 o con decimales (p. ej. 12,5), **Then** la configuración se rechaza con un mensaje claro y sin guardar nada.
6. **Given** la cuenta común, **When** se busca dónde configurar el ahorro, **Then** no existe configuración de ahorro para la cuenta común: la configuración vive en los miembros con cuenta personal.
7. **Given** un ahorro activo y el mes en curso consultado, **When** se navega a un mes futuro, **Then** ese mes futuro no muestra ninguna deducción de ahorro.
8. **Given** un miembro sin ingreso regular configurado (018), **When** consulta un mes y abre el menú ⋮ de su tarjeta, **Then** no se deduce ningún ahorro para ese miembro y el ítem «Ahorro» aparece deshabilitado con «Requiere ingreso regular», sin abrir diálogo (espejo de 019).
9. **Given** una cuenta personal con ahorro configurado, **When** consulto la página de la cuenta, **Then** el bloque «KPIs del mes» muestra el ahorro del mes junto a la aportación común y el saldo neto del ahorro (3 métricas), visible de forma continua mientras recorro el listado; sin ahorro configurado muestra «Sin ahorro configurado» / 0,00 € y el saldo neto coincide con el saldo de movimientos.
10. **Given** el selector ‹ mes/año › posicionado en un mes distinto al en curso, **When** consulto la cuenta, **Then** la deducción y los KPIs reflejan el mes consultado, coherentes con la configuración y las reglas de esa fecha.
11. **Given** un miembro con aportación común (019) y ahorro activos a la vez, **When** consulta el mes en curso, **Then** ambos apartados coexisten como configuraciones independientes: la aportación es un movimiento más y el ahorro solo una deducción informativa, sin validación cruzada entre sus porcentajes.
12. **Given** cualquier mes con ahorro deducido, **When** consulto el cierre mensual, el resumen global o la cuenta de resultados anual, **Then** ninguno computa el ahorro ni cambia sus importes: el ahorro es informativo y los agregados siguen basados en movimientos.

---

### Edge Cases

- **Redondeo al céntimo**: porcentajes que no producen importes exactos (p. ej. 7,5 % de 2.533,33 € = 190,00 €; 10 % de 3.000,05 € = 300,01 €) se resuelven con redondeo **half-up** al céntimo más próximo (.5 hacia arriba); la misma entrada produce siempre el mismo importe.
- **Porcentaje entero, sin decimales** (decisión del propietario, 2026-10-26): el porcentaje de ahorro MUST ser un número entero en (0, 100]; cualquier entrada con decimales (p. ej. 12,5 %) se rechaza con mensaje claro, sin redondeo. El redondeo half-up aplica solo al importe resultante, no al porcentaje.
- **Alta a mitad de mes en curso**: la configuración creada con el mes ya avanzado deduce el ahorro del mes en curso en la siguiente consulta del mes.
- **Meses anteriores a la activación**: nunca muestran deducción, aunque se consulten.
- **Cambio del importe del ingreso regular (018)**: los meses ya consultados conservan su deducción; los meses aún no consultados calculan el ahorro sobre el nuevo importe (solo-adelante).
- **Ingreso regular eliminado en un mes** (018: borrado definitivo de su movimiento): la deducción ya mostrada de ese mes se conserva con su importe (paridad con 019).
- **Ingreso regular desactivado en un mes aún sin deducción** (decisión del propietario, 2026-10-26): no-op sin registrar (paridad 019) — 0,00 € en ese mes y el mes queda abierto; si el ingreso se reactiva, una consulta posterior del mes puede deducirlo.
- **Saldo neto negativo o cero**: si el ahorro y los gastos superan los ingresos del mes, el saldo neto (KPI) se muestra tal cual (negativo), con la convención visual de importes existente, sin bloquear la configuración.
- **Coexistencia con la aportación común (019)**: porcentajes completamente independientes; el ahorro no altera la aportación ni viceversa, y no existe validación cruzada de la suma de porcentajes (el ahorro se valida como entero en (0, 100] y la aportación según su propia regla de 019, cada uno por separado).
- **Doble envío del formulario de configuración**: los controles se deshabilitan mientras se guarda (mismo patrón anti-doble-envío que el guardado de movimiento).
- **Rendimiento**: el cálculo de la deducción no degrada apreciablemente la apertura del mes.
- **Sin doble cómputo**: el saldo base del mes (ingresos − gastos de movimientos, contrato de 022 y base del cierre) no incluye el ahorro; el KPI de saldo lo resta explícitamente sobre ese saldo base, de modo que KPI y cierre son coherentes por construcción y, con ahorro > 0, difieren exactamente en el importe deducido (el cierre no computa ahorro, FR-007).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (configuración por miembro)**: El sistema MUST permitir configurar, para cada miembro con cuenta personal, un ahorro mensual definido por: porcentaje del ingreso regular (obligatorio, **número entero** mayor que cero y como máximo 100, sin decimales; decisión del propietario, 2026-10-26) y estado (activo/inactivo). La configuración MUST requerir ingreso regular activo (018): sin él, el ítem «Ahorro» MUST aparecer deshabilitado con «Requiere ingreso regular» y el guardado MUST rechazarse con error claro (espejo de 019, `MissingRegularIncomeError`; decisión del propietario, 2026-10-26). La configuración MUST poder editarse y desactivarse en cualquier momento. La cuenta común MUST carecer de configuración de ahorro. La configuración MUST ser accesible desde el ítem «Ahorro» del menú de configuración (⋮) de la tarjeta de la cuenta personal en el panel de cuentas (`/`), con indicación de su estado (requiere ingreso regular / sin configurar / activo / inactivo), conforme al menú definido en `020-menu-configuracion-cuenta`; la página de la cuenta MUST permanecer libre de configuración (020). Los literales exactos se congelan en el ui-contract del plan.
- **FR-002 (cálculo plano sobre el ingreso bruto)**: El importe del apartado MUST ser igual al porcentaje aplicado sobre el ingreso regular configurado del miembro (018), redondeado al céntimo con redondeo half-up (al céntimo más próximo, .5 hacia arriba). El cálculo MUST ser plano sobre esa base: sin interacción con el descuento de gastos comunes de 021 ni con la aportación de 019; los ingresos extra registrados a mano no alteran la base (decisión del propietario, 2026-10-26).
- **FR-003 (apartado informativo con deducción visible, sin movimiento)**: El sistema MUST garantizar que, para cada mes desde la activación de la configuración hasta el mes en curso inclusive, al consultar el mes exista la deducción del ahorro del miembro con el importe calculado según FR-002. La deducción MUST ser **únicamente informativa**: MUST NOT materializarse como movimiento (no aparece en el listado ni computa en el balance acumulado ni en ningún agregado) y MUST mostrarse **restada del disponible del mes** en la página de la cuenta personal, de modo que el usuario conozca de forma continua lo que puede gastar en el mes. El cálculo MUST ser perezoso (al consultar el mes) e idempotente (consultas repetidas del mismo mes, desde cualquier vista, muestran exactamente la misma deducción, nunca duplicada ni acumulada). MUST NOT calcularse deducción para meses anteriores a la activación ni para meses futuros, aunque se consulten (decisión del propietario, 2026-10-26). Si al consultar un mes aún sin deducción el ingreso regular está inactivo o ausente, MUST no deducirse nada y el mes MUST quedar abierto (no registrado), de modo que una consulta posterior con el ingreso reactivado pueda deducirlo (paridad 019).
- **FR-004 (régimen temporal: paridad 018/019)**: El régimen del cálculo MUST seguir la paridad de 018/019, adaptada a la ausencia de movimiento: solo-adelante (cambios de porcentaje o del importe del ingreso regular aplican únicamente a meses aún no consultados; los ya consultados conservan su deducción); la desactivación MUST detener la deducción en meses posteriores conservando lo ya mostrado; la reactivación MUST resetear el mes de activación al mes en curso, sin deducir el hueco inactivo; los meses cerrados MUST permanecer congelados con su deducción. No existe borrado del mes (no hay movimiento que borrar) y la deducción de un mes ya consultado MUST NOT cambiarse por consultas posteriores (decisión del propietario, 2026-10-26).
- **FR-005 (KPI propio y saldo neto en el bloque «KPIs del mes»)**: El bloque «KPIs del mes» de las cuentas personales (022) MUST incorporar la métrica de ahorro junto a la aportación común y el saldo del mes, con el mismo comportamiento de visibilidad continua (sticky de 022): **3 métricas** (aportación común, ahorro, saldo neto), sin KPI «Disponible» propio (decisión del propietario, 2026-10-26). El KPI de ahorro MUST mostrarse siempre en cuentas personales: sin configuración MUST mostrar «Sin ahorro configurado» y 0,00 €; con configuración MUST mostrar el importe deducido del mes consultado (0,00 € si ese mes no tiene deducción). El KPI de saldo MUST mostrarse **neto del ahorro** (saldo del mes de movimientos − ahorro deducido), de modo que el usuario vea lo que puede gastar neto del apartado; el saldo base de movimientos (contrato de 022, base del cierre) no incluye el ahorro. Ambos MUST reflejar el mes seleccionado en el selector ‹ mes/año › y MUST ser coherentes por construcción con la configuración y las reglas de cálculo (sin recálculos paralelos en la UI). El contrato UI de 022 queda amendado: literales y orden exactos se congelan en el ui-contract del plan.
- **FR-006 (independencia de configuraciones)**: La configuración de ahorro y la de aportación común (019) MUST ser independientes entre sí: cada una se valida, activa, desactiva y calcula por separado, sin validación cruzada de la suma de sus porcentajes.
- **FR-007 (agregados y balance acumulado sin cambios)**: Cierre mensual, resumen global mensual, cuenta de resultados anual y balance acumulado MUST permanecer basados en movimientos y sin cambios en sus reglas: el ahorro informativo MUST NOT computar en ellos. La página de la cuenta común MUST permanecer sin cambios.
- **FR-008 (actualización de documentación)**: Al completar la feature, el roadmap maestro MUST registrar la fila 023 como Completada, documentar la amenda al contrato de 022 (bloque KPIs con ahorro y disponible) y, si la implementación fija convenciones nuevas, MUST documentarlas en AGENTS.md.
- **FR-009 (cobertura de tests)**: La feature MUST estar cubierta por tests: unidad/dominio-aplicación de la configuración, el cálculo del porcentaje (redondeo determinístico del importe, porcentaje entero 1–100, base plana) y el cálculo informativo (idempotencia, solo-adelante, sin retroactivo ni futuro, congelado de meses cerrados), componentes de la interfaz de configuración y del bloque de KPIs (con ahorro, sin configuración, mes consultado distinto al en curso, saldo neto del ahorro), y un flujo e2e que configure ingreso regular y porcentaje, consulte el mes y verifique la deducción visible y estable sin movimiento alguno, con su propia combinación cuenta/mes (convención de aislamiento e2e; constitución III).

### Key Entities

- **Ahorro (nuevo)**: Configuración propiedad de un miembro: porcentaje, estado (activo/inactivo) y mes de activación. Calcula un importe mensual informativo (porcentaje sobre el ingreso regular) que se descuenta del disponible mostrado; no genera movimientos. Término de dominio; nombre en código (p. ej. `SavingsAllocation`) y glosario definitivo en el data-model del plan.
- **Ingreso regular (018, sin cambios)**: base sobre la que se aplica el porcentaje.
- **Aportación común (019, afectada solo por coexistencia)**: configuración hermana; permanece independiente (FR-006) y sigue materializándose como movimiento.
- **Menú de configuración de la tarjeta (020, afectado)**: gana el ítem «Ahorro» con su estado, junto a «Ingreso regular» y «Aportación»; el ahorro no añade superficies de configuración nuevas.
- **Bloque «KPIs del mes» (022, afectado)**: gana la métrica de ahorro y el saldo neto de ahorro en su KPI de saldo (contrato amendado por FR-005).
- **Movimiento (sin cambios)**: el ahorro no crea movimientos; el listado, el cierre y los agregados siguen moviéndose solo con movimientos reales (incluidos los materializados por 018/019).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Configurar el ahorro por primera vez toma menos de 1 minuto: tras configurar, el mes en curso ya muestra la deducción sin ninguna alta manual.
- **SC-002**: Consultas repetidas del mismo mes (5 o más) desde distintas vistas muestran exactamente 1 deducción con importe estable: 0 duplicaciones y 0 variaciones.
- **SC-003**: El 100 % de los meses desde la activación hasta el mes en curso muestra la deducción con el importe correcto (porcentaje plano half-up sobre el ingreso regular) al consultarse por primera vez.
- **SC-004**: El 100 % de las cuentas personales muestra el KPI de ahorro y el saldo neto del ahorro de forma continua junto a la aportación; la cuenta común, los agregados y el balance acumulado presentan 0 cambios.
- **SC-005**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde, con el flujo «configurar ingreso regular + porcentaje de ahorro → consultar mes → ver deducción estable y saldo neto del mes, sin movimiento» cubierto end-to-end.

## Assumptions

- **Apartado informativo (decisión del propietario, 2026-10-26)**: sin movimiento ni etiqueta asociada; la deducción vive solo en la página de la cuenta personal. Realización UI cerrada en clarify (2026-10-26): **saldo neto de ahorro** — el bloque «KPIs del mes» muestra 3 métricas (aportación común, ahorro, saldo neto = saldo de movimientos − ahorro), sin KPI «Disponible» propio; literales y orden se congelan en el ui-contract del plan. La spec exige el resultado observable: saldo visible neto del ahorro, coherente y continuo.
- **Cálculo plano (decisión del propietario, 2026-10-26)**: base = ingreso regular configurado (018), estable y predecible; sin interacción con 021/019.
- **Régimen temporal (decisión del propietario, 2026-10-26)**: paridad 018/019; el aparte de «borrado del mes definitivo» no aplica (no hay movimiento).
- **Cálculo perezoso al consultar** (mismo default informado que 018/019): el comportamiento observable es «al consultar el mes, la deducción ya está»; el mecanismo interno que garantiza idempotencia y solo-adelante (congelado por mes en un registro u otra vía equivalente) es decisión del plan.
- Moneda EUR con aritmética en céntimos enteros y redondeo half-up al céntimo (ADR 0007).
- La configuración es un flujo propio: no toca los formularios de alta/edición de movimiento (013/014/017) ni la tanda de captación continua.
- Esta feature depende de 018, 019 y 022 (completadas); fija su contrato sobre ellas sin modificar su semántica (salvo la amenda UI de 022).
- Los e2e de la feature operarán en su propia combinación cuenta/mes y en fichero propio, conforme a la convención de aislamiento del proyecto.

## Out of Scope

- **Materializar el ahorro como movimiento real** (gasto con etiqueta «Ahorro», doble anotación, cómputo en agregados): descartado por decisión del propietario (2026-10-26: informativo); posible feature futura si se quiere un asiento real.
- **«Seguimiento del ahorro como tipo de movimiento»** (alcance diferido del roadmap maestro): tipo propio de movimiento, cubos o destinos de ahorro, y transferencias entre cuentas.
- Mover el importe apartado a otra cuenta o destino, remuneración/interés del ahorro, metas de ahorro, presupuestos y proyecciones (siguen diferidos en el maestro).
- Interacción con el descuento de gastos comunes de 021 (el cálculo plano queda cerrado) o con la aportación de 019.
- Cambios en la página de la cuenta común (incluidos KPIs propios), en las reglas de cierre mensual, resumen global, cuenta de resultados anual o balance acumulado.
- Notificaciones, recordatorios o generación por calendario real (cron).
- Optimización móvil específica más allá del comportamiento responsivo estándar, dark mode y animaciones.
