# Feature Specification: Gestión de etiquetas y jerarquía unificada del catálogo

**Feature Branch**: `feature/027-gestion-etiquetas`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "Después de completar la gestión de categorías (026), necesito gestionar las etiquetas (crear, etc.) en la misma página de gestión de etiquetas. Además, allí no se distingue bien qué es una categoría y qué es una etiqueta: en el fondo es una jerarquía de etiquetas de 2 niveles donde el nivel padre agrupa. Quiero una experiencia tipo Money Lover: una sola vía de creación y el selector de etiquetas del movimiento agrupado por categoría. En ningún caso se asigna al padre."

**Fuente**: Necesidad surgida del uso de 026: el catálogo agrupado funcionó, pero (a) el ciclo de vida de las etiquetas sigue incompleto en `/tags` — no se puede crear una etiqueta desde la propia página (solo inline en el formulario, 017) — y (b) la página presenta categorías y etiquetas como dos conceptos casi idénticos (misma tipografía, mismo patrón de fila, dos botones de creación hermanos), lo que oculta que el modelo es una única jerarquía de clasificación de 2 niveles: movimiento → 1 etiqueta → 1 categoría (cada movimiento tiene a lo sumo una etiqueta y cada etiqueta pertenece a exactamente una categoría).

**Decisiones del propietario (2026-11-03)**:

- **Una sola vía de creación con inferencia de tipo** (resolución de [Q1], planificación 2026-11-03): único botón «Nueva etiqueta» en `/tags`; el diálogo pide nombre y una **categoría padre opcional**. Si el usuario no selecciona categoría padre, se infiere que está creando una **categoría** (nodo superior de la jerarquía de 2 niveles); si selecciona una, se infiere que está creando una **etiqueta** dentro de ella. Sin alta inline de categorías dentro del diálogo. El botón «Nueva categoría» de la cabecera desaparece.
- **Jerarquía visible como un árbol**: `/tags` presenta un único árbol — la categoría como grupo visual contenedor, la etiqueta como elemento contenido — nunca dos listados hermanos. El vocabulario de dominio no cambia («etiqueta», «categoría», nav «Etiquetas»).
- **Las categorías nunca son asignables a un movimiento** (decisión taxativa): en el selector del formulario son exclusivamente cabeceras organizativas no seleccionables (ni clic ni teclado); el movimiento siempre guarda una etiqueta.
- **Selector «Etiqueta» agrupado por categoría** en alta y edición de movimiento: amenda la decisión de 026 (FR-008) que lo mantenía plano; es cambio de presentación, no de semántica.
- **Los informes siguen intactos**: la categoría no computa en ningún agregado (se mantiene FR-008 de 026); el informe por categorías anotado como feature futura (~027 en el roadmap) se diferirá a un número posterior.

**Granularidad** (constitución II): una única user story pequeña: completar la gestión de etiquetas en `/tags` presentando la jerarquía como un solo concepto. Las tres superficies (árbol en `/tags`, alta de etiqueta con categoría, selector agrupado) no son historias con valor independiente: juntas resuelven un único problema de uso — «veo dos conceptos y no puedo crear etiquetas» — tal y como lo ha encuadrado el propietario. No aplica excepción.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gestionar etiquetas desde /tags con la jerarquía a la vista (Priority: P1)

Como propietario de la aplicación, quiero crear etiquetas desde `/tags` eligiendo su categoría (o creándola al vuelo en el mismo diálogo), ver el catálogo como un único árbol donde la categoría agrupa y la etiqueta clasifica, y que el selector «Etiqueta» del formulario de movimiento agrupe las opciones por categoría con cabeceras no seleccionables — para gestionar el ciclo de vida completo de las etiquetas en un solo sitio y entender la jerarquía sin ambigüedad.

**Why this priority**: Es la única historia de la feature: completa el ciclo de gestión en `/tags` (hoy faltaba el alta) y unifica la presentación de la jerarquía en toda la app, que es la confusión que motiva la feature.

