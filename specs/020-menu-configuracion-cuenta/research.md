# Research: Menú de configuración en las tarjetas de cuenta

**Feature**: 020-menu-configuracion-cuenta | **Fecha**: 2026-10-13

Feature de reubicación pura de adaptador UI: la entrada a la configuración del ingreso regular pasa del panel inferior de la página de cuenta (018) a un menú de tres puntos (⋮) en la tarjeta de cada cuenta personal del panel de cuentas (`/`). Este research fija el estado verificado en código, resuelve los puntos que la spec deja al plan (componente de menú, patrón tarjeta-lanzadora + botón que no navega, estado en el ítem, reutilización del diálogo, retiro del panel) y descarta alternativas. Dominio, aplicación, action, repositorio, BD y materialización quedan intactos (FR-005).

## §1. Componente de menú: DropdownMenu de Radix (shadcn copiado y versionado)

**Estado actual (verificado)**: `src/infrastructure/primary/ui/components/ui/` contiene `alert-dialog`, `button`, `checkbox`, `dialog`, `input`, `label`, `radio-group`, `select`, `sonner` — **no existe** `dropdown-menu.tsx`. El paquete `radix-ui` (^1.6.7, monopaquete) ya es dependencia y es la vía de import de los primitivos existentes (`import { Dialog as DialogPrimitive } from "radix-ui"` en `dialog.tsx`, `Select as SelectPrimitive` en `select.tsx`); `lucide-react` ya aporta iconos (`XIcon`, `CheckIcon`, `ChevronDownIcon`).

**Decisión**: copiar el primitivo shadcn/ui **`dropdown-menu.tsx`** a `components/ui/` (mismo estilo de import desde el monopaquete `radix-ui`, icono `ChevronRightIcon`/check según el original), versionado en el repo (ADR 0005). El menú de la tarjeta usa `DropdownMenu → DropdownMenuTrigger` (botón icono ⋮, `EllipsisVerticalIcon` de lucide) `→ DropdownMenuContent → DropdownMenuItem`. Cero dependencias nuevas.

**Rationale**: Radix DropdownMenu da gratis exactamente los requisitos de accesibilidad y comportamiento de la spec: roles `menu`/`menuitem`, apertura con Enter/Espacio, navegación por ítems con flechas, cierre con Escape/focus-out/clic-fuera (escenario 8 y edges), toggle del trigger (edge «doble apertura»), alineación y **evitación de colisiones** con el viewport (edge móvil «no se sale del viewport»). Es el patrón del stack ya presente (constitución: shadcn/ui sin otras librerías).

**Alternativas consideradas**:

- *Menú propio con `useState` + listener de clic fuera*: rechazado; reinvención de roles ARIA, focus trap, Escape y colisiones que Radix ya resuelve y testea.
- *`Popover` de Radix*: rechazado; semántica de popover, no de menú (roles y navegación por flechas incorrectos para el patrón «⋮ de opciones»).
- *`<details>`/`<menu>` nativos*: rechazados; comportamiento de foco/cierre inconsistente entre navegadores y sin garantía de viewport.
- *Otra librería de componentes*: prohibida sin justificación (constitución, ADR 0005).

## §2. Tarjeta lanzadora + botón ⋮ que no navega (HTML válido)

**Estado actual (verificado)**: `account-card-grid.tsx` es un componente compartido sin `"use client"` que renderiza `<li><Link href="/accounts/{id}" className="…tarjeta completa…">nombre + etiqueta</Link></li>`; la tarjeta entera es el enlace (012: lanzadera). e2e `panel-cuentas.spec.ts` N1 aserta el nombre accesible de los 3 links y `links = 3`.

**Decisión**: patrón **stretched-link** — el `<li>` pasa a alojar un `div.relative` con los estilos visuales de la tarjeta; el `<Link>` envuelve solo nombre+etiqueta y se estira con `after:absolute after:inset-0 after:rounded-lg` (pseudo-elemento que cubre toda la tarjeta); el trigger del menú (en cuentas personales) lleva `relative z-10` y queda **por encima** del pseudo-enlace: el clic en ⋮ nunca navega y el clic en cualquier otro punto de la tarjeta sí (FR-003). El contenido del menú abre en **portal** de Radix (fuera del subárbol de la tarjeta): sin anidamiento de elementos interactivos.

**Rationale**: es la única variante con HTML válido (`<button>` dentro de `<a>` es contenido interactivo anidado prohibido por HTML), semántica intacta (el nombre accesible del link sigue siendo nombre+etiqueta de la cuenta; cmd/ctrl+click y menú contextual del navegador siguen funcionando) y orden de pintado explícito. Los asserts e2e de N1 (nombre accesible del link, 3 links) se mantienen.

**Alternativas consideradas**:

- *`<button onClick={stopPropagation}>` dentro del `<Link>`*: rechazado; HTML inválido, comportamiento de lectores de pantalla impredecible y stopPropagation no blinda el comportamiento por defecto del anchor en todos los escenarios.
- *Tarjeta `div onClick={() => router.push(…)}`*: rechazado; pierde semántica de enlace, apertura en pestaña nueva y estado hover/focus nativos.
- *Zona de enlace parcial (nombre) + botón aparte*: rechazado; rompe «la tarjeta entera navega» (FR-003) y encoge el objetivo táctil principal.

## §3. Estado en el ítem + lectura server-side de la configuración en `/`

**Estado actual (verificado)**: `/` (`src/app/page.tsx`) es server component ya dinámico (`await connection()`); ejecuta `ListAccounts` y pinta `AccountCardGrid accounts`. `GetRegularIncome` (aplicación, 018) expone `execute(accountId) → RegularIncomeDTO | null`; `regular_incomes` se consulta por `account_id UNIQUE` (SELECT trivial). `AccountDTO` vive en `@/application/movement/dto`.

**Decisión**:

1. `page.tsx` ejecuta `GetRegularIncome` **solo para las cuentas personales** (2 llamadas con el repertorio real de cuentas) en paralelo con `ListAccounts` y pasa al grid un prop nuevo serializable: `regularIncomes: Record<number, RegularIncomeDTO | null>` (clave `account.id`). `AccountCardGrid` pasa a ser **client component** (`"use client"`: menú Radix + estado de apertura del diálogo).
2. La **cuenta común no recibe menú** (FR-001): la condición `type === "personal"` vive en el grid; para la común no existe trigger alguno.
3. Derivación del estado del ítem como función pura exportada (testable sin render):

   | `config` | Literal del ítem (congelado) |
   |---|---|
   | `null` | **«Sin configurar»** |
   | `active: true` | **«Activa»** |
   | `active: false` | **«Desactivada»** |

4. Trigger con nombre accesible único por tarjeta: `aria-label={`Configuración de ${account.name}`}` (p. ej. «Configuración de Cuenta de Miembro A»), icono ⋮ sin texto visible, tamaño de objetivo ≥ 44 px (`h-11 w-11`).

**Rationale**: la página ya es dinámica y server-side; hidratar el estado en el render inicial evita parpadeo de estado y una frontera de lectura nueva. El `Record` por id mantiene el grid desacoplado de cómo se leyeron las configs.

**Alternativas consideradas**:

- *Endpoint/fetch client-side para leer configs*: rechazado; nueva frontera HTTP sin consumidor que la exija (YAGNI, I), loading states y estado inicial «Sin configurar» falso.
- *Puerto nuevo «leer todas las configs»*: rechazado; con 3 cuentas son 2 SELECT por id único (YAGNI, I).
- *Leer desde la Server Action*: rechazado; las actions de este repo son envíos de formulario con estado, no consultas (la excepción de ADR 0015 es para creación inline con `useTransition`, no para hidratar una página).

## §4. Diálogo reutilizado, muerte del panel y sincronización de estado

**Estado actual (verificado)**: `regular-income-panel.tsx` (255 líneas) contiene tres piezas: el panel visual (3 estados, con botón directo «Desactivar» vía `PanelDeactivateForm`), y el diálogo `RegularIncomeConfigDialog` (campos, validaciones, intents `save`/`deactivate`, toasts, cierre) — este último autocontenido y sin dependencia del panel salvo props. La action `configureRegularIncome` ya hace `revalidatePath("/", "layout")`.

**Decisión**:

1. **Extraer** `RegularIncomeConfigDialog` a `src/infrastructure/primary/ui/regular-income-config-dialog.tsx` **sin cambios funcionales** (mismos props `accountId`/`memberName`/`config`/`onClose`, mismo montaje condicional del padre, misma instancia fresca de `useActionState` por apertura — patrón 014/018).
2. **Borrar** `regular-income-panel.tsx` (y su suite) con el panel: la página de cuenta queda en movimientos+cierre+balance (FR-004). La **desactivación directa** del panel desaparece: su única vía pasa a ser el botón submit «Desactivar» del diálogo (escenario 3 de la spec: «puedo editar o desactivar» desde el diálogo, mismos efectos y mensajes de 018; el intent `deactivate` ya valida solo `accountId`).
3. El menú de la tarjeta abre el diálogo: `DropdownMenuItem onSelect` cierra el menú (comportamiento Radix) y monta `{configOpen ? <RegularIncomeConfigDialog …/> : null}` dentro del `li` de la tarjeta.
4. **Sincronización del estado del ítem** (escenario 7, edge «estado recién cambiado»): al guardar/desactivar, la action revalida `("/", "layout")` → el re-render RSC de `/` refresca `regularIncomes` → al reabrir el menú el ítem muestra el estado nuevo sin recarga manual (SC-002). Diálogo con errores de validación: permanece abierto con valores conservados (018 intacto); el menú lanzador ya está cerrado (edge de la spec).

