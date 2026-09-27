# Feature Specification: Página de Cuenta

**Feature Branch**: `feature/011-pagina-cuenta`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "Feature `011-pagina-cuenta` del roadmap maestro (rediseño UX, nota 2026-09-27): página propia por cuenta (`/accounts/[id]`) con el listado de movimientos del mes actual agrupado por fecha (fila con tags prominentes, nota en pequeño e importe a la derecha —rojo gasto/verde ingreso—), edición y eliminación por movimiento, selector ‹ mes/año › y cierre mensual visible. `/` conserva su selector de cuenta como pasarela hasta `012-panel-cuentas`."

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (nota 2026-09-27, revisión UX/UI de las features completadas). Reutiliza el modelo y casos de uso de `002-registro-movimientos`, los diálogos de edición/eliminación de `003-edicion-movimientos` y el cierre mensual de `005-cierre-mensual`. Es una feature de solo lectura sobre lo existente: sin cambios de dominio ni persistencia; la agrupación por fecha es presentación sobre el orden que ya devuelve `ListMovements` (`date DESC, id DESC`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operar una cuenta en su propia página (Priority: P1)

Como usuario, quiero entrar a una página propia de la cuenta (`/accounts/[id]`) que muestre el listado de movimientos del mes actual **agrupado por fecha** —grupos de fecha más reciente a más antigua y, dentro de cada día, el último registrado primero—, donde cada fila se identifica por sus **tags**, muestra la **nota en pequeño** debajo y el **importe a la derecha** (rojo si es gasto, verde si es ingreso), con **edición y eliminación** por movimiento, un **selector ‹ mes/año ›** para navegar hacia atrás y adelante y el **cierre mensual** y el balance acumulado de la cuenta visibles, para operar una cuenta con una URL estable y leer el mes de un vistazo.

**Why this priority**: Es la única historia de la feature y el primer paso del rediseño UX: da a cada cuenta una URL bookmarkable y una lectura rápida del mes. Todo el valor es de presentación sobre la funcionalidad ya entregada por 002/003/005; las features posteriores (012 landing, 013 formulario en diálogo) se construyen sobre esta página.

**Independent Test**: Se puede probar navegando a la página de una cuenta, verificando la agrupación y orden del listado, editando y eliminando movimientos, y moviéndose entre meses con el selector — todo sin salir de la página.

**Acceptance Scenarios**:

1. **Given** una cuenta con movimientos en el mes actual, **When** abro su página, **Then** veo los movimientos del mes agrupados por fecha, con el grupo de fecha más reciente arriba y, dentro de cada día, el último movimiento registrado primero.
2. **Given** un gasto y un ingreso en el listado, **When** los miro, **Then** cada fila muestra sus tags como elemento prominente, la nota en pequeño debajo y el importe a la derecha —en rojo si es gasto, en verde si es ingreso— y los gastos llevan un distintivo sutil de naturaleza (Personal/Común).
3. **Given** un movimiento con concepto y descripción, **When** se renderiza su fila, **Then** la nota muestra el concepto y, si existe descripción, se concatena a continuación (p. ej. "Mercadona · compra semanal").
4. **Given** la página de una cuenta, **When** pulso ‹ o › en el selector de mes, **Then** la página navega al mes anterior/siguiente de la misma cuenta (URL incluida) sin cambiar de vista, y el salto directo a un mes/año arbitrario sigue disponible.
5. **Given** un movimiento del listado, **When** pulso editar o eliminar en su fila, **Then** se abre el diálogo correspondiente de 003 y, tras confirmar, el listado y el cierre se recalculan en la nueva vista.
6. **Given** la página de una cuenta, **When** la consulto, **Then** el cierre mensual de esa cuenta y mes (panel de 005) y el balance acumulado de la cuenta están visibles.
7. **Given** la ruta `/`, **When** la abro, **Then** mantiene su comportamiento actual (selector de cuenta y mes, alta de movimientos): es la pasarela hasta `012-panel-cuentas`.

### Edge Cases

- Mes sin movimientos: la página muestra el estado vacío **dentro del propio listado** (no como sustitución condicional en la página), para que los diálogos montados a nivel del listado no pierdan el estado (convención de `movement-list.tsx`).
- Movimiento con la etiqueta «Sin Clasificar» como única tag: la fila la muestra como cualquier otra tag.
- Navegación a meses anteriores al primer movimiento: listado vacío y cierre con balance heredado del mes anterior (comportamiento de 005), sin errores.
- Movimientos registrados el mismo día en distinto orden: el orden dentro del grupo es por registro más reciente primero (`id DESC`), no por ningún campo visible.
- Agrupación por **fecha del movimiento** (campo fecha), no por fecha de registro (`createdAt`): un movimiento editado y cambiado de mes desaparece del grupo y aparece en el mes de su nueva fecha (recálculo de 003 ya garantizado).
- Sin subtotal de gastos por día: decisión del propietario (2026-09-27); se iterará si aporta.
- La fila no muestra texto "Gasto/Ingreso": el tipo se comunica por color del importe (rojo/verde) y la naturaleza con el distintivo sutil; accesibilidad del color a valorar en el plan.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST servir una página propia por cuenta en ruta `/accounts/[accountId]?month=YYYY-MM` (adaptador fino server-side, validación Zod de parámetros con los patrones existentes, mes por defecto = mes actual), con navegación interna que preserva la cuenta. La ruta concreta se valida en el plan frente a las convenciones de App Router.
- **FR-002**: El listado MUST mostrar los movimientos del mes de la cuenta agrupados por fecha del movimiento en orden descendente; dentro de cada día, por orden de registro más reciente primero. El orden proviene de `ListMovements` (`date DESC, id DESC`); la agrupación es presentación, sin nueva query ni lógica de dominio.
- **FR-003**: Cada fila MUST mostrar: las tags como elemento identificador prominente (píldoras), la nota en texto pequeño debajo —concepto, concatenando la descripción si existe (hasta la fusión de campos de `014-formulario-nota-tags`)— y el importe a la derecha con color semántico: rojo para gasto, verde para ingreso. Los gastos MUST llevar un distintivo sutil de naturaleza (Personal/Común); los ingresos no muestran naturaleza.
- **FR-004**: Cada movimiento MUST poder editarse y eliminarse desde su fila, reutilizando los diálogos de 003. Los diálogos MUST montarse a nivel del componente listado (nunca dentro de la fila) y el estado vacío MUST renderizarse dentro del propio listado, conforme a la convención existente.
- **FR-005**: La página MUST incluir un selector de mes/año con navegación al mes anterior y siguiente (‹ ›) y salto directo a un mes arbitrario (picker), manteniendo la cuenta activa en la URL.
- **FR-006**: La página MUST mostrar el cierre mensual de la cuenta y mes visibles (panel de 005 sin cambios funcionales) y el balance acumulado de la cuenta.
- **FR-007**: La ruta `/` MUST conservar intacto su comportamiento actual (selector de cuenta y mes, alta, edición, eliminación, cierre): la sustitución de `/` por la landing de tarjetas es `012-panel-cuentas`.
- **FR-008**: El alta de movimientos en esta fase se mantiene con el formulario embebido actual en la página de cuenta (el CTA en diálogo llega con `013-formulario-dialogo`).
- **FR-009**: Sin cambios de dominio, aplicación ni persistencia: read-only sobre `ListMovements`, `GetMonthlyClosure` y el balance por cuenta; sin migraciones ni dependencias nuevas. La UI nunca calcula (constitución VII): agrupa y formatea.
- **FR-010**: Interfaz en español; importes en formato EUR es-ES con dos decimales y cifras tabulares, reutilizando los helpers de formateo existentes (`format.ts`).

### Key Entities

- Ninguna nueva. Reutiliza **Cuenta**, **Movimiento** y **Tag** tal cual; la agrupación por fecha del listado es una vista calculada en el adaptador de UI sobre el orden devuelto por `ListMovements`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La URL de una cuenta abre directamente su mes actual y es estable (bookmark/refresco muestran la misma vista); la navegación entre meses no cambia de página.
- **SC-002**: Un movimiento se localiza en el listado por sus tags y su importe sin leer texto auxiliar: tipo (gasto/ingreso) distinguible por color y naturaleza por distintivo, de un vistazo.
- **SC-003**: La página de una cuenta con hasta 300 movimientos del mes se visualiza en menos de 3 segundos (SC-004 del maestro).
- **SC-004**: Toda la funcionalidad de 002/003/005 permanece operativa desde la nueva página: alta (formulario embebido), edición, eliminación y cierre del mes, incluidos sus e2e existentes.

## Assumptions

- Escritorio primero en esta fase (decisión del propietario, 2026-09-27): la página debe ser usable en móvil pero no se optimiza hasta iteraciones posteriores.
- La "nota" de la fila es interina: concepto + descripción concatenados hasta que `014-formulario-nota-tags` fusione ambos campos en una nota única.
- El distintivo de naturaleza se mantiene (decisión de diseño): perder la información de naturaleza visible por fila sería un retroceso respecto al listado actual.
- Los grupos de fecha usan una etiqueta legible en español (día, mes y año) con `<time>` semántico; el formato exacto se decide en el plan.
- `/` actúa de pasarela con su selector actual; el selector de cuenta desaparece de la página de cuenta con `012-panel-cuentas`.
- Se valorará en el plan un e2e de la nueva ruta (navegación de meses y agrupación) siguiendo la convención de aislamiento: combinación propia cuenta/mes por spec y orden alfabético de ficheros sobre `e2e.sqlite` (AGENTS.md); al no haber flujo de escritura nuevo, no añade flujo crítico obligatorio adicional al de registro.
- El formateo y los colores semánticos (rojo/verde) reutilizan las convenciones ya presentes en el listado actual; accesibilidad del color (contraste/alternativa no cromática) a valorar en el plan.
- Moneda única EUR con céntimos enteros; la aritmética no cambia (ADR 0007).

## Out of Scope

- Landing `/` con tarjetas de cuentas y navegación global persistente (`012-panel-cuentas`).
- CTA "Nuevo movimiento" con formulario en diálogo (`013-formulario-dialogo`) y formulario rediseñado con nota única y chips (`014-formulario-nota-tags`).
- Cuenta de resultados anual agrupada por grupos genéricos (`015-anual-agrupada`).
- Subtotales diarios por grupo de fecha, agrupación configurable y paginación/desplazamiento infinito del listado.
- Filtrado y búsqueda de movimientos (`007-filtrado-busqueda`); gestión de tags (`004-gestion-tags`) y de cuentas/miembros (`008-gestion-cuentas-miembros`).
- Dark mode/temas, animaciones de transición entre meses y atajos de teclado.
- Registro de usuarios, login y multiusuario; importación de histórico, presupuestos, metas de ahorro e integración bancaria.
