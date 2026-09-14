# Feature Specification: Edición y Eliminación de Movimientos

**Feature Branch**: `feature/003-edicion-movimientos`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Feature `003-edicion-movimientos` del roadmap maestro (FR-008, refinamiento): editar y eliminar movimientos existentes, de forma que los resúmenes y balances afectados se actualicen automáticamente. Primera parte del split de la feature original `003-gestion-movimientos` (el filtrado/búsqueda pasó a `007-filtrado-busqueda` y la gestión de cuentas/miembros a `008-gestion-cuentas-miembros`)."

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (requisito FR-008 del maestro; edge case "¿Qué ocurre si se edita un movimiento cambiándolo de cuenta o de mes?"). Se apoya en el modelo y las invariantes construidos en `002-registro-movimientos` (validaciones de `Movement`, naturaleza "personal"/"compartido", mínimo una tag por movimiento con "Sin Clasificar" por defecto) y en el principio de vistas derivadas de `005-cierre-mensual` (balance y cierre recalculados a partir de los movimientos, ADR 0009).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editar un movimiento existente (Priority: P1)

Como miembro de la familia, quiero corregir cualquier dato de un movimiento ya registrado —fecha, concepto, descripción, importe, cuenta, tipo, naturaleza y tags— reutilizando el mismo formulario y las mismas validaciones que al registrarlo, para subsanar errores de registro sin borrar y volver a crear el movimiento.

**Why this priority**: Es la fricción más habitual tras el registro (002): un error de importe, tag o cuenta obliga hoy a convivir con el error o recrear el movimiento. La edición reutiliza la validación y el formulario existentes, por lo que entrega valor con riesgo mínimo.

**Independent Test**: Se puede probar editando cada campo de un movimiento (incluidos cuenta, mes y tipo) y verificando que el listado, el balance de cabecera y el cierre mensual (005) reflejan el estado correcto tras el cambio, sin pasos manuales.

**Acceptance Scenarios**:

1. **Given** un gasto de 85,00 € con concepto "Mercadona" y tag Alimentación, **When** edito su importe a 78,50 € y guardo, **Then** el listado muestra 78,50 €, el balance de cabecera de la cuenta y el cierre mensual de 005 se recalculan con el nuevo importe sin pasos manuales.
2. **Given** un movimiento del mes de septiembre, **When** edito su fecha a un día de agosto y guardo, **Then** el movimiento desaparece del listado de septiembre, aparece en el de agosto y computa en el cierre de agosto (y no en el de septiembre).
3. **Given** un movimiento de una cuenta personal, **When** cambio su cuenta a la cuenta común y guardo, **Then** computa en adelante en los listados, balance y cierre de la cuenta común, y deja de computar en los de la cuenta de origen.
4. **Given** un gasto con naturaleza "personal", **When** cambio su tipo a ingreso y guardo, **Then** la edición exige dejar la naturaleza vacía (prohibida en ingresos, invariante de 002) y el movimiento pasa a computar como ingreso en el cierre del mes.
5. **Given** un ingreso, **When** cambio su tipo a gasto y guardo, **Then** la edición exige elegir naturaleza "personal" o "compartido" antes de guardar (invariante de 002).
6. **Given** la edición de un movimiento, **When** intento guardar con importe 0 o negativo, concepto vacío, sin ninguna tag o fecha inválida, **Then** el sistema muestra los mismos mensajes de error que el alta (002) y no guarda los cambios.

### User Story 2 - Eliminar un movimiento (Priority: P2)

Como miembro de la familia, quiero eliminar un movimiento registrado que no debería existir (un duplicado, una prueba), con una confirmación previa que evite borrados accidentales, para mantener el histórico limpio y que los totales vuelvan a ser correctos.

**Why this priority**: Complementa a la edición: cubre el caso en que corregir no tiene sentido (registro duplicado o erróneo sin valor). Depende del mismo recorrido UI sobre el listado, pero es menos frecuente que editar.

**Independent Test**: Se puede probar eliminando un movimiento de un mes con más registros y verificando que desaparece del listado y que balance de cabecera y cierre mensual quedan recalculados sin él.

**Acceptance Scenarios**:

1. **Given** un mes con tres movimientos, **When** elimino uno confirmando la acción, **Then** el listado pasa a mostrar dos, y el balance de cabecera y el cierre mensual se recalculan sin el movimiento eliminado.
2. **Given** el diálogo de confirmación de borrado, **When** cancelo, **Then** no se elimina nada y el listado permanece intacto.
3. **Given** un movimiento con varias tags, **When** lo elimino, **Then** desaparecen sus asociaciones con tags pero el catálogo de tags permanece intacto (las tags siguen existiendo y usándose por otros movimientos).

### Edge Cases

