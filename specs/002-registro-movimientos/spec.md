# Feature Specification: Registro de Movimientos con Tags

**Feature Branch**: `002-registro-movimientos`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "Feature `002-registro-movimientos` del roadmap maestro (US1, prioridad P1): registrar gastos e ingresos con tags. Incluye el modelo de datos base (Miembro, Cuenta, Movimiento, Tag), el scaffolding de la aplicación y la precarga de 3 cuentas (2 personales + 1 común) y del catálogo inicial de tags. Restricción US6: usuario único, sin login."

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (historia US1; requisitos FR-001 parcial —solo preconfiguración—, FR-002, FR-003, FR-004 —ahora alineado: 0 o más tags—, FR-010 y FR-011; entidades base Miembro, Cuenta, Movimiento, Tag).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar gastos e ingresos con tags (Priority: P1)

Como miembro de la familia, quiero registrar un movimiento indicando: fecha, concepto (ej. "Mercadona"), descripción (ej. "Compra semanal"), importe, la cuenta desde la que se realiza, el tipo de movimiento (gasto o ingreso), su naturaleza cuando es un gasto (personal o compartido) y una o varias etiquetas (tags), para sustituir el registro manual en Excel por un registro más rápido y más flexible.

**Why this priority**: Es el núcleo del sistema y un slice mínimamente independiente: sin registro de movimientos no existe ningún valor. Es el equivalente digital exacto de lo que hoy se hace en la hoja Excel cada mes.

**Independent Test**: Se puede probar registrando movimientos de cada tipo (gasto personal, gasto compartido —incluido uno compartido pagado desde cuenta personal—, gasto sin tags e ingreso) y verificando que quedan guardados con sus campos, sus tags, el balance de la cuenta actualizado, que aparecen en el listado del mes y cuenta correspondientes y que siguen ahí en una sesión posterior.

**Acceptance Scenarios**:

1. **Given** que estoy en la cuenta común, **When** registro un gasto de 850,00 € con concepto "Hipoteca" y las tags "vivienda" e "hipoteca", **Then** el movimiento aparece en el listado de ese mes y de la cuenta común con ambas tags visibles.
2. **Given** que registro un gasto desde mi cuenta personal, **When** marco su naturaleza como "compartido" (por ejemplo, la compra semanal del supermercado), **Then** el gasto queda identificado como gasto compartido pagado desde cuenta personal y computa en los totales de gastos compartidos.
3. **Given** que registro mi nómina como ingreso en mi cuenta personal, **When** la guardo, **Then** el ingreso se guarda correctamente y el balance acumulado de la cuenta queda actualizado.
4. **Given** que intento guardar un movimiento sin importe, con un importe no válido o con un importe de cero o menos, **When** envío el formulario, **Then** el sistema muestra un mensaje de error claro junto al campo de importe y no guarda el movimiento.
5. **Given** que envío el formulario de registro con uno o más campos obligatorios vacíos, **When** se procesa la solicitud, **Then** el registro se rechaza, cada campo ausente muestra su mensaje de error de validación correspondiente y los valores introducidos previamente permanecen en el formulario.
6. **Given** que registro un movimiento fechado en un mes distinto al actual, **When** lo guardo, **Then** el movimiento se almacena y computa en el mes de su fecha.
7. **Given** que registro un movimiento sin seleccionar ninguna tag, **When** lo guardo, **Then** el movimiento se almacena y se muestra agrupado como "Sin clasificar".

### Edge Cases

- ¿Qué ocurre cuando se registra un gasto con importe 0, negativo o no numérico? (Se rechaza con un mensaje claro junto al campo de importe; los abonos y devoluciones se registran como ingresos).
- ¿Cómo se maneja un movimiento fechado en un mes distinto al actual? (Se permite; el movimiento computa en el mes de su fecha y aparece en el listado de ese mes).
- ¿Qué ocurre si se guarda un movimiento sin ninguna tag? (Se permite; el movimiento queda agrupado como "Sin clasificar").
- ¿Qué naturaleza tiene un gasto registrado en la cuenta común? ("Compartido" por defecto; la elección personal/compartido aplica solo a los gastos de cuentas personales).
- ¿Llevan naturaleza los ingresos? (No; la naturaleza personal/compartido existe únicamente para gastos).
- ¿Qué tags pueden asignarse al registrar? (Solo las del catálogo precargado; el alta de nuevas tags queda diferida a la feature de gestión del catálogo).
- ¿Qué ocurre si el catálogo contiene dos nombres de tag que solo difieren en capitalización ("Luz" vs "luz")? (Se consideran duplicados: los nombres de tag son únicos ignorando mayúsculas/minúsculas).
- ¿Qué ocurre si el registro falla por validación? (Nada se guarda; los valores introducidos permanecen en el formulario y cada campo con error muestra su mensaje junto al campo).

## Clarifications

### Session 2026-09-02

