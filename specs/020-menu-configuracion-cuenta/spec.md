# Feature Specification: Menú de configuración en las tarjetas de cuenta

**Feature Branch**: `feature/020-menu-configuracion-cuenta`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Me gustaría replanificar dónde se ubica la configuración del ingreso. Es una configuración que no quiero estar viendo cada vez que acceso a los movimientos del usuario, en su lugar, creo que estaría mejor tener en la card la típica imagen de 3 puntitos con las distintas opciones de configuración."

**Fuente**: Petición directa del propietario (2026-10-13) tras completar `018-ingresos-regulares` (PR #17 mergeada). Da por construidos `012-panel-cuentas` (tarjetas lanzadera en `/`) y `018` (panel «Ingreso regular» al final de la página de cuenta + diálogo de configuración). El panel de configuración actual genera ruido permanente en una página de uso diario: la configuración del ingreso regular es una acción de baja frecuencia que hoy ocupa espacio visible en cada visita a los movimientos.

**Decisiones del propietario (2026-10-13)**:

- **Menú de configuración (⋮) en la tarjeta de la cuenta**: la entrada a la configuración del ingreso regular pasa del panel inferior de la página de cuenta a un menú de tres puntos en la tarjeta de cada cuenta personal del panel de cuentas (`/`).
- **Estado en el propio ítem del menú**: el ítem «Ingreso regular» muestra su estado (activa/desactivada/sin configurar); la tarjeta queda limpia, sin badges ni indicadores.
- **El panel inferior desaparece por completo**: la página de cuenta se queda solo en movimientos, cierre y balance; la única entrada de configuración es el menú de la tarjeta.
- **Feature nueva (020), no enmienda de 018**: 018 se mergea tal cual (completa y validada); esta reubicación es una feature hija pequeña. La aportación porcentual a la cuenta común sigue reservada como feature futura (rama `019-aportacion-comun`).

**Granularidad** (constitución II): una única user story pequeña con valor propio — mover la configuración del ingreso regular a un menú en la tarjeta para que la página de cuenta esté libre de ruido de configuración. No aplica excepción.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar el ingreso regular desde el menú de la tarjeta de mi cuenta (Priority: P1)

Como miembro, quiero que la configuración de mi ingreso regular viva detrás de un menú de tres puntos (⋮) en la tarjeta de mi cuenta del panel de cuentas, para que la página de mis movimientos se centre en lo que hago a diario (consultar, registrar) y no vea opciones de configuración en cada visita.

**Why this priority**: Es la única historia de la feature: reubicar una entrada ya existente. El valor es de higiene de producto — configuración de baja frecuencia fuera del camino diario — y deja el hogar natural para configuración futura (p. ej. la aportación % de la feature 019).

**Independent Test**: Se puede probar abriendo el menú ⋮ de la tarjeta de una cuenta personal en el panel de cuentas: el ítem «Ingreso regular» muestra su estado, lo abre el diálogo de configuración (el mismo de 018) y, tras guardar o desactivar, el estado del ítem se actualiza; la página de la cuenta ya no muestra ningún panel de configuración pero el ingreso del mes consultado sigue materializándose igual.

**Acceptance Scenarios**:

1. **Given** el panel de cuentas (`/`) con mis cuentas personales, **When** abro el menú ⋮ de una tarjeta personal, **Then** veo el ítem «Ingreso regular» acompañado de su estado: sin configurar, activa o desactivada.
2. **Given** el menú abierto en una cuenta sin configuración, **When** pulso «Ingreso regular», **Then** se abre el diálogo de configuración vacío (mismos campos, validaciones, defaults y comportamiento de guardado que en 018).
3. **Given** el menú abierto en una cuenta con configuración (activa o desactivada), **When** pulso «Ingreso regular», **Then** se abre el diálogo precargado con los valores de la configuración y puedo editar o desactivar con los mismos efectos y mensajes que en 018.
4. **Given** una tarjeta de cuenta personal, **When** pulso en cualquier parte de la tarjeta fuera del menú ⋮, **Then** navego a la página de la cuenta como hasta ahora: la tarjeta sigue siendo un lanzador.
5. **Given** la tarjeta de la cuenta común, **When** la consulto en el panel, **Then** no ofrece menú de configuración: no existe configuración de ingreso regular para la cuenta común (FR-001 de 018).
6. **Given** la página de la cuenta personal, **When** la consulto tras la reubicación, **Then** ya no aparece el panel «Ingreso regular» al final, y el ingreso del mes consultado sigue materializándose exactamente igual (el comportamiento de 018 no cambia).
7. **Given** el diálogo de configuración abierto desde el menú, **When** guardo o desactivo con éxito, **Then** el diálogo cierra con su toast y el estado del ítem «Ingreso regular» del menú refleja el nuevo estado al volver a abrirlo.
8. **Given** el menú ⋮ abierto, **When** pulso fuera, pulso Escape o desplazo el foco, **Then** el menú cierra sin navegar ni abrir diálogo.

---

### Edge Cases

- **Clic en el ⋮ no navega**: el botón del menú dentro de la tarjeta no debe activar la navegación de la tarjeta (y viceversa: el menú abierto no bloquea la navegación si se pulsa la tarjeta).
- **Dos cuentas personales**: menús independientes; abrir el de una no abre ni afecta al de la otra; cada una muestra el estado de su propia configuración.
- **Estado recién cambiado**: tras guardar/desactivar/reactivar desde el diálogo, el estado del ítem debe estar sincronizado (revalidación), sin recargar la página a mano.
- **Diálogo con errores de validación**: el diálogo permanece abierto con los errores y valores conservados (comportamiento 018); el menú que lo lanzó ya está cerrado.
- **Doble apertura del menú**: el botón ⋮ con el menú abierto lo cierra (toggle), no lo duplica.
- **Accesibilidad y teclado**: el menú es operable con teclado (abrir con Enter/Espacio, navegar ítems, cerrar con Escape) y anuncia su rol (patrón menú de shadcn/ui si existe, o DropdownMenu de Radix).
- **Móvil**: el objetivo táctil del ⋮ es suficiente (≥ 44 px como el resto de acciones) y el menú no se sale del viewport en tarjetas de la última columna.
- **Config inactiva**: el ítem muestra «desactivada» y el diálogo abre precargado con la opción de reactivar editando y guardando (semántica de reactivación de 018 intacta).
- **Descubibilidad reducida**: la configuración pasa a estar un nivel más profunda; asumido por el propietario (1-2 usuarios que conocen el producto).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (menú de configuración en la tarjeta)**: El sistema MUST ofrecer en cada tarjeta de cuenta personal del panel de cuentas un menú de configuración (⋮) cuyo primer ítem es «Ingreso regular» con indicación de su estado (sin configurar / activa / desactivada). Las tarjetas sin opciones de configuración aplicables (la cuenta común) MUST carecer de menú. Los literales exactos y el marcado del estado se congelan en el ui-contract del plan.
- **FR-002 (diálogo sin cambios funcionales)**: El ítem «Ingreso regular» MUST abrir el mismo diálogo de configuración de 018 (campos, defaults, validaciones con mensajes exactos, intents `save`/`deactivate`, toasts y revalidación), vacío sin configuración y precargado con ella. Ningún comportamiento de la action `configureRegularIncome` ni de los casos de uso cambia.
- **FR-003 (la tarjeta sigue siendo lanzador)**: La interacción principal de la tarjeta (pulsar la tarjeta) MUST seguir navegando a la página de la cuenta; el menú y su botón MUST no navegar ni interferir esa acción.
- **FR-004 (página de cuenta sin panel)**: La página de la cuenta personal MUST dejar de renderizar el panel «Ingreso regular». La materialización perezosa previa a la lectura MUST permanecer exactamente igual (único disparador, guardas de rango, idempotencia): el ingreso del mes consultado sigue apareciendo en el listado sin alta manual.
- **FR-005 (alcance de adaptador)**: El cambio MUST limitarse a adaptadores de UI: panel de cuentas (tarjeta + menú + montaje del diálogo) y página de cuenta (desmontaje del panel). Dominio, aplicación, action, repositorio, BD y materialización quedan intactos.
- **FR-006 (actualización de e2e afectados)**: Los e2e que asumen la UI previa MUST actualizarse: `panel-cuentas.spec.ts` (N1 «lanzador puro» enmendado: tarjeta + menú ⋮ en cuentas personales, sin más adornos) e `ingresos-regulares.spec.ts` (el flujo de configuración parte ahora del menú de la tarjeta). La combinación cuenta/mes de cada spec y el aislamiento mutuo se conservan.
- **FR-007 (actualización del roadmap maestro)**: Al completar la feature, el roadmap maestro MUST registrar la fila 020 (Completada) y dejar constancia de que el menú de configuración de la tarjeta es el hogar de las opciones de cuenta, donde la aportación % (019) añadirá su entrada.
- **FR-008 (cobertura de tests)**: La feature MUST estar cubierta por tests: componente del menú/tarjeta (estados por tipo de cuenta, apertura de diálogo según estado, no-navegación al usar el menú), suite de la página de cuenta sin el panel, suites existentes de action y diálogo de 018 en verde, y e2e del flujo reubicado (configurar desde el menú → consultar mes → ingreso materializado) (constitución III).

### Key Entities

- **Menú de configuración de la tarjeta (nuevo, adaptador UI)**: Accesorio visual de la tarjeta de cuenta en el panel de cuentas: lista de ítems de configuración con su estado. Nace con un único ítem («Ingreso regular»); la aportación % (019) y futuras opciones de cuenta se añadirán aquí.
- **Ingreso regular (sin cambios de dominio)**: Su configuración, estados y materialización son los de 018; solo cambia el punto de acceso en la interfaz.
- **Tarjeta de cuenta (afectada)**: sigue siendo lanzador; gana el botón ⋮ en cuentas personales.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La página de la cuenta personal muestra 0 elementos de configuración del ingreso regular: solo movimientos, cierre y balance; y el ingreso del mes consultado sigue materializándose (comportamiento 018 intacto).
- **SC-002**: Configurar, editar o desactivar el ingreso regular desde el menú de la tarjeta toma menos de 1 minuto, y el estado del ítem refleja la última acción sin recarga manual (revalidación).
- **SC-003**: El menú es operable con teclado y lector de pantalla (abrir/navegar/cerrar) y el clic en la tarjeta navega siempre que no se use el menú.
- **SC-004**: Todas las suites (dominio, aplicación, componentes, action, e2e —incluidas las enmiendas de FR-006) quedan en verde.

## Assumptions

- **El ⋮ solo aparece donde hay opciones**: hoy solo cuentas personales (ingreso regular); la cuenta común no muestra menú. Ampliable cuando existan opciones aplicables (p. ej. aportación % en 019, ya reservada en rama).
- **Los literales y el marcado exacto del estado** («Activa»/«Desactivada»/«Sin configurar», sufijo del ítem) se deciden y congelan en el ui-contract del plan.
- **Reutilización del diálogo y la action de 018**: el componente de diálogo (con `useActionState(configureRegularIncome)`) se reutiliza; la página `/` necesitará leer el DTO del ingreso regular de cada cuenta personal (lectura server-side nueva en el adaptador, `GetRegularIncome`).
- **Componente de menú**: se usará el patrón de menú/dropdown del stack (Radix/shadcn) ya presente en el repo; sin dependencias nuevas.
- **Móvil usable**: el ⋮ es alcanzable con pulgar y el menú no se descorta.
- El panel «Ingreso regular» y su suite de componente se retiran/adaptan con la feature (el diálogo se conserva); el detalle de qué ficheros se reutilizan vs. renombran es decisión del plan.

## Out of Scope

- **Nuevas opciones de configuración**: solo se reubica la entrada «Ingreso regular»; la aportación % (019) añadirá la suya sobre este menú en su propio ciclo.
- **Cambios de dominio, aplicación, action, repositorio, BD o materialización** (FR-005): cualquier ajuste funcional del ingreso regular es scope de 018 (o futuras), no de aquí.
- **Reordenar o rediseñar tarjetas**, edición de cuentas/miembros, o convertir el panel de cuentas en dashboard (balances en tarjeta, etc.).
- **Configuración global o por miembro fuera de la tarjeta** (página de ajustes): no se crea.
- Dark mode, animaciones y optimización móvil específica.