**Rationale**: reutilizar el diálogo archivo a archivo es la garantía de FR-002 («el mismo diálogo»); extraerlo a fichero propio evita arrastrar el panel muerto y da suite propia. Respecto de la convención «Diálogos por fila» (AGENTS.md): existe porque una fila puede desaparecer tras `revalidatePath` perdiendo el estado de `useActionState`; las **tarjetas de cuenta son catálogo estable** (no desaparecen de `/` al guardar configuración), de modo que montar el diálogo por tarjeta es seguro — desviación consciente que se documenta como convención propia (§7).

**Alternativas consideradas**:

- *Diálogo montado a nivel de grid con DTO en estado*: viable pero innecesario; añade estado ascendente y keys para un catálogo que no muta su lista (YAGNI).
- *Conservar el panel y añadir además el menú*: rechazado; la spec decide la desaparición completa del panel (decisión del propietario).
- *Desactivación como segundo ítem del menú («Desactivar ingreso»)*: rechazado; bifurca el contrato de intents de 018 y saca la acción confirmable del contexto del formulario (FR-002 pide el mismo diálogo, no un atajo nuevo).

## §5. Página de cuenta sin panel; materialización intacta

**Estado actual (verificado)**: `src/app/accounts/[accountId]/page.tsx` renderiza `RegularIncomePanel` para cuentas personales y lee `GetRegularIncome` en el `Promise.all`; `MaterializeRegularIncomes.ensureForAccountAndMonth` corre **antes** del `Promise.all` (único disparador, ADR 0016). `e2e/pagina-cuenta.spec.ts` no referencia el panel (verificado); solo `ingresos-regulares.spec.ts` lo usa.

**Decisión**: quitar el render del panel, su import y la lectura de `GetRegularIncome` del `Promise.all` (queda sin consumidor en esa página). `MaterializeRegularIncomes` y su posición (antes de leer) quedan **intactos** (FR-004). `/summary`, `/annual`, dominio, aplicación, action, repositorio, BD y seed: intactos (FR-005).

**Alternativas consideradas**: ninguna razonable; mantener la lectura de `GetRegularIncome` sin consumidor sería código muerto.

## §6. Pruebas: cobertura por capa y enmiendas e2e con aislamiento conservado

**Estado actual (verificado)**: Vitest `test.projects` (node: dominio/aplicación/db/actions; ui: jsdom) con suites co-localizadas; no existe suite unitaria de páginas (adaptadores finos cubiertos por e2e). Suites existentes de action y dominio/aplicación de 018 no dependen de la UI. e2e con `workers: 1` (orden alfabético) sobre `e2e.sqlite`; combinaciones verificadas en 018 research §7: `ingresos-regulares` usa Cuenta de Miembro A + mes en curso dinámico y limpia al final (borrado del movimiento + desactivación); `panel-cuentas` N1 aserta «lanzador puro».

**Decisión**:

1. **Componente `account-card-grid.test.tsx`** (ampliada): menú ausente en la cuenta común y presente en las personales; trigger con nombre accesible único («Configuración de Cuenta de Miembro A/B»); ítem «Ingreso regular» con literal de estado según `regularIncomes` (3 casos de la derivación); selección del ítem abre el diálogo «Ingreso regular» (y el menú ya no está abierto); el botón del menú **no** está dentro del `<a>` (invariante estructural del patrón stretched-link); hrefs y nombres accesibles de los 3 links intactos; sigue sin pintar `€`. En jsdm, la interacción con DropdownMenu de Radix se realiza con `userEvent` (mismo entorno que las suites de diálogos Radix existentes); si un escenario de apertura resultara frágil en jsdom, se degrada a assert de render+derivación y la interacción real queda cubierta por e2e (riesgo acotado, no bloqueante).
2. **Diálogo `regular-income-config-dialog.test.tsx`** (NUEVA, adaptada de la suite del panel): se conservan íntegros los casos de diálogo (vacío/precargado, guardado con toast y cierre, errores por campo con valores conservados, pending, intents `save`/`deactivate`); caen los casos del panel visual y de `PanelDeactivateForm`.
3. **Action `configure-regular-income.action.test.ts`, dominio y aplicación**: intactas y en verde (FR-005/FR-008: nada cambia bajo la UI).
4. **e2e `panel-cuentas.spec.ts` (N1 enmendado, FR-006)**: «lanzador puro» pasa a «tarjeta + ⋮ en personales»: 3 links con nombres intactos, botones «Configuración de Cuenta de Miembro A/B» visibles, «Configuración de Cuenta común» ausente, sin `€`/combobox/«Registrar»/regiones de mes (resto de tests N2–N5 intactos).
5. **e2e `ingresos-regulares.spec.ts` (re-rutado, FR-006/FR-008)**: R1 parte de `/`: abrir ⋮ de A → ítem «Ingreso regular Sin configurar» → diálogo vacío → 2.000 € día 1 → Guardar → toast → navegar a la cuenta → ingreso materializado exactamente 1; R2 (agregados sin duplicados) intacto; R3 edita desde el menú de `/` y verifica que el ítem reabre con «Activa»; R4 (borrado definitivo) intacto; R5 desactiva desde el diálogo (botón «Desactivar» con config activa) y verifica el ítem «Desactivada» + ausencia de `regular-income-panel` en la página de cuenta. **Combinación cuenta/mes (A + mes en curso) y limpieza final natural se conservan**; el orden alfabético efectivo y las combinaciones del resto de specs verificados en 018 research §7 siguen válidos (ninguna otra spec toca `/` ni el ingreso de A).
6. **Gates**: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` en verde (SC-004).

**Alternativas consideradas**: *spec e2e nueva para el menú y dejar `ingresos-regulares` como estaba* — imposible: su flujo parte del panel que desaparece; *cambiar la combinación de cuenta/mes de `ingresos-regulares`* — rechazado: rompería el aislamiento verificado contra `registro-movimientos` (A + mes actual con balances exactos).

## §7. Documentación viva y roadmap

**Verificado**: el roadmap maestro no tiene fila 020; `overview.md` y `diagrams/panel-cuentas-sequence.md` describen la landing como lanzadera pura y la configuración vive en la página de cuenta; AGENTS.md recoge la convención «diálogos por fila» pero nada sobre menús de configuración.

**Decisión** (en la implementación, DoD): roadmap (FR-007): fila `020-menu-configuracion-cuenta` Completada + nota de que **el menú ⋮ de la tarjeta es el hogar de las opciones de cuenta** (019-aportacion-comun añadirá ahí su entrada). `docs/architecture/overview.md`: la configuración del ingreso regular pasa a accesible desde la tarjeta en `/`; página de cuenta = movimientos+cierre+balance. `diagrams/panel-cuentas-sequence.md`: extender con la variante «abrir configuración desde la tarjeta» (reutilizando el diagrama de secuencia de este plan). `AGENTS.md`: convención nueva «tarjetas lanzaderas con menú de configuración» (patrón stretched-link con HTML válido; menú solo donde hay opciones; diálogos por tarjeta seguros porque el catálogo es estable — contraste y excepción consciente de «diálogos por fila»). **ADR: no procede** — es un patrón de UI, no una decisión arquitectónica; ADR 0005 ya cubre shadcn copiado/versionado.

**Alternativas consideradas**: *ADR del menú*: rechazada; el registro ADR queda para decisiones de arquitectura/infraestructura (constitución III DoD), y la convención UI vive en AGENTS.md como las demás.

## Resumen de decisiones

| Tema | Decisión | Alternativa rechazada |
|------|----------|----------------------|
| §1 Menú | `dropdown-menu.tsx` shadcn copiado/versionado sobre `radix-ui` existente; trigger ⋮ (`EllipsisVerticalIcon`) | Menú propio; Popover; nativos; otra librería |
| §2 Tarjeta | Patrón stretched-link (`div.relative` + `Link` con `after:inset-0` + trigger `z-10`); menú en portal | Button dentro de `<a>`; onClick router.push; enlace parcial |
| §3 Estado en `/` | `GetRegularIncome` por cuenta personal en `page.tsx`; prop `regularIncomes: Record<number, RegularIncomeDTO \| null>`; derivación pura «Sin configurar/Activa/Desactivada»; trigger `aria-label="Configuración de {nombre}"` | Endpoint cliente; puerto nuevo; leer desde action |
| §4 Diálogo | `RegularIncomeConfigDialog` extraído a fichero propio sin cambios; panel borrado; desactivar solo desde el diálogo; montaje condicional por tarjeta (catálogo estable); `revalidatePath("/", "layout")` sincroniza el ítem | Diálogo a nivel de grid; conservar panel; ítem «desactivar» en el menú |
| §5 Página cuenta | Sin panel y sin lectura de `GetRegularIncome`; `MaterializeRegularIncomes` intacto antes del `Promise.all` | Mantener lectura muerta |
| §6 Pruebas | Grid ampliada + diálogo adaptada + action/dominio intactas; e2e N1 enmendado y `ingresos-regulares` re-rutado conservando combinación A+mes en curso y limpieza final | Spec e2e nueva; cambiar combinación |
| §7 Documentación | Fila 020 + nota «hogar de opciones»; overview + diagrama panel-cuentas; convención AGENTS.md; sin ADR | ADR para patrón UI |
