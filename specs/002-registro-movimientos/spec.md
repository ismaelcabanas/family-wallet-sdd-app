# Feature Specification: Registro de Movimientos con Tags

**Feature Branch**: `002-registro-movimientos`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "La primera especificación se acota a la User Story 1 del roadmap maestro (registrar gastos e ingresos con tags), que es independiente y acotada; el resto del alcance queda diferido a otras especificaciones hijas."

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (historia US1; requisitos FR-001 parcial —solo preconfiguración—, FR-002, FR-003, FR-004 —con desviación: mínimo 1 tag—, FR-010 y FR-011; entidades base Miembro, Cuenta, Movimiento, Tag).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar gastos e ingresos con tags (Priority: P1)

Como miembro de la familia, quiero registrar un movimiento indicando: fecha, concepto (ej. "Mercadona"), descripción (ej. "Compra semanal"), importe, la cuenta desde la que se realiza, el tipo de movimiento (gasto o ingreso), su naturaleza cuando es gasto (propio o común) y una o varias etiquetas (tags), para sustituir el registro manual en Excel por un registro más rápido y flexible.

**Why this priority**: Es el núcleo del sistema y un slice mínimamente independiente: sin registro de movimientos no existe ningún valor. Es el equivalente digital exacto de lo que hoy se hace en la hoja Excel cada mes.

**Independent Test**: Se puede probar registrando movimientos de cada tipo (gasto propio, gasto común e ingreso) y verificando que quedan guardados con sus campos, sus tags, el balance de la cuenta actualizado y que siguen ahí en una sesión posterior.

**Acceptance Scenarios**:

1. **Given** que estoy en la cuenta común, **When** registro un gasto de 850,00 € con concepto "Hipoteca" y las tags "vivienda" e "hipoteca", **Then** el movimiento aparece en el listado del mes y de la cuenta común con ambas tags visibles.
2. **Given** que registro un gasto desde mi cuenta personal, **When** marco su naturaleza como "común" (por ejemplo, la compra semanal del supermercado), **Then** el gasto queda identificado como gasto común pagado desde cuenta personal.
3. **Given** que registro mi nómina como ingreso en mi cuenta personal, **When** la guardo, **Then** el ingreso se guarda correctamente y actualiza el balance de la cuenta.
4. **Given** que registro un gasto, **When** intento guardarlo sin importe o con un importe no válido (0 o negativo), **Then** el sistema muestra un mensaje de error claro y no guarda el movimiento.

### Edge Cases

- ¿Qué ocurre cuando se registra un gasto con importe 0 o negativo? (Debe rechazarse con mensaje claro; los abonos/devoluciones se registran como ingresos).
- ¿Cómo se maneja un movimiento fechado en un mes distinto al actual? (Debe permitirse; el movimiento computa en el mes de su fecha y aparece en el listado de ese mes).
- ¿Qué ocurre si se intenta guardar un movimiento sin ninguna tag? (Se impide con un mensaje claro; el usuario puede asignar la tag "Sin clasificar" del catálogo precargado).
- ¿Qué naturaleza tiene un gasto registrado en la cuenta común? (Común por defecto, sin opción a marcarla como propia; la elección propio/común aplica a los gastos de cuentas personales).
- ¿Qué tags pueden asignarse al registrar? (Solo las del catálogo precargado; el alta de nuevas tags queda diferida a la feature de gestión del catálogo).
- ¿Qué ocurre si se intentan asignar más de 5 tags a un movimiento? (Se impide con un aviso claro; el límite es 5 tags por movimiento).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST disponer desde la primera ejecución de las 3 cuentas preconfiguradas del núcleo familiar (dos personales y una común), identificadas con nombre y tipo (personal/común), disponibles para asociar movimientos.
- **FR-002**: El sistema MUST permitir registrar movimientos con: fecha, concepto, descripción, importe, cuenta y tipo de movimiento (gasto o ingreso). El importe MUST ser positivo, en euros y con dos decimales; el movimiento computa en el mes de su fecha.
- **FR-003**: El sistema MUST permitir marcar cada gasto con su naturaleza: "propio" o "común". Los gastos de la cuenta común se consideran comunes por defecto; en las cuentas personales el usuario elige la naturaleza. Los ingresos no llevan naturaleza.
- **FR-004**: El sistema MUST exigir que cada movimiento tenga al menos una tag, y permitir asignar hasta un máximo de 5 tags del catálogo precargado. Para movimientos sin una clasificación clara, el catálogo incluye la tag "Sin clasificar".
- **FR-005**: El sistema MUST validar los datos del movimiento antes de guardarlo y, si el importe falta o no es válido, o si el movimiento no tiene ninguna tag, mostrar un mensaje de error claro sin guardar nada.
- **FR-006**: El sistema MUST mostrar el listado de movimientos del mes seleccionado y de la cuenta seleccionada, con fecha, concepto, importe, tipo, naturaleza y tags visibles.
- **FR-007**: El sistema MUST mostrar el balance acumulado de cada cuenta (equivalente a la columna "Balance" del Excel), actualizado con cada movimiento registrado.
- **FR-008**: El sistema MUST permitir su uso individual sin registro de usuario ni inicio de sesión, y todos los datos MUST persistir entre sesiones.

