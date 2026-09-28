# Tasks: Página de Cuenta

**Input**: Design documents from `/specs/011-pagina-cuenta/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/ui-contract.md, quickstart.md, `.specify/memory/constitution.md`

**Tests**: REQUERIDOS en esta feature (constitución, principio III): 5 niveles según plan/research §7 — helpers (`format.ts`), repositorio contra libsql `:memory:` (corte `asOf` inclusive), acciones (doble `revalidatePath`), RTL jsdom de los componentes nuevos (Server Actions mockeadas con `vi.mock`, patrón del repo) y e2e nueva `pagina-cuenta.spec.ts` (las 5 specs previas INTACTAS, SC-004). Tests co-localizados junto al SUT (`*.test.ts` / `*.test.tsx`).

**Organization**: Una única user story (US1, P1). **Sin fases de Setup ni Foundational**: feature de presentación sobre lo existente — sin dependencias, esquema, migraciones ni datos nuevos (FR-009); la US1 comienza directamente. Fases: Puerto de balance + helpers → Componentes UI → Ruta + revalidación → e2e → Polish, conforme a la dependencia hexagonal. `/` queda intacta (FR-007): ni `src/app/page.tsx`, ni `movement-list.tsx`, ni `account-month-selector.tsx` se tocan.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js existente: `src/` (domain, application, app, infrastructure) conforme a [plan.md](./plan.md).
- Tests co-localizados junto a su SUT; e2e en `e2e/`.

---

## Phase 1: User Story 1 - Puerto de balance con corte y helpers de calendario

**Goal**: única ampliación no-UI de la feature: `AccountRepository.getBalance(id, asOf?)` (fecha inclusive, opcional — `/` no cambia) con su implementación Drizzle, y los helpers puros `monthEndIsoDate`/`shiftMonth` que alimentan la página y el selector (research §2/§4).

- [X] T001 [US1] Ampliar el puerto `AccountRepository` en `src/application/account/AccountRepository.ts` con `getBalance(id: AccountId, asOf?: string): Promise<number>` (fecha ISO `YYYY-MM-DD` **inclusive**; `undefined` = histórico total, semántica anterior de `/`) e implementarlo en `src/infrastructure/db/DrizzleAccountRepository.ts` (declaración e implementación en el mismo cambio para mantener el árbol compilando; actualizar dobles de tests que implementen el puerto si el typecheck lo exige): añadir `lte(movements.date, asOf)` a la cláusula `where` existente solo cuando `asOf` está presente; misma agregación `sum` con signo por `type`, `coalesce` 0 y `Money.fromCentsOrZero` (data-model §2.1–§2.2, research §2; sin dominio, sin migraciones — el índice existente `(account_id, date)` cubre `eq + lte`, FR-009)
- [X] T002 [US1] Ampliar `src/infrastructure/db/DrizzleRepositories.test.ts` (libsql `:memory:` + migraciones de `drizzle/`, patrones existentes) con los invariantes de `getBalance` con `asOf` (data-model §2.2): corte **inclusive** (movimiento fechado exactamente el `asOf` computa), movimientos con fecha > `asOf` excluidos, sin `asOf` = histórico total (regresión de 002), y cuenta sin movimientos ≤ `asOf` → `0` (no null, no NaN)
- [X] T003 [P] [US1] Ampliar `src/infrastructure/primary/ui/format.ts` con los helpers puros `monthEndIsoDate(month: string): string` (`2026-04` → `2026-04-30`; febrero bisiesto correcto por construcción con `Date(year, month, 0)`) y `shiftMonth(month: string, delta: number): string` (cruce de año en ambas direcciones), y ampliar `src/infrastructure/primary/ui/format.test.ts` con sus tests co-localizados: mes de 30/31 días, febrero bisiesto y no bisiesto, diciembre→enero y enero→diciembre en ambas direcciones, delta 0 identidad (research §2/§4/§7.1)

**Checkpoint**: puerto con corte verificado contra BD real; helpers de calendario puros en verde. La US ya puede construir su vista encima.

---

## Phase 2: User Story 1 - Componentes de UI (balance con subtítulo, selector ‹ ›, listado agrupado)

**Goal**: los dos componentes cliente nuevos (`MonthStepper`, `GroupedMovementList`) con fila rediseñada, diálogos de 003 al nivel del listado y estado vacío interno, y `AccountBalance` con subtítulo como prop (research §3/§4/§6).

- [X] T004 [P] [US1] Ampliar `AccountBalance` en `src/infrastructure/primary/ui/account-balance.tsx` para aceptar el subtítulo como prop (`subtitle?: string` con default «Histórico completo de la cuenta (ingresos − gastos)» — `/` no cambia ni se toca, FR-007) y crear `src/infrastructure/primary/ui/account-balance.test.tsx` (jsdom + RTL): subtítulo por prop visible, default conservado cuando no llega prop, rojo en balance negativo (ui-contract §2.4)
- [X] T005 [P] [US1] Crear el componente cliente `MonthStepper` en `src/infrastructure/primary/ui/month-stepper.tsx` según contracts/ui-contract.md §4: `MonthStepper({ accountId, month })`; **‹** (`aria-label="Mes anterior"`) siempre activo, navega a `shiftMonth(month, -1)`; **›** (`aria-label="Mes siguiente"`) navega a `shiftMonth(month, +1)` con `disabled={month >= currentMonth()}` (comparación léxica `YYYY-MM`: nunca futuro desde la UI, también en mes futuro alcanzado por URL directa); picker `Select` shadcn con `aria-label="Mes visible"` y opciones acotadas al mes actual — `buildMonthWindow(month, 24).filter((m) => m <= currentMonth())` (o equivalente: truncar la ventana en el mes actual real; el picker nunca ofrece meses futuros, clarificación 2026-09-28) etiquetadas `monthLabel` («Abril de 2026») para salto directo (misma regla que `›`: ningún control navega al futuro; URL directa a mes futuro sigue válida); navegación `router.replace(\`/accounts/${accountId}?month=${next}\`)` dentro de `startTransition` con feedback `opacity-60` en `isPending` (espejo de `month-selector.tsx`/`account-month-selector.tsx`, research §4)
- [X] T006 [US1] Escribir tests de `MonthStepper` en `src/infrastructure/primary/ui/month-stepper.test.tsx` (jsdom + RTL, mock de `useRouter`): ‹ navega a `/accounts/{id}?month=` del mes anterior (cruce de año incluido), › deshabilitado en el mes actual real y en meses futuros alcanzados por URL, › activo navega al mes siguiente, picker «Mes visible» salta al mes elegido **sin ofrecer meses futuros en sus opciones** (ventana truncada en el mes actual real), y la cuenta nunca cambia al navegar (depende de T003 `shiftMonth` y T005)
- [X] T007 [P] [US1] Crear el componente cliente `GroupedMovementList` en `src/infrastructure/primary/ui/grouped-movement-list.tsx` según contracts/ui-contract.md §2 y data-model §1.2: mismos props que `MovementList` (`movements`, `accounts`, `tags`, `currentAccountId`, `currentMonth`); `groupMovementsByDate` como `reduce` puro sobre el orden de `ListMovements` (`date DESC, id DESC`) → grupos `{ date, movements }[]` en orden de aparición (más reciente arriba, interno por registro desc) sin reordenar ni calcular (invariante: aplanar grupos === entrada); cabecera de grupo `<h3><time dateTime={date}>{formatDate(date)}</time></h3>` («5 de abril de 2026»); fila rediseñada: tags en píldoras `rounded-full bg-secondary` como elemento prominente («Sin Clasificar» como cualquier otra), nota en texto pequeño `text-muted-foreground` debajo (`{concepto}` + `" · " + {descripción}` si existe), importe a la derecha con `formatSignedAmountCents` + `tabular-nums` y color semántico (`text-red-600` gasto / `text-emerald-600` ingreso; **sin** texto «Gasto/Ingreso» — el signo +/− es la señal no cromática, research §6), distintivo «Personal»/«Común» SOLO en gastos (píldora pequeña sutil; ingresos sin distintivo); botones ✏️ «Editar {concepto}» / 🗑️ «Eliminar {concepto}» por fila con `data-testid="movement-item"` conservado; `EditMovementDialog`/`DeleteMovementDialog` montados **a nivel del componente listado** con el DTO en estado del cliente (nunca dentro de la fila) y `EmptyState` («Aún no hay movimientos en este mes.») renderizado DENTRO del propio componente, nunca como swap en la página (convención AGENTS.md, FR-004); sección `region` con `aria-labelledby="movement-list-title"` «Movimientos del mes» y `ul` por grupo (rol `listitem` por fila)
- [X] T008 [US1] Escribir tests de `GroupedMovementList` en `src/infrastructure/primary/ui/grouped-movement-list.test.tsx` (jsdom + RTL, Server Actions mockeadas con `vi.mock` — patrón de `movement-list.test.tsx`): grupos por fecha más reciente primero y orden interno por registro (`id DESC`), nota concatenada «concepto · descripción» y concepto solo sin descripción, distintivo de naturaleza solo en gastos, importes con signo +/− (U+2212) y clases de color por tipo, tag «Sin Clasificar» pintada como cualquier otra, diálogos de 003 accesibles al pulsar editar/eliminar desde la fila y estado vacío interno con el listado montado, aplanado de grupos === entrada (invariante de data-model §1.2) (depende de T007)

**Checkpoint**: componentes verificados en jsdom; `movement-list.tsx` y `account-month-selector.tsx` intactos (`/` congelada hasta 012).

---

## Phase 3: User Story 1 - Ruta `/accounts/[accountId]` y revalidación de las acciones

**Goal**: adaptador inbound fino con 404 explícito y mes con fallback, 5 lecturas paralelas y composición de la página según ui-contract §1; las 3 Server Actions revalidan el patrón de la ruta nueva (research §1/§5).

- [X] T009 [US1] Crear la ruta `src/app/accounts/[accountId]/page.tsx` (server, adaptador fino; en Next 16 `params`/`searchParams` son promesas — resolver con `await`): validar `params.accountId` con Zod `/^\d+$/` y resolver la cuenta contra `ListAccounts().execute()` (`accounts.find((a) => a.id === parsed)`) — no parsea **o** no existe → **`notFound()`** (404 explícito, nunca otra cuenta, clarificación 2026-09-27); validar `searchParams.month` con `/^\d{4}-(0[1-9]|1[0-2])$/` con fallback a `currentMonth()` si inválido o ausente; lecturas: cuentas (misma query sirve resolución y selector del diálogo de edición), `ListMovements(accountId, month)`, `accountRepository.getBalance(AccountId(id), monthEndIsoDate(month))` (acumulado a fin de mes, FR-006), `GetMonthlyClosure` y `ListActiveTags`; render según ui-contract §1.2: nav existente («Resumen global» → `/summary?month={month}`, «Cuenta de resultados» → `/annual?year={año}`), h1 `{nombre de cuenta}` + subtítulo («Cuenta personal de {miembro}» / «Cuenta común»), `MonthStepper`, `AccountBalance` con subtítulo «Acumulado hasta {monthYearLabel(month)}», `MovementForm` embebido (FR-008), `MonthlyClosurePanel` (005 intacto) y `GroupedMovementList`; **sin selector de cuenta** (la identidad es la URL, ui-contract §1.3); columna única `max-w-4xl` como `/` (depende de T001, T003, T004, T005, T007)
- [X] T010 [P] [US1] Ampliar las Server Actions en `src/infrastructure/primary/actions/create-movement.action.ts`, `src/infrastructure/primary/actions/update-movement.action.ts` y `src/infrastructure/primary/actions/delete-movement.action.ts` añadiendo `revalidatePath("/accounts/[accountId]", "page")` junto al `revalidatePath("/")` existente (patrón de ruta dinámica + `type: "page"` invalida todas las páginas de cuenta tras alta/edición/eliminación sin resolver el id, research §5), y ampliar sus tests co-localizados `create-movement.action.test.ts`, `update-movement.action.test.ts` y `delete-movement.action.test.ts` esperando AMBAS llamadas en los caminos de éxito

**Checkpoint**: `npm run dev` → `/accounts/2` abre la página de esa cuenta en el mes actual; alta/edición/eliminación recalculan listado, cierre y balance en la propia vista; `/accounts/999` y `/accounts/abc` → 404.

---

## Phase 4: User Story 1 - E2E

**Goal**: flujo nuevo de punta a punta (navegación de meses con URL, agrupación, 404, fila rediseñada) con aislamiento verificado.

- [X] T011 [US1] Escribir el test e2e `e2e/pagina-cuenta.spec.ts` (specs en serie dentro del fichero, BD `e2e.sqlite`; **aislamiento propio sin colisión: operar SOLO en Cuenta de Miembro B y en abril 2026 (`2026-04`)** — no escribir en Cuenta común ni en cuentas de Miembro A en ningún mes (`registro-movimientos.spec.ts` afirma balances históricos absolutos); abril 2026 en B queda libre y anterior a todos los meses con datos de otras specs → balances con corte deterministas, research §7): registro vía formulario embebido en `/accounts/{B}`; agrupación (dos fechas + dos movimientos el mismo día → grupo más reciente arriba y orden interno por registro); fila rediseñada (tags, nota «concepto · descripción», importe con signo/color, distintivo de naturaleza solo en gastos, sin texto «Gasto/Ingreso»); edición y eliminación desde la fila con recálculo en la propia página; ‹ a marzo 2026 (estado vacío dentro del listado + balance heredado `0,00 €`); › activo desde abril 2026; › deshabilitado en el mes actual real; picker sin meses futuros en sus opciones; URL directa a mes futuro (válida, vacía, › deshabilitado); 404 de `/accounts/999` y `/accounts/abc`; `month` inválido (p. ej. `2026-13`) → fallback a mes actual (depende de T009, T010)

**Checkpoint**: US1 completa — la página de cuenta opera con URL estable (SC-001–SC-004).

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T012 [P] Actualizar la documentación de arquitectura en el mismo cambio reutilizando los diagramas del plan como base: `docs/architecture/overview.md` (ruta `/accounts/[accountId]`, componentes `MonthStepper`/`GroupedMovementList`, parámetro `asOf` del puerto `AccountRepository`, subtítulo de `AccountBalance`) y los diagramas afectados en `docs/architecture/diagrams/` (C4: nueva vista en el contenedor web; fichero de secuencia con el happy path de plan.md §Diagramas); `domain-model.md` NO cambia (sin piezas de dominio nuevas, plan §Diagramas); README/AGENTS.md solo si surge convención nueva
- [X] T013 Ejecutar la verificación manual completa de `specs/011-pagina-cuenta/quickstart.md` (E1–E7 + comprobación inicial + verificaciones adicionales) sobre `npm run dev` con BD migrada y sembrada (E2/E3 verifican balances exactos: anotar los valores previos de la cuenta usada)
- [X] T014 Verificar los gates finales: `npm run lint`, `npm run typecheck`, `npm run test` y `npm run test:e2e` en verde en local — con las 5 specs e2e previas INTACTAS (`registro-movimientos`, `edicion-movimientos`, `cierre-mensual`, `resumen-global`, `cuenta-resultados-anual`, SC-004) — y CI de GitHub Actions en verde tras push

---

## Dependencies & Execution Order

### Phase Dependencies

- **Puerto + helpers (Phase 1)**: sin dependencias — empezar por aquí. T002 depende de T001 (batería del adaptador sobre la firma nueva); T003 es independiente (fichero distinto).
- **Componentes UI (Phase 2)**: T004, T005 y T007 en paralelo (ficheros distintos); T006 tras T003 (`shiftMonth`) y T005; T008 tras T007.
- **Ruta + acciones (Phase 3)**: T009 depende de T001 (`asOf`), T003 (`monthEndIsoDate`), T004, T005 y T007; T010 es paralelo a T009 (ficheros distintos).
- **E2E (Phase 4)**: T011 depende de T009 y T010.
- **Polish (Phase 5)**: T012 tras T009; T013 requiere T011; T014 es siempre el último.

### Within User Story 1

- T001 → T002 (firma antes que su batería); T003 en paralelo.
- Componentes con tests co-localizados: T005 → T006 y T007 → T008 (tests junto a su implementación, criterio del repo).
- T009 integra todo lo anterior; T010 independiente de la ruta pero habilita el recálculo en la vista.
- T011 cierra el flujo de punta a punta; T012–T014 cierran la Definition of Done.

### Parallel Opportunities

- Arranque: T001 (+T002 a continuación) y T003 en paralelo (ficheros distintos).
- UI: T004, T005 y T007 en paralelo; después T006 y T008 en paralelo (tests de módulos distintos).
- Fase 3: T009 y T010 en paralelo.
- Polish: T012 en paralelo con T013 una vez T011 está en verde.

---

## Parallel Example: User Story 1

```bash
# Bloque inicial (en paralelo):
Task: "T003 [P] [US1] Helpers monthEndIsoDate/shiftMonth en src/infrastructure/primary/ui/format.ts + format.test.ts"
# (mientras T001 → T002 avanzan el puerto y su batería)

# Bloque UI (en paralelo por módulo):
Task: "T004 [P] [US1] AccountBalance con subtitle prop + account-balance.test.tsx"
Task: "T005 [P] [US1] MonthStepper en src/infrastructure/primary/ui/month-stepper.tsx"
Task: "T007 [P] [US1] GroupedMovementList en src/infrastructure/primary/ui/grouped-movement-list.tsx"

# Bloque tests UI (en paralelo, tras sus componentes):
Task: "T006 [US1] Tests de MonthStepper en month-stepper.test.tsx"
Task: "T008 [US1] Tests de GroupedMovementList en grouped-movement-list.test.tsx"

# Bloque fase 3 (en paralelo):
Task: "T009 [US1] Ruta src/app/accounts/[accountId]/page.tsx"
Task: "T010 [P] [US1] revalidatePath '/accounts/[accountId]' en las 3 acciones + tests"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Puerto de balance con corte `asOf` + helpers de calendario, verificados (T001–T003).
2. Componentes UI con sus tests co-localizados (T004–T008).
3. Ruta `/accounts/[accountId]` con 404/fallback + revalidación de acciones (T009–T010).
4. **STOP y VALIDAR**: quickstart E1–E7 manualmente + `npm run dev` con `/accounts/2`.
5. E2E nueva con las 5 previas intactas (T011).
6. Polish: docs, verificación manual y gates finales (T012–T014).

### Incremental Delivery

1. Puerto + helpers → balance acumulado obtenible y calendario derivable (reglas baratas protegidas).
2. Componentes → selector ‹ › y listado agrupado verificables en jsdom.
3. Ruta + acciones → página visible y recalculada tras escribir.
4. E2E → flujo de usuario cubierto de punta a punta.
5. Polish → Definition of Done de la constitución (docs en el mismo cambio).

---

## Notes

- [P] tasks = different files, no dependencies
- [US1] label mapea cada tarea a la user story para trazabilidad
- La feature NO crea migraciones, dependencias ni código de dominio (FR-009): `npm run db:migrate`/`db:seed` existentes bastan; único toque no-UI es la firma `asOf` del puerto + Drizzle
- `/` queda intacta (FR-007): no tocar `src/app/page.tsx`, `movement-list.tsx` ni `account-month-selector.tsx`; los e2e previos deben pasar SIN modificaciones (SC-004)
- Commit tras cada tarea o grupo lógico (Conventional Commits, en español si aporta claridad)
- Verificar los checkpoints antes de avanzar de fase
