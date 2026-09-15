# Feature Specification: Resumen Mensual Global

**Feature Branch**: `feature/006-resumen-global-mensual`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Feature `006-resumen-global-mensual` del roadmap maestro (US3, prioridad P3): consultar un resumen mensual global que agregue todas las cuentas con desglose de gastos por naturaleza, tag y miembro, para conocer la situación financiera de la familia sin cruzar manualmente los cierres de cada cuenta. Primera parte del split de la feature original `006-analisis-agregado` (la cuenta de resultados anual pasó a `009-cuenta-resultados-anual`); el cuadre mensual con saldos declarados se separó después a `010-cuadre-mensual` aplicando el acuerdo de granularidad una feature = una US con valor propio (constitución v1.2.1)."

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (historia US3; requisito FR-007 —resumen global con desgloses—). Se apoya en el modelo y la terminología de `002-registro-movimientos` (naturaleza "personal"/"compartido", multi-tag, Miembro/Cuenta) y en la agregación por cuenta de `005-cierre-mensual` (cierre mensual como vista derivada, ADR 0009/0010).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el resumen mensual global (Priority: P1)

Como familia, queremos ver, para el mes seleccionado, un resumen global que agregue las tres cuentas: total de ingresos, total de gastos, gastos compartidos (incluidos los pagados desde cuentas personales), gastos personales, saldo del mes global y desgloses de gastos por tag y por miembro, para conocer la situación financiera de la familia sin cruzar manualmente los cierres de cada cuenta.

**Why this priority**: Es la primera salida de valor a nivel de familia: replica el cruce manual de los tres Excel de Balance que hoy se hace a mano. Es una vista de solo lectura sobre el modelo existente (agregación de los cierres por cuenta de 005) que entrega valor completa por sí sola.

**Independent Test**: Se puede probar registrando movimientos del mismo mes en las tres cuentas y verificando que cada total global coincide con la suma de los cierres por cuenta de 005 y con el cálculo manual sobre el mismo conjunto.

**Acceptance Scenarios**:

1. **Given** movimientos del mes en las tres cuentas, **When** abro el resumen global del mes, **Then** el total de gastos coincide con la suma de los gastos de las tres cuentas (e igualmente ingresos, gastos compartidos, gastos personales y saldo del mes global).
2. **Given** gastos marcados como personales y como compartidos (incluidos compartidos pagados desde cuentas personales), **When** consulto el resumen global, **Then** el total de gastos compartidos incluye los pagados desde cuentas personales, y el desglose por miembro muestra los gastos personales y compartidos de cada miembro (los pagados desde su cuenta personal).
3. **Given** un gasto con varias tags (p. ej. "supermercado" + "vacaciones"), **When** consulto el desglose global por tag, **Then** el gasto computa en cada una de sus tags sin duplicar el total global de gastos.
4. **Given** un mes en el que una cuenta no tiene movimientos y las otras sí, **When** abro el resumen global, **Then** la cuenta vacía aporta cero a los totales y el resumen global cuadra con la suma de los cierres por cuenta, sin errores.
5. **Given** el resumen global de un mes, **When** cambio el mes, **Then** todos los totales y desgloses se recalculan para el nuevo mes en la misma vista.

### Edge Cases

- Mes sin movimientos: totales globales a cero y desgloses vacíos (como el cierre por cuenta de 005, escenario 3), sin errores.
- Gasto multi-tag en el desglose: computa en cada una de sus tags sin duplicar el total global de gastos (escenario 3 de US1).
- Movimientos fechados en otros meses o futuros: no computan en el resumen del mes consultado (misma regla que 005).
- Gastos de la cuenta común en el desglose por miembro: no se atribuyen a ningún miembro (se atribuye cada gasto al dueño de la cuenta desde la que se pagó).
- ¿Computan los ingresos en el desglose por tag? (No: el desglose es de gastos; los ingresos solo aparecen como total global, igual que en 005).
- Aritmética monetaria: cálculos en céntimos enteros sin coma flotante (ADR 0007); los totales globales deben ser exactos al céntimo, sin desviaciones de redondeo.
- Rendimiento: el resumen global de un mes con hasta 300 movimientos debe visualizarse en menos de 3 segundos (SC-004 del maestro).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar, para el mes seleccionado, un resumen global que agregue todas las cuentas: total de ingresos, total de gastos, gastos compartidos, gastos personales y saldo del mes global (ingresos − gastos) mostrado con signo.
- **FR-002**: Cada total global MUST ser la suma de los totales de las cuentas individuales del mes (los KPIs del cierre por cuenta de 005): el resumen global y los cierres por cuenta MUST ser coherentes al céntimo en el mismo mes. La semántica de naturaleza de 005 se conserva: la naturaleza la marca el gasto, no la cuenta que lo paga (los compartidos pagados desde cuentas personales computan como compartidos).
- **FR-003**: El sistema MUST mostrar el desglose global de gastos del mes por tag (todas las cuentas juntas): cada tag con el importe total de los gastos que la llevan —solo el importe, sin porcentajes ni recuentos—, ordenado de mayor a menor importe. Un gasto con varias tags computa en cada una de ellas sin duplicar el total global de gastos.
- **FR-004**: El sistema MUST mostrar el desglose de gastos del mes por miembro: para cada miembro, sus gastos personales y sus gastos compartidos (estos últimos, incluidos los pagados desde su cuenta personal). Los gastos pagados desde la cuenta común MUST presentarse sin atribución a un miembro concreto. El desglose por miembro cubre solo gastos; los ingresos por miembro llegan con la cuenta de resultados anual (`009-cuenta-resultados-anual`).
- **FR-005**: El resumen global MUST ser una vista derivada de los movimientos (extensión del ADR 0009): no se persisten totales ni desgloses; se recalculan a partir de los movimientos existentes en cada consulta. No hay persistencia nueva ni migraciones de esquema en esta feature.
- **FR-006**: Todos los cálculos MUST realizarse con aritmética exacta en céntimos enteros (sin coma flotante) y mostrarse en formato español EUR con dos decimales (Intl es-ES), reutilizando las convenciones de formateo existentes.
- **FR-007**: La interfaz MUST estar en español, con etiquetas equivalentes a las del Excel agregado (Ingresos, Gastos, Gastos compartidos, Gastos personales, Saldo del mes, Desglose por tag, Desglose por miembro). La ubicación concreta de la vista (sección en la pantalla principal o ruta propia) se decide en el plan.
- **FR-008**: El sistema MUST presentar el resumen global de un mes con hasta 300 movimientos en menos de 3 segundos, sin cargar más meses de los necesarios.

