# Feature Specification: Gestión de cuentas y miembros

**Feature Branch**: `feature/008-gestion-cuentas-miembros`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "008-gestion-cuentas-miembros"

**Fuente**: Fila del roadmap maestro (`specs/001-family-wallet/spec.md`, reservada en el split del 2026-09-14): *«Gestión de cuentas y miembros: añadir y renombrar» (refinamiento de FR-001)*. Hoy el catálogo de miembros y cuentas nace del seed con nombres de plataforma («Miembro A», «Miembro B», «Cuenta de Miembro A/B», «Cuenta común») y no existe ninguna vía de gestión: la asunción del maestro («la unidad familiar inicial son 2 miembros y 3 cuentas, pero el sistema debe permitir añadir más miembros y cuentas sin rediseño») sigue sin cubrirse en la interfaz. **Alcance reducido (2026-10-29)**: por decisión del propietario, esta feature entrega solo la mitad «renombrar» de la fila; las altas de miembros y cuentas se aplazan a una feature futura (ver Clarifications).

**Contexto relevante (features completadas)**:

- `012-panel-cuentas`: `/` es el panel con tarjetas lanzadera por cuenta (nombre + etiqueta de tipo, sin datos financieros).
- `020-menu-configuracion-cuenta`: el menú ⋮ de la tarjeta de cuenta personal es el **hogar de las opciones de cuenta** (hoy: ingreso regular, aportación, ahorro); la cuenta común no ofrece menú porque no tiene opciones aplicables.
- Las vistas derivadas (listado por cuenta, cierre mensual, resumen global, cuenta de resultados anual, desgloses por miembro) leen siempre los datos vigentes: renombrar no requiere recálculo ni migración, solo reflejar el nuevo nombre en la siguiente lectura.
- La atribución de miembro vive en la cuenta (`cuenta personal → miembro`), no en cada movimiento: renombrar un miembro no toca los movimientos.
- Las configuraciones por cuenta (ingreso regular 018, aportación 019, ahorro 023) y los KPIs de la página de cuenta (022/023) dependen del identificador de cuenta, no de su nombre: el renombrado no las afecta.
- Hoy `accounts.name` (`text NOT NULL UNIQUE`) almacena el nombre de todas las cuentas, personales y comunes; nada se deriva. Esta feature cambia ese modelo para las personales (ver FR-004).

**Granularidad** (constitución II): la fila original agrupaba dos operaciones (añadir, renombrar) sobre dos entidades hermanas (miembro, cuenta) que comparten una única superficie de gestión y recorrido UI — la excepción que decidió y justificó el propietario al reservar la fila en el split del 2026-09-14. Revisada el 2026-10-29: con las altas aplazadas, la feature comprende una única US pequeña (renombrado de miembros y de la cuenta común) con valor propio.

## Clarifications

### Session 2026-10-29

- Q: Además del renombrado, ¿qué altas (de miembros o cuentas) debe ofrecer la feature? → A: Ninguna: solo renombrados. US2 (alta de miembro con cuenta personal) y US3 (alta de cuentas) se aplazan a una feature futura por decisión del propietario.
- Q: Cuando se renombra un miembro, ¿qué ocurre con el nombre de su cuenta personal? → A: La cuenta personal no tiene nombre independiente: su nombre mostrado se deduce siempre como «Cuenta de {miembro}», de modo que renombrar el miembro cambia el nombre de su cuenta por construcción. El renombrado de cuenta editable queda solo para la cuenta común.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Poner nombres reales a miembros y a la cuenta común (Priority: P1)

Como propietario, quiero renombrar los miembros —con lo que el nombre mostrado de su cuenta personal («Cuenta de {miembro}») se actualiza por construcción— y renombrar la cuenta común, para que toda la interfaz —panel, páginas de cuenta, cierres, resumen global y cuenta de resultados anual— muestre los nombres reales de mi familia y de nuestras cuentas sin perder un solo dato histórico.

**Why this priority**: Es la necesidad real que motivó la feature: el seed deja «Miembro A/B» y hoy la única vía de cambio es editar la base de datos a mano. Es además el cambio de menor riesgo: no altera ni crea datos, solo etiquetas.

**Independent Test**: Se puede probar renombrando un miembro y la cuenta común desde el panel y verificando que el panel, las páginas de cuenta y los agregados (resumen global, anual) muestran los nuevos nombres, con balances, cierres y desgloses numéricamente idénticos.

**Acceptance Scenarios**:

1. **Given** el panel de cuentas con la tarjeta «Cuenta de Miembro A», **When** renombro el miembro «Miembro A» a «Isma», **Then** la tarjeta y toda vista de esa cuenta (página de cuenta, cierres, listados) muestran el nombre derivado «Cuenta de Isma», y el balance acumulado y los movimientos históricos permanecen intactos.
2. **Given** un miembro llamado «Miembro B», **When** lo renombro a «Sole», **Then** los desgloses por miembro (resumen global, ingresos por miembro del anual) muestran «Sole» — y su tarjeta «Cuenta de Sole» — con los mismos importes, sin duplicar filas ni perder histórico.
3. **Given** la cuenta común, **When** la renombro (p. ej. «Cuenta conjunta»), **Then** el panel y sus vistas reflejan el nuevo nombre.
4. **Given** el formulario de renombrado, **When** dejo el nombre vacío o solo espacios, **Then** el sistema muestra un error claro, no guarda y conserva lo tecleado.
5. **Given** un miembro llamado «Isma», **When** intento renombrar otro miembro a «ISMA», **Then** el sistema lo impide por duplicado (ignorando mayúsculas) con un mensaje claro; la misma regla aplica al nombre almacenado de la cuenta común.
6. **Given** una cuenta personal con ingreso regular, aportación o ahorro configurados, **When** renombro su miembro (o la cuenta común), **Then** las configuraciones siguen activas y con sus valores (el renombrado no toca type, atribución, movimientos, tags ni balances).

---

### Edge Cases

- **Nombre vacío o solo espacios**: error claro, sin guardado, valor conservado en el formulario (patrón de inputs controlados del repo).
- **Duplicados ignorando mayúsculas**: «Isma» vs «ISMA» bloqueados con mensaje claro entre miembros; el nombre almacenado de la cuenta común sigue la misma regla (paridad con la regla de tags del maestro).
- **Nombre de cuenta personal derivado**: las cuentas personales no tienen nombre editable; muestran siempre «Cuenta de {miembro}» con el nombre vigente del miembro. Renombrar el miembro cambia la tarjeta y todas las vistas en la siguiente lectura, sin escritura sobre la cuenta.
- **Colisión visual del derivado**: una cuenta común renombrada a «Cuenta de Isma» puede coincidir con el derivado del miembro «Isma»; no hay conflicto de datos (las vistas usan ids, no nombres) y la coincidencia visual se acepta.
- **Renombrar con histórico**: todos los agregados muestran el nuevo nombre con importes idénticos; nada se duplica ni se pierde (las vistas son derivadas).
- **Renombrar el miembro de una cuenta con configs activas** (018/019/023): configs intactas y operativas.
- **Nombre con espacios extremos**: se recorta (trim) antes de validar y guardar, como en el resto del dominio.
- **Renombrado desde el panel no navega**: la acción de renombrar no debe disparar la navegación de la tarjeta (misma salvaguarda del ⋮ de 020).
- **Revalidación**: tras un renombrado, el panel refleja el cambio sin recarga manual.
- **Aislamiento e2e**: la spec e2e nueva opera sobre su propia combinación cuenta/mes sin colisionar con las existentes (convención del repo).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (renombrar miembro)**: El sistema MUST permitir renombrar un miembro existente desde la superficie de gestión del panel de cuentas: nombre obligatorio (recortado), único entre miembros ignorando mayúsculas, con mensajes de error claros. El renombrado MUST propagarse a todas las vistas que muestran el miembro o su cuenta personal (panel, desgloses por miembro del resumen global y del anual) **sin alterar** movimientos, atribuciones, configuraciones ni importes.
- **FR-002 (renombrar cuenta común)**: El sistema MUST permitir renombrar la cuenta común: nombre obligatorio (recortado), único ignorando mayúsculas entre nombres almacenados de cuentas, con mensajes de error claros. El renombrado MUST reflejarse en panel, página de cuenta y listados, conservando type, movimientos, tags y balances exactos. La tarjeta de la cuenta común MUST ganar acceso a esta operación (hoy su tarjeta no ofrece menú). Las cuentas personales NO son renombrables de forma independiente: su nombre mostrado es siempre el derivado de FR-004.
- **FR-003 (superficie de gestión única)**: Las operaciones de la feature (renombrado de miembro y de cuenta común) MUST vivir en el panel de cuentas (`/`), extendiendo el patrón del menú ⋮ de 020. La ubicación exacta de cada operación, diálogos y literales se congela en el ui-contract del plan.
- **FR-004 (nombre de cuenta personal derivado)**: El nombre mostrado de una cuenta personal MUST deducirse siempre como «Cuenta de {nombre del miembro}»: renombrar un miembro cambia automáticamente el nombre mostrado de su cuenta en todas las vistas, sin operación ni escritura adicional sobre la cuenta. No existe renombrado independiente de cuenta personal.
- **FR-005 (sin borrado ni altas)**: La feature MUST no incluir borrado ni desactivación de miembros/cuentas, ni altas de miembros o cuentas (aplazadas a una feature futura), ni cambio de tipo o de miembro atribuido de una cuenta: solo renombrados (límite explícito, reforzado por la decisión de alcance del 2026-10-29).
- **FR-006 (validación consistente y usable)**: Todos los formularios de la feature MUST validar en frontera (mensajes claros en español), conservar el valor tecleado ante errores y ser operables por teclado; los diálogos siguen los patrones del repo (inputs controlados, `role="alert"`, diálogos montados a nivel del listado/panel, no por fila desmontable).
- **FR-007 (cobertura de tests)**: La feature MUST estar cubierta por tests de dominio/aplicación (reglas de validación y derivación del nombre), de componente, de action y por una spec e2e nueva (flujo crítico: renombrado de miembro con propagación del derivado a panel/vistas, y renombrado de la cuenta común), respetando el aislamiento cuenta/mes de las e2e existentes (constitución III).
- **FR-008 (roadmap maestro)**: Al completar la feature, el roadmap maestro MUST registrar la fila 008 como Completada en su mitad «renombrar» y dejar constancia de que la mitad «añadir» queda aplazada a una feature futura (decisión del propietario, 2026-10-29).

