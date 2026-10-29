# Feature Specification: Gestión de cuentas y miembros

**Feature Branch**: `feature/008-gestion-cuentas-miembros`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "008-gestion-cuentas-miembros"

**Fuente**: Fila del roadmap maestro (`specs/001-family-wallet/spec.md`, reservada en el split del 2026-09-14): *«Gestión de cuentas y miembros: añadir y renombrar» (refinamiento de FR-001)*. Hoy el catálogo de miembros y cuentas nace del seed con nombres de plataforma («Miembro A», «Miembro B», «Cuenta de Miembro A/B», «Cuenta común») y no existe ninguna vía de gestión: la asunción del maestro («la unidad familiar inicial son 2 miembros y 3 cuentas, pero el sistema debe permitir añadir más miembros y cuentas sin rediseño») sigue sin cubrirse en la interfaz.

**Contexto relevante (features completadas)**:

- `012-panel-cuentas`: `/` es el panel con tarjetas lanzadera por cuenta (nombre + etiqueta de tipo, sin datos financieros).
- `020-menu-configuracion-cuenta`: el menú ⋮ de la tarjeta de cuenta personal es el **hogar de las opciones de cuenta** (hoy: ingreso regular, aportación, ahorro); la cuenta común no ofrece menú porque no tiene opciones aplicables.
- Las vistas derivadas (listado por cuenta, cierre mensual, resumen global, cuenta de resultados anual, desgloses por miembro) leen siempre los datos vigentes: renombrar no requiere recálculo ni migración, solo reflejar el nuevo nombre en la siguiente lectura.
- La atribución de miembro vive en la cuenta (`cuenta personal → miembro`), no en cada movimiento: renombrar un miembro no toca los movimientos.
- Las configuraciones por cuenta (ingreso regular 018, aportación 019, ahorro 23) y los KPIs de la página de cuenta (022/023) funcionan para cualquier cuenta personal: una cuenta nueva arranca «Sin configurar» y el KPI de aportación muestra el literal previsto.

**Granularidad** (constitución II): la fila agrupa dos operaciones (añadir, renombrar) sobre dos entidades hermanas (miembro, cuenta) que comparten una única superficie de gestión y recorrido UI. Es la excepción que decidió y justificó el propietario al reservar la fila en el split del 2026-09-14 (mismo criterio que 003: formulario y recorrido compartidos).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Poner nombres reales a miembros y cuentas (Priority: P1)

Como propietario, quiero renombrar los miembros y las cuentas sembrados con nombres de plataforma (y cualquiera creado después), para que toda la interfaz —panel, páginas de cuenta, cierres, resumen global y cuenta de resultados anual— muestre los nombres reales de mi familia y de nuestras cuentas sin perder un solo dato histórico.

**Why this priority**: Es la necesidad real que motivó la feature: el seed deja «Miembro A/B» y hoy la única vía de cambio es editar la base de datos a mano. Es además el cambio de menor riesgo: no altera ni crea datos, solo etiquetas.

**Independent Test**: Se puede probar renombrando un miembro y una cuenta desde el panel y verificando que el panel, la página de cuenta y los agregados (resumen global, anual) muestran el nuevo nombre, con balances, cierres y desgloses numéricamente idénticos.

**Acceptance Scenarios**:

1. **Given** el panel de cuentas con la tarjeta «Cuenta de Miembro A», **When** renombro la cuenta a «Cuenta de Isma», **Then** la tarjeta (y todo listado/cierre de esa cuenta) muestra el nuevo nombre y el balance acumulado y los movimientos históricos permanecen intactos.
2. **Given** un miembro llamado «Miembro B», **When** lo renombro a «Sole», **Then** los desgloses por miembro (resumen global, ingresos por miembro del anual) muestran «Sole» con los mismos importes, sin duplicar filas ni perder histórico.
3. **Given** la cuenta común, **When** la renombro (p. ej. «Cuenta conjunta»), **Then** el panel y sus vistas reflejan el nuevo nombre.
4. **Given** el formulario de renombrado, **When** dejo el nombre vacío o solo espacios, **Then** el sistema muestra un error claro, no guarda y conserva lo tecleado.
5. **Given** un miembro llamado «Isma», **When** intento renombrar otro miembro a «ISMA», **Then** el sistema lo impide por duplicado (ignorando mayúsculas) con un mensaje claro; la misma regla aplica a nombres de cuenta entre sí.
6. **Given** una cuenta personal con ingreso regular, aportación o ahorro configurados, **When** renombro la cuenta o su miembro, **Then** las configuraciones siguen activas y con sus valores (el renombrado no toca type, atribución, movimientos, tags ni balances).

