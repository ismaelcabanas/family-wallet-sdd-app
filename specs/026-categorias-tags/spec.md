# Feature Specification: Categorías de etiquetas — organización del catálogo

**Feature Branch**: `feature/026-categorias-tags`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Tenemos diseñado un sistema de etiquetas para etiquetar los movimientos, de manera que podemos agrupar movimientos de índole similar. Podemos tener un gran número de etiquetas, pero a nivel de visión general, a la hora de elaborar informes, ya sea por mes, meses, o anuales, me interesa tener una visión más general y no una visión tan desglosada por etiquetas. Por ejemplo, a nivel de visión general me interesa saber los movimientos, principalmente los gastos, que estén asociados con alimentación, o del hogar, o con viajes u ocio, etc., es decir, los gastos más relevantes para una familia a la hora de ver en qué se gasta el presupuesto familiar y de esta manera tomar decisiones."

**Fuente**: Necesidad nueva surgida del uso (no contemplada en el roadmap maestro): las etiquetas (002/004/017) ofrecen un catálogo plano que puede crecer mucho, y las vistas de visión general (`/summary`, `/annual`) desglosan por etiqueta individual. El propietario quiere un nivel de agrupación por encima — categorías familiares tipo «Alimentación», «Hogar», «Viajes», «Ocio» — aunque de momento solo como organización del catálogo.

**Decisiones del propietario (2026-11-02)**:

- **Taxonomía**: una categoría agrupa 1..N etiquetas; cada etiqueta pertenece a **exactamente una** categoría, obligatoriamente. La pertenencia es atributo de la etiqueta, nunca del movimiento.
- **Arranque**: todas las etiquetas existentes quedan asignadas a una **categoría genérica** única (backfill); después el propietario crea las categorías que considere y mueve las etiquetas a su ritmo. El catálogo inicial de categorías es solo la genérica (sin macros precargadas).
- **Informes fuera de alcance por ahora**: `/summary` y `/annual` quedan exactamente como están (desglose por etiqueta); cómo presentar la visión por categoría se decidirá en una feature futura.
- **Ciclo de vida mínimo**: crear, renombrar, mover etiquetas entre categorías y eliminar categorías vacías. Sin desactivar ni fusionar categorías (YAGNI).

**Granularidad** (constitución II): una única user story pequeña con valor propio — organizar el catálogo de etiquetas en categorías. Crear una categoría sin poder asignarle etiquetas no aportaría valor por sí solo, por lo que no se divide. No aplica excepción.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Organizar el catálogo de etiquetas en categorías (Priority: P1)

Como propietario de la aplicación, quiero agrupar las etiquetas del catálogo en categorías familiares (Alimentación, Hogar, Viajes, Ocio…), creando categorías y moviendo etiquetas entre ellas desde la vista de administración `/tags`, para tener el catálogo organizado a nivel general de forma que más adelante las vistas de visión general puedan apoyarse en esa agrupación — todo ello sin tocar ningún movimiento ni alterar los informes actuales.

**Why this priority**: Es la única historia de la feature y su razón de ser: el catálogo plano crece y necesita un nivel de organización superior; esta feature sienta el modelo y la gestión, y deja los informes intactos por decisión explícita del propietario.

**Independent Test**: Se puede probar entrando en `/tags`: tras la puesta en marcha todas las etiquetas aparecen agrupadas bajo la categoría genérica; creo «Alimentación», muevo las etiquetas de comida a ella, y compruebo que el catálogo queda agrupado, que ningún movimiento ha cambiado y que `/summary` y `/annual` siguen mostrando exactamente lo mismo.

**Acceptance Scenarios**:

