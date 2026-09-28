# Checklist de Revisión de Diseño: Página de Cuenta

**Purpose**: Revisión de calidad de los requisitos de `011-pagina-cuenta` en toda su huella documental (spec + plan + data-model + contracts + quickstart) —UX/UI, casos límite, trazabilidad FR→contrato— como gate del revisor antes de `/speckit.tasks`.
**Created**: 2026-09-28
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [contracts/ui-contract.md](../contracts/ui-contract.md)

**Note**: Checklist custom generado por el comando `/speckit.checklist` a partir del contexto de la feature. Los items evalúan la **calidad de los requisitos escritos** (completitud, claridad, consistencia, medibilidad, cobertura), no la implementación.
**Review Ownership**: Artefacto de revisión propiedad del revisor. Marca un item `[x]` solo cuando el revisor determine que el criterio de calidad del requisito está satisfecho.
**Marker Semantics**: `[x]` significa que el criterio ha sido revisado y satisfecho en cuanto a calidad de requisitos. NO significa que el trabajo de implementación esté completado.

## Completitud de requisitos

- [x] CHK001 - ¿Los requisitos definen todos los estados de la página de cuenta (con datos, vacío, 404 por accountId inválido, mes futuro por URL directa) con su comportamiento esperado? [Completeness, Spec §FR-001, Edge Cases]
- [x] CHK002 - ¿Están definidos los requisitos de ajuste/truncamiento para filas con tags numerosas o largas y notas extensas (concepto · descripción)? [Gap, Spec §FR-003]
- [x] CHK003 - ¿Se especifica el comportamiento esperado cuando un alta desde el formulario embebido se fecha fuera del mes visible (¿aparece en la vista, hay feedback)? [Gap, Spec §FR-008]
- [x] CHK004 - ¿La accesibilidad del color (contraste, alternativa no cromática) está especificada como requisito verificable y no solo como decisión aplazada o resuelta implícitamente en el contrato? [Completeness, Spec §Assumptions, ui-contract §5]
- [x] CHK005 - ¿Está definido de forma explícita el requisito de qué se recalcula tras una escritura (listado, cierre, balance) en la propia vista? [Completeness, Spec §FR-004, FR-006, ui-contract §2.3]

## Claridad y ausencia de ambigüedad

- [x] CHK006 - ¿«Tags como elemento identificador prominente» está cuantificado con criterios verificables (posición, jerarquía visual frente a nota e importe)? [Clarity, Spec §FR-003, ui-contract §2.2]
- [x] CHK007 - ¿«Distintivo sutil» de naturaleza está definido con propiedades medibles y no solo cualitativas? [Clarity, Spec §FR-003]
- [x] CHK008 - ¿La excepción de FR-009 (corte de fecha del puerto de balance) está delimitada sin ambigüedad frente al enunciado general «sin cambios de aplicación»? [Clarity, Spec §FR-006, FR-009]
- [x] CHK009 - ¿El orden interno del grupo («último registrado primero») está especificado con un criterio objetivo (id DESC) y no solo perceptual? [Clarity, Spec §FR-002, Edge Cases]
- [x] CHK010 - ¿«Usable en móvil pero no optimizado» (escritorio primero) tiene criterios que permitan verificar su cumplimiento? [Ambiguity, Spec §Assumptions]

## Consistencia entre artefactos

- [x] CHK011 - ¿La regla de deshabilitado de › es consistente entre la spec («mes actual») y el contrato (mes ≥ actual, que cubre también el futuro alcanzado por URL)? [Consistency, Spec §FR-005, Edge Cases, ui-contract §4]
- [x] CHK012 - ¿La divergencia terminológica de naturaleza («Personal/Común» en 011 frente al «Compartido» del listado actual de `/`) está documentada como decisión intencionada? [Consistency, research §3, ui-contract §3]
- [x] CHK013 - ¿El balance acumulado hasta fin de mes (FR-006) es coherente en base temporal con el panel de cierre de 005 mostrado en la misma página? [Consistency, Spec §FR-006]
- [x] CHK014 - ¿FR-007 (`/` intacta) y el rediseño de fila son consistentes con SC-004 (e2e existentes sin modificar), sin requisito contradictorio de unificar presentación entre ambas páginas? [Consistency, Spec §FR-007, SC-004]
- [x] CHK015 - ¿Los textos exactos del contrato (cabecera de fecha «{D} de {mes} de {YYYY}», subtítulo «Acumulado hasta {Mes de YYYY}», vacío) coinciden con los enunciados de los escenarios de aceptación? [Consistency, Spec §Escenarios 3/6, ui-contract §3]