- Editar cambiando cuenta o mes: cubierto por los escenarios 2 y 3 de US1 (computa exclusivamente en la cuenta/mes de su nueva fecha; nada queda "a medias" entre origen y destino).
- Cambio de tipo gasto ↔ ingreso: cubierto por los escenarios 4 y 5 de US1 (las invariantes de naturaleza de 002 se aplican también en edición).
- ¿Eliminación física o lógica? Física: no existe requisito de auditoría ni de papelera (uso individual, YAGNI); las tags asociadas nunca se borran del catálogo.
- ¿Qué pasa si el movimiento ya no existe al guardar la edición o la eliminación (p. ej. borrado en otra pestaña)? El sistema muestra un error claro y no corrompe el estado; no se modelan conflictos de edición concurrente más allá de esto (uso individual).
- Movimiento editado hacia un mes futuro: permitido; se comporta como cualquier registro fechado por adelantado (edge case ya aceptado en 005).
- Aritmética monetaria: los importes se manejan en céntimos enteros sin coma flotante (ADR 0007); una edición de importe nunca introduce desviaciones de redondeo.
- Validaciones de frontera: Zod valida en la Server Action de edición igual que en el alta (constitución IV).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir editar cualquier movimiento existente desde el listado de la pantalla principal, modificando: fecha, concepto, descripción, importe, cuenta, tipo (gasto/ingreso), naturaleza (personal/compartido, en gastos) y tags (una o más).
- **FR-002**: Las validaciones de edición MUST ser idénticas a las del alta (002): importe mayor que cero en céntimos enteros, concepto no vacío tras trim, descripción opcional, fecha de calendario válida, mínimo una tag sin duplicados, naturaleza obligatoria en gastos y prohibida en ingresos.
- **FR-003**: El sistema MUST permitir eliminar físicamente un movimiento existente tras una confirmación explícita y cancelable; la eliminación borra sus asociaciones de tags (movement_tags) pero MUST NOT modificar el catálogo de tags.
- **FR-004**: Balance de cabecera, listados y cierres mensuales (005) MUST reflejar el estado tras cada edición o eliminación sin pasos manuales: son vistas derivadas de los movimientos (ADR 0009, FR-009 de 005), no hay totales persistidos que recalcular.
- **FR-005**: Al editar un movimiento cambiándolo de cuenta y/o de mes, el movimiento MUST computar en adelante exclusivamente en la cuenta y el mes de su nueva fecha, sin residuos en la cuenta/mes de origen.
- **FR-006**: El formulario de edición MUST ser el mismo formulario del alta (002) precargado con los datos del movimiento, en la misma pantalla principal y sin navegación a una ruta nueva; la interacción de apertura (botón por fila, diálogo) se decide en el plan.
- **FR-007**: La UI MUST estar en español, dar feedback de éxito/error tras guardar o eliminar (incluido el caso "movimiento no encontrado"), y revalidar la pantalla para actualizar listado, balance y cierre en la misma visualización.
- **FR-008**: Los datos que crucen la frontera (Server Action de edición y de eliminación) MUST validarse con Zod en tiempo de ejecución (constitución IV), incluyendo el identificador del movimiento.

### Key Entities *(include if feature involves data)*

- **Movimiento**: Entidad existente de 002 que gana capacidad de actualización con sus mismas invariantes; la edición reconstruye el movimiento validado (fecha, concepto, descripción, importe, cuenta, tipo, naturaleza, tags) en lugar de relajar reglas. No se crean entidades nuevas ni se modifican Miembro, Cuenta, Tag o Cierre mensual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras editar cualquier campo de un movimiento, listado, balance de cabecera y cierre mensual muestran valores coherentes al 100% con el nuevo conjunto de movimientos, verificado contra cálculo manual (extensión de SC-002 del maestro).
- **SC-002**: Tras eliminar un movimiento, el total de movimientos del mes/cuenta disminuye en uno y balance y cierre quedan recalculados sin pasos manuales.
- **SC-003**: Una corrección completa de un movimiento se completa en menos de 30 segundos (equivalente a SC-001 del maestro para el registro).
- **SC-004**: Los casos de error de edición (importe 0/negativo, concepto vacío, cero tags, naturaleza inconsistente con el tipo) se rechazan con los mismos mensajes que el alta, sin guardados parciales.

## Assumptions

- Edición y eliminación se disparan desde el listado de la pantalla principal (la misma de 002/005); el patrón de interacción concreto (botones por fila, diálogo de edición, diálogo de confirmación) se decide en el plan.
- Eliminación física, no lógica: no hay requisito de auditoría, papelera ni "deshacer" (YAGNI, principio I de la constitución).
- El flujo crítico editar/eliminar se cubre con e2e de Playwright (constitución III), como ya ocurre con registrar y consultar el cierre.
- Reutilización íntegra del dominio y la aplicación de 002 (`Money`, `Movement`, tipos, repositorios); se prevé añadir casos de uso de actualización/eliminación y su puerto, sin cambios de esquema ni migraciones (UPDATE/DELETE sobre tablas existentes).
- Sin filtrado ni búsqueda de movimientos (`007-filtrado-busqueda`), sin gestión de cuentas y miembros (`008-gestion-cuentas-miembros`), sin gestión del catálogo de tags (`004-gestion-tags`).
- Uso individual sin login (US6 del maestro): no se modelan conflictos de escritura concurrente más allá del error "movimiento no encontrado".
- Moneda única EUR con dos decimales; formato español Intl es-ES reutilizando los helpers de la UI (002).

## Out of Scope

- Filtrado y búsqueda de movimientos por cuenta, tipo, naturaleza, tag o miembro (feature `007-filtrado-busqueda`).
- Gestión de cuentas y miembros: añadir, renombrar (feature `008-gestion-cuentas-miembros`).
- Gestión del catálogo de tags: crear, renombrar, fusionar, desactivar (feature `004-gestion-tags`).
- Resumen global agregado, cuadre mensual y cuenta de resultados anual (feature `006-analisis-agregado`).
- Eliminación lógica, papelera, deshacer o historial de cambios de un movimiento.
- Edición/eliminación masiva (multi-selección) de movimientos.
- Registro de usuarios, login, multiusuario e importación desde Excel.