1. **Given** la aplicación con etiquetas existentes y sin categorías, **When** se pone en marcha la feature, **Then** existe una categoría genérica («General») y el 100 % de las etiquetas existentes quedan asignadas a ella, sin perder ninguna ni alterar su nombre, slug ni estado.
2. **Given** la vista `/tags` mostrando el catálogo agrupado por categorías, **When** creo la categoría «Alimentación», **Then** la categoría aparece en el catálogo (vacía) junto a la genérica, con el nombre tal cual lo introduje.
3. **Given** que ya existe la categoría «Hogar», **When** intento crear «hogar» (o «HOGAR»), **Then** la creación se rechaza con un mensaje claro de nombre duplicado y el nombre tecleado permanece editable para corregirlo.
4. **Given** las categorías «General» y «Alimentación», **When** muevo la etiqueta «Supermercado» de «General» a «Alimentación», **Then** «Supermercado» deja de listarse bajo «General» y pasa a listarse bajo «Alimentación», inmediatamente y sin recargar la página manualmente.
5. **Given** movimientos registrados con la etiqueta «Supermercado», **When** muevo esa etiqueta a otra categoría, **Then** los movimientos no cambian en absoluto: siguen mostrando la etiqueta «Supermercado» con sus importes y fechas, y los desgloses por etiqueta de `/summary` y `/annual` permanecen idénticos.
6. **Given** la categoría «Alimentación», **When** la renombro a «Comida», **Then** el catálogo muestra el nuevo nombre, sus etiquetas siguen asignadas a ella y ningún movimiento ni informe cambia.
7. **Given** la categoría «Alimentación» con etiquetas asignadas, **When** intento eliminarla, **Then** se rechaza con un mensaje claro indicando que tiene etiquetas; **When** muevo todas sus etiquetas a otras categorías y vuelvo a intentar eliminarla, **Then** la categoría desaparece del catálogo.
8. **Given** el formulario de alta de movimiento con el patrón «+ Nueva etiqueta» de 017, **When** creo una etiqueta nueva en línea, **Then** la etiqueta nace asignada a la categoría genérica sin ningún paso adicional y el flujo de captación funciona exactamente igual que hoy.

---

### Edge Cases

- **Nombre de categoría vacío o solo espacios**: se recorta (trim) antes de validar y guardar; un nombre vacío tras el recorte se rechaza con mensaje claro.
- **Duplicados ignorando mayúsculas**: «Hogar» y «HOGAR» son duplicados (misma regla vigente del catálogo de etiquetas); «Alimentación» y «Alimentacion» **no** lo son (la regla vigente no normaliza acentos).
- **Categoría genérica protegida**: no se puede eliminar mientras exista (es el destino por defecto de las etiquetas nuevas); renombrarla sí está permitido y no cambia su papel de categoría por defecto.
- **Mover una etiqueta a la categoría que ya tiene**: no-op sin error; el catálogo queda igual.
- **Etiqueta protegida «Aportación común»** (004): puede moverse de categoría como cualquier otra; su protección afecta a renombrar/fusionar/desactivar la etiqueta, no a su pertenencia.
- **Fusión de etiquetas (004)**: al fusionar, la etiqueta superviviente conserva su categoría y los movimientos absorbidos heredan etiqueta y categoría de la superviviente; no quedan etiquetas huérfanas.
- **Desactivación de etiquetas (004)**: una categoría puede contener tanto etiquetas activas como inactivas; el estado de la etiqueta es ortogonal a su pertenencia.
- **Doble envío**: los controles de crear/renombrar/mover/eliminar se deshabilitan mientras la operación se procesa (mismo patrón que el resto de diálogos del proyecto).
- **Catálogo grande**: la agrupación debe seguir siendo usable con decenas de categorías y etiquetas (la presentación concreta —colapsable, orden— es detalle del plan).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (pertenencia obligatoria y única)**: Cada etiqueta MUST pertenecer a exactamente una categoría en todo momento; el sistema MUST garantizar el invariante en altas, movimientos entre categorías, fusiones de etiquetas y eliminación de categorías. La puesta en marcha MUST asignar todas las etiquetas existentes a la categoría genérica sin pérdida de datos ni modificación de movimientos.
- **FR-002 (catálogo agrupado)**: La vista `/tags` MUST mostrar las etiquetas agrupadas por su categoría, con la categoría genérica y las creadas por el usuario tratadas por igual. Cada grupo MUST reflejar de forma inmediata los cambios de pertenencia.
- **FR-003 (crear categoría)**: El usuario MUST poder crear una categoría aportando únicamente el nombre (con trim); un nombre vacío o duplicado ignorando mayúsculas/minúsculas MUST rechazarse con mensaje claro conservando el nombre tecleado para corregirlo. La categoría nace vacía y disponible para asignar etiquetas.
- **FR-004 (renombrar categoría)**: El usuario MUST poder renombrar una categoría con la misma regla de unicidad y mensajes de error que la creación. El renombrado MUST no alterar las etiquetas asignadas ni ningún movimiento.
- **FR-005 (mover etiqueta de categoría)**: El usuario MUST poder mover una etiqueta de una categoría a otra desde `/tags`. El cambio MUST ser inmediato en el catálogo y MUST no modificar ningún movimiento, importe ni desglose: la pertenencia es atributo de la etiqueta.
- **FR-006 (eliminar categoría vacía)**: El usuario MUST poder eliminar una categoría **solo si no tiene etiquetas asignadas**; una categoría con etiquetas MUST rechazar la eliminación con un mensaje claro. La categoría genérica MUST no ser eliminable.
- **FR-007 (etiquetas nuevas en la genérica)**: Toda etiqueta creada a partir de la puesta en marcha —incluida la creación inline «+ Nueva etiqueta» de 017— MUST quedar asignada por defecto a la categoría genérica sin pasos adicionales para el usuario.
- **FR-008 (fuera de alcance explícito)**: `/summary`, `/annual`, los formularios de movimiento, los listados de cuenta y los KPIs MUST permanecer funcionalmente idénticos: mismos desgloses por etiqueta, mismos importes, misma interacción. El selector «Etiqueta» del formulario de movimiento sigue mostrando las etiquetas sin agrupar por categoría.
- **FR-009 (actualización del roadmap maestro)**: Al completar la feature, el roadmap maestro MUST registrar la nueva fila (026, Completada) y dejar constancia de que la visión general por categorías en los informes queda diferida a una feature futura cuya presentación decidirá el propietario.
- **FR-010 (cobertura de tests)**: La feature MUST estar cubierta por tests: dominio/aplicación de la lógica de categorías (creación, duplicado case-insensitive, mover etiqueta, eliminación con/sin etiquetas, invariante de pertenencia), componentes de `/tags` (agrupación, diálogos, mensajes de error) y un flujo e2e que cree una categoría, mueva una etiqueta y verifique que el histórico no cambia (constitución III).