**Independent Test**: Se puede probar entrando en `/tags`: creo la etiqueta «Mercadona» eligiendo (o creando al vuelo) la categoría «Alimentación», la veo listada dentro de su grupo, y al registrar un gasto el selector me la muestra bajo la cabecera «Alimentación» — sin que la cabecera misma sea elegible.

**Acceptance Scenarios**:

1. **Given** `/tags` con las categorías «General» y «Alimentación», **When** creo la etiqueta «Mercadona» seleccionando «Alimentación», **Then** la etiqueta aparece listada dentro del grupo de esa categoría sin recarga manual y queda disponible de inmediato en el selector «Etiqueta» del formulario de movimiento, dentro de su grupo.
2. **Given** el diálogo «Nueva etiqueta», **When** confirmo con el selector de categoría **vacío** y nombre «Suscripciones», **Then** se crea una **categoría** «Suscripciones» (nivel superior) que aparece como grupo nuevo vacío en el árbol; y al repetir el flujo seleccionándola como padre, la etiqueta «Netflix» queda creada dentro de ella (ambos pasos desde el mismo punto de entrada, sin inline).
3. **Given** existe la etiqueta «Ocio», **When** intento crear «ocio» (o «OCIO»), **Then** la creación se rechaza con mensaje claro de duplicado y el nombre tecleado permanece editable para corregirlo; la regla es la vigente del catálogo (ignora mayúsculas/minúsculas, no normaliza acentos, trim previo).
4. **Given** `/tags` mostrando el catálogo, **When** observo la página, **Then** cada etiqueta se presenta dentro del grupo visual de su categoría (contenedor vs contenido) con una jerarquía inequívoca: no existen dos listados hermanos de categorías y etiquetas, y existe un único punto de entrada de creación («Nueva etiqueta», sin botón «Nueva categoría»).
5. **Given** el formulario de alta o edición de un movimiento, **When** despliego el selector «Etiqueta», **Then** las etiquetas activas aparecen agrupadas por categoría bajo cabeceras visibles no seleccionables, la opción elegida guarda exactamente la misma etiqueta que hoy, y «Sin etiqueta» sigue disponible en ingresos.
6. **Given** el selector desplegado, **When** lo recorro con teclado, **Then** las cabeceras de categoría se saltan (no reciben foco ni pueden quedarse seleccionadas): nunca puede almacenarse una categoría como etiqueta de un movimiento.
7. **Given** una etiqueta cualquiera en `/tags`, **When** renombro, fusiono, desactivo, reactivo o muevo de categoría, **Then** cada acción funciona exactamente como hoy (004/026), con sus diálogos montados a nivel del listado.
8. **Given** una categoría sin etiquetas activas (todas inactivas o vacía), **When** despliego el selector «Etiqueta» del formulario, **Then** esa categoría no pinta una cabecera vacía: solo aparecen categorías con al menos una etiqueta activa.
9. **Given** el patrón inline «+ Nueva etiqueta» de 017 dentro del formulario de movimiento, **When** creo una etiqueta sin salir del formulario, **Then** nace asignada a la categoría genérica sin pasos adicionales (FR-007 de 026) y el flujo de captación por tandas funciona exactamente igual que hoy.

---

### Edge Cases

