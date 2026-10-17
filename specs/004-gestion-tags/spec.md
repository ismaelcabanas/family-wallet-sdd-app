# Feature Specification: Gestión del catálogo de etiquetas (renombrar, fusionar, desactivar)

**Feature Branch**: `feature/004-gestion-tags`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "para 004-gestion-tags" — Mantenimiento del catálogo de tags: renombrar, fusionar y desactivar tags sin perder el histórico. La creación de tags desde el formulario de movimiento ya está cubierta por `017-creacion-tags-formulario` (Completada).

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (US5 / FR-005, fila `004-gestion-tags`, reducida por decisión del propietario el 2026-10-04). Da por construidas `017-creacion-tags-formulario` (creación inline de etiquetas junto al Select «Etiqueta») y `014-formulario-nota-tags` (etiqueta única por movimiento, obligatoria en gastos y opcional en ingresos). El edge case de duplicados de etiquetas inactivas en la spec de 017 difiere expresamente la **reactivación** a esta feature: el catálogo ya puede contener etiquetas inactivas (el modelo Tag contempla estado activa/inactiva desde el origen), pero hoy no existe ninguna vía para renombrarlas, fusionarlas, desactivarlas ni reactivarlas.

**Decisiones del propietario**:

- **(2026-10-04)** La fila 004 se reduce a su necesidad real —mantenimiento del catálogo (renombrar, fusionar, desactivar)— porque la **creación** de tags quedó cubierta por `017-creacion-tags-formulario`: crear una etiqueta no requiere una vista de administración, sino estar donde surge la necesidad; el mantenimiento sí requiere una vista propia.
- **(2026-10-17)** Con esta feature, FR-005 del roadmap maestro queda íntegramente cubierto (crear → 017; renombrar, fusionar, desactivar → esta feature; reactivar → esta feature, diferida por el edge case de 017).

**Granularidad** (constitución II): una única user story pequeña con valor propio — mantener el catálogo de etiquetas limpio a medida que evoluciona. Las operaciones comparten una misma vista de catálogo y un mismo recorrido UI, por lo que constituyen una sola historia; no aplica excepción.

## Clarifications

### Session 2026-10-17

- Q: ¿Puede «Aportación Común» ser elegida como etiqueta resultante en una fusión, o debe quedar protegida también en ese papel? (FR-007) → A: No; protegida también como resultante — prohibición total de las cuatro operaciones (renombrar, desactivar, absorbida y resultante de fusión).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mantener el catálogo de etiquetas sin perder el histórico (Priority: P1)

Como único usuario de la aplicación, quiero gestionar el catálogo de etiquetas —renombrar una etiqueta, fusionar dos etiquetas similares en una, desactivar las que ya no uso y reactivar las inactivas que vuelva a necesitar— desde una vista de administración del catálogo, para mantener el sistema de clasificación limpio y significativo sin perder ni alterar el histórico de movimientos ya registrados.

**Why this priority**: Es la única historia de la feature. Hoy el catálogo solo crece (creación inline de 017) y el modelo ya contempla estados, pero no existe ninguna vía de mantenimiento: una etiqueta mal escrita, duplicada conceptualmente con otra o en desuso queda ahí para siempre, degradando el selector y los desgloses con el paso de los meses.

**Independent Test**: Se puede probar creando dos etiquetas parecidas con movimientos asociados, fusionándolas en una y comprobando que todos los movimientos históricos muestran la etiqueta resultante, que los totales no cambian y que la etiqueta absorbida desaparece del catálogo; y desactivando una etiqueta con histórico, comprobando que deja de ofrecerse en nuevos movimientos pero los históricos la conservan y siguen computando en los desgloses.

**Acceptance Scenarios**:

