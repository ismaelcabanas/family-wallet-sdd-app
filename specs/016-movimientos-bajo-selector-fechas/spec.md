# Feature Specification: Listado de movimientos bajo el selector de fechas

**Feature Branch**: `feature/016-movimientos-bajo-selector-fechas`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Quiero crear una especificación para que en la página de detalle de una cuenta el listado de movimientos aparezca justo debajo del selector de fechas"

**Fuente**: Refinamiento del rediseño UX (roadmap maestro, nota 2026-09-27): la fila `013-formulario-dialogo` anticipaba una «página de cuenta list-first»; esta feature entrega esa parte por separado y antes. Da por construidas `011-pagina-cuenta` y `012-panel-cuentas` (Completadas): la página de cuenta `/accounts/[id]?month=` muestra hoy, en este orden, el selector de mes/año, el balance acumulado, el formulario de alta embebido, el cierre mensual y el listado agrupado por fecha. Es una feature de presentación pura: reordenar bloques existentes, sin cambios de dominio, aplicación, persistencia ni datos.

## Clarifications

### Session 2026-09-29

- Q: ¿Cuál debe ser el orden de los bloques por debajo del listado de movimientos? → A: Balance acumulado → formulario de alta embebido → cierre mensual (orden relativo actual, confirmado por el propietario).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Leer el mes de la cuenta sin desplazarme (Priority: P1)

Como usuario, quiero que en la página de una cuenta el listado de movimientos del mes aparezca **justo debajo del selector de mes/año**, para que al cambiar de mes vea inmediatamente sus movimientos sin pasar antes por el balance, el formulario de alta o el cierre: lo que más consulto (qué movimientos hay este mes) queda arriba; lo que uso de vez en cuando (registrar, revisar totales) queda debajo.

**Why this priority**: Es la única historia de la feature y de valor inmediato: elimina el desplazamiento para la operación más frecuente (consultar y editar el mes visible). Anticipa el «list-first» previsto en `013-formulario-dialogo`, que después convertirá el formulario embebido en un CTA con diálogo.

**Independent Test**: Se puede probar abriendo la página de una cuenta y verificando que entre el selector de mes/año y el listado no hay ningún otro bloque, y que el resto de bloques sigue presente y operativo más abajo.

**Acceptance Scenarios**:

1. **Given** la página de una cuenta con movimientos en el mes visible, **When** la abro, **Then** el listado agrupado por fecha aparece inmediatamente debajo del selector de mes/año, sin ningún bloque entre ambos.
2. **Given** la página de una cuenta, **When** pulso ‹ o › (o salto a un mes con el picker), **Then** la vista del mismo mes se actualiza y el nuevo listado sigue apareciendo justo bajo el selector, sin cambiar de página.
3. **Given** la página reordenada, **When** la recorro hacia abajo, **Then** el balance acumulado, el formulario de alta y el cierre mensual siguen presentes y operativos (alta, edición, eliminación, totales), más abajo del listado.
4. **Given** un mes sin movimientos, **When** navego a él, **Then** el estado vacío del listado se muestra justo debajo del selector, dentro del propio listado (convención existente), sin bloque extra entre ambos.
5. **Given** un movimiento del listado, **When** pulso editar o eliminar en su fila, **Then** el diálogo se abre y tras confirmar el listado y el cierre se recalculan en la nueva vista, como hasta ahora.

### Edge Cases

