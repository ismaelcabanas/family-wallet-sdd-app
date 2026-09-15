# Feature Specification: Resumen Mensual Global y Cuadre

**Feature Branch**: `feature/006-resumen-global-mensual`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Feature `006-resumen-global-mensual` del roadmap maestro (US3, prioridad P3): consultar un resumen mensual global que agregue todas las cuentas con desglose de gastos por naturaleza, tag y miembro, y comprobar el cuadre del mes comparando la variación calculada (ingresos − gastos) con la variación real del saldo declarada manualmente. Primera parte del split de la feature original `006-analisis-agregado` (la cuenta de resultados anual pasó a `009-cuenta-resultados-anual`)."

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (historia US3; requisitos FR-007 —resumen global con desgloses— y FR-012 —cuadre mensual—; entidad calculada "Cuadre mensual"; edge case "¿Qué ocurre si el cuadre mensual detecta un descuadre?"). Se apoya en el modelo y la terminología de `002-registro-movimientos` (naturaleza "personal"/"compartido", multi-tag, Miembro/Cuenta) y en la agregación por cuenta de `005-cierre-mensual` (cierre mensual como vista derivada, ADR 0009/0010).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el resumen mensual global (Priority: P1)

Como familia, queremos ver, para el mes seleccionado, un resumen global que agregue las tres cuentas: total de ingresos, total de gastos, gastos compartidos (incluidos los pagados desde cuentas personales), gastos personales, saldo del mes global y desgloses de gastos por tag y por miembro, para conocer la situación financiera de la familia sin cruzar manualmente los cierres de cada cuenta.

**Why this priority**: Es la primera salida de valor a nivel de familia: replica el cruce manual de los tres Excel de Balance que hoy se hace a mano. Es una vista de solo lectura sobre el modelo existente (agregación de los cierres por cuenta de 005) y no bloquea a US2: entrega valor por sí sola.

**Independent Test**: Se puede probar registrando movimientos del mismo mes en las tres cuentas y verificando que cada total global coincide con la suma de los cierres por cuenta de 005 y con el cálculo manual sobre el mismo conjunto.

**Acceptance Scenarios**:

1. **Given** movimientos del mes en las tres cuentas, **When** abro el resumen global del mes, **Then** el total de gastos coincide con la suma de los gastos de las tres cuentas (e igualmente ingresos, gastos compartidos, gastos personales y saldo del mes global).
2. **Given** gastos marcados como personales y como compartidos (incluidos compartidos pagados desde cuentas personales), **When** consulto el resumen global, **Then** el total de gastos compartidos incluye los pagados desde cuentas personales, y el desglose por miembro muestra los gastos personales y compartidos de cada miembro (los pagados desde su cuenta personal).
3. **Given** un gasto con varias tags (p. ej. "supermercado" + "vacaciones"), **When** consulto el desglose global por tag, **Then** el gasto computa en cada una de sus tags sin duplicar el total global de gastos.
4. **Given** un mes en el que una cuenta no tiene movimientos y las otras sí, **When** abro el resumen global, **Then** la cuenta vacía aporta cero a los totales y el resumen global cuadra con la suma de los cierres por cuenta, sin errores.
5. **Given** el resumen global de un mes, **When** cambio el mes, **Then** todos los totales y desgloses se recalculan para el nuevo mes en la misma vista.

### User Story 2 - Cuadrar el mes con los saldos reales declarados (Priority: P2)

Como familia, queremos declarar el saldo real inicial y final de cada cuenta y que el sistema compruebe automáticamente el cuadre —variación calculada (ingresos − gastos) frente a variación real del saldo, por cuenta y en global— señalando el importe de cualquier descuadre y la cuenta donde se produce, para detectar olvidos o errores de registro sin hacer la comprobación manual del "Saldo CUENTA CORRIENTE".

**Why this priority**: El cuadre es la garantía de calidad del registro: hoy se hace a mano y depende de que el resultado "cuadre". Añade la única escritura nueva de la feature (los saldos declarados por cuenta) y depende del resumen global (P1), pero entrega valor incremental claro: convierte el resumen en una comprobación activa que, además, localiza en qué cuenta está el olvido.

**Independent Test**: Se puede probar registrando movimientos en varias cuentas, declarando los saldos reales de cada cuenta y verificando que el cuadre detecta tanto un mes cuadrado (diferencia 0,00 €) como un descuadre con el importe exacto, señalando la cuenta responsable.

**Acceptance Scenarios**:

1. **Given** los saldos reales inicial y final de todas las cuentas declarados, **When** la variación real agregada coincide con la calculada (ingresos − gastos global), **Then** el mes se muestra como cuadrado en global y por cuenta, sin diferencia.
2. **Given** los saldos reales de todas las cuentas declarados, **When** la variación real de una cuenta difiere de su variación calculada, **Then** el cuadre global señala el descuadre con su importe exacto (p. ej. "faltan 35,20 €") y el desglose por cuenta localiza en cuál se produce.
3. **Given** un mes con una o varias cuentas sin saldos declarados, **When** abro su cuadre, **Then** esas cuentas (y el global) se muestran como pendientes de declarar, sin errores ni cálculos parciales.
4. **Given** saldos ya declarados de una cuenta y mes, **When** los corrijo y guardo, **Then** el cuadre de esa cuenta y el global se recalculan con los nuevos valores sin pasos manuales.
5. **Given** un mes con descuadre detectado, **When** registro o edito movimientos (002/003), **Then** nada se bloquea: el descuadre se muestra como aviso visual y el cuadre se recalcula con cada cambio.

