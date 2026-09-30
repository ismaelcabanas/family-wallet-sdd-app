# Research: Listado de movimientos bajo el selector de fechas

**Feature**: 016-movimientos-bajo-selector-fechas | **Fecha**: 2026-09-30

Feature de presentación pura sobre la página de cuenta de 011 (`src/app/accounts/[accountId]/page.tsx`): reordenar bloques existentes sin tocar dominio, aplicación, puertos ni persistencia (FR-003). Este research documenta el estado actual verificado en código, las decisiones de reordenación/verificación y las alternativas desechadas. No hay NEEDS CLARIFICATION abiertos: la única duda (orden de los bloques restantes) quedó resuelta en clarificación (2026-09-29).

## §1. Composición actual de la página y reordenación exacta

**Estado actual (verificado en `src/app/accounts/[accountId]/page.tsx:66-103`)**: `main` (flex-col) renderiza en este orden: `h1`+`GlobalNav` → subtítulo de tipo de cuenta → `MonthStepper` → `AccountBalance` (subtitle «Acumulado hasta {mes}») → `MovementForm` → `MonthlyClosurePanel` → `GroupedMovementList`.

**Decisión**: mover únicamente el bloque JSX de `GroupedMovementList` (líneas 95-101 actuales) a la posición inmediatamente posterior a `MonthStepper`. Orden resultante: cabecera → subtítulo → `MonthStepper` → **`GroupedMovementList`** → `AccountBalance` → `MovementForm` → `MonthlyClosurePanel`.

**Rationale**: es el cambio mínimo que satisface FR-001 (ningún bloque entre selector y listado) y FR-002 (los bloques restantes conservan su orden relativo: balance → formulario → cierre, clarificación 2026-09-29). Los componentes hijos reciben exactamente las mismas props; los Tests RTL co-localizados de `GroupedMovementList`, `MonthStepper`, `AccountBalance`, etc. renderizan componentes aislados y no dependen del orden de la página → quedan intactos.

**Alternativas consideradas**:
- *Extraer la composición a un componente `AccountPageBlocks`*: rechazada por indirección innecesaria (YAGNI, constitución I); la página ya es el lugar canónico de composición en 011.
- *Reordenar también los bloques restantes (p. ej. cierre antes del balance)*: rechazada; la clarificación fija el orden relativo actual (FR-002).

**Convención de estado vacío verificada**: el estado vacío («Aún no hay movimientos en este mes») se renderiza **dentro** de `GroupedMovementList` (client), nunca como swap condicional de la página — convención de diálogos montados a nivel del listado documentada en AGENTS.md. Al reordenar, el estado vacío acompaña al listado bajo el selector (escenario 4) sin cambio alguno en el componente.

## §2. Server Actions, revalidación e interacciones de fila

**Verificado**: las Server Actions de alta (`002`) y edición/eliminación (`003`) revalidan `revalidatePath("/accounts/[accountId]", "page")`, lo que recalcula la página completa del mes visible. La posición de los bloques en el JSX es irrelevante para la revalidación.

**Decisión**: no tocar acciones, `revalidatePath` ni flujos de datos. Los diálogos de editar/eliminar siguen montados a nivel de `grouped-movement-list.tsx` con el DTO capturado en estado del cliente (FR-004): al seguir el listado dentro del mismo árbol cliente (page server → GroupedMovementList client), el patrón funciona igual en la nueva posición.

**Rationale**: la reordenación es composición visual; cualquier cambio en el flujo de revalidación sería alcance extra prohibido (FR-003) y riesgo innecesario para FR-005.

**Alternativas consideradas**: ninguna razonable; mover lógica de revalidación sería una desviación sin beneficio.

## §3. Pruebas e2e: selectores agnósticos del orden + aserción de adyacencia

**Análisis de las specs existentes** (todas usan roles/regions/labels, no posición):

- `pagina-cuenta.spec.ts` (cuenta 2, abril 2026): `registerMovement` llena el formulario **por label** (`getByLabel("Fecha")`, etc.) — funciona con el formulario más abajo; P1 agrupa por headings del `region "Movimientos del mes"`; P2 edición/eliminación por botones de fila; P3 mes vacío; P4/P5 límites de meses; P6 404; P7 month inválido. **Nada depende del orden de bloques.**
- `registro-movimientos.spec.ts` (cuenta 1): alta + balance histórico por texto/region, agnóstico del orden.
- `edicion-movimientos.spec.ts` (cuenta 3): diálogos por role/name.
- `cierre-mensual.spec.ts`, `resumen-global.spec.ts`, `cuenta-resultados-anual.spec.ts`, `panel-cuentas.spec.ts`: navegan a la página de cuenta como paso intermedio; aserciones sobre cierres/totales por texto — agnósticas.

