---
description: "Task list for feature 018 implementation"
---

# Tasks: Ingresos mensuales regulares por miembro

**Input**: Design documents from `/specs/018-ingresos-regulares/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-008 los exige explícitamente (unidad dominio/aplicación/repositorio, action, componentes y e2e del flujo crítico; constitución III). En rojo primero donde la feature añade comportamiento nuevo (`RegularIncome`, `calendar`, los cuatro casos de uso, `DrizzleRegularIncomeRepository`, action `configureRegularIncome`, panel); las suites nuevas se escriben contra los contratos congelados de data-model/ui-contract.

**Organization**: Una única user story pequeña (US1, P1 — constitución II, sin excepción): configurar una vez el ingreso regular y verlo materializado al consultar el mes en la página de la cuenta. El cambio baja por las capas en la dirección de dependencias (VII): entidad + helper calendario puros en dominio → cuatro casos de uso + puerto en aplicación → repositorio Drizzle (dos tablas nuevas, migración aditiva) → Server Action → panel UI + enganche en la página de cuenta → e2e. **`movements`, `accounts`, seed y formularios de movimiento (013/014) intactos** (FR-003); `/summary` y `/annual` no materializan (decisión del propietario 2026-10-12).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js (App Router): `src/` en la raíz del repositorio; e2e en `e2e/`; docs vivos en `docs/architecture/`; roadmap maestro en `specs/001-family-wallet/spec.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar línea base verde y la rama feature antes de tocar código.

- [ ] T001 Verificar línea base verde ejecutando `npm run lint && npm run typecheck && npm run test` (todo debe pasar antes de cualquier cambio)
- [ ] T002 Confirmar la rama `feature/018-ingresos-regulares` activa y el árbol limpio (creada por la extensión git de Spec Kit; worktree actualizado si se usa)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la fase fundacional.

---

## Phase 2: Foundational (Dominio → Aplicación → Persistencia — bloquea US1)

**Purpose**: Vertical del backend del ingreso regular: entidad `RegularIncome` (con `activatedAtMonth` y clamping de día), helper calendario puro, puerto `RegularIncomeRepository`, cuatro casos de uso (configurar/desactivar/leer/materializar) y repositorio Drizzle con la tabla de registro de meses. Todo aditivo: `movements` y `accounts` intactas, seed intacto.

**Nota**: Conceptualmente estas tareas sirven solo a US1, pero no llevan label de historia: son prerrequisito compartido (backend) de todo lo que viene después (action + UI + página + e2e).

### Tests primero (en rojo)

- [ ] T003 [P] Crear `src/domain/regular-income/RegularIncome.test.ts` (rojo): validaciones de `create`/`update` (importe 0/negativo/no entero vía `Money`, día 0/32/1/29/31, nota vacía tras trim, `activatedAtMonth` mal formado), `dueDateForMonth` con clamping (día 31 → 28/29 en febrero y 30 en abril; día 30 → 28/29 en febrero; día 1 → 01; bisiesto 2028-02 → 29), `update` conserva `active` y `activatedAtMonth`, `deactivate`/`activate(currentMonth)` con reset de activación solo en `activate`; ejecutar y confirmar rojo
- [ ] T004 [P] Crear `src/domain/shared/calendar.test.ts` (rojo): `lastDayOfMonth` para meses de 28 (2026-02), 29 (2028-02 bisiesto), 30 (2026-04/06/09/11) y 31 días, y cruce de año (enero/diciembre); ejecutar y confirmar rojo
- [ ] T005 [P] Crear `src/application/regular-income/ConfigureRegularIncome.test.ts` (rojo) con dobles en memoria de `RegularIncomeRepository`/`AccountRepository`: alta con defaults (día 1, nota «Ingreso regular de {memberName}», `activatedAtMonth = currentMonth`, activa), nota explícita conservada, edición sin reset de `activatedAtMonth`, reactivación de config inactiva resetea a `currentMonth`, cuenta común → `SharedAccountIncomeError`, importe inválido → error de `Money`; ejecutar y confirmar rojo
- [ ] T006 [P] Crear `src/application/regular-income/MaterializeRegularIncomes.test.ts` (rojo) con doble en memoria: primera consulta del mes en curso materializa (`Movement.create` ingreso con `dueDateForMonth`, sin naturaleza ni etiqueta + `registerMaterialization`), consulta repetida no duplica, mes < `activatedAtMonth` nunca, mes > `currentMonth` nunca (futuro), cambio de importe no toca mes ya registrado y aplica al pendiente, tras «borrar» el movimiento (el doble lo simula) no se regenera, config inactiva → no-op, sin config → no-op, día 31 clamp a febrero; ejecutar y confirmar rojo
- [ ] T007 [P] Crear `src/application/regular-income/GetRegularIncome.test.ts` y `src/application/regular-income/DeactivateRegularIncome.test.ts` (rojos, doble en memoria): `GetRegularIncome` devuelve DTO | null; `DeactivateRegularIncome` desactiva conservando valores y `activatedAtMonth`, y sin config → `RegularIncomeNotFoundError`; ejecutar y confirmar rojo