1. **Given** que existe la etiqueta «super» usada por movimientos históricos, **When** la renombro a «supermercado», **Then** todos los movimientos que la tenían muestran la nueva etiqueta (listados, cierres, resúmenes y cuenta anual), los totales no cambian y ninguna otra etiqueta se ve afectada.
2. **Given** dos etiquetas similares («gas» y «gas-casa») con movimientos en ambas, **When** las fusiono eligiendo «gas» como etiqueta resultante, **Then** todos los movimientos de ambas quedan con «gas», los totales globales no cambian, el desglose por etiqueta pasa a sumar ambos importes bajo «gas» y «gas-casa» desaparece del catálogo.
3. **Given** una etiqueta usada en movimientos históricos, **When** la desactivo, **Then** deja de estar disponible para nuevos movimientos (alta y edición) pero los históricos la conservan y siguen computando en todos los desgloses.
4. **Given** una etiqueta inactiva sin colisión de nombre, **When** la reactivo, **Then** vuelve a estar disponible en el selector de alta y edición con su nombre e histórico intactos.
5. **Given** el catálogo con etiquetas activas e inactivas, **When** abro la vista de administración, **Then** veo todas las etiquetas con su estado visible y las acciones aplicables a cada una.
6. **Given** que intento renombrar una etiqueta a un nombre ya existente ignorando mayúsculas/minúsculas, **When** confirmo, **Then** la operación se rechaza con un mensaje claro, el nombre tecleado permanece editable para corregirlo y el catálogo no cambia.

---

### Edge Cases

