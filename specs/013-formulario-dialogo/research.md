# Research: Formulario de alta en diálogo desde el listado

**Feature**: 013-formulario-dialogo | **Fecha**: 2026-09-30

Feature de presentación pura sobre la página de cuenta (011 + reordenación 016): convertir el alta embebida (`MovementForm`, 002) en un CTA «Nuevo movimiento» junto al listado que abre un diálogo con el formulario de alta, y eliminar el bloque embebido (FR-004). Sin cambios de dominio, aplicación, acciones ni persistencia (FR-005). Este research documenta el estado actual verificado en código, las decisiones y las alternativas desechadas. No hay NEEDS CLARIFICATION abiertos: la posición del CTA y el patrón del diálogo quedan fijados por la spec (asunciones) y este research.

## §1. Punto de entrada del alta: CTA junto al listado + diálogo

**Estado actual (verificado)**:

- `src/app/accounts/[accountId]/page.tsx:94-99` monta `<MovementForm accountId accountName accountType tags />` como bloque embebido (posición 5.ª tras la reordenación de 016).
- `src/infrastructure/primary/ui/movement-form.tsx` tiene ya dos niveles: `MovementForm` (wrapper con `useActionState(createMovement)` + `formKey` de remonte tras éxito + toast) y **`MovementFormFields`** (exportado, campos puros con `state`/`formAction`/`isPending` inyectados, `submitLabel`, `secondaryActions`, `children` para hidden inputs) — el mismo molde que ya reutiliza el diálogo de edición.
- `src/infrastructure/primary/ui/edit-movement-dialog.tsx` es el patrón de diálogo de 003: `Dialog` controlado con `open` inicial `true` montado condicionalmente por el padre (sin `DialogTrigger`), `MovementFormFields` dentro, `useEffect` que cierra + `toast.success` en éxito y NO cierra en errores de campo; «Cancelar» (`secondaryActions`) cierra sin confirmación.
- `src/infrastructure/primary/ui/grouped-movement-list.tsx:48-49` ya monta los diálogos de editar/eliminar a nivel del listado con DTO en estado (`editing`/`deleting`) — la convención documentada en AGENTS.md.

**Decisión**:

1. Nuevo componente **`create-movement-dialog.tsx`** (client) en `src/infrastructure/primary/ui/`, calco estructural de `edit-movement-dialog.tsx`: `Dialog` controlado + `DialogTitle «Nuevo movimiento»` + subcomponente `CreateMovementForm` con `useActionState(createMovement, { status: "idle" })`, `useEffect` éxito → `onClose()` + `toast.success("Movimiento guardado")` (errores de campo NO cierran), `MovementFormFields` en modo alta (`accountId`/`accountName`/`accountType`, sin `initialValues`) con `submitLabel="Registrar"` y `secondaryActions={<Button variant="outline">Cancelar</Button>}`.
2. `GroupedMovementList` ampliado: nuevo estado `creating` (`useState<boolean>`), botón **«Nuevo movimiento»** en la cabecera de la sección del listado (junto al `h2` «Movimientos del mes») **y también junto al estado vacío** (`EmptyState` recibe el CTA o se envuelve) — disponible en cualquier mes, con o sin movimientos (FR-001, escenario 5); render condicional `{creating ? <CreateMovementDialog … onClose={() => setCreating(false)} /> : null}` a nivel del listado.
3. `page.tsx`: eliminar el bloque `MovementForm` (FR-004) y su import; pasar `accountName`/`accountType` (además de los `accounts`/`tags` actuales) a `GroupedMovementList` para que el diálogo fije la cuenta (FR-002). Orden resultante: cabecera → subtítulo → `MonthStepper` → `GroupedMovementList` (con CTA) → `AccountBalance` → `MonthlyClosurePanel`.

**Rationale**: reutiliza el patrón de diálogo ya entregado por 003 (menor riesgo, FR-002/FR-005) y `MovementFormFields` con `formAction` inyectada — la pieza diseñada exactamente para reutilizarse. Mantener el CTA dentro de `GroupedMovementList` (client) garantiza que el diálogo sobreviva a `revalidatePath` (convención de diálogos a nivel de listado) y que exista también en meses vacíos, donde hoy solo se renderiza `EmptyState`. El botón de fila ya existente del alta embebida desaparece con su bloque.

**Alternativas consideradas**:

- *`DialogTrigger` dentro del propio `MovementForm` envuelto en Dialog*: rechazada; el alta embebida se elimina (FR-004), no se transforma en acordeón/collapsible.
- *CTA flotante (FAB) fijo*: rechazado por coste CSS/accesibilidad y alejamiento del listado (spec: «junto al listado»).
- *Diálogo montado en `page.tsx`*: imposible sin convertir la página en client; rompería la convención de diálogos a nivel del listado.
- *Mover `MovementForm` entero dentro del diálogo sin extraer el wrapper*: rechazado; `MovementForm` trae sección/borde/título «Registrar movimiento» y la lógica `formKey` de remonte para altas encadenadas — el diálogo se cierra tras guardar (edge case «registros consecutivos»), por lo que el remonte por `key` es innecesario: cada apertura remonta el formulario limpio al desmontarse el diálogo.