- Mes vacío: el estado vacío se renderiza dentro del propio listado, nunca como sustitución condicional de la página (convención de diálogos montados a nivel del listado).
- La reordenación no cambia qué datos se muestran ni cuándo se calculan: mismos movimientos, mismo balance acumulado a fin de mes, mismo cierre; solo cambia el orden visual de los bloques.
- Mes actual visible: › sigue deshabilitado y el picker sigue sin ofrecer meses futuros; la reordenación no altera las reglas de navegación de meses de 011.
- URL con `accountId` inválido o inexistente: sigue produciendo 404 explícito; `month` inválido sigue cayendo al mes actual.
- En ventanas pequeñas (móvil) la página debe seguir siendo usable, aunque la optimización móvil siga fuera de alcance (decisión 2026-09-27).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: En la página de detalle de una cuenta, el listado de movimientos del mes visible MUST aparecer inmediatamente debajo del selector de mes/año: ningún otro bloque (balance, formulario, cierre) puede interponerse entre ambos.
- **FR-002**: Los bloques restantes de la página (balance acumulado de la cuenta, formulario de alta embebido y cierre mensual) MUST permanecer en la página, visibles por debajo del listado, conservando entre ellos su orden relativo actual y toda su funcionalidad (alta, edición, eliminación, totales del cierre).
- **FR-003**: El alcance MUST limitarse a la composición/orden de bloques de la página de detalle de cuenta: sin cambios de dominio, aplicación, persistencia ni de datos; sin migraciones; sin consultas nuevas.
- **FR-004**: Las convenciones de interacción del listado MUST preservarse íntegras: edición y eliminación por movimiento con diálogos montados a nivel del componente listado (nunca en la fila) y estado vacío renderizado dentro del propio listado.
- **FR-005**: Toda la funcionalidad ya entregada (alta con formulario embebido, edición, eliminación, navegación de meses acotada al presente, cierre mensual, balance acumulado a fin de mes) MUST seguir operativa tras la reordenación, y las pruebas existentes MUST permanecer en verde; si alguna prueba depende del orden actual de bloques, se actualiza para reflejar el nuevo orden, no para debilitar lo que verifica.
- **FR-006**: Las demás páginas (`/`, `/summary`, `/annual`) y la navegación global MUST permanecer sin cambios.

### Key Entities

- Ninguna nueva. Reutiliza **Cuenta**, **Movimiento** y **Tag** tal cual; la feature es una reordenación de presentación de la página de cuenta de 011.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En la página de cualquier cuenta, entre el selector de mes/año y el primer grupo del listado no aparece ningún bloque intermedio, en cualquier mes consultado.
- **SC-002**: Con un viewport de escritorio estándar, el selector de fechas y el primer grupo de movimientos del mes son visibles en la misma pantalla, sin desplazamiento.
- **SC-003**: Tras la reordenación, el 100 % de la funcionalidad previa sigue operativa (alta, edición, eliminación, navegación de meses, cierre, balance) y las suites de pruebas existentes quedan en verde.
- **SC-004**: Ningún dato mostrado cambia respecto a la composición anterior: mismos movimientos, mismo balance acumulado, mismo cierre.

## Assumptions

- El orden resultante de la página es: cabecera de cuenta → selector de mes/año → **listado de movimientos** → balance acumulado → formulario de alta embebido → cierre mensual, confirmado en clarificación (2026-09-29): los bloques restantes conservan su orden relativo actual debajo del listado.
- El formulario de alta permanece embebido en la página hasta `013-formulario-dialogo`, que lo convierte en CTA con diálogo; esta feature no lo toca más allá de su posición.
- Escritorio primero (decisión del propietario, 2026-09-27): usable en móvil, sin optimización específica.
- No se añaden pruebas e2e nuevas por defecto: al no haber flujo nuevo ni escritura adicional, los e2e existentes de la página de cuenta cubren la operativa; si el plan lo considera oportuno, se ajustan selectores/orden en los existentes antes que añadir specs.
- La numeración 016 respeta los números ya reservados en el roadmap (013–015) siguiendo el precedente de los splits de 003/006 (números reservados no se reutilizan); la fila 013 del roadmap maestro se actualiza retirando «página de cuenta list-first», ahora entregado por esta feature.

## Out of Scope

- CTA «Nuevo movimiento» con formulario en diálogo (`013-formulario-dialogo`) y formulario rediseñado con nota única y chips (`014-formulario-nota-tags`).
- Cambios de contenido, datos o cálculos de los bloques reordenados (balance, cierre, listado).
- Ocultar, colapsar o eliminar bloques existentes; subtotales diarios, paginación o virtualización del listado.
- Cambios en `/`, `/summary`, `/annual` o en la navegación global.
- Optimización móvil específica, dark mode y animaciones de transición.