- **Nombre vacío o solo espacios** (etiqueta o categoría, incluida el alta inline): se recorta antes de validar; un nombre vacío tras el recorte se rechaza con mensaje claro sin abandonar el flujo.
- **Duplicados ignorando mayúsculas**: «Hogar»/«HOGAR» son duplicados dentro de cada catálogo (etiquetas con etiquetas, categorías con categorías); una etiqueta puede llamarse como una categoría (regla 026 vigente; la inferencia de tipo aplica cada regla a su catálogo destino).
- **Cancelar el diálogo «Nueva etiqueta»**: nada se compromete hasta confirmar (sin alta inline desde 2026-11-03, resolución Q1); cancelar es un no-op limpio.
- **Categoría eliminada con el diálogo abierto**: si la categoría elegida desaparece (p. ej. eliminada en otra pestaña) al confirmar el alta, se rechaza con mensaje claro conservando el nombre tecleado.
- **Edición de un movimiento cuya etiqueta está inactiva**: el selector agrupado conserva el comportamiento vigente del formulario de edición con la etiqueta actual del movimiento.
- **Doble envío**: los controles de creación se deshabilitan mientras la operación se procesa (patrón del proyecto).
- **Catálogo grande**: decenas de categorías × decenas de etiquetas siguen siendo utilizables en `/tags` y en el selector agrupado (la presentación concreta es detalle del plan).
- **Genérica renombrada**: sigue siendo la categoría por defecto del diálogo y la primera del árbol, con independencia de su nombre visible (identidad fija por slug, 026).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (crear etiqueta desde `/tags`)**: El usuario MUST poder crear una etiqueta desde `/tags` aportando nombre y la categoría a la que pertenece (selección explícita en el diálogo; sin valor por defecto desde la resolución Q1). El alta MUST aplicar trim y la unicidad vigente de etiquetas (ignorando mayúsculas/minúsculas, sin normalizar acentos), rechazando duplicados con mensaje claro que conserve el nombre tecleado. La etiqueta creada MUST aparecer en el catálogo y estar disponible en el selector del formulario sin recarga manual.
- **FR-002 (una sola vía de creación con inferencia de tipo — Q1 resuelta)**: El diálogo «Nueva etiqueta» MUST ser el único punto de creación de `/tags`: sin categoría padre seleccionada crea una **categoría** (con la unicidad vigente de categorías); con categoría padre seleccionada crea una **etiqueta** en ella. El sistema MUST NOT ofrecer creación de categorías en ningún otro lugar de `/tags` (el botón «Nueva categoría» de la cabecera desaparece) ni alta inline de categorías dentro del diálogo.
- **FR-003 (árbol unificado en `/tags`)**: La página `/tags` MUST presentar un único árbol jerárquico — categorías como grupos visuales contenedores (con sus acciones de 026: renombrar, eliminar la no genérica) y etiquetas como elementos contenidos (con sus acciones de 004/026: mover, renombrar, fusionar, desactivar/reactivar) — con exactamente un punto de entrada de creación («Nueva etiqueta»). La distinción visual entre nivel de agrupación y nivel de clasificación MUST ser inequívoca sin explicación externa.
- **FR-004 (selector agrupado por categoría)**: El selector «Etiqueta» de los formularios de alta y edición de movimiento MUST mostrar las etiquetas activas agrupadas por su categoría, con cabeceras de categoría visibles y no seleccionables (clic y teclado). Las categorías sin etiquetas activas MUST no pintar cabecera. La opción «Sin etiqueta» en ingresos y la semántica del valor guardado (id de etiqueta) MUST permanecer idénticas a las actuales.
- **FR-005 (categoría nunca asignable — invariante)**: El sistema MUST garantizar que un movimiento nunca almacena una categoría como clasificación: la clasificación del movimiento es su etiqueta (0..1); la categoría solo se alcanza indirectamente (movimiento → etiqueta → categoría). Ninguna superficie de captación puede ofrecer la categoría como valor elegible.
- **FR-006 (no-regresión explícita)**: `/summary`, `/annual`, los listados de cuenta, los KPIs y las materializaciones MUST permanecer funcionalmente idénticos (FR-008 de 026 se mantiene: la categoría no computa en ningún agregado). El patrón inline 017 y el ciclo de vida de etiquetas de 004 (desactivar/fusionar como única vía de retirada) MUST conservarse sin cambios.
- **FR-007 (actualización del roadmap maestro)**: Al completar la feature, el roadmap maestro MUST registrar la fila 027 (Completada) y re-referenciar la nota del informe del mes por categorías (anotada como ~027 el 2026-11-02) a un número posterior.
- **FR-008 (cobertura de tests)**: La feature MUST estar cubierta por tests: aplicación del alta de etiqueta con categoría (duplicados, categoría inexistente) y de la inferencia de tipo (sin padre → categoría), componentes de `/tags` (árbol, alta con categoría, mensajes de error), componentes del selector agrupado (agrupación, cabeceras no seleccionables, sin cabeceras vacías) y un flujo e2e que cree una categoría (sin padre), cree una etiqueta en ella y la use en un movimiento (constitución III).

