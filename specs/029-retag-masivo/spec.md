# Feature Specification: Reasignación masiva de etiquetas de movimientos

**Feature Branch**: `feature/029-retag-masivo`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "me veo en la necesidad de cambiar las etiquetas de ciertos gastos de manera masiva". Acotado con el propietario (2026-11-07): **vía manual primero** («modo estándar»); un futuro **modo IA** (chat con LLM sobre los datos de la app, proveedor ZAI) reutilizará el mismo caso de uso como adaptador de entrada adicional — queda anotado en el roadmap maestro como feature futura y explícitamente fuera de alcance aquí.

**Fuente**: Petición del propietario (2026-11-07). Complementa, sin solaparse, la gestión del catálogo de 004: la **fusión** de 004 es una operación de catálogo (la absorbida desaparece y **todos** sus movimientos pasan a la resultante, sin distinción de mes ni cuenta); esta feature es una operación **sobre movimientos**: el usuario elige un conjunto concreto de movimientos (los de una cuenta y un mes visibles) y les cambia la etiqueta **sin tocar el catálogo** (ambas etiquetas siguen existiendo). La «eliminación de una etiqueta en concreto» mencionada por el propietario ya está cubierta por 004 (desactivar con histórico conservado, fusionar).

**Granularidad** (constitución II): una única user story pequeña con valor propio — cambiar la etiqueta de varios movimientos a la vez desde donde ya se consultan. No aplica excepción de agrupación.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cambiar la etiqueta de varios movimientos a la vez (Priority: P1)

Como único usuario de la aplicación, quiero, desde la página de una cuenta en un mes concreto, seleccionar varios movimientos del listado y cambiarles la etiqueta a todos de una sola vez, para reorganizar mi clasificación (p. ej. tras importar un mes desde Excel o al refactorizar cómo etiqueto) sin editar movimiento a movimiento con el formulario de edición (003).

**Why this priority**: Es la única historia de la feature y su razón de ser: hoy la única vía de reasignar una etiqueta es la edición individual (003), inviable para decenas de movimientos (un mes importado de 028 puede traer 50–100 filas).

**Independent Test**: Se puede probar entrando en una cuenta y mes con varios movimientos que compartan etiqueta, activando la selección, marcando un subconjunto, eligiendo la etiqueta destino en el diálogo, confirmando y verificando que el listado y los desgloses (etiqueta del mes, resumen global, cuenta de resultados, informe anual por categorías) muestran la nueva etiqueta solo en los movimientos reasignados y que ningún importe ha cambiado.

**Acceptance Scenarios**:

1. **Given** una cuenta y mes con varios movimientos, **When** activo la selección, marco N movimientos, elijo una etiqueta destino activa y confirmo, **Then** exactamente esos N movimientos muestran la etiqueta destino en el listado agrupado, el resto queda intacto, y la operación termina con un mensaje del recuento («N movimientos actualizados»).
2. **Given** el diálogo de reasignación abierto con movimientos seleccionados, **When** lo reviso, **Then** veo el número de movimientos afectados y la etiqueta destino antes de poder confirmar; la confirmación es explícita (FR-002).
3. **Given** una selección vacía (ningún movimiento marcado), **When** intento abrir la reasignación, **Then** la acción no está disponible (control deshabilitado u oculto).
4. **Given** movimientos con la etiqueta protegida «Aportación Común» (019/021), **When** activo la selección, **Then** no son seleccionables (excluidos por protección, Edge Cases); y la etiqueta protegida jamás se ofrece como destino.
5. **Given** movimientos seleccionados y una etiqueta destino, **When** la acción se ejecuta, **Then** la reasignación es transaccional todo-o-nada: o todos los seleccionados cambian de etiqueta, o no cambia ninguno (FR-003).
6. **Given** movimientos reasignados, **When** consulto cualquier vista derivada (KPIs del mes, `/summary`, `/annual`, informe anual por categorías de 015), **Then** todos los importes y totales son idénticos a antes de la operación al céntimo; solo la dimensión etiqueta se ha movido entre desgloses (FR-005).
7. **Given** movimientos reasignados, **When** los edito o elimino individualmente después (003), **Then** se comportan como cualquier movimiento manual.

---

### Edge Cases