- **Renombrar cambiando solo mayúsculas/minúsculas** («luz» → «Luz»): se permite; no es un duplicado de sí misma.
- **Acentos**: «Alimentación» y «Alimentacion» no son duplicados (la regla vigente solo ignora mayúsculas/minúsculas, comportamiento actual del catálogo heredado de 017).
- **Reactivar una inactiva cuyo nombre colisiona con una activa** (p. ej. inactiva «Luz» existiendo activa «LUZ»): la reactivación se rechaza como duplicado con mensaje claro; resolver la colisión (renombrando una de las dos) queda en manos del usuario.
- **Fusionar hacia una etiqueta inactiva**: permitido si el usuario la elige como resultante (es visible con su estado); los movimientos absorbidos computan bajo una etiqueta que seguirá sin ofrecerse para nuevos movimientos.
- **Fusionar dos etiquetas sin movimientos**: permitido; la absorbida desaparece y la resultante queda igual.
- **Etiqueta usada por la aportación común (019)**: la etiqueta «Aportación Común» está ligada a la materialización de la aportación mensual; renombrarla, desactivarla o usarla como absorbida **o como resultante** en una fusión rompería esa automatización o la haría irreversible, por lo que queda protegida de las cuatro operaciones (ver FR-007).
- **Etiqueta desactivada seleccionada en un formulario abierto**: si se desactiva mientras un diálogo de alta/edición la tiene seleccionada, el movimiento en curso puede guardarse con ella; la restricción aplica a nuevas selecciones, no a envíos en vuelo.
- **Doble envío de una operación**: los controles se deshabilitan mientras la operación se procesa (mismo patrón de doble envío que el guardado del movimiento).
- **Fusionar/renombrar actualiza los desgloses del mismo render**: cierres, resúmenes y cuenta anual son vistas derivadas; tras una operación de catálogo muestran el resultado recalculado sin pasos manuales.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (vista de administración del catálogo)**: El sistema MUST ofrecer una vista de administración del catálogo de etiquetas, accesible desde la navegación global persistente, que muestre **todas** las etiquetas (activas e inactivas) con su estado visible y las acciones aplicables a cada una según su estado: renombrar, fusionar, desactivar (activas) y reactivar (inactivas).
- **FR-002 (renombrar)**: El sistema MUST permitir renombrar una etiqueta con la validación de unicidad vigente del catálogo (ignorando mayúsculas/minúsculas, con trim del nombre): un nombre vacío o duplicado MUST rechazarse con mensaje claro conservando el nombre tecleado para corregirlo. Un renombrado con éxito MUST reflejarse de inmediato en listados, cierres, resúmenes y cuenta anual, **sin alterar ningún total**: solo cambia la etiqueta mostrada.
- **FR-003 (fusionar)**: El sistema MUST permitir fusionar dos etiquetas eligiendo la resultante: todos los movimientos de ambas MUST quedar con la etiqueta resultante, la etiqueta absorbida MUST desaparecer del catálogo y los totales globales MUST permanecer exactamente iguales; el desglose por etiqueta pasa a acumular ambos importes bajo la resultante. La fusión MUST pedir confirmación explícita antes de ejecutarse.
- **FR-004 (desactivar)**: El sistema MUST permitir desactivar una etiqueta activa: deja de ofrecerse para nuevos movimientos (alta y edición) y los movimientos históricos la conservan, computando en todos los desgloses como hasta ahora. La desactivación NO borra la etiqueta ni su histórico.
- **FR-005 (reactivar)**: El sistema MUST permitir reactivar una etiqueta inactiva, aplicando la misma regla de unicidad ignorando mayúsculas/minúsculas frente a las etiquetas activas existentes; una reactivación válida la devuelve al selector de alta y edición con su nombre e histórico intactos.
- **FR-006 (integridad del histórico)**: Ninguna operación de catálogo MUST alterar importes, fechas, notas, cuentas ni totales de movimientos existentes: las operaciones solo actúan sobre la dimensión etiqueta. Los movimientos generados automáticamente (ingresos regulares de 018, aportaciones de 019) MUST permanecer intactos.
- **FR-007 (protección de la etiqueta de sistema)**: La etiqueta «Aportación Común» (usada por la materialización de la aportación de 019) MUST estar protegida: no puede renombrarse, desactivarse, ser la absorbida de una fusión **ni ser la etiqueta resultante de una fusión** (la prohibición cubre las cuatro operaciones); las acciones correspondientes no se ofrecen o se rechazan con mensaje claro. El resto del catálogo (incluida «Sin Clasificar», etiqueta corriente desde 014) se gestiona con normalidad.
- **FR-008 (confirmaciones)**: Las operaciones con efecto sobre múltiples movimientos (fusión) o que retiran una etiqueta del uso diario (desactivación) MUST pedir confirmación explícita mostrando su consecuencia de forma comprensible antes de ejecutarse.
- **FR-009 (disponibilidad inmediata)**: Tras cualquier operación de catálogo, los selectores de etiqueta de alta y edición y los desgloses MUST reflejar el estado resultante en los usos siguientes de la aplicación, sin pasos manuales de refresco.
- **FR-010 (actualización del roadmap maestro)**: Al completar la feature, el roadmap maestro MUST marcar la fila `004-gestion-tags` como Completada y dejar constancia de que FR-005 queda íntegramente cubierto (crear → 017; renombrar, fusionar, desactivar y reactivar → 004).
- **FR-011 (cobertura de tests)**: La feature MUST estar cubierta por tests: unidad de dominio/aplicación de cada operación (renombrado con duplicado, fusión con reasignación e integridad de totales, desactivación que preserva histórico, reactivación con colisión, protección de la etiqueta de sistema), componentes de la vista de administración y un flujo e2e que renombre, fusione y desactive etiquetas verificando el histórico (constitución III).

### Key Entities

