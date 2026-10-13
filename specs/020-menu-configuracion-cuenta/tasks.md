# Tasks: Menú de configuración en las tarjetas de cuenta

**Input**: Design documents from `/specs/020-menu-configuracion-cuenta/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contract.md, quickstart.md

**Tests**: Requeridos por la spec (FR-008, constitución III): suites de componente (grid y diálogo) y enmiendas e2e (FR-006). Dominio, aplicación y action quedan intactos (FR-005) — sus suites existentes deben permanecer en verde sin modificarse.

**Organization**: Feature de adaptador UI puro con una única user story (US1). Las tareas siguen el orden de dependencia real para mantener el árbol compilable: primitivo → extracción del diálogo → retiro del panel → grid/page → suites → e2e → docs.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js (App Router): `src/app/`, `src/infrastructure/primary/` (UI + actions), `src/infrastructure/primary/ui/components/ui/` (primitivos shadcn), `e2e/` (Playwright)
- Tests co-localizados junto a su SUT (`*.test.tsx`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

**Sin tareas**: el repo ya existe y la feature añade **cero dependencias nuevas** (el menú usa el monopaquete `radix-ui` ya presente; plan.md «Technical Context»). No hay inicialización que hacer.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T001 [P] Copiar y adaptar el primitivo shadcn `dropdown-menu` (mismo estilo de import desde el monopaquete `radix-ui` que los primitivos existentes, p. ej. `Dialog as DialogPrimitive` en `dialog.tsx`; iconos según el original de lucide-react) en `src/infrastructure/primary/ui/components/ui/dropdown-menu.tsx` — copiado y versionado en el repo (ADR 0005), cero dependencias nuevas (research §1)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Configurar el ingreso regular desde el menú de la tarjeta de mi cuenta (Priority: P1) 🎯 MVP

**Goal**: La entrada a la configuración del ingreso regular pasa del panel inferior de la página de cuenta a un menú ⋮ en la tarjeta de cada cuenta personal de `/`, cuyo ítem muestra su estado y abre el mismo diálogo de 018; la página de cuenta queda libre de configuración (FR-001–FR-005).

**Independent Test**: Abrir el menú ⋮ de una tarjeta personal en `/`: el ítem «Ingreso regular» muestra su estado, abre el diálogo de 018 (vacío o precargado) y, tras guardar o desactivar, el estado del ítem se actualiza al reabrir; la página de la cuenta ya no muestra panel de configuración pero el ingreso del mes consultado sigue materializándose igual (spec.md, Independent Test).

### Implementation for User Story 1

- [x] T002 [P] [US1] Extraer `RegularIncomeConfigDialog` (campos, defaults, validaciones con mensajes exactos, intents `save`/`deactivate`, toasts, `useActionState(configureRegularIncome)`, props `accountId`/`memberName`/`config`/`onClose`) de `src/infrastructure/primary/ui/regular-income-panel.tsx` al nuevo fichero `src/infrastructure/primary/ui/regular-income-config-dialog.tsx`, sin cambios funcionales (FR-002, research §4)
- [x] T003 [P] [US1] Quitar el panel de la página de cuenta en `src/app/accounts/[accountId]/page.tsx`: eliminar import y render de `RegularIncomePanel` y la lectura de `GetRegularIncome` del `Promise.all`; `MaterializeRegularIncomes.ensureForAccountAndMonth` queda intacto antes del `Promise.all` (FR-004, ADR 0016, research §5)
- [x] T004 [US1] Borrar `src/infrastructure/primary/ui/regular-income-panel.tsx` y `src/infrastructure/primary/ui/regular-income-panel.test.tsx` (depende de T002 y T003): la desactivación directa desaparece, su única vía es el botón «Desactivar» del diálogo
- [x] T005 [P] [US1] Crear la suite `src/infrastructure/primary/ui/regular-income-config-dialog.test.tsx` adaptada de la del panel (depende de T002): diálogo vacío/precargado, guardado con toast y cierre, errores por campo con valores conservados, pending, intents `save`/`deactivate`; caen los casos del panel visual y de `PanelDeactivateForm` (research §6.2)
- [x] T006 [US1] Reescribir `src/infrastructure/primary/ui/account-card-grid.tsx` como client component (depende de T001 y T002): props `accounts` + `regularIncomes: Record<number, RegularIncomeDTO | null>` (data-model §1.3); tarjeta con patrón stretched-link (`div.relative` con estilos de tarjeta + `<Link>` que envuelve nombre+etiqueta estirado con `after:absolute after:inset-0`); menú ⋮ solo en `type === "personal"` (trigger `button` con `aria-label={`Configuración de ${account.name}`}`, `EllipsisVerticalIcon`, objetivo ≥ 44 px, `relative z-10`); único ítem «Ingreso regular» con estado derivado de la función pura exportada `regularIncomeMenuStatus(config)` («Sin configurar»/«Activa»/«Desactivada»); montaje condicional del diálogo por tarjeta `{configOpen ? <RegularIncomeConfigDialog …/> : null}` (FR-001/FR-003, research §2–§4, ui-contract §1–§2)
- [x] T007 [US1] Actualizar `src/app/page.tsx` (depende de T006): ejecutar `GetRegularIncome` por cada cuenta personal (en paralelo con `ListAccounts`) y pasar el prop serializable `regularIncomes` a `AccountCardGrid` (research §3)
- [x] T008 [P] [US1] Ampliar la suite `src/infrastructure/primary/ui/account-card-grid.test.tsx` (depende de T006): menú ausente en la cuenta común y presente en las personales; triggers con nombre accesible único; literal del ítem según los 3 casos de `regularIncomeMenuStatus`; la selección del ítem abre el diálogo «Ingreso regular»; el botón del menú NO está dentro del `<a>` (invariante stretched-link); 3 links con nombre accesible `{nombre}\n{etiqueta}` intactos; sigue sin pintar `€` (research §6.1, ui-contract §5)
- [x] T009 [P] [US1] Enmendar `e2e/panel-cuentas.spec.ts` (depende de T007): N1 pasa de «lanzador puro» a «tarjeta lanzadora + ⋮ en personales» (3 links con nombres intactos, botones «Configuración de Cuenta de Miembro A/B» visibles, «Configuración de Cuenta común» ausente, sin `€`/combobox/«Registrar»/regiones de mes); N2–N5 intactos (FR-006, research §6.4)
- [x] T010 [P] [US1] Enmendar `e2e/ingresos-regulares.spec.ts` (depende de T007): flujo re-rutado desde el menú de la tarjeta en `/` — R1 parte de ⋮ de la Cuenta de Miembro A → ítem con estado → diálogo → guardar → navegar → ingreso materializado exactamente 1; R3 edita desde el menú y verifica el ítem reabierto con «Activa»; R5 desactiva vía botón «Desactivar» del diálogo y verifica ítem «Desactivada» + `data-testid="regular-income-panel"` ausente; R2/R4 intactos; **conservar la combinación Cuenta de Miembro A + mes en curso y la limpieza final** (FR-006/FR-008, research §6.5)

**Checkpoint**: US1 completa — el menú de la tarjeta es la única entrada a la configuración, la página de cuenta queda en movimientos+cierre+balance y el flujo e2e reubicado pasa

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva, roadmap y gates (DoD constitución III)

- [x] T011 [P] Actualizar `docs/architecture/overview.md`: la configuración del ingreso regular es accesible desde el menú ⋮ de la tarjeta en `/`; la página de cuenta queda en movimientos + cierre + balance (research §7)
- [x] T012 [P] Extender `docs/architecture/diagrams/panel-cuentas-sequence.md` con la variante «configurar desde la tarjeta», reutilizando como base el diagrama de secuencia de `specs/020-menu-configuracion-cuenta/plan.md` (research §7)
- [x] T013 [P] Añadir la convención «tarjetas lanzaderas con menú de configuración» a `AGENTS.md` (sección Convenciones): patrón stretched-link con HTML válido, menú solo donde hay opciones aplicables, y diálogo por tarjeta seguro porque el catálogo de cuentas es estable — excepción consciente y documentada de «diálogos por fila» (research §4/§7)
- [x] T014 [P] Actualizar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-007): fila `020-menu-configuracion-cuenta` Completada + nota de que el menú ⋮ de la tarjeta es el hogar de las opciones de cuenta (019-aportacion-comun añadirá ahí su entrada)
- [x] T015 Gates y validación manual (depende de todas): `npm run lint && npm run typecheck && npm run test && npm run test:e2e` en verde (SC-004) — incluye suites intactas de action/dominio/aplicación de 018 — y recorrer los escenarios Q1–Q8 de `specs/020-menu-configuracion-cuenta/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin tareas (repo existente, cero dependencias nuevas)
- **Foundational (Phase 2)**: T001 — bloquea el trabajo del menú (T006)
- **User Story 1 (Phase 3)**: Depende de T001; el resto son tareas de la propia historia
- **Polish (Phase 4)**: T011–T014 dependen de que la implementación esté completa; T015 depende de todas