**Decisión**:
1. **No crear specs e2e nuevas** (asunción de la spec: no hay flujo nuevo ni escritura adicional; los e2e existentes cubren la operativa).
2. **Añadir una aserción de adyacencia en P1 de `pagina-cuenta.spec.ts`** que congela el FR-001 en CI sin debilitar nada existente: usando `locator.evaluate` o comparación de `boundingBox()` entre el stepper (`combobox "Mes visible"`) y el primer heading del listado, verificar que ningún bloque intermedio (balance/formulario/cierre) aparece entre ambos. Implementación recomendada: `expect(page.locator("main > *").first-of-type?)` — mejor: sobre los hijos directos de `main`, índice del stepper < índice del listado y entre ambos no hay `section`/`region` de balance/cierre/formulario. La forma más simple y robusta en Playwright: `await expect(stepperElement).toBeVisible()` + `list.first()` visible en el mismo viewport (`toBeInViewport()`), cubriendo SC-002.

**Rationale**: los tests de la spec piden que «si alguna prueba depende del orden actual de bloques, se actualice para reflejar el nuevo orden» (FR-005) — no hay ninguna dependiente — y la asunción permite «ajustar selectores/orden en los existentes antes que añadir specs»; la aserción de adyacencia es un refuerzo barato y estable del criterio central de la feature.

**Alternativas consideradas**:
- *Nueva spec e2e `movimientos-bajo-selector.spec.ts`*: rechazada; duplicaría P1/P3 sin flujo nuevo y añadiría un fichero más a la cola serial de `workers: 1`.
- *Test RTL de la página completa (jsdom) renderizando `AccountPage`*: rechazado; la página es un server component async con DB real (necesitaría mocks masivos de módulos server-only); los e2e ya lo cubren de verdad.

**Nota**: verificar `toBeInViewport()` tras el cambio — el stepper + primer grupo de movimientos deben caber en pantalla de escritorio (SC-002); con las clases actuales (`max-w-4xl`, paddings compactos) el margen es holgado, pero la aserción lo congela.

## §4. Documentación viva y roadmap

**Verificado**:
- `docs/architecture/diagrams/pagina-cuenta-sequence.md` línea 29 documenta el orden de render actual («MonthStepper, balance, MovementForm, cierre, listado») → actualizar al nuevo orden.
- `docs/architecture/overview.md` describe la página de cuenta; actualizar la mención de composición si la hay (fase implementación).
- `specs/001-family-wallet/spec.md`: fila 013 dice «CTA "Nuevo movimiento" que abre el formulario actual en diálogo» — ya no menciona «página de cuenta list-first» (la nota 2026-09-29 ya retiró esa parte y la fila 016 la absorbió); actualizar **estado de la fila 016** (a En curso/Completada según fase) al implementar. Fila 013 sin cambios de texto necesarios (verificado: ya está reducida al CTA).

**Decisión**: estas actualizaciones se ejecutan en la fase de implementación (DoD: documentación actualizada en el mismo cambio), reutilizando los diagramas de este plan como base.

**Rationale**: constitución III/DoD y regla de AGENTS.md sobre documentación viva.

## §5. Accesibilidad y UX del nuevo orden

**Verificado**: la página es un `main` con flex-col y gap; cada bloque es un elemento semántico (h1, nav, section/region, form). No hay `tabindex` ni foco gestionado por posición.

**Decisión**: sin cambios de accesibilidad; el orden de lectura del DOM pasa a coincidir con el orden visual (listado antes del balance), lo que mejora la coherencia de tabulación para el caso de uso principal (consultar movimientos).

**Alternativas consideradas**: añadir landmarks nuevos o `aria-order`: innecesario (constitución I).

## Resumen de decisiones

| Tema | Decisión | Alternativa rechazada |
|------|----------|----------------------|
| §1 Cambio de código | Mover bloque JSX de `GroupedMovementList` tras `MonthStepper` en `page.tsx`; nada más | Componente envoltorio; reordenar bloques restantes |
| §2 Revalidación | Intacta: acciones y `revalidatePath` sin cambios | Reubicar lógica de revalidación |
| §3 E2E | Sin specs nuevas; aserción de adyacencia/viewport en P1 (`pagina-cuenta.spec.ts`) | Nueva spec dedicada; test RTL de página server |
| §4 Documentación | Actualizar `pagina-cuenta-sequence.md`, `overview.md` y estado de fila 016 en la implementación | Dejar docs desactualizadas |
| §5 Accesibilidad | Sin cambios; DOM order = visual order tras la reordenación | Landmarks/aria-order extra |