- Q: ¿Cómo accede el usuario al formulario de registro de movimientos desde la pantalla principal? → A: Formulario siempre visible en la pantalla principal, junto al listado del mes/cuenta.
- Q: ¿Qué ocurre en la interfaz justo después de guardar un movimiento con éxito? → A: Mensaje de confirmación (toast) y formulario vaciado listo para el siguiente registro, permaneciendo en la misma pantalla.
- Q: ¿Qué valores por defecto debe tener el formulario al abrirse? → A: Fecha = hoy y naturaleza "personal" preseleccionada en gastos de cuentas personales. Además, la naturaleza pasa a denominarse "personal"/"compartido" (antes "propio"/"común" en el roadmap maestro).
- Q: ¿Cómo selecciona el usuario el mes y la cuenta, y cuál es la vista por defecto? → A: La cuenta es el parámetro primario (se elige primero) y el mes el secundario; ambos con selector visible. Al abrir: mes actual; la cuenta activa queda como contexto y precarga el formulario de registro.
- Q: ¿Qué se muestra en el listado cuando el mes/cuenta seleccionados no tienen movimientos? → A: Un estado vacío informativo ("Aún no hay movimientos en este mes") que invita a registrar el primer movimiento.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST disponer desde la primera ejecución de los 2 miembros y las 3 cuentas preconfiguradas del núcleo familiar (dos cuentas personales, una por miembro, y una cuenta común), identificadas con nombre y tipo (personal/común), disponibles para asociar movimientos.
- **FR-002**: El sistema MUST permitir registrar movimientos con: fecha, concepto, descripción (opcional), importe, cuenta y tipo de movimiento (gasto o ingreso). Fecha, concepto, importe, cuenta y tipo son obligatorios.
- **FR-003**: El sistema MUST exigir un importe mayor que cero, en euros y con dos decimales, y MUST realizar los cálculos monetarios con aritmética exacta (sin errores de redondeo). Los abonos y devoluciones se registran como ingresos.
- **FR-004**: El sistema MUST permitir fechar un movimiento en un mes distinto al actual; el movimiento computa en el mes de su fecha.
- **FR-005**: El sistema MUST exigir que cada gasto tenga una naturaleza: "personal" o "compartido". Los gastos de la cuenta común se consideran "compartido" por defecto; en las cuentas personales el usuario elige la naturaleza (preseleccionada como "personal"). Los ingresos no llevan naturaleza.
- **FR-006**: El sistema MUST permitir asignar a un movimiento 0 o más tags del catálogo precargado. Los movimientos sin tags se agrupan como "Sin clasificar".
- **FR-007**: El sistema MUST garantizar que los nombres de tag del catálogo son únicos ignorando mayúsculas/minúsculas ("Luz" y "luz" son duplicados).
- **FR-008**: El sistema MUST mostrar el balance acumulado de cada cuenta, actualizado con cada movimiento registrado (los ingresos suman y los gastos restan).
- **FR-009**: El sistema MUST mostrar el listado de movimientos del mes seleccionado y de la cuenta seleccionada, con fecha, concepto, importe, tipo, naturaleza y tags visibles.
- **FR-010**: El sistema MUST permitir su uso individual sin registro de usuario ni inicio de sesión; el usuario único registra movimientos en nombre de cualquier miembro (atribución por miembro disponible desde el día uno).
- **FR-011**: El sistema MUST validar los datos del movimiento en sus fronteras antes de guardarlo y, si falta un campo obligatorio o algún dato es inválido, mostrar el error junto al campo correspondiente sin guardar nada, conservando los valores introducidos en el formulario.
- **FR-012**: La interfaz del sistema MUST estar en español.
- **FR-013**: El sistema MUST persistir todos los datos (miembros, cuentas, movimientos, tags y balances) entre sesiones.
- **FR-014**: El formulario de registro MUST estar siempre visible en la pantalla principal, junto al listado de movimientos del mes/cuenta, sin navegación adicional ni diálogos intermedios.
- **FR-015**: Tras guardar un movimiento con éxito, el sistema MUST mostrar un mensaje de confirmación (toast), vaciar el formulario para dejarlo listo para el siguiente registro y permanecer en la misma pantalla, con el listado y el balance actualizados.
- **FR-016**: El formulario MUST precargar la fecha con el día actual y preseleccionar la naturaleza "personal" en los gastos de cuentas personales; el usuario puede modificar ambos valores.
- **FR-017**: La pantalla principal MUST disponer de un selector de cuenta (parámetro primario, elegido primero) y un selector de mes (parámetro secundario), visibles y vinculados al listado (FR-009) y al formulario. Al abrir la aplicación el mes seleccionado MUST ser el actual; la cuenta activa queda como contexto de trabajo y el formulario MUST precargarla como cuenta del movimiento.
- **FR-018**: Cuando el mes/cuenta seleccionados no tienen movimientos, el listado MUST mostrar un estado vacío informativo en español ("Aún no hay movimientos en este mes") que invite a registrar el primer movimiento.

### Key Entities *(include if feature involves data)*