### Dominio y aplicación

- [ ] T008 [P] Crear `src/domain/shared/calendar.ts` con `lastDayOfMonth(month: string): number` (función pura, `new Date(y, m, 0).getDate()` sobre `YYYY-MM`, sin dependencias — el dominio no puede importar `ui/format.ts`, VII; data-model §1.1); verificar T004 en verde
- [ ] T009 [P] Crear `src/domain/regular-income/RegularIncomeId.ts` (branded id entero > 0, patrón `MovementId`) y `src/domain/regular-income/RegularIncomeErrors.ts` (`InvalidRegularIncomeError(field, message)` con fields `"dayOfMonth" | "note" | "activatedAtMonth"`, `SharedAccountIncomeError`, `RegularIncomeNotFoundError`, con los literales congelados de data-model §1.2)
- [ ] T010 Crear `src/domain/regular-income/RegularIncome.ts` (entidad inmutable `Object.freeze`, patrón `Movement`): campos `id/accountId/amount(Money)/dayOfMonth(1-31)/note/active/activatedAtMonth(YYYY-MM)`; factories `create`/`rehydrate` y métodos `update({amount?, dayOfMonth?, note?})` (sin tocar `active`/`activatedAtMonth`), `deactivate()`, `activate(currentMonth)` (reset de activación) y `dueDateForMonth(month)` con clamp a `lastDayOfMonth` (data-model §1.2); verificar T003 en verde
- [ ] T011 Crear `src/application/regular-income/RegularIncomeRepository.ts` (puerto: `findByAccountId`, `save` upsert, `isMaterialized`, `registerMaterialization` transaccional que devuelve `boolean` — data-model §1.4) y `src/application/regular-income/dto.ts` (`RegularIncomeDTO`: accountId, amountCents, dayOfMonth, note, active, activatedAtMonth — data-model §4)
- [ ] T012 Crear `src/application/regular-income/ConfigureRegularIncome.ts`: resolver cuenta vía `AccountRepository.findAll()` (rechaza `type === "shared"` con `SharedAccountIncomeError`, toma `memberName`), nota final `input.note?.trim() || "Ingreso regular de {memberName}"`, si había config `existing.update({...})` + `existing.activate(currentMonth)` solo si estaba inactiva, si no `RegularIncome.create({..., activatedAtMonth: currentMonth})` → `save` → DTO (research §4.1); verificar T005 en verde
- [ ] T013 [P] Crear `src/application/regular-income/GetRegularIncome.ts` (`execute(accountId) → RegularIncomeDTO | null`) y `src/application/regular-income/DeactivateRegularIncome.ts` (`existing.deactivate()` → `save`; sin config → `RegularIncomeNotFoundError`) (research §4.2); verificar T007 en verde
- [ ] T014 Crear `src/application/regular-income/MaterializeRegularIncomes.ts`: `ensureForAccountAndMonth(accountId, month, currentMonth)` — config inexistente o inactiva → no-op; guardas lexicográficas `activatedAtMonth ≤ month ≤ currentMonth` (FR-005); si `isMaterialized(id, month)` es falso → `Movement.create({ accountId, type: "income", date: config.dueDateForMonth(month), note: config.note, amount: config.amount, nature: null, tagId: null })` + `registerMaterialization(config, month, movement)` (research §3, data-model §1.3); verificar T006 en verde