- **Ingresos sin etiqueta**: son seleccionables; la reasignación les fija la etiqueta elegida (la etiqueta es opcional en ingresos — 014; asignarla a posteriori es válida). Los gastos siempre tienen etiqueta y siempre tendrán una tras la reasignación (nunca se deja un gasto sin etiqueta).
- **Etiqueta destino = etiqueta actual de todos los seleccionados**: la operación es un no-op con mensaje claro o el botón deshabilitado [NEEDS CLARIFICATION: preferencia del propietario — no-op con confirmación vs. deshabilitado].
- **Etiqueta destino deja de existir entre previsualización y confirmación** (p. ej. fusionada en otra pestaña): la acción re-valida en servidor y termina en error sin cambiar nada (FR-003); el catálogo se relee en el siguiente render.
- **Etiqueta destino inactiva o protegida**: no se ofrece en el Select (solo etiquetas activas, sin «Aportación Común»).
- **Selección que cruza grupos de fecha del listado agrupado**: la selección opera sobre el listado completo del mes visible (grupos por fecha), no por grupo; seleccionar/deseleccionar todo es un atajo disponible.
- **Mes en curso de una cuenta personal con aportación materializada**: los movimientos generados (etiqueta «Aportación Común») están excluidos por protección; la re-sincronización de 021 y las materializaciones (018/019/023) no se ven afectadas por reasignar otros movimientos del mes (los importes no cambian, FR-005).
- **Meses cerrados**: la reasignación está permitida en cualquier mes consultado — cambia la dimensión etiqueta, no importes ni configs, y no interacciona con el congelado de materializaciones.
- **`updated_at` de los movimientos reasignados** [NEEDS CLARIFICATION: la fusión de 004 no lo tocaba (operación de catálogo); aquí el usuario edita movimientos concretos — decisión de si la reasignación cuenta como edición (lo actualiza) o como operación de dimensiones (no lo toca) se cierra en clarify y se registra en el plan].
- **Concurrencia**: un movimiento seleccionado que desaparece del mes antes de confirmar (eliminado en otra pestaña): la acción re-valida en servidor contra los ids enviados; los ids inexistentes se ignoran con aviso del recuento real [NEEDS CLARIFICATION: ignorar con aviso vs. abortar todo-o-nada — preferencia del propietario].

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (selección en la página de cuenta)**: La aplicación MUST ofrecer un modo de selección sobre el listado agrupado de la página de cuenta (`/accounts/{id}`, mes visible): activar selección, marcar/desmarcar movimientos individuales (excluidos los protegidos — Edge Cases), atajo de seleccionar todo y salida limpia del modo; una barra de acción contextual ofrece «Cambiar etiqueta…» con el recuento de seleccionados. El resto del recorrido de la vista operativa (025: stepper, KPIs, edición/eliminación individual) MUST permanecer intacto cuando el modo está desactivado.
- **FR-002 (diálogo de reasignación con confirmación informada)**: Antes de ejecutar nada, la aplicación MUST mostrar un diálogo con el **número de movimientos seleccionados** y un Select de **etiqueta destino** (solo activas, sin protegidas, agrupado por categorías — patrón 027); la confirmación explícita ejecuta y el resultado informa del recuento actualizado («N movimientos actualizados»). No se persiste nada sin esa confirmación.
- **FR-003 (transaccionalidad y re-validación en servidor)**: La reasignación confirmada MUST ejecutarse de forma transaccional **todo-o-nada** sobre los ids validados en servidor (pertenencia a la cuenta y mes de la operación, etiqueta destino existente y activa); cualquier error no contemplado revierte todo sin cambios parciales.
- **FR-004 (reglas de dominio vigentes, sin excepciones)**: La reasignación MUST pasar por el dominio y la aplicación existentes: un movimiento siempre conserva **una única** etiqueta (014), obligatoria en gastos; la etiqueta destino es una `Tag` activa existente; «Aportación Común» está protegida en ambos papeles (origen seleccionable nunca — sus movimientos se excluyen — y destino nunca ofrecido), reutilizando la protección por slug de 004. Sin bypass de dominio ni UPDATE SQL directo desde la action.
- **FR-005 (agregados y materializaciones intactos)**: La reasignación MUST NOT cambiar importe, fecha, nota, tipo ni naturaleza de ningún movimiento, y MUST NOT disparar ni inhibir las materializaciones (018/019/021/023); todas las vistas derivadas (KPIs, cierres internos, `/summary`, `/annual`, informe 015) reflejan el cambio por sus joins vivos, recalculando solo la dimensión etiqueta.
- **FR-006 (caso de uso reutilizable por el futuro modo IA)**: La operación MUST implementarse como caso de uso de aplicación con contrato explícito (entrada: cuenta, mes, ids de movimientos, etiqueta destino; salida: recuento y resultado tipado), de modo que un adaptador de entrada futuro (el chat del modo IA, feature aparte) pueda ejecutarla con previsualización/confirmación equivalentes **sin cambios en dominio ni aplicación** (misma arquitectura que el resto de adaptadores inbound — constitución VII).
- **FR-007 (cobertura de tests)**: La feature MUST estar cubierta por tests: unidad de aplicación del caso de uso (doble en memoria: éxito con recuento, movimiento ajeno a la cuenta/mes, id inexistente, etiqueta destino inexistente/inactiva/protegida, selección protegida excluida), repositorio (transaccionalidad contra libsql `:memory:`), action (Zod y mapeo de errores), componentes del modo selección y del diálogo, y un e2e del flujo completo (seleccionar → confirmar → listado y desglose verificados) en combinación cuenta/mes propia (convención de aislamiento e2e; constitución III).
- **FR-008 (actualización de documentación)**: Al completar la feature, el roadmap maestro MUST registrar la fila `029-retag-masivo` como Completada y la decisión pendiente del modo IA queda anotada como feature futura; la solución de `updated_at` (Edge Cases) y cualquier convención UI nueva (p. ej. modo selección sobre listados) se registran en ADR/AGENTS.md según corresponda.