---

### User Story 2 - Añadir un miembro de la familia con su cuenta personal (Priority: P2)

Como propietario, quiero dar de alta un miembro nuevo con su cuenta personal, para que la unidad familiar pueda crecer (un hijo, un tercero) sin tocar la base de datos y que desde el primer momento pueda recibir movimientos y aparecer en los desgloses por miembro.

**Why this priority**: Cubre la asunción explícita del maestro («añadir más miembros sin rediseño»). No es la necesidad diaria de hoy (2 miembros), pero es la mitad «añadir» de la fila del roadmap y desbloquea el crecimiento real de la familia.

**Independent Test**: Se puede probar dando de alta un miembro desde el panel: aparece su tarjeta nueva en `/`, su página de cuenta funciona (KPIs en estado «Sin configurar»), admite registro de movimientos y el resumen global/anual lo incluye en los desgloses por miembro.

**Acceptance Scenarios**:

1. **Given** el panel de cuentas, **When** doy de alta el miembro «Nueva» [NEEDS CLARIFICATION: alcance exacto de las altas — ver Q1], **Then** aparece en el panel su cuenta personal (nombre por defecto derivado, p. ej. «Cuenta de Nueva») y puedo navegar a su página.
2. **Given** la cuenta del miembro nuevo, **When** registro movimientos en ella y consulto el resumen global y el anual, **Then** los importes se atribuyen al miembro nuevo en los desgloses por miembro.
3. **Given** la cuenta del miembro nuevo, **When** abro el menú ⋮ de su tarjeta, **Then** los ítems muestran «Sin configurar» y los diálogos de 018/019/023 funcionan sobre ella como en cualquier cuenta personal.
4. **Given** el alta de un miembro, **When** confirmo con nombre vacío o duplicado (ignorando mayúsculas) de uno existente, **Then** error claro sin alta parcial (no se crea el miembro ni la cuenta).
5. **Given** un año con la cuenta creada a mitad de año, **When** consulto la cuenta de resultados anual, **Then** el miembro nuevo aparece con importes a cero en los meses previos, sin errores.

---

### User Story 3 - Añadir una cuenta [NEEDS CLARIFICATION: alcance exacto — ver Q1] (Priority: P3)

Como propietario, quiero poder ampliar el conjunto de cuentas según el alcance decidido en Q1 (cuentas comunes adicionales y/o segundas cuentas personales de un miembro existente, o ninguna), para que la estructura de cuentas siga al ritmo de la familia sin rediseño.

**Why this priority**: Depende totalmente de la decisión de Q1: si el alcance elegido no incluye más cuentas que las creadas vía miembros (US2), esta historia queda vacía y se retira de la spec.

**Independent Test**: Según el alcance decidido: dar de alta la cuenta nueva (elegiendo tipo y, si es personal, miembro atribuido) y verificar que aparece en el panel, admite movimientos y computa en cierres y agregados como cualquier otra cuenta de su tipo.

**Acceptance Scenarios**:

1. **Given** el panel de cuentas, **When** doy de alta una cuenta del alcance permitido por Q1, **Then** aparece su tarjeta en el panel con su etiqueta de tipo y navega a su página.
2. **Given** una cuenta común adicional dada de alta, **When** registro gastos en ella, **Then** computan como comunes en cierres y resumen global, igual que la cuenta común original.
3. **Given** el alta de una cuenta personal para un miembro existente (si Q1 lo permite), **When** consulto los desgloses por miembro, **Then** sus movimientos de ambas cuentas se atribuyen al mismo miembro.

---

### Edge Cases