## §2. Estado vacío, textos y accesibilidad

**Estado actual (verificado)**:

- `empty-state.tsx` dice «Registra el primero con el formulario superior.» — quedará obsoleto al eliminar el formulario embebido (FR-004).
- Botones del proyecto: `Button` de shadcn con variantes (`default`/`outline`/`destructive`); los diálogos usan `role="dialog"` con nombre accesible por `DialogTitle` (Radix: foco atrapado, Escape, `aria-modal`).

**Decisión**:

1. `EmptyState` mantiene el texto principal «Aún no hay movimientos en este mes.» y pasa a recibir el CTA como `children` (o el componente listado renderiza el botón junto al `EmptyState`): el CTA debe existir en meses vacíos (FR-001). Texto de apoyo actualizado: «Pulsa «Nuevo movimiento» para registrar el primero.» (FR-007).
2. CTA: `<Button type="button">Nuevo movimiento</Button>` en la cabecera de la sección del listado (fila `flex` entre `h2` «Movimientos del mes» y el botón); estilo `default` (primario, es la única acción de escritura de la página), `size="sm"` para no competir visualmente con los headings.
3. `DialogTitle` del diálogo: **«Nuevo movimiento»** (mismo nombre que el CTA, refuerza el mental model; evita colisión con «Editar movimiento» de 003). Los labels internos son los de `MovementFormFields` — idénticos al alta actual, por lo que los e2e por label siguen funcionando.

**Rationale**: meses vacíos son justo donde más se necesita el CTA (escenario 5); mantener los labels intactos minimiza el impacto en e2e (§3) y FR-007 (importes EUR vía helpers existentes, sin tocar).

**Alternativas consideradas**:

- *Copiar el botón en el estado vacío duplicándolo*: rechazado por duplicación; mejor propiedad/children.
- *Texto «Añadir movimiento»*: rechazado; la spec nombra el CTA «Nuevo movimiento» (US, FR-001) y así debe congelarse en el contrato.

## §3. Pruebas: unitarias/RTL de componentes y e2e

**Estado actual (verificado)**:

- `movement-form.test.tsx` (349 líneas) testea `MovementForm` (wrapper embebido) y `MovementFormFields` (modo edición). El wrapper embebido desaparece de la página, pero los tests del wrapper validan comportamiento del flujo de alta (defaults, errores, reset) que el diálogo debe conservar.
- `grouped-movement-list.test.tsx` ya testea apertura/cierre de diálogos por botón de fila; `edit-movement-dialog.test.tsx` es el molde para el test del diálogo de alta.
- e2e: 7 specs. Los helpers `registerMovement` rellenan **por label** y pulsan «Registrar» — funcionarán sin cambios dentro del `dialog` role tras añadir la apertura del CTA (los labels son únicos en la página, no hay otro formulario visible). Specs afectadas: `registro-movimientos` (E1–E4), `pagina-cuenta` (P1), `edicion-movimientos` (setup), `cierre-mensual` (E1), `resumen-global` (3 altas), `cuenta-resultados-anual` (5 altas). `panel-cuentas` solo aserta la **ausencia** del botón «Registrar» en `/` — intacto.
- `pagina-cuenta.spec.ts:136-146` aserta adyacencia stepper→listado sobre `main > *`: sigue válida (el CTA vive **dentro** de la sección del listado, no es hijo directo de `main`).

**Decisión**:

1. **Test RTL nuevo** `create-movement-dialog.test.tsx` (molde `edit-movement-dialog.test.tsx`): apertura con defaults de alta (fecha hoy, Gasto, cuenta fijada), submit feliz → llama action + cierra + toast «Movimiento guardado», error de campo → diálogo abierto y valores conservados, Cancelar → cierra sin llamar la action, y naturaleza oculta con Ingreso.
2. **Ampliar** `grouped-movement-list.test.tsx`: botón «Nuevo movimiento» visible con movimientos y en estado vacío; abre `dialog { name: "Nuevo movimiento" }`; el estado vacío ya no menciona «formulario superior».
3. **`movement-form.test.tsx`**: los tests del wrapper `MovementForm` se re-point a `CreateMovementDialog` (o se marcan equivalentes vía `MovementFormFields` en modo alta con `formAction` inyectada); los de `MovementFormFields` (modo edición) quedan intactos. La aserción de reset tras éxito se adapta: tras guardar, el diálogo se cierra y una reapertura muestra el formulario limpio.
4. **e2e**: cada helper `registerMovement` añade `await page.getByRole("button", { name: "Nuevo movimiento" }).click()` + `await expect(page.getByRole("dialog", { name: "Nuevo movimiento" })).toBeVisible()` antes de rellenar. Tras guardar: assert de cierre del diálogo (implícito al desaparecer `dialog`). Se mantiene el aislamiento por combinación cuenta/mes de cada spec (asunción de la spec). `panel-cuentas` N1/N4 (sin «Registrar» en `/`) sin cambios; opcionalmente reforzar en `pagina-cuenta` P1 que el formulario embebido ya no existe (sin `section "Registrar movimiento"`) — congela FR-004 en CI.
5. **Gates**: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` en verde (FR-006, constitución III).

**Rationale**: el flujo crítico de registro sigue cubierto e2e (constitución III) con el nuevo punto de entrada; los tests RTL del diálogo replican la cobertura que hoy tiene el wrapper embebido sin duplicarla (el wrapper se elimina, FR-004). Congelar la ausencia del formulario embebido en e2e evita regresiones silenciosas.

**Alternativas consideradas**:

- *Mantener tests del wrapper `MovementForm` tal cual*: imposible; el componente se elimina de la página. Se conservan los comportamientos verificándolos en el diálogo.
- *Spec e2e nueva dedicada al diálogo*: rechazada; `registro-movimientos` ya es la spec canónica del alta y pasa a cubrir el diálogo al cambiar su helper — duplicaría cobertura sin flujo nuevo y añadiría un fichero a la cola serial.
- *Selectores por posición/DOM:* rechazados; los helpers ya usan roles/labels (robustos).

## §4. Documentación viva y roadmap

**Verificado**:

- `docs/architecture/diagrams/pagina-cuenta-sequence.md` y `docs/architecture/overview.md` documentan la composición de la página de cuenta (orden con `MovementForm` embebido tras 016).
- `specs/001-family-wallet/spec.md` fila 013: «CTA "Nuevo movimiento" que abre el formulario actual en diálogo» — estado a actualizar al completar.
- `AGENTS.md`: convenciones ya documentadas (diálogos por fila a nivel del listado, estado vacío dentro del listado); el CTA no introduce convención nueva, pero la eliminación del alta embebida puede tocar menciones de composición en docs.

**Decisión**: actualizar en la fase de implementación (DoD): diagrama de secuencia de la página de cuenta (diálogo de alta en lugar de bloque embebido), `overview.md` si menciona el formulario embebido, fila 013 del roadmap a «Completada» al cerrar. `AGENTS.md` solo si la implementación fija convención nueva (p. ej. wording del CTA junto a headings) — no se prevé.

**Rationale**: constitución III/DoD y regla de AGENTS.md sobre documentación en el mismo cambio; los diagramas de este plan son la base.

**Alternativas consideradas**: ninguna razonable; dejar docs desfasadas viola la DoD.

## §5. Interacción con la revalidación y edge cases

**Verificado**:

- `create-movement.action.ts` revalida `/` y `/accounts/[accountId]` (page) → la página completa se recalcula tras el alta; el diálogo es client y sobrevive al `revalidatePath` mientras esté montado en `GroupedMovementList` (misma garantía que los diálogos de 003, demostrada por el test «el diálogo de borrado sobrevive cuando el refresco vacía la lista»).
- El alta con fecha fuera del mes visible no cambia la vista (revalidación de la misma URL); la fecha por defecto sigue siendo `todayIsoDate()` (comportamiento actual, asunción de la spec).

**Decisión**: sin cambios en acciones/revalidación (FR-005). El cierre del diálogo tras éxito + reapertura limpia cubre los registros consecutivos (edge case). El botón Guardar ya se deshabilita con `isPending` («Guardando…»); Cancelar/X/Escape (vía `onOpenChange` → `onClose`) descartan sin confirmación, igual que 003 (edge case «cierre con datos a medias»).

**Rationale**: los edge cases de la spec ya están cubiertos por el patrón de 003 y el comportamiento existente de `createMovement`; cualquier cambio sería alcance extra prohibido (FR-005).

**Alternativas consideradas**: *Confirmación al cerrar con datos a medias*: rechazada explícitamente por la spec (edge case: se descarta sin confirmación).

## Resumen de decisiones

| Tema | Decisión | Alternativa rechazada |
|------|----------|----------------------|
| §1 Punto de entrada | `create-movement-dialog.tsx` nuevo (calco de `edit-movement-dialog` con `createMovement`); CTA «Nuevo movimiento» en la cabecera del listado y junto al estado vacío; diálogos a nivel de `GroupedMovementList`; eliminar `MovementForm` de `page.tsx` | DialogTrigger/collapsible sobre el formulario embebido; FAB; diálogo en la página server |
| §2 Textos y CTA | `DialogTitle`/CTA «Nuevo movimiento»; `EmptyState` recibe el CTA y texto actualizado; Button primario `size="sm"` | Duplicar botón; «Añadir movimiento» |
| §3 Pruebas | Test RTL nuevo del diálogo; ampliar tests del listado (CTA en vacío + apertura); re-point de tests del wrapper eliminado; helpers e2e añaden apertura del CTA; assert de ausencia del bloque embebido | Mantener tests del wrapper; spec e2e nueva; selectores posicionales |
| §4 Documentación | Actualizar diagrama de secuencia, overview y fila 013 del roadmap en la implementación | Dejar docs desfasadas |
| §5 Revalidación/edge cases | Acciones y `revalidatePath` intactos; cierre tras éxito + reapertura limpia; cancelar descarta sin confirmación | Confirmación al cancelar; cambios en la action |