### User Story Dependencies

- **User Story 1 (P1)**: Única historia de la feature — sin dependencias entre historias

### Within User Story 1 (grafo real)

```text
T001 (primitivo dropdown-menu)
  └─→ T006 (grid client + menú + stretched-link) ─→ T007 (page.tsx regularIncomes)
                                                        ├─→ T009 (e2e panel-cuentas)
                                                        └─→ T010 (e2e ingresos-regulares)
T002 (extraer diálogo) ─┬─→ T004 (borrar panel + suite; también depende de T003)
                        ├─→ T005 (suite del diálogo)
                        └─→ T006
T003 (página sin panel) ─→ T004
T006 ─→ T008 (suite del grid)
```

- El orden mantiene el árbol compilable: el panel se borra (T004) solo cuando el diálogo ya vive en su fichero (T002) y la página de cuenta ya no lo importa (T003)
- `page.tsx` (T007) se actualiza tras el grid (T006) para que el prop `regularIncomes` exista y typecheck quede en verde

### Parallel Opportunities

- T002 ∥ T003 (ficheros distintos, sin dependencia mutua) — tras T002: T004/T005 pueden intercalarse
- T005 ∥ T007 (suite del diálogo ∥ page.tsx, ficheros distintos)
- T007 ∥ T008 (page.tsx ∥ suite del grid, ficheros distintos)
- T009 ∥ T010 (specs e2e distintas)
- T011 ∥ T012 ∥ T013 ∥ T014 (docs/roadmap/AGENTS.md, ficheros distintos)