- **Miembro**: Persona de la unidad familiar (inicialmente 2). Atributos: nombre. Relación: posee una cuenta personal.
- **Cuenta**: Agrupación financiera sobre la que se registran movimientos. Atributos: nombre, tipo (personal o común), balance acumulado. Relación: una cuenta personal pertenece a un miembro; la cuenta común es compartida y no pertenece a un miembro concreto.
- **Movimiento**: Registro unitario equivalente a una fila del Excel mensual. Atributos: tipo (gasto o ingreso), fecha, concepto, descripción (opcional), importe, naturaleza (personal/compartido, solo para gastos), tags (0 o más). Relación: pertenece a una cuenta y computa en el mes de su fecha; su miembro se deriva de la cuenta en las cuentas personales.
- **Tag**: Etiqueta de clasificación que sustituye a la categoría única actual. Atributos: nombre (único sin distinguir capitalización), estado (activa/desactivada). Relación: puede aplicarse a muchos movimientos; un movimiento puede llevar 0 o más tags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro puede registrar un movimiento completo (importe, concepto, cuenta, tipo, naturaleza y tags) en menos de 30 segundos.
- **SC-002**: Un movimiento guardado aparece en el listado de su mes y cuenta, con sus tags visibles, en menos de 2 segundos.
- **SC-003**: El balance acumulado mostrado de cada cuenta coincide en el 100% de los casos con la suma de ingresos menos gastos de sus movimientos registrados.
- **SC-004**: El 100% de los movimientos y tags persisten entre sesiones sin pérdida de datos.
- **SC-005**: El 100% de los envíos del formulario con campos obligatorios ausentes o datos inválidos se rechazan mostrando el error junto al campo correspondiente y conservando los valores introducidos.

## Assumptions

- Esta feature entrega también el scaffolding inicial de la aplicación (primer código del repositorio: proyecto, estructura de capas y pipeline de calidad); hasta ahora no existe `package.json` ni código fuente.
- Catálogo de tags precargado: Hogar, Coche, Salud, Alimentación, Ocio, Viaje, Ropa, Regalos, Suscripciones online y Sin Clasificar, ampliado con "Vivienda" e "Hipoteca" para dar soporte al Escenario 1 (hipoteca de la casa); la gestión del catálogo (crear, renombrar, fusionar, desactivar) queda diferida a la feature de gestión del catálogo de tags. Todas las tags del catálogo están activas en esta feature.
- El número de tags por movimiento es "0 o más" (alineado con FR-004 del roadmap maestro): se elimina el mínimo de 1 tag y el máximo de 5 fijados en el borrador anterior (v3). No se impone límite superior más allá del propio catálogo.
- Atribución de miembro: cada cuenta personal pertenece a un miembro, por lo que el usuario único atribuye el movimiento a un miembro al elegir la cuenta; la cuenta común no atribuye a un miembro concreto.
- El mecanismo concreto de validación en fronteras y de aritmética monetaria exacta (sin coma flotante directa) está fijado por la constitución del proyecto y se concreta en el plan; esta spec recoge el comportamiento observable (errores por campo, valores conservados, ausencia de errores de redondeo).
- La edición y eliminación de movimientos queda diferida a la feature de gestión de movimientos; provisionalmente, ante un error de registro, se vuelve a registrar el movimiento correcto.
- La gestión de cuentas y miembros (añadir, renombrar) queda diferida; se usan los miembros y cuentas preconfigurados.
- Moneda única: euro (EUR) con dos decimales; no se contemplan divisas ni conversiones.
- No se migra el histórico de los Excel: se empieza de cero (decisión del usuario).
- Los movimientos se registran manualmente; no hay integración bancaria en esta versión.
- Las transferencias entre cuentas (aportaciones a la cuenta común) y el seguimiento del ahorro quedan diferidos; provisionalmente, las aportaciones a la cuenta común, si se registran, se anotan como ingresos en dicha cuenta.
- Los ingresos no requieren naturaleza personal/compartido; se asocian a la cuenta en la que se registran.
- La distinción "Concepto" / "Descripción" del Excel se mantiene como dos campos independientes del movimiento.
- Idioma de la interfaz: español; identificadores de código en inglés (términos de dominio intraducibles documentados en el glosario del data-model).

## Out of Scope

- Edición y eliminación de movimientos (feature 003).
- Filtrado y búsqueda de movimientos (feature 003).
- Gestión de cuentas y miembros: añadir, renombrar (feature 003).
- Gestión del catálogo de tags: crear, renombrar, fusionar, desactivar (feature 004; aquí solo se usa el catálogo precargado).
- Cierre mensual con KPIs por cuenta (feature 005).
- Resumen mensual global, comprobación de cuadre y cuenta de resultados anual (feature 006).
- Registro de usuarios, inicio de sesión, acceso multiusuario y reglas de reparto de gastos compartidos.
- Transferencias entre cuentas y seguimiento del ahorro.
- Importación del histórico desde Excel.
- Presupuestos, metas de ahorro, proyecciones.
- Integración bancaria o importación automática de extractos.