### Persistencia

- [ ] T015 Crear `src/infrastructure/db/schema/regular-incomes.ts` con `regularIncomes` (id PK, `account_id` integer NOT NULL UNIQUE → accounts, amount_cents, day_of_month, note, active 0/1, activated_at_month, created_at, updated_at) y `regularIncomeMonths` (id PK, `regular_income_id` → regular_incomes ON DELETE CASCADE, month text, created_at, `UNIQUE (regular_income_id, month)`) y reexportar ambas en `src/infrastructure/db/schema/index.ts` (data-model §2.1)
- [ ] T016 Generar la migración aditiva `drizzle/0003_*.sql` con drizzle-kit (`npx drizzle-kit generate`) a partir del esquema de T015, revisar el SQL (dos `CREATE TABLE`, FK y unique; cero destructivos) y aplicarla en dev con `npm run db:migrate`
- [ ] T017 Crear `src/infrastructure/db/DrizzleRegularIncomeRepository.test.ts` (rojo, contra `createTestDb` libsql `:memory:` con migraciones): `save` inserta y hace upsert por `account_id` devolviendo entidad con id; `findByAccountId` rehidrata; `isMaterialized` antes/después de registrar; `registerMaterialization` inserta fila + movimiento en una tx (id `coalesce(max(id),0)+1`, patrón `DrizzleMovementRepository.create`) y devuelve `true`; segunda inserción del mismo par → `false` **sin** crear movimiento; el movimiento creado es visible a `DrizzleMovementRepository.listByMonthAndAccount` y a `DrizzleAccountRepository.getBalance`; ejecutar y confirmar rojo
- [ ] T018 Crear `src/infrastructure/db/DrizzleRegularIncomeRepository.ts`: `findByAccountId` (SELECT → `RegularIncome.rehydrate`), `save` (`onConflictDoUpdate` target `account_id` returning), `isMaterialized` (`SELECT 1 ... LIMIT 1`), `registerMaterialization` (tx Drizzle: `INSERT INTO regular_income_months ON CONFLICT DO NOTHING RETURNING id`; solo si devuelve fila, insert del movimiento en la misma tx → `true`) (data-model §2.2); verificar T017 en verde
- [ ] T019 Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (cambio aditivo: las suites existentes no cambian de forma)

**Checkpoint**: Ingreso regular operativa de dominio a BD (`ConfigureRegularIncome`/`MaterializeRegularIncomes` utilizables); `movements` y el resto de la app intactos.

---

## Phase 3: User Story 1 - Configurar el ingreso mensual regular y verlo generado automáticamente (Priority: P1) 🎯 MVP

**Goal**: Panel «Ingreso regular» al final de la página de cuenta personal con diálogo de configuración (`useActionState` + intents `save`/`deactivate`), materialización perezosa antes de leer en `/accounts/[accountId]`, literales congelados del ui-contract, validación Zod en frontera y `revalidatePath("/", "layout")` (FR-001–FR-006, SC-001–SC-004).

**Independent Test**: Quickstart Q1–Q10: configurar 2.000 € (día 1, nota vacía) y ver el ingreso del mes en curso sin alta manual; consultas repetidas y `/summary`//`annual` sin duplicados; cambio de importe solo-adelante; edición/borrado del generado como movimiento corriente (borrar no regenera); desactivar/reactivar; validación con mensajes exactos; cuenta común sin panel; sin retroactivo ni futuro.

### Tests para US1 (primero, en rojo)