- **Nombre vacío o solo espacios**: error claro, sin guardado, valor conservado en el formulario (patrón de inputs controlados del repo).
- **Duplicados ignorando mayúsculas**: «Isma» vs «ISMA» bloqueados con mensaje claro, tanto en miembros como en cuentas (paridad con la regla de tags del maestro); la unicidad de nombres de cuenta es global (entre personales y comunes).
- **Renombrar con histórico**: todos los agregados muestran el nuevo nombre con importes idénticos; nada se duplica ni se pierde (las vistas son derivadas).
- **Renombrar la cuenta de un miembro con configs activas** (018/019/023): configs intactas y operativas.
- **Alta parcial**: un fallo de validación no puede dejar miembro creado sin cuenta ni viceversa.
- **Cuenta nueva en KPIs/agregados**: la página de cuenta personal nueva renderiza el bloque de KPIs de 022/023 («Sin aportación configurada»/0,00 € y ahorro sin configurar); el anual muestra columnas/filas a cero de meses previos.
- **Nombre con espacios extremos**: se recorta (trim) antes de validar y guardar, como en el resto del dominio.
- **Renombrado desde el panel no navega**: la acción de renombrar no debe disparar la navegación de la tarjeta (misma salvaguarda del ⋮ de 020).
- **Revalidación**: tras alta o renombrado, el panel refleja el cambio sin recarga manual.
- **Aislamiento e2e**: la spec e2e nueva opera sobre su propia combinación cuenta/mes sin colisionar con las existentes (convención del repo).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (renombrar miembro)**: El sistema MUST permitir renombrar un miembro existente desde la superficie de gestión del panel de cuentas: nombre obligatorio (recortado), único entre miembros ignorando mayúsculas, con mensajes de error claros. El renombrado MUST propagarse a todas las vistas que muestran el miembro (panel, desgloses por miembro del resumen global y del anual) **sin alterar** movimientos, atribuciones, configuraciones ni importes.
- **FR-002 (renombrar cuenta)**: El sistema MUST permitir renombrar cualquier cuenta (personal o común): mismas reglas de validación (obligatorio, recortado, única entre cuentas ignorando mayúsculas). El renombrado MUST reflejarse en panel, página de cuenta y listados, conservando type, atribución a miembro, movimientos, tags, configuraciones (018/019/023) y balances exactos. La cuenta común MUST ganar acceso a esta operación (hoy su tarjeta no ofrece menú).
- **FR-003 (alta de miembro con cuenta personal)**: El sistema MUST permitir dar de alta un miembro nuevo que nace con su cuenta personal (nombre de cuenta por defecto derivado del miembro, editable después con FR-002), de forma atómica (miembro y cuenta se crean juntos o no se crea nada). La cuenta nueva MUST funcionar de inmediato: tarjeta en el panel, página de cuenta con KPIs en estado inicial, registro de movimientos y presencia en desgloses por miembro.
- **FR-004 (alta de cuentas adicionales)**: El sistema MUST permitir las altas de cuenta correspondientes al alcance decidido en Q1 [NEEDS CLARIFICATION]: si el alcance no incluye cuentas adicionales, este requisito se retira; si las incluye, el alta respeta las reglas del dominio (personal ⇒ miembro atribuido; común ⇒ sin miembro) y la unicidad global de nombres.
- **FR-005 (superficie de gestión única)**: Las operaciones de la feature (altas y renombrados) MUST vivir en el panel de cuentas (`/`), extendiendo el patrón del menú ⋮ de 020 para las operaciones por tarjeta y ofreciendo un acceso visible para las altas. El diseño exacto (ubicación de las altas, diálogos, literales) se congela en el ui-contract del plan.
- **FR-006 (propagación del renombrado de miembro a su cuenta)**: [NEEDS CLARIFICATION — ver Q2] El renombrado de un miembro y el de su cuenta personal son operaciones independientes / se propaga según el patrón por defecto / otra política elegida en Q2.
- **FR-007 (sin borrado ni reatribución)**: La feature MUST no incluir borrado ni desactivación de miembros/cuentas, ni cambio de tipo o de miembro atribuido de una cuenta: solo altas y renombrados (límite explícito de la fila del roadmap).
- **FR-008 (validación consistente y usable)**: Todos los formularios de la feature MUST validar en frontera (mensajes claros en español), conservar el valor tecleado ante errores y ser operables por teclado; los diálogos siguen los patrones del repo (inputs controlados, `role="alert"`, diálogos montados a nivel del listado/panel, no por fila desmontable).
- **FR-009 (cobertura de tests)**: La feature MUST estar cubierta por tests de dominio/aplicación (reglas de validación y atomicidad del alta), de componente, de action y por una spec e2e nueva (flujo crítico: alta + renombrado con propagación a vistas), respetando el aislamiento cuenta/mes de las e2e existentes (constitución III).
- **FR-010 (roadmap maestro)**: Al completar la feature, el roadmap maestro MUST registrar la fila 008 como Completada y dejar constancia de las decisiones de Q1/Q2 si amiendan asunciones del maestro.