### Key Entities *(include if feature involves data)*

- **Resumen global mensual**: Agregación CALCULADA por mes (no se persiste): totales de ingresos y gastos, desglose por naturaleza, saldo del mes global y desgloses de gastos por tag y por miembro. Deriva de los movimientos del mes de todas las cuentas (coherente con los cierres por cuenta de 005). No se crean entidades nuevas: Miembro, Cuenta, Movimiento y Tag se reutilizan tal cual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los totales y desgloses del resumen global reproducen con desviación cero los valores que hoy se obtienen cruzando manualmente los cierres de las tres cuentas (SC-003 del roadmap maestro).
- **SC-002**: El resumen global de un mes con hasta 300 movimientos se visualiza en menos de 3 segundos (SC-004 del roadmap maestro).
- **SC-003**: La suma de los cierres por cuenta de 005 coincide exactamente con el resumen global del mismo mes, verificable cuenta a cuenta en cualquier mes con datos.

## Assumptions

- Terminología alineada con 002/005: la naturaleza "propio/común" del maestro se muestra como "personal"/"compartido"; los KPIs "Gastos Comunes/Gastos Personales" se etiquetan "Gastos compartidos/Gastos personales".
- El desglose por miembro atribuye cada gasto al dueño de la cuenta desde la que se pagó; los gastos de la cuenta común no se atribuyen a ningún miembro. El reparto de gastos comunes entre miembros queda diferido (decisión del usuario en el maestro).
- Reutilización íntegra del dominio y la aplicación de 002/005 (`Money`, `MonthlyClosure`, casos de uso y puertos de lectura); se prevé un caso de uso de resumen global sobre el puerto existente. Como en 005, es una proyección de solo lectura: sin escrituras ni migraciones.
- La vista usa el selector de mes existente; los KPIs se calculan en la capa de aplicación/servidor y la UI solo formatea (principio VII).
- El plan valora un e2e de consulta del resumen global, en línea con el que cubre el cierre mensual en 005 (constitución III); al no haber flujo de escritura nuevo, no hay flujo crítico adicional obligatorio.
- Moneda única EUR con dos decimales; formato español Intl es-ES (helpers existentes).
- Edición/eliminación de movimientos (003) ya garantiza el recálculo de vistas derivadas; esta feature no añade lógica de invalidación especial.

## Out of Scope

- Cuadre mensual con declaración de saldos reales por cuenta, variación real frente a calculada y descuadres (feature `010-cuadre-mensual`; granularidad por cuenta clarificada por el propietario el 2026-09-15).
- Cuenta de resultados anual: ingresos por miembro y mes, gasto real, saldo, columnas mensuales, totales anuales, media mensual, total sin gastos personales y balance acumulado multimes (feature `009-cuenta-resultados-anual`).
- Regla de reparto configurable y liquidación de gastos comunes entre miembros (diferido, decisión del usuario).
- Gestión del catálogo de tags (feature `004-gestion-tags`), filtrado y búsqueda de movimientos (`007-filtrado-busqueda`), gestión de cuentas y miembros (`008-gestion-cuentas-miembros`).
- Exportación del resumen (PDF, CSV) o impresión.
- Registro de usuarios, login y multiusuario; importación de histórico desde Excel, presupuestos, metas de ahorro y proyecciones; integración bancaria.