### Key Entities

- **Miembro (existente, ampliado en su gestión)**: Persona de la unidad familiar con nombre único. Gana operación de renombrado; sin cambios de estructura. Sigue siendo la base de los desgloses por miembro (resumen global, anual) y, desde ahora, de la derivación del nombre de su cuenta personal.
- **Cuenta (existente, ampliado en su gestión)**: Agrupación con tipo (personal/común) y atribución a miembro (solo personales). Las personales no tienen nombre editable: muestran siempre el derivado «Cuenta de {miembro}» (FR-004); la común conserva nombre único editable (FR-002). Tipo y atribución son inmutables (FR-005). La tarjeta de la cuenta común pasa a ofrecer menú con su renombrado.
- **No se introducen entidades nuevas**: las vistas derivadas (cierre, resumen, anual) consumen los nombres vigentes (almacenado o derivado según el tipo) sin cambios.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Renombrar un miembro o la cuenta común toma menos de 30 segundos desde el panel y el nuevo nombre es visible en panel y vistas derivadas sin recarga manual.
- **SC-002**: Tras cualquier renombrado, el 100% de los datos históricos permanece: balances acumulados, cierres, resúmenes y desgloses numéricamente idénticos (solo cambian etiquetas).
- **SC-003**: Todas las suites (dominio, aplicación, componentes, actions, e2e existentes y la nueva) quedan en verde.

## Assumptions

- **Superficie**: la gestión vive en el panel `/` (FR-003); la cuenta común gana menú ⋮ solo con «Renombrar cuenta». El detalle visual se congela en el plan.
- **Validación de nombres**: obligatorio, recorte de espacios, unicidad case-insensitive: miembros entre sí; nombre almacenado de la cuenta común entre cuentas. Paridad con la regla de duplicados de tags (edge case del maestro).
- **Nombre de cuenta personal derivado**: hoy `accounts.name` almacena el nombre de todas las cuentas (`NOT NULL UNIQUE`); esta feature pasa a mostrar el derivado «Cuenta de {miembro}» para las personales. La estrategia de esquema/lectura (columna nullable solo para comunes, derivación en lectura, etc.) se decide en el plan.
- **El seed no cambia**: sigue sembrando «Miembro A/B» y las 3 cuentas; la primera personalización la hace el usuario con esta feature (renombrar tras instalar).
- **Sin límite duro de miembros/cuentas** más allá de las validaciones; no se implementan confirmaciones destructivas porque no hay operaciones destructivas.
- **Configs y KPIs intactos**: las features 018/019/021/022/023 operan sin cambios; la materialización perezosa no se altera.
- **Atribución de miembro**: vive en la cuenta (no en movimientos), así que renombrar un miembro no requiere tocar movimientos; los desgloses derivan siempre del nombre vigente.
- **Dependencias**: da por construidos 012 (panel), 020 (menú ⋮) y los agregados 005/006/009; no depende de features futuras (007, 010, 015).

## Out of Scope

- **Altas de miembros y cuentas** (mitad «añadir» de la fila del maestro): aplazadas a una feature futura por decisión del propietario (2026-10-29); la asunción del maestro («añadir más miembros y cuentas sin rediseño») queda cubierta por esa feature.
- **Renombrado independiente de cuentas personales**: el nombre de una cuenta personal es siempre el derivado «Cuenta de {miembro}» (FR-004); no se ofrece edición directa.
- **Borrado, desactivación o archivado** de miembros y cuentas (límite de la fila del roadmap; el histórico siempre se conserva).
- **Cambio de tipo de cuenta o de miembro atribuido**.
- **Transferencias entre cuentas**, multiusuario con credenciales y regla de reparto (alcance diferido del maestro).
- **Reordenar tarjetas, rediseño del panel, balances en tarjeta** (decisión 2026-09-29 de 012 intacta).
- **Importación/renaming masivo** desde Excel.