### Key Entities

- **Miembro (existente, ampliado en su gestión)**: Persona de la unidad familiar con nombre único. Gana operación de renombrado y alta; sin cambios de estructura. Sigue siendo la base de los desgloses por miembro (resumen global, anual).
- **Cuenta (existente, ampliada en su gestión)**: Agrupación con nombre, tipo (personal/común) y atribución a miembro (solo personales). Gana renombrado y —según Q1— altas adicionales; tipo y atribución son inmutables tras el alta (FR-007). La tarjeta de la cuenta común pasa a ofrecer menú con su renombrado.
- **No se introducen entidades nuevas**: las vistas derivadas (cierre, resumen, anual) consumen los nombres vigentes sin cambios.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Renombrar un miembro o una cuenta toma menos de 30 segundos desde el panel y el nuevo nombre es visible en panel y vistas derivadas sin recarga manual.
- **SC-002**: Tras cualquier renombrado, el 100% de los datos históricos permanece: balances acumulados, cierres, resúmenes y desgloses numéricamente idénticos (solo cambian etiquetas).
- **SC-003**: Dar de alta un miembro toma menos de 1 minuto y su cuenta es inmediatamente operativa (movimientos registrables, desgloses por miembro actualizados, KPIs en estado inicial).
- **SC-004**: Todas las suites (dominio, aplicación, componentes, actions, e2e existentes y la nueva) quedan en verde.

## Assumptions

- **Superficie**: la gestión vive en el panel `/` (FR-005); la cuenta común gana menú ⋮ solo con «Renombrar cuenta». El detalle visual se congela en el plan.
- **Validación de nombres**: obligatorio, recorte de espacios, unicidad case-insensitive (miembros entre sí; cuentas entre sí, global para cuentas). Paridad con la regla de duplicados de tags (edge case del maestro).
- **Nombre de cuenta por defecto en el alta de miembro**: «Cuenta de {nombre}» (patrón del seed), renombrable después.
- **El seed no cambia**: sigue sembrando «Miembro A/B» y las 3 cuentas; la primera personalización la hace el usuario con esta feature (renombrar tras instalar).
- **Sin límite duro de miembros/cuentas** más allá de las validaciones; no se implementan confirmaciones destructivas porque no hay operaciones destructivas.
- **Configs y KPIs intactos**: las features 018/019/021/022/023 operan sin cambios sobre cuentas nuevas (arrancan «Sin configurar»); la materialización perezosa no se altera.
- **Atribución de miembro**: vive en la cuenta (no en movimientos), así que renombrar un miembro no requiere tocar movimientos; los desgloses derivan siempre del nombre vigente.
- **Dependencias**: da por construidos 012 (panel), 020 (menú ⋮) y los agregados 005/006/009; no depende de features futuras (007, 010, 015).

## Out of Scope

- **Borrado, desactivación o archivado** de miembros y cuentas (límite de la fila del roadmap; el histórico siempre se conserva).
- **Cambio de tipo de cuenta o de miembro atribuido** tras el alta.
- **Gestión de miembros sin cuenta personal** o miembros «auxiliares» (p. ej. hijos sin cuenta): todo miembro nace con su cuenta (FR-003).
- **Transferencias entre cuentas**, multiusuario con credenciales y regla de reparto (alcance diferido del maestro).
- **Reordenar tarjetas, rediseño del panel, balances en tarjeta** (decisión 2026-09-29 de 012 intacta).
- **Importación/renaming masivo** desde Excel.