### Key Entities

- **Etiqueta** (sin cambios de modelo): nombre único ignorando mayúsculas, slug, estado activa/inactiva, protección de «Aportación común», pertenencia única y obligatoria a una categoría (026). Novedad de comportamiento: el alta desde `/tags` permite elegir su categoría.
- **Categoría** (sin cambios de modelo): nombre único ignorando mayúsculas, genérica por slug constante renombrable y no eliminable. Novedad de comportamiento: se crea desde el mismo diálogo «Nueva etiqueta» dejando el selector de categoría vacío (inferencia de tipo, Q1).
- **Movimiento** (intacto): 0..1 etiqueta; la categoría nunca es atributo del movimiento (FR-005).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El alta completa de una etiqueta —incluida la creación de su categoría al vuelo— se realiza desde `/tags` sin salir de la página, y la etiqueta es utilizable en el siguiente movimiento registrado sin recarga manual.
- **SC-002**: Jerarquía inequívoca: el 100 % de las etiquetas se muestra dentro del grupo de su categoría en `/tags`, las categorías aparecen como cabeceras no seleccionables en el 100 % de los selectores de etiqueta, y el propietario distingue categoría y etiqueta sin explicación externa.
- **SC-003**: No-regresión: `/summary`, `/annual`, listados, KPIs y el flujo inline 017 producen exactamente los mismos números y comportamientos que antes de la feature.
- **SC-004**: Todas las suites (dominio, aplicación, componentes, e2e) en verde, con el flujo «categoría inline → etiqueta → movimiento» cubierto end-to-end.

## Assumptions

- El vocabulario de dominio no cambia: «etiqueta» y «categoría» siguen siendo los términos del producto; no se adopta «subcategoría».
- La presentación concreta del árbol (chips vs filas, iconos, contenedores, sutitle de la página) es detalle del plan; esta spec fija el comportamiento: un árbol, un punto de creación, jerarquía inequívoca.
- Las categorías siguen sin estado activa/inactiva y sin fusión (026); los grupos del catálogo no se colapsan (se mantiene la decisión de 026).
- El selector «Etiqueta» del formulario lista solo etiquetas activas (comportamiento vigente vía `ListActiveTags`); el agrupado hereda esa regla.
- No hay borrado definitivo de etiquetas: el ciclo de vida de retirada sigue siendo desactivar/fusionar (004); cualquier borrado duro es otra conversación.
- Literales de UI en español; escritorio primero, usable en móvil sin optimización específica.
- Los e2e de la feature operan en fichero propio y combinación cuenta/mes propia, conforme a la convención de aislamiento del proyecto.

## Out of Scope

- **Asignar movimientos a categorías** (al padre): prohibido por decisión del propietario (2026-11-03); las categorías son solo organizativas.
- **Informes por categoría** (balance por categoría, drill-down): feature futura ya anotada en el roadmap; se re-referencia en FR-007.
- **Borrado definitivo de etiquetas**: el ciclo de vida 004 (desactivar/fusionar) se mantiene.
- Renombrar el vocabulario de dominio (p. ej. «subcategorías»), reordenar el catálogo, colapsar grupos, colores/iconos por categoría.
- Movimiento de etiquetas en lote y creación de categorías desde el control «Mover a categoría…» (sigue ofreciendo solo categorías existentes, 026).
- Cambios en el modelo de datos: sin migraciones nuevas salvo necesidad técnica que justifique el plan.
- Optimización móvil específica, dark mode y animaciones.
