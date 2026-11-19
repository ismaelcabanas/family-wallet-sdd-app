# Feature Specification: Etiquetas inactivas visibles en el listado de movimientos

**Feature Branch**: `feature/034-diferenciar-tags-inactivas`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "En la lista de movimientos mensuales, cada movimiento tiene aplicada una tag, pero actualmente no sé si la tag está o no activa, me gustaría poder diferenciarlas de algún modo, con el objetivo final de poder actualizarla en el movimiento a una tag activa y así eliminarlas en el futuro".

**Fuente**: Petición del propietario (2026-11-19). Diagnóstico verificado sobre el código: el chip de etiqueta de cada fila del listado mensual (`/accounts/{id}`) se pinta igual esté o no activa la etiqueta — la fila no conoce su estado. El diálogo de edición solo ofrece etiquetas activas (Select agrupado de 027): un movimiento con etiqueta inactiva abre con el campo «Etiqueta» vacío (placeholder, la inactiva actual es invisible) y, al guardar sin cambiarla, produce el error actual «Una de las etiquetas seleccionadas ya no está disponible.». Las vías de reasignación a etiqueta activa ya existen y funcionan: edición individual (014) y reasignación masiva (029, donde estas filas sí son seleccionables — la exclusión es solo para etiquetas protegidas). La desactivación/reactivación vive en `/tags` (004). El objetivo final del propietario — eliminar las etiquetas inactivas — está cubierto por la feature futura `030-eliminacion-etiquetas`, que exige que la etiqueta no tenga movimientos asociados: esta feature da la visibilidad necesaria para vaciarlas.

**Granularidad** (constitución II): una única user story pequeña con valor propio — ver de un vistazo qué movimientos llevan etiqueta inactiva para reasignarlos a una activa. La coherencia del diálogo de edición (mostrar la inactiva actual en lugar de un vacío) es consecuencia directa de la misma necesidad de información en la superficie donde se resuelve, no una historia independiente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identificar etiquetas inactivas en el listado y reasignarlas a activas (Priority: P1)

Como único usuario de la aplicación, quiero que el listado mensual de movimientos me muestre cuáles llevan una etiqueta desactivada — de un vistazo, sin ir a `/tags` ni abrir diálogos — y que al editar uno de esos movimientos vea su etiqueta inactiva actual, para reasignarlos a etiquetas activas (uno a uno o en lote con 029) y dejar las etiquetas inactivas sin movimientos, listas para poder eliminarlas en el futuro (030).

**Why this priority**: Es la única historia de la feature y su razón de ser: hoy la inactividad es invisible en la página de cuenta (chips idénticos) y el vacío del Select en edición oculta la causa del error, de modo que el propietario no puede ejecutar el mantenimiento que desea (vaciar etiquetas inactivas antes de borrarlas con 030).

**Independent Test**: Se puede probar desactivando en `/tags` una etiqueta usada por movimientos del mes, abriendo la página de la cuenta de ese mes: las filas afectadas muestran el chip diferenciado y las demás quedan como hoy; al editar una de ellas, el campo «Etiqueta» muestra la etiqueta actual marcada como inactiva; al elegir una activa y guardar, el chip vuelve a la apariencia normal; el histórico y los agregados no cambian.

**Acceptance Scenarios**:

1. **Given** un mes consultado con movimientos cuya etiqueta está desactivada, **When** abro la página de la cuenta, **Then** cada fila con etiqueta inactiva muestra su chip con un tratamiento visual claramente distinto (p. ej. desaturado con borde discontinuo) y una marca textual «(inactiva)» accesible para lectores de pantalla, y las filas con etiquetas activas se muestran exactamente como hoy.
2. **Given** una fila con chip de etiqueta inactiva, **When** abro su diálogo de edición, **Then** el campo «Etiqueta» muestra la etiqueta actual marcada como inactiva (p. ej. «{nombre} (inactiva)» como valor actual no elegible), en lugar del valor vacío con placeholder actual.
3. **Given** el diálogo de edición de un movimiento con etiqueta inactiva, **When** elijo una etiqueta activa y guardo, **Then** el movimiento queda con la etiqueta activa (chip normal en el listado, sin marcador) — vía de edición existente, sin cambios de comportamiento.
4. **Given** varios movimientos del mes con la misma etiqueta inactiva, **When** entro en modo selección (029) y los reasigno en lote a una etiqueta activa, **Then** todos pasan a la etiqueta elegida y ningún chip diferenciado permanece; el marcador acompaña al chip también dentro del modo selección.
5. **Given** el diálogo de edición de un movimiento con etiqueta inactiva, **When** guardo sin cambiar la etiqueta, **Then** se mantiene el error actual sobre el campo «Etiqueta» («Una de las etiquetas seleccionadas ya no está disponible.») — la regla de dominio (solo etiquetas activas asignables) no cambia; ahora el usuario ve el motivo en el propio formulario.
6. **Given** cualquier cuenta (personales y común) y cualquier mes consultado (también pasados), **When** hay filas con etiquetas inactivas, **Then** el marcador aparece igual: el histórico conserva sus etiquetas y su estado se muestra tal cual.
7. **Given** cualquier vista agregada (`/summary`, `/annual`, informe anual de gastos), **When** consulto antes y después de la feature, **Then** todos los importes computan exactamente igual: la inactividad es solo presentación, los desgloses siguen incluyendo el histórico de etiquetas inactivas.
8. **Given** las etiquetas protegidas del sistema («Aportación Común», «Ahorro»), **When** se renderizan filas, **Then** nunca llevan marcador de inactiva (no son desactivables por construcción, 004/033).

---

### Edge Cases

- **Movimiento sin etiqueta** (ingreso sin etiqueta): no hay chip, no hay nada que diferenciar.
- **Etiqueta desactivada con el movimiento ya en pantalla**: el estado se lee en cada render de la página de cuenta; tras desactivar en `/tags` y volver a la cuenta, el chip aparece diferenciado (revalidación del layout existente).
- **Modo selección (029)**: los movimientos con etiqueta inactiva siguen siendo seleccionables (la exclusión de checkboxes es solo para protegidas); el marcador no altera la selección ni los recuentos.
- **Destino de la reasignación**: edición y retag masivo siguen ofreciendo solo etiquetas activas como destino (regla actual); reactivar una etiqueta sigue viviendo en `/tags` (004), no en el listado.
- **Etiqueta inactiva compartida por muchos meses**: el marcador aparece en todos los meses consultados; vaciarla puede requerir recorrer mes a mes (el listado solo muestra el mes consultado) — aceptado por el propietario; el filtrado/búsqueda global es la feature futura 007.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (diferenciación en el listado)**: El listado mensual de movimientos de la página de cuenta MUST distinguir las filas cuya etiqueta está desactivada: el chip de la etiqueta inactiva se muestra con un tratamiento visual claramente distinto del chip normal (p. ej. desaturado con borde discontinuo) y MUST incluir una marca textual «(inactiva)» accesible (nombre accesible y título del chip), de modo que la distinción no dependa solo del color. Las etiquetas activas MUST mostrarse exactamente como hoy. La diferenciación MUST aplicar en todas las cuentas, cualquier mes consultado y también con el modo de selección activo (029).
- **FR-002 (coherencia en el diálogo de edición)**: Al editar un movimiento cuya etiqueta está desactivada, el campo «Etiqueta» del formulario MUST mostrar explícitamente la etiqueta actual marcada como inactiva (p. ej. ítem «{nombre} (inactiva)» presentado como valor actual, no ofrecido como destino elegible), en lugar del valor vacío actual. El resto del comportamiento del formulario no cambia: guardar sin cambiar la etiqueta inactiva sigue produciendo el error existente sobre el campo, y la lista de destinos sigue siendo solo etiquetas activas.
- **FR-003 (lectura pura, sin cambios de cálculo)**: El estado activa/inactiva de la etiqueta MUST viajar con la lectura del mes hasta la fila del movimiento (el listado no consulta nada por su cuenta ni recalcula). La feature es lectura pura: sin cambios de escritura, de esquema ni de migraciones. Ningún cálculo MUST verse alterado: importes, KPIs del mes, `/summary`, `/annual` y el informe anual computan exactamente igual (los agregados siguen incluyendo el histórico de etiquetas inactivas, como hoy).
- **FR-004 (vías existentes intactas)**: La reasignación a una etiqueta activa MUST usar exclusivamente las vías existentes — edición individual (014) y reasignación masiva (029) — sin nuevas actions, diálogos ni accesos directos. La activación/desactivación de etiquetas sigue viviendo en `/tags` (004), y la eliminación de etiquetas sin uso queda para `030-eliminacion-etiquetas` (feature futura).
- **FR-005 (cobertura de tests)**: La feature MUST estar cubierta por tests: componente del listado (chip inactivo con tratamiento diferenciado y marca accesible «(inactiva)»; chip activo idéntico a hoy; marcador presente en modo selección), componente del formulario de edición (etiqueta inactiva actual visible y marcada como valor inicial, destinos solo activos, error existente al guardar sin cambiar), y un e2e del recorrido completo (desactivar en `/tags` → chip diferenciado en la cuenta → editar y reasignar a activa → chip normal) en combinación cuenta/mes propia (convención de aislamiento e2e; constitución III).
- **FR-006 (documentación)**: Al completar la feature, el roadmap maestro MUST añadir/marcar la fila `034-diferenciar-tags-inactivas` como Completada; si nace convención de UI (tratamiento de chips con estado), se registra en AGENTS.md.