- [ ] T020 [P] [US1] Crear `src/infrastructure/primary/actions/configure-regular-income.action.test.ts` (rojo, mockeando casos de uso con `vi.mock`/`vi.hoisted` como las actions de movimiento): Zod con mensajes exactos (importe vacío «El importe es obligatorio.», formato «Introduce un importe válido (ej. 2000,00).», cero «El importe debe ser mayor que cero.», día «El día del mes debe estar entre 1 y 31.», día vacío → default 1), `intent="deactivate"` valida solo accountId y delega en `DeactivateRegularIncome`, éxito save/deactivate → `{ status: "success" }` con su mensaje y `revalidatePath("/", "layout")` llamada (mock), errores de dominio mapeados por campo (`InvalidMoneyError` → amount, `InvalidRegularIncomeError` → su campo, resto → `_form` con mensaje genérico «No se ha podido guardar el ingreso regular. Inténtalo de nuevo.») y `values` conservados; ejecutar y confirmar rojo
- [ ] T021 [P] [US1] Crear `src/infrastructure/primary/ui/regular-income-panel.test.tsx` (rojo): tres estados del panel (sin config CTA «Configurar ingreso», activa con resumen `{importe} el día {día} de cada mes` + nota + «Activa» + Editar/Desactivar, inactiva «Ingreso regular desactivado.» + Editar), diálogo vacío/precargado según estado, guardado con éxito (toast «Ingreso regular guardado», cierre), errores `role="alert"` por campo con valores conservados y diálogo abierto, «Guardando…» y disabled en `isPending`, «Desactivar» del panel sin abrir diálogo con toast «Ingreso regular desactivado», foco inicial en «Importe (€)»; ejecutar y confirmar rojo

### Frontera (Server Action) y UI

- [ ] T022 [US1] Crear `src/infrastructure/primary/actions/configure-regular-income.action.ts`: `regularIncomeFormSchema` (Zod, reutiliza `parseAmountToCents` de `movement-form.schema.ts`; rama propia para `intent="deactivate"` que valida solo `accountId`), `ConfigureRegularIncomeState` unión discriminada (idle/success/error con `errors` por campo + `values`), delegación en `ConfigureRegularIncome`/`DeactivateRegularIncome`, mapeo de errores de data-model §3 (nunca lanzar al cliente) y `revalidatePath("/", "layout")` en éxito (data-model §4, ui-contract §5); verificar T020 en verde
- [ ] T023 [US1] Crear `src/infrastructure/primary/ui/regular-income-panel.tsx` (client): `section aria-labelledby` «Ingreso regular» (`data-testid="regular-income-panel"`) con los tres estados del ui-contract §2; diálogo Radix con formulario `useActionState(configureRegularIncome)` — campos «Importe (€)» (formato ES, mismo parseo que movimiento), «Día del mes» (1–31, default 1), «Nota» (opcional, placeholder «Ingreso regular de {miembro}») —; botones submit `name="intent"` («Guardar»/`save`, «Desactivar»/`deactivate` secundario solo con config activa), «Cancelar»/Escape/overlay cierran sin guardar, `isPending` deshabilita todo con «Guardando…», errores `role="alert"` + `aria-describedby`, foco al abrir en Importe, toasts sonner de éxito; «Desactivar» del panel actúa directo sin abrir el diálogo (ui-contract §2/§3/§7); verificar T021 en verde
- [ ] T024 [US1] Modificar `src/app/accounts/[accountId]/page.tsx`: instanciar `MaterializeRegularIncomes` y llamar `ensureForAccountAndMonth(accountId, month, currentMonth())` **antes del `Promise.all`** (cubre listado, cierre y balance del mismo render; `currentMonth` de `ui/format.ts` como parámetro del adaptador), y renderizar `RegularIncomePanel` (con `GetRegularIncome` → DTO) **solo en cuentas personales** (`account.type === "personal"`), al final de la página debajo del cierre; `/summary` y `/annual` quedan intactos (plan §Project Structure, research §3/§6)
- [ ] T025 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (SC-005 parcial)

**Checkpoint**: US1 funcional: configurar desde la página de la cuenta y ver el ingreso del mes materializado exactamente una vez; suites unitarias y de componentes en verde.

---

## Phase 4: E2E del flujo crítico (FR-008, constitución III)

**Purpose**: Spec nueva en fichero propio con combinación cuenta/mes exclusiva (Cuenta de Miembro A + **mes en curso real dinámico**, calculado como en `panel-cuentas`; limpieza final natural por los escenarios de borrado+desactivación — research §7.6). Las 8 specs existentes quedan intactas.