- **Tag**: nombre único ignorando mayúsculas/minúsculas, slug derivado, estado (activa/inactiva). La feature añade las operaciones de mantenimiento (renombrar, fusionar, desactivar, reactivar) que el modelo ya anticipaba con su estado; no cambia su estructura.
- **Movimiento** (sin cambios): la etiqueta sigue siendo única por movimiento (014); la fusión reasigna la etiqueta de los movimientos afectados sin tocar ningún otro campo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cualquier operación de catálogo (renombrar, fusionar, desactivar, reactivar) se completa en menos de 30 segundos desde la vista de administración, incluida su confirmación.
- **SC-002**: Tras un renombrado o una fusión, los totales de cierre mensual, resumen global y cuenta anual coinciden al 100 % con los previos a la operación: cero variación en importes; el desglose por etiqueta refleja únicamente el cambio de dimensión etiqueta (nuevo nombre o suma de importes bajo la resultante).
- **SC-003**: Tras una desactivación, el 100 % de los movimientos históricos conserva la etiqueta desactivada y sigue computando en los desgloses, y el 0 % de los formularios de alta/edición la ofrece para nuevas selecciones.
- **SC-004**: El 100 % de las operaciones inválidas (nombre duplicado ignorando mayúsculas, nombre vacío, reactivación con colisión, operaciones sobre la etiqueta protegida) se rechazan con mensaje claro sin cambios parciales en el catálogo ni pérdida de lo tecleado.
- **SC-005**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde y el flujo «renombrar + fusionar + desactivar con histórico verificado» queda cubierto end-to-end.

## Assumptions

- **Vista propia**: el mantenimiento requiere ver el catálogo completo (activas e inactivas) y comparar nombres, así que vive en una vista de administración propia accesible desde la navegación global persistente; la ubicación exacta y el diseño (tabla/lista, diálogos, menús por fila) son decisión del plan.
- **Fusión con reasignación y desaparición**: conforme al escenario US5-2 del roadmap maestro, la etiqueta absorbida desaparece del catálogo tras reasignar sus movimientos a la resultante (el histórico no se pierde: los movimientos siguen ahí con la etiqueta superviviente). El mecanismo técnico (p. ej. reasignación de la referencia de los movimientos afectados) es detalle del plan.
- **La reactivación forma parte del alcance** porque el edge case de duplicados de 017 la difirió expresamente a esta feature; sin ella, una desactivación sería irreversible.
- **La protección se limita a «Aportación Común»**, única etiqueta con rol de sistema real hoy (la materialización de 019 la localiza por su slug); «Sin Clasificar» y el catálogo inicial del Excel son etiquetas corrientes y se gestionan con normalidad. Si una futura feature añade más etiquetas de sistema, heredarán esta protección.
- El usuario introduce solo nombres (renombrado) o elige etiquetas existentes (fusión); la derivación del slug y la resolución de colisiones son detalle del plan, con la unicidad case-insensitive de nombre como única validación de negocio visible.
- No se contempla borrado físico de etiquetas con histórico (la salida es la desactivación); el borrado físico de la absorbida en una fusión es parte de la propia fusión, no una operación independiente.
- Los desgloses por etiqueta (cierre mensual, resumen global, cuenta anual) incluyen las etiquetas inactivas usadas por movimientos del período: el estado solo regula la oferta en formularios, no el cálculo.
- Literales de UI en español; escritorio primero, usable en móvil sin optimización específica (decisión del propietario 2026-09-27).
- Los e2e de la feature operarán en su propia combinación cuenta/mes y en fichero propio, conforme a la convención de aislamiento del proyecto.

## Out of Scope

- **Creación de etiquetas**: cubierta por `017-creacion-tags-formulario` (inline junto al Select «Etiqueta»); esta feature no añade vías de creación.
- Asignación de etiquetas a movimientos desde la vista de catálogo (el alta/edición de movimientos no cambia).
- Borrado físico de etiquetas con histórico como operación independiente.
- Edición en masa de movimientos, reasignación de etiquetas por lotes fuera de la fusión de dos etiquetas.
- Grupos genéricos de agregación (`015-anual-agrupada`, futura) ni la asignación etiqueta→grupo (015/004 del roadmap: «`004-gestion-tags` heredará la asignación tag→grupo», que se resolverá cuando 015 se especifique).
- Cambios en el modelo del movimiento, en la obligatoriedad/opcionalidad de la etiqueta, en `/`, `/summary`, `/annual`, cierre y cuadre, salvo reflejar el resultado de las operaciones de catálogo.
- Optimización móvil específica, dark mode y animaciones.