### Key Entities

Sin entidades nuevas ni cambios de esquema; cambia lo que se expone de las existentes:

- **Etiqueta**: su estado activa/inactiva (existente desde 004, hoy visible solo en `/tags`) pasa a ser visible también en el listado de movimientos y en el formulario de edición — como presentación, sin tocar las reglas (protección, desactivación, fusión).
- **Movimiento (fila del listado)**: la lectura del mes pasa a conocer el estado de la etiqueta de cada fila en el momento del render; el movimiento en sí no cambia (histórico intacto, la inactividad no se persiste en él).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con una sola inspección del listado del mes (sin abrir diálogos ni salir de la página de cuenta), el 100 % de las filas con etiqueta inactiva muestra el marcador y el 0 % de las filas con etiqueta activa lo muestra.
- **SC-002**: El recorrido completo «detectar → reasignar» (abrir la edición de una fila marcada, elegir etiqueta activa, guardar) se completa en menos de 30 segundos y sin errores, y el chip queda sin marcador.
- **SC-003**: Cero cambios de cálculo: importes, KPIs del mes y agregados (`/summary`, `/annual`, informe anual) producen los mismos valores antes y después de la feature.
- **SC-004**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde tras la feature.

## Assumptions

- Tratamiento visual por defecto elegido como conjetura informada: chip desaturado con borde discontinuo + sufijo «(inactiva)» en el nombre accesible y el título; la decisión de estilo final se confirma en el plan (el propietario pidió «diferenciarlas de algún modo»).
- La marca «(inactiva)» en edición es presentación del valor actual: no convierte a la etiqueta inactiva en destino elegible del Select ni relaja la regla de dominio (`InactiveTagError` en escritura).
- El DTO de la etiqueta de las filas está congelado por 027 (FR-006 de aquella): la vía para hacer llegar el estado hasta la fila (amend del DTO frente a composición en lectura, al estilo de 015 con el mapa de categorías) se decide y justifica en el plan.
- El listado solo muestra el mes consultado: vaciar una etiqueta inactiva usada en varios meses requiere recorrerlos con el stepper ‹ mes/año › (aceptado; la búsqueda global es 007).
- Las etiquetas protegidas no pueden desactivarse (004/033): el marcador es imposible para ellas por construcción.
- Un solo usuario sin concurrencia real; el estado leído por render es suficiente (no hay escritura que proteger).

## Out of Scope

- **Eliminación de etiquetas** (`030-eliminacion-etiquetas`, feature futura): esta feature la habilita (vaciar etiquetas inactivas) pero no la implementa.
- **Reactivación de etiquetas** desde el listado o la edición (ya existe «Reactivar» en `/tags`, 004).
- **Mejoras del modo de selección/acciones masivas** (`031-ui-acciones-masivas`, feature futura).
- **Marcado de inactivas en vistas agregadas** (`/summary`, `/annual`, informe anual): el estado no computa y no se muestra ahí.
- **Cambios en el importador (028)** ni en el flujo de alta: en el alta solo se asignan etiquetas activas (regla actual), no hay inactivas que mostrar.
- **Filtrado por estado de etiqueta o búsqueda global** (007, feature futura).