- [ ] T026 [US1] Crear `e2e/ingresos-regulares.spec.ts` (Cuenta de Miembro A, mes en curso dinámico): configurar 2.000 € día 1 → el listado muestra el ingreso sin alta manual (escenario 1, SC-001); reconsultar desde `/summary?month={mes}` y `/annual?year={año}` + recarga de la cuenta → exactamente 1, sin duplicados (escenario 2, SC-002); editar config a 2.100 € → el mes conserva 2.000 € (escenario 3); borrar el movimiento generado → no reaparece al reconsultar (escenario 5); desactivar → panel en estado inactivo y sin generación posterior (escenario 6) — los dos últimos pasos dejan la BD como estaba (limpieza natural, research §7)
- [ ] T027 [US1] Ejecutar `npm run test:e2e` y verificar las 9 specs en verde (las 8 existentes sin cambios esperados — ajustar solo si un literal afectado lo exige)

**Checkpoint**: Flujo crítico «configurar → consultar mes → ver ingreso sin duplicados → borrar no regenera → desactivar» cubierto end-to-end (SC-005).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva, ADR y roadmap maestro actualizados en el mismo cambio (constitución III DoD, research §8, FR-007).

- [ ] T028 [P] Crear `docs/architecture/adr/0016-materializacion-perezosa-ingresos-regulares.md`: pereza al consultar en serverless sin cron, registro de meses (`regular_income_months`) como fuente de idempotencia/borrado-definitivo/solo-adelante, `movements` intacta, enganche solo en la página de cuenta (`/summary` y `/annual` no materializan: decisión del propietario 2026-10-12, iteración futura aditiva), `currentMonth` como parámetro del adaptador (research §2/§3/§8)
- [ ] T029 [P] Actualizar `docs/architecture/diagrams/domain-model.md`: `RegularIncome`, helper `calendar` y puerto/casos de uso nuevos (base: data-model §1.5)
- [ ] T030 [P] Crear `docs/architecture/diagrams/ingreso-regular-secuencia.md`: secuencia del happy path «configurar → consultar mes → ingreso materializado» (base: plan.md §Diagramas de diseño)
- [ ] T031 [P] Actualizar `docs/architecture/overview.md`: módulo `regular-income` en dominio/aplicación, repositorio Drizzle nuevo y enganche de la página de cuenta
- [ ] T032 Actualizar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-007): fila `018-ingresos-regulares` «Completada» + nota de la decisión 2026-10-09 (aportación % a la cuenta común como feature hija futura ~019 sobre el ingreso regular de 018, revive el alcance diferido)
- [ ] T033 Documentar en `AGENTS.md` la convención «materialización perezosa» (la página de cuenta invoca `MaterializeRegularIncomes` antes de leer — los agregados no materializan, decisión 2026-10-12 —; la idempotencia vive en el registro de meses `regular_income_months`, nunca en la existencia del movimiento) (regla de oro 6, research §8)
- [ ] T034 Validar manualmente los escenarios Q1–Q10 de `specs/018-ingresos-regulares/quickstart.md` con `npm run dev` sobre BD migrada y sembrada (`npm run db:migrate && npm run db:seed`)
- [ ] T035 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-005, DoD)