### Key Entities

- **Categoría** (nueva): agrupación de nivel superior del catálogo de etiquetas. Atributos: nombre único ignorando mayúsculas. Relación: contiene 1..N etiquetas; la categoría genérica existe siempre y es el destino por defecto de las etiquetas nuevas.
- **Etiqueta** (extensión): gana pertenencia única y obligatoria a una categoría. El resto de su modelo queda intacto: nombre único ignorando mayúsculas, slug derivado, estado activa/inactiva y protección de «Aportación común» (004).
- **Movimiento** (sin cambios): la categoría nunca es atributo del movimiento; se alcanza indirectamente a través de su etiqueta (0 o 1 por movimiento).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras la puesta en marcha, el 100 % de las etiquetas preexistentes están asignadas a la categoría genérica y 0 movimientos han sido modificados (importes, fechas, etiquetas de cada movimiento idénticos antes y después).
- **SC-002**: Organizar el catálogo completo — crear todas las categorías deseadas y mover cada etiqueta a la suya — es posible sin pérdida de ninguna etiqueta ni de su histórico, con la agrupación visible en `/tags` al instante.
- **SC-003**: Con el catálogo reorganizado, `/summary` y `/annual` producen exactamente los mismos números y filas por etiqueta que antes de la feature (verificación de no-regresión).
- **SC-004**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde y el flujo «crear categoría → mover etiqueta → histórico intacto» queda cubierto end-to-end.

## Assumptions

- La categoría genérica inicial se llama «General»; es renombrable pero no eliminable (es el destino por defecto de FR-007). Su identidad como categoría por defecto es fija, con independencia del nombre visible.
- La categoría no aparece en ningún sitio fuera de `/tags` en esta feature: ni en formularios de movimiento, ni en listados, ni en informes. El selector «Etiqueta» sigue plano.
- Las categorías no tienen estado activa/inactiva ni mecanismo de fusión en esta primera tanda (ciclo de vida mínimo, decisión del propietario 2026-11-02).
- La regla de unicidad de nombre replica la vigente de las etiquetas: ignora mayúsculas/minúsculas, no normaliza acentos, con trim previo.
- Los detalles técnicos (si la categoría necesita slug, esquema de persistencia, índices, forma de la UI de movimiento entre categorías —diálogo, select en fila, menú ⋮—) corresponden al plan; esta spec solo fija el comportamiento.
- Los desgloses por etiqueta de cierre mensual, resumen global y cuenta de resultados anual no cambian: la categoría computa como hoy (es decir, no computa) en todos los agregados.
- Literales de UI en español («Nueva categoría», «Mover a categoría…», mensajes de duplicado y de categoría con etiquetas); escritorio primero, usable en móvil sin optimización específica.
- Los e2e de la feature operarán en su propia combinación cuenta/mes y en fichero propio, conforme a la convención de aislamiento del proyecto.

## Out of Scope

- **Informes y visiones por categoría**: desglose por categoría en `/summary` y `/annual`, drill-down categoría→etiqueta, o cualquier cambio de presentación de los agregados (diferido explícitamente; el propietario decidirá la forma).
- **Desactivar/fusionar categorías**, reordenar el catálogo, colores o iconos por categoría.
- **Agrupar el selector «Etiqueta»** del formulario de movimiento por categorías (optgroup).
- Cambios en el modelo del movimiento, en la obligatoriedad de la etiqueta, o en la gestión de etiquetas de 004/017 más allá de añadir su categoría.
- Migración de datos desde los Excel históricos.
- Optimización móvil específica, dark mode y animaciones.