### Edge Cases

- Mes sin movimientos: totales globales a cero (como el cierre por cuenta de 005); si hay saldos declarados, el cuadre compara contra variación calculada cero.
- Descuadre: cubierto por el escenario 2 de US2 —se marca visualmente con el importe, sin bloquear el registro— (edge case del maestro).
- Saldos declarados a medias: si a una cuenta le falta el inicial o el final, su cuadre queda pendiente; el cuadre global solo se calcula cuando las tres cuentas tienen ambos saldos declarados (nunca se agregan datos parciales).
- Re-declaración de saldos de meses pasados: permitida; el cuadre de esa cuenta y el global se recalculan.
- Saldos reales negativos o cero: válidos (una cuenta puede estar en números rojos); la validación solo rechaza valores no numéricos o mal formados, a diferencia de los importes de movimiento (siempre > 0).
- Gasto multi-tag en el desglose global: cubierto por el escenario 3 de US1 (computa en cada tag sin duplicar el total global).
- Movimientos fechados en otros meses o futuros: no computan en el resumen del mes consultado (misma regla que 005).
- Gastos de la cuenta común en el desglose por miembro: no se atribuyen a ningún miembro (se atribuye cada gasto al dueño de la cuenta desde la que se pagó).
- Aritmética monetaria: cálculos en céntimos enteros sin coma flotante (ADR 0007); el cuadre debe ser exacto al céntimo, sin desviaciones de redondeo.
- Rendimiento: el resumen global y el cuadre de un mes con hasta 300 movimientos deben visualizarse en menos de 3 segundos (SC-004 del maestro).

## Clarifications

### Session 2026-09-15

- Q: ¿Los saldos reales del cuadre se declaran por cuenta o como un único saldo global familiar? → A: Por cuenta: saldo real inicial y final de cada una de las tres cuentas, con cuadre por cuenta (variación calculada del cierre de esa cuenta, 005) y cuadre global agregado. Localiza en qué cuenta está el olvido; el global solo se calcula con las tres cuentas declaradas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar, para el mes seleccionado, un resumen global que agregue todas las cuentas: total de ingresos, total de gastos, gastos compartidos, gastos personales y saldo del mes global (ingresos − gastos) mostrado con signo.
- **FR-002**: Cada total global MUST ser la suma de los totales de las cuentas individuales del mes (los KPIs del cierre por cuenta de 005): el resumen global y los cierres por cuenta MUST ser coherentes al céntimo en el mismo mes. La semántica de naturaleza de 005 se conserva: la naturaleza la marca el gasto, no la cuenta que lo paga (los compartidos pagados desde cuentas personales computan como compartidos).
- **FR-003**: El sistema MUST mostrar el desglose global de gastos del mes por tag (todas las cuentas juntas): cada tag con el importe total de los gastos que la llevan —solo el importe, sin porcentajes ni recuentos—, ordenado de mayor a menor importe. Un gasto con varias tags computa en cada una de ellas sin duplicar el total global de gastos.
- **FR-004**: El sistema MUST mostrar el desglose de gastos del mes por miembro: para cada miembro, sus gastos personales y sus gastos compartidos (estos últimos, incluidos los pagados desde su cuenta personal). Los gastos pagados desde la cuenta común MUST presentarse sin atribución a un miembro concreto. El desglose por miembro cubre solo gastos; los ingresos por miembro llegan con la cuenta de resultados anual (`009-cuenta-resultados-anual`).
- **FR-005**: El sistema MUST permitir declarar, para cada cuenta, el saldo real inicial y el saldo real final del mes, en euros con dos decimales, y persistirlos de forma editable (re-declarables en cualquier momento). Cada cuenta es una cuenta bancaria real con su propio saldo (clarificación 2026-09-15).
- **FR-006**: El sistema MUST calcular el cuadre del mes en dos niveles coherentes entre sí: por cuenta —variación real declarada (saldo final − saldo inicial) frente a variación calculada del cierre de esa cuenta (005)— y global —agregado de las tres cuentas—. Estados en cada nivel: cuadrado (diferencia 0,00 €), descuadrado (diferencia distinta de cero, mostrando su importe exacto y sentido) y pendiente (por cuenta, si faltan sus saldos; global, si falta cualquiera de las cuentas; sin cálculos parciales).
- **FR-007**: Un descuadre MUST marcarse visualmente con su importe y MUST NOT bloquear ninguna operación (registro, edición, eliminación de movimientos).
- **FR-008**: El resumen global y el cuadre MUST ser vistas derivadas de los movimientos (extensión del ADR 0009): no se persisten totales ni resultados del cuadre; la única persistencia nueva de la feature son los saldos declarados.
- **FR-009**: Todos los cálculos MUST realizarse con aritmética exacta en céntimos enteros (sin coma flotante) y mostrarse en formato español EUR con dos decimales (Intl es-ES), reutilizando las convenciones de formateo existentes.
- **FR-010**: La interfaz MUST estar en español, con etiquetas equivalentes a las del Excel agregado (Ingresos, Gastos, Gastos compartidos, Gastos personales, Saldo del mes, Desglose por tag, Desglose por miembro, Cuadre). La ubicación concreta de la vista (sección en la pantalla principal o ruta propia) y el patrón de entrada de saldos (diálogo, formulario en línea) se deciden en el plan.
- **FR-011**: El sistema MUST presentar el resumen global y el cuadre de un mes con hasta 300 movimientos en menos de 3 segundos, sin cargar más meses de los necesarios.
- **FR-012**: Los datos que crucen la frontera (entrada y guardado de saldos declarados) MUST validarse con Zod en tiempo de ejecución (constitución IV), rechazando importes no numéricos o mal formados; los saldos negativos o cero son válidos.