### Key Entities

No se introducen entidades nuevas de dominio ni de esquema: la operación reasigna la **etiqueta** de **movimientos** existentes. Conceptualmente aparecen:

- **Selección de movimientos** (estado efímero de cliente): conjunto de ids marcados en el listado del mes visible de una cuenta, excluyendo los protegidos; se envía a la action como lista de ids y se re-valida en servidor.
- **Reasignación masiva** (caso de aplicación, FR-006): operación transaccional que fija una misma etiqueta destino activa sobre un conjunto validado de movimientos de una cuenta y mes, devolviendo el recuento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Reasignar la etiqueta de 50 movimientos de un mes (incluida la revisión del diálogo) toma menos de 30 segundos, frente a ~50 ediciones individuales con el diálogo de 003.
- **SC-002**: Tras cualquier reasignación, todos los totales y saldos de la aplicación (mes, global, anual) son idénticos al céntimo a los previos; los desgloses por etiqueta mueven exactamente los importes de los movimientos reasignados de una etiqueta a otra.
- **SC-003**: El 100 % de los casos de error (ids ajenos, destino inválido, errores inesperados) termina sin cambios parciales en la base de datos.
- **SC-004**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde tras la feature.

## Assumptions

- **Alcance v1 acotado a la vista operativa**: la selección vive en la página de una cuenta y el mes visible (una operación = una cuenta + un mes); la selección global multi-cuenta/multi-mes o por filtros (007) queda fuera.
- **Destino = etiqueta existente y activa**: no hay creación inline de etiquetas en el diálogo (crear antes con 017 o `/tags` si falta); la etiqueta protegida no participa.
- **No se permite dejar sin etiqueta** en la operación masiva (v1): siempre se sustituye por (o se asigna) una etiqueta elegida; la retirada masiva de etiqueta queda fuera de alcance.
- **Un solo usuario** sin concurrencia real; aún así la acción re-valida todo en servidor (FR-003) porque es la frontera de confianza.
- **La UI y la spec van en español** y los identificadores en inglés (`BulkRetagMovements`, nombres definitivos en el plan/data-model); los e2e operan en combinación cuenta/mes propia conforme a la convención de aislamiento del proyecto.
- **El caso de uso es la unidad de reuso** del futuro modo IA (FR-006): la feature no añade ninguna dependencia externa ni infraestructura nueva (cero dependencias, sin migraciones — el esquema actual soporta todo).

## Out of Scope

- **Modo IA / chat con LLM** (chat que opera la app sobre los datos con previsualización/confirmación, proveedor ZAI vía puerto `LlmClient`, tool calling; sin MCP ni RAG): feature futura ya acordada con el propietario (2026-11-07) que reutilizará este caso de uso; decisión arquitectónica y ADR en su propia spec.
- Edición masiva de otros campos (nota, importe, fecha, tipo, naturaleza, cuenta).
- Selección por filtros/busquedas (007) o multi-mes/multi-cuenta.
- Retirada masiva de etiqueta (dejar movimientos sin etiqueta).
- Cambios en `/tags` (fusión, desactivación, reactivación: 004) ni en el catálogo en general — ambas etiquetas siguen existiendo tras la operación.
- Deshacer/rehacer la reasignación (el listado y los desgloses muestran el resultado; revertir es otra reasignación).