**Checkpoint**: Documentación viva, ADR, roadmap y quickstart sincronizados con la implementación; feature entregada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Depende de Phase 1. **Bloquea US1** (la action, el panel y la página consumen los casos de uso y el repositorio). Dentro de la fase: tests rojos (T003–T007) → dominio (T008–T010) → puerto + aplicación (T011–T014) → persistencia (T015–T018) → gate (T019); la dirección de dependencias es hacia abajo, nunca al revés (constitución VII).
- **US1 (Phase 3)**: Depende de Phase 2 completa. Tests rojos primero (T020–T021) → action (T022) → panel (T023) → página (T024) → gate (T025).
- **E2E (Phase 4)**: Depende de Phase 3 (UI completa operativa).
- **Polish (Phase 5)**: Depende de todas las anteriores (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US1 (P1, única)**: Tras Phase 2. Independientemente testable vía quickstart Q1–Q10 y las suites por capa; el MVP de la feature es la propia US1 completa (Phase 1–4).

### Within Each User Story

- Tests primero y en rojo antes de su SUT (T003–T007 → T008–T018; T020–T021 → T022–T023).
- Dominio (T008–T010) antes del puerto (T011) y de los casos de uso (T012–T014 los consumen); esquema (T015) antes de la migración (T016) y del repositorio (T017–T018).
- Action (T022) antes del panel (T023 la llama); panel (T023) antes de la página (T024 lo monta).
- E2E tras la UI completa; gates acumulativos al final de cada fase.

### Parallel Opportunities

- Phase 2: T003 ∥ T004 ∥ T005 ∥ T006 ∥ T007 (ficheros distintos, en rojo); luego T008 ∥ T009 (ficheros distintos) y T013 tras T012 en paralelo con nada pendiente del mismo fichero.
- Phase 3: T020 ∥ T021 (ficheros distintos, en rojo).
- Phase 5: T028 ∥ T029 ∥ T030 ∥ T031 (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Launch red tests together:
Task: "Create RegularIncome.test.ts (src/domain/regular-income/)"
Task: "Create calendar.test.ts (src/domain/shared/)"
Task: "Create ConfigureRegularIncome.test.ts (src/application/regular-income/)"
Task: "Create MaterializeRegularIncomes.test.ts (src/application/regular-income/)"
Task: "Create GetRegularIncome.test.ts + DeactivateRegularIncome.test.ts"

# Tras el rojo, dominio en paralelo (ficheros distintos):
Task: "Create calendar.ts (lastDayOfMonth)"
Task: "Create RegularIncomeId.ts + RegularIncomeErrors.ts"
# y después la entidad, puerto y casos de uso (secuenciales por dependencia):
Task: "Create RegularIncome.ts"
Task: "Create RegularIncomeRepository.ts (port) + dto.ts"
# en la frontera (secuenciales):
Task: "Create configure-regular-income.action.ts"
Task: "Create regular-income-panel.tsx"
Task: "Modify src/app/accounts/[accountId]/page.tsx (materialize + panel)"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Complete Phase 1: línea base verde
2. Complete Phase 2: backend fundacional (dominio → aplicación → persistencia, aditivo con migración 0003)
3. Complete Phase 3: US1 — panel + action + enganche en la página de cuenta (quickstart Q1–Q10)
4. **STOP and VALIDATE**: `npm run lint && npm run typecheck && npm run test` + validación manual Q1–Q10
5. Complete Phase 4: e2e del flujo crítico (`ingresos-regulares.spec.ts`)
6. Complete Phase 5: ADR 0016, docs vivas, roadmap (FR-007) y gates completos (SC-005)

### Incremental Delivery

- Feature de una sola US (constitución II): el valor de usuario llega con Phase 3. Phase 2 es un checkpoint técnico (config/materialización utilizables solo vía código, sin UI), no un despliegue parcial.

### Parallel Team Strategy

- Para 1 desarrollador (real): estrictamente secuencial por fases. Con varios: tras los tests rojos de Phase 2, dominio/aplicación/persistencia avanzan en ficheros distintos; T020 ∥ T021 en rojo; docs de Phase 5 en paralelo.

---

## Notes

- [P] tasks = different files, no dependencies
- El negocio vive en dominio/aplicación (`RegularIncome`, guardas de materialización, semántica de activación/reactivación); la página solo orquesta «materializar antes de leer» (único disparador; decisión del propietario 2026-10-12); la UI no decide nada de negocio (captura config, pinta DTO) (constitución VII)
- La idempotencia vive en `regular_income_months` (`UNIQUE (config, mes)` + `ON CONFLICT DO NOTHING` en tx), **nunca** en la existencia del movimiento: así el borrado es definitivo (FR-004) y `movements` queda intacta (FR-003)
- `currentMonth` entra como parámetro calculado por el adaptador (`ui/format.ts`): aplicación pura y tests deterministas, sin puerto Clock (research §3.3)
- La comparación/order de meses `YYYY-MM` es lexicográfica (invariante del formato); sin `monthRange` (YAGNI — la materialización es por mes consultado)
- E2e en fichero propio (Miembro A + mes actual dinámico, con limpieza natural por escenarios 5–6 para no contaminar `registro-movimientos`, que corre después alfabéticamente — research §7); `workers: 1` y aislamiento cuenta/mes por spec intactos
- Seed y `seed-data.ts` intactos: la configuración nace del usuario
- Commit after each task or logical group (Conventional Commits, en español el enunciado cuando aporte claridad)