## Calidad de criterios de aceptación

- [x] CHK016 - ¿SC-002 («localizar por tags e importe de un vistazo, sin leer texto auxiliar») es objetivamente verificable? [Measurability, Spec §SC-002]
- [x] CHK017 - ¿SC-003 (< 3 s con 300 movimientos) define condiciones de medición (entorno, método) o queda como verificación informal («impresión informal» en quickstart)? [Measurability, Spec §SC-003, quickstart]
- [x] CHK018 - ¿Los 7 escenarios de aceptación cubren los 10 FRs sin dejar FR sin escenario ni escenario sin FR (trazabilidad bidireccional)? [Traceability, Spec §Requirements, §User Scenarios]

## Cobertura de escenarios y casos límite

- [x] CHK019 - ¿Existe escenario o criterio explícito para el límite del corte inclusivo (movimiento fechado exactamente el último día del mes computa en el balance)? [Edge Case, Spec §FR-006, data-model §2.2]
- [x] CHK020 - ¿La navegación ‹ › en cruce de año (diciembre ↔ enero) está contemplada en requisitos o escenarios de la spec? [Coverage, Gap, Spec §FR-005]
- [x] CHK021 - ¿El caso de `accountId` numérico no canónico (ceros a la izquierda, p. ej. `/accounts/02`) tiene comportamiento definido (resuelve, 404, redirige)? [Edge Case, Gap, Spec §FR-001]
- [x] CHK022 - ¿Los meses extremos accesibles por URL directa (fuera de la ventana de 24 meses del picker) tienen comportamiento especificado? [Edge Case, Spec §FR-005, ui-contract §4]
- [x] CHK023 - ¿La edición que mueve un movimiento a otra cuenta (diálogo de 003 con selector de cuenta) desde la página de la cuenta origen está cubierta en requisitos (desaparece del listado, balance recalculado)? [Coverage, Spec §FR-004, ui-contract §1.3]
- [x] CHK024 - ¿El estado vacío tras eliminar el último movimiento visible (sin desmontar el listado) está elevado a requisito y no queda solo como convención de implementación? [Coverage, Spec §FR-004, Edge Cases]

## Requisitos no funcionales

- [x] CHK025 - ¿Los requisitos de accesibilidad (aria-labels, region/aria-labelledby, `<time>` semántico, foco visible, operación por teclado) están especificados como requisitos de la feature o solo viven en el contrato de UI sin anclaje en los FR? [Coverage, NFR, ui-contract §5]
- [x] CHK026 - ¿El feedback de navegación entre meses (estado pendiente, `opacity-60`) es un requisito especificado o una decisión de diseño sin requisito asociado que lo respalde? [Completeness, NFR, ui-contract §4]

## Dependencias, supuestos y exclusiones

- [x] CHK027 - ¿La nota interina «concepto · descripción» (hasta la fusión de campos de 014) está documentada como supuesto con impacto y fecha de retirada delimitados? [Assumption, Spec §Assumptions]
- [x] CHK028 - ¿Las exclusiones del Out of Scope son exhaustivas respecto a las decisiones tomadas en clarificaciones y edge cases (p. ej. subtotal diario rechazado el 2026-09-27, sin texto «Gasto/Ingreso»)? [Dependencies, Spec §Out of Scope, Edge Cases]

## Notes

- Marca items `[x]` solo tras confirmar que el criterio de calidad del requisito está satisfecho
- Deja items sin marcar cuando aún requieran clarificación, corrección o evaluación del revisor
- `/speckit.implement` lee el estado de los checkboxes como gate y no debe modificar los marcadores
- `checklists/requirements.md` tiene un ciclo de vida separado mantenido por `/speckit.specify` y `/speckit.clarify`
- Añade comentarios o hallazgos inline
- Items numerados secuencialmente para referencia fácil