### Key Entities *(include if feature involves data)*

- **Resumen global mensual**: Agregación CALCULADA por mes (no se persiste): totales de ingresos y gastos, desglose por naturaleza, saldo del mes global y desgloses de gastos por tag y por miembro. Deriva de los movimientos del mes de todas las cuentas (coherente con los cierres por cuenta de 005).
- **Declaración de saldo real**: Nuevo dato PERSISTIDO por cuenta y mes: saldo real inicial y saldo real final (céntimos enteros), editables (clarificación 2026-09-15).
- **Cuadre mensual**: Comprobación CALCULADA (no se persiste), por cuenta y global: variación calculada, variación real, diferencia (importe y sentido del descuadre) y estado (cuadrado/descuadrado/pendiente).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los totales y desgloses del resumen global reproducen con desviación cero los valores que hoy se obtienen cruzando manualmente los cierres de las tres cuentas (SC-003 del roadmap maestro).
- **SC-002**: El cuadre se realiza de forma automática al declarar los saldos reales, sin ningún cálculo manual intermedio, y es exacto al céntimo (SC-005 del roadmap maestro).
- **SC-003**: El resumen global y el cuadre de un mes con hasta 300 movimientos se visualizan en menos de 3 segundos (SC-004 del roadmap maestro).
- **SC-004**: La suma de los cierres por cuenta de 005 coincide exactamente con el resumen global del mismo mes, verificable cuenta a cuenta en cualquier mes con datos.

## Assumptions

- Terminología alineada con 002/005: la naturaleza "propio/común" del maestro se muestra como "personal"/"compartido"; los KPIs "Gastos Comunes/Gastos Personales" se etiquetan "Gastos compartidos/Gastos personales".
- El desglose por miembro atribuye cada gasto al dueño de la cuenta desde la que se pagó; los gastos de la cuenta común no se atribuyen a ningún miembro. El reparto de gastos comunes entre miembros queda diferido (decisión del usuario en el maestro).
- Los saldos reales se introducen manualmente; no hay integración bancaria (assumption del maestro).
- El descuadre es un aviso visual: no bloquea ni exige resolución; no hay flujo de "cerrar mes" (el cierre como acción bloqueante llega, si procede, en `009-cuenta-resultados-anual` o posterior).
- Reutilización íntegra del dominio y la aplicación de 002/005 (`Money`, `MonthlyClosure`, casos de uso y puertos de lectura); se prevé un caso de uso de resumen global y la persistencia de los saldos declarados (única migración de esquema prevista).
- La vista usa el selector de mes existente; los KPIs se calculan en la capa de aplicación/servidor y la UI solo formatea (principio VII).
- El flujo crítico de cuadre (declarar saldos → ver resultado) se cubre con e2e de Playwright (constitución III).
- Moneda única EUR con dos decimales; formato español Intl es-ES (helpers existentes).
- Edición/eliminación de movimientos (003) ya garantiza el recálculo de vistas derivadas; esta feature no añade lógica de invalidación especial.

## Out of Scope

- Cuenta de resultados anual: ingresos por miembro y mes, gasto real, saldo, columnas mensuales, totales anuales, media mensual, total sin gastos personales y balance acumulado multimes (feature `009-cuenta-resultados-anual`).
- Regla de reparto configurable y liquidación de gastos comunes entre miembros (diferido, decisión del usuario).
- Gestión del catálogo de tags (feature `004-gestion-tags`), filtrado y búsqueda de movimientos (`007-filtrado-busqueda`), gestión de cuentas y miembros (`008-gestion-cuentas-miembros`).
- Cierre de mes como acción bloqueante o flujo de "mes cerrado" con escritura prohibida.
- Exportación del resumen o del cuadre (PDF, CSV) e impresión.
- Registro de usuarios, login y multiusuario; importación de histórico desde Excel, presupuestos, metas de ahorro y proyecciones; integración bancaria.