---

## Parallel Example: User Story 1

```bash
# Tras T001, lanzar en paralelo (ficheros distintos):
Task: "T002 [US1] Extraer RegularIncomeConfigDialog en src/infrastructure/primary/ui/regular-income-config-dialog.tsx"
Task: "T003 [US1] Quitar el panel en src/app/accounts/[accountId]/page.tsx"

# Tras T007, lanzar en paralelo:
Task: "T009 [US1] Enmendar e2e/panel-cuentas.spec.ts"
Task: "T010 [US1] Enmendar e2e/ingresos-regulares.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

La feature ES una única historia: el MVP es US1 completa.

1. Complete Phase 2: Foundational (T001 — primitivo del menú)
2. Complete Phase 3: User Story 1 (T002–T010) en el orden del grafo de dependencias
3. **STOP and VALIDATE**: gates (`npm run lint && npm run typecheck && npm run test`) + quickstart Q1–Q8 manual
4. Complete Phase 4: documentación viva + roadmap (T011–T014) y gates finales con e2e (T015)

### Incremental Delivery

1. T001 → primitivo listo (sin impacto en producción)
2. T002–T004 → diálogo extraído, panel retirado, página de cuenta limpia (compilable y verde en cada paso)
3. T006–T008 → menú en la tarjeta con estado y diálogo operativo + suites
4. T009–T010 → e2e del flujo reubicado
5. T011–T015 → docs, roadmap y validación final

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Dominio, aplicación, action, repositorio, BD y materialización quedan INTACTOS (FR-005): cualquier necesidad de tocarlos es una señal de desviación del plan
- Las suites existentes de action/dominio/aplicación de 018 no se modifican: deben pasar tal cual (FR-008)
- Literales congelados en `contracts/ui-contract.md` (§1–§2): no improvisar variantes
- Commit después de cada tarea o grupo lógico (Conventional Commits, en español cuando aporte claridad)
- Stop at any checkpoint to validate story independently