### Key Entities *(include if feature involves data)*

- **Miembro**: Persona de la unidad familiar (inicialmente 2, equivalentes a "Sueldo 1" y "Sueldo 2" del Excel agregado). Atributos: nombre. Relación: posee una cuenta personal.
- **Cuenta**: Agrupación financiera sobre la que se registran movimientos. Atributos: nombre, tipo (personal o común), balance acumulado. Relación: una cuenta personal pertenece a un miembro; la cuenta común es compartida.
- **Movimiento**: Registro unitario equivalente a una fila del Excel mensual. Atributos: tipo (gasto o ingreso), fecha, concepto, descripción, importe, naturaleza (propio/común, solo para gastos), tags (1 a 5). Relación: pertenece a una cuenta y al mes de su fecha; su miembro se deriva de la cuenta.
- **Tag**: Etiqueta de clasificación libre que sustituye a la categoría única actual. Atributos: nombre (único sin distinguir capitalización), estado (activa/desactivada). Relación: puede aplicarse a muchos movimientos; un movimiento debe tener entre 1 y 5 tags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro puede registrar un movimiento completo (importe, concepto, cuenta, tipo, naturaleza y tags) en menos de 30 segundos.
- **SC-002**: Un movimiento guardado aparece en el listado de su mes y cuenta, con sus tags visibles, en menos de 2 segundos.
- **SC-003**: El balance acumulado mostrado de cada cuenta coincide en el 100% de los casos con la suma de ingresos menos gastos de sus movimientos registrados.
- **SC-004**: El 100% de los movimientos y tags persisten entre sesiones sin pérdida de datos.
- **SC-005**: Al menos el 80% de los movimientos registrados llevan una tag distinta de "Sin clasificar" tras el primer mes de uso.

## Assumptions

- La feature usa las cuentas y miembros preconfigurados (2 miembros, 3 cuentas: 2 personales + 1 común); la gestión de cuentas y miembros (añadir, renombrar) queda diferida a la feature de gestión de movimientos.
- El catálogo de tags se precarga a partir de las categorías actuales del Excel (Hogar, Coche, Salud, Alimentación, Ocio, Viaje, Ropa, Regalos, Suscripciones online, Sin Clasificar) y se completa con "vivienda" e "hipoteca" para cubrir los gastos fijos de la casa; la gestión del catálogo (crear, renombrar, fusionar, desactivar) queda diferida a la feature de gestión del catálogo de tags.
- Desviación del roadmap maestro (FR-004 global permite 0 tags): esta feature exige un mínimo de 1 tag por movimiento, con la tag "Sin clasificar" como opción de respaldo (decisión del usuario).
- La edición y eliminación de movimientos queda diferida a la feature de gestión de movimientos; provisionalmente, ante un error de registro, se vuelve a registrar el movimiento correcto.
- Uso individual sin autenticación (decisión del usuario); el multiusuario y la regla de reparto de gastos comunes quedan diferidos.
- Moneda única: euro (EUR) con dos decimales; no se contemplan divisas ni conversiones.
- No se migra el histórico de los Excel: se empieza de cero (decisión del usuario).
- Los movimientos se registran manualmente; no hay integración bancaria en esta versión.
- Las transferencias entre cuentas (aportaciones a la cuenta común) y el seguimiento del ahorro quedan diferidos; provisionalmente, las aportaciones a la cuenta común, si se registran, se anotan como ingresos en dicha cuenta.
- Los ingresos no requieren naturaleza propio/común; se asocian a la cuenta en la que se registran.
- La distinción "Concepto" / "Descripción" del Excel se mantiene como dos campos independientes del movimiento.
- Idioma de la interfaz: español.
- Fuera de alcance de esta feature (features hijas posteriores del roadmap): edición/eliminación y filtrado de movimientos, gestión de cuentas y miembros, gestión del catálogo de tags, cierre mensual por cuenta, resumen global con cuadre, cuenta de resultados anual, transferencias entre cuentas, multiusuario, presupuestos, metas de ahorro, proyecciones e importación de histórico desde Excel.
