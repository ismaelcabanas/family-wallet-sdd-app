---
description: "Task list for feature 023 implementation"
---

# Tasks: Porcentaje de ahorro por miembro con apartado mensual

**Input**: Design documents from `/specs/023-porcentaje-ahorro/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-009 los exige explícitamente (unidad dominio/aplicación/repositorio, action, componentes y e2e del flujo crítico; constitución III). En rojo primero donde la feature añade comportamiento nuevo (`SavingsPercentage`, `SavingsAllocation`, los cinco casos de uso, `DrizzleSavingsAllocationRepository`, action `configureSavingsAllocation`, ítem de menú, diálogo y bloque KPIs amendado); las suites nuevas se escriben contra los contratos congelados de data-model/ui-contract.

**Organization**: Una única user story pequeña (US1, P1 — constitución II, sin excepción): configurar una vez el porcentaje de ahorro y ver el importe deducido del disponible al consultar el mes. El cambio baja por las capas en la dirección de dependencias (VII): VO + entidad + errores puros en dominio → cinco casos de uso + puerto en aplicación → repositorio Drizzle (dos tablas nuevas en migración aditiva `0006`, **sin** seed ni INSERT: no hay etiqueta ni catálogo) → Server Action + `savings-form.schema.ts` → ítem «Ahorro» del menú ⋮ + diálogo + lecturas en `/` y tercer materializador + KPIs de 3 métricas en `/accounts/[accountId]` → e2e. **`movements`, `regular_incomes`, `common_contributions`, cierre/resumen/anual/balance, agregados de lectura y la cuenta común intactos** (FR-007); `/summary` y `/annual` no deducen (ADR 0016/0017).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js (App Router): `src/` en la raíz del repositorio; e2e en `e2e/`; docs vivos en `docs/architecture/`; roadmap maestro en `specs/001-family-wallet/spec.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar línea base verde y la rama feature antes de tocar código.

- [X] T001 Verificar línea base verde ejecutando `npm run lint && npm run typecheck && npm run test` (todo debe pasar antes de cualquier cambio)
- [X] T002 Confirmar la rama `feature/023-porcentaje-ahorro` activa y el árbol limpio (creada por la extensión git de Spec Kit; worktree actualizado si se usa)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la fase fundacional.

---

## Phase 2: Foundational (Dominio → Aplicación → Persistencia — bloquea US1)

**Purpose**: Vertical del backend del ahorro: VO `SavingsPercentage` (entero 1–100, sin puntos base, half-up entero propio), entidad `SavingsAllocation` (config por miembro, sin `dueDateForMonth` ni movimiento), 4 errores de dominio, puerto `SavingsAllocationRepository` (con `registerDeduction`/`findDeductedAmount` sobre el registro de meses), cinco casos de uso (configurar/desactivar/leer/materializar deducción/leer KPI del mes) y repositorio Drizzle con `savings_allocations` + `savings_allocation_months` (importe congelado, migración `0006`). Todo aditivo: `movements`, `regular_incomes`, `common_contributions` y `tags` estructuralmente intactas.

**Nota**: Conceptualmente estas tareas sirven solo a US1, pero no llevan label de historia: son prerrequisito compartido (backend) de todo lo que viene después (action + menú/diálogo + páginas + e2e).

### Tests primero (en rojo)

- [X] T003 [P] Crear `src/domain/savings/SavingsPercentage.test.ts` (rojo): `fromPercent` rechaza no enteros (`12.5`), `0`, negativos y `> 100` con `InvalidSavingsAllocationError("percentage", …)`; `percent` accessor; `equals`; tabla half-up congelada de data-model §1.1 (10 % × 300 000 → 30 000; 10 % × 300 005 → 30 001; 33 % × 150 → 50; 10 % × 5 → 1; 1 % × 99 → 1 — .5 hacia arriba); ejecutar y confirmar rojo
- [X] T004 [P] Crear `src/domain/savings/SavingsAllocation.test.ts` (rojo): `create` nace `active: true` con `activatedAtMonth = currentMonth`; `rehydrate` conserva todo (incluido `id`); `update({percentage})` revalida y conserva `active`/`activatedAtMonth`; `deactivate()` conserva `activatedAtMonth`; `activate(currentMonth)` resetea `activatedAtMonth` al mes en curso; porcentaje inválido en `create`/`update` → `InvalidSavingsAllocationError("percentage", …)`; `activatedAtMonth` malformado → `InvalidSavingsAllocationError("activatedAtMonth", …)`; sin método de fecha de materialización (no hay movimiento); ejecutar y confirmar rojo
- [X] T005 [P] Crear `src/application/savings/ConfigureSavingsAllocation.test.ts` (rojo) con dobles en memoria de `SavingsAllocationRepository`/`RegularIncomeRepository`/`AccountRepository`: alta nace activa con `activatedAtMonth = currentMonth`, edición conserva `activatedAtMonth`, reactivación de config inactiva resetea a `currentMonth`, cuenta no encontrada → `AccountNotFoundError`, cuenta común → `SharedAccountSavingsError`, sin ingreso regular (`null`) → `MissingRegularIncomeError`, ingreso con el que el porcentaje redondea a 0 céntimos → `InvalidSavingsAllocationError("percentage", "El porcentaje aplicado a tu ingreso regular debe resultar en al menos 0,01 €.")`; ejecutar y confirmar rojo
- [X] T006 [P] Crear `src/application/savings/MaterializeSavingsAllocations.test.ts` (rojo) con dobles en memoria: primera consulta del mes en curso registra la deducción (`percentage.appliedToCents(income.amountCents)` + `registerDeduction(config, month, amountCents)`), consulta repetida no duplica (`isDeducted`), mes < `activatedAtMonth` nunca (sin retroactivo), mes > `currentMonth` nunca (futuro), cambio de porcentaje o del importe del ingreso no toca mes ya registrado y aplica al pendiente (solo-adelante, importe congelado), sin config o inactiva → no-op, sin ingreso regular o inactivo → **no-op sin registrar el mes** (mes abierto, paridad 019; clarify 2026-10-26), cálculo < 1 céntimo → no-op sin registrar, carrera (`registerDeduction` devuelve `false`) → no-op silencioso, **nunca** toca `MovementRepository` (FR-003); ejecutar y confirmar rojo
- [X] T007 [P] Crear `src/application/savings/DeactivateSavingsAllocation.test.ts`, `src/application/savings/GetSavingsAllocation.test.ts` y `src/application/savings/GetMonthSavings.test.ts` (rojos, doble en memoria): `Deactivate` desactiva conservando `activatedAtMonth`, sin config → `SavingsAllocationNotFoundError`; `GetSavingsAllocation` devuelve `SavingsAllocationDTO | null`; `GetMonthSavings` sin config → `{configured: false, amountCents: 0}`, con config → `{configured: true, amountCents: findDeductedAmount(...) ?? 0}` (lee la fila del registro, nunca recalcula), mes inválido (no `YYYY-MM`) → throw Error (paridad `GetMonthlyClosure`); ejecutar y confirmar rojo

### Dominio y aplicación

- [X] T008 [P] Crear `src/domain/savings/SavingsAllocationId.ts` (branded id entero > 0, patrón `CommonContributionId`) y `src/domain/savings/SavingsAllocationErrors.ts` (`InvalidSavingsAllocationError(field, message)` con fields `"percentage" | "activatedAtMonth"`, `SharedAccountSavingsError` «La cuenta común no puede tener ahorro.», `SavingsAllocationNotFoundError` «No existe ahorro configurado para esta cuenta.», `MissingRegularIncomeError` «Configura primero el ingreso regular de este miembro.» — propia del módulo, sin importar la de 019 —, con los literales congelados de data-model §1.1)
- [X] T009 Crear `src/domain/savings/SavingsPercentage.ts` (VO inmutable `Object.freeze`): `fromPercent` (rechaza no enteros y fuera de `1..100`), `appliedToCents(amountCents) = floor((amountCents × percent + 50) / 100)` — aritmética entera pura, sin flotantes ni `Math.round` (research §2) — y `equals`; verificar T003 en verde
- [X] T010 Crear `src/domain/savings/SavingsAllocation.ts` (entidad inmutable, patrón `CommonContribution` sin `dueDateForMonth`): campos `id/accountId/percentage(SavingsPercentage)/active/activatedAtMonth(YYYY-MM)`; factories `create`/`rehydrate` y métodos `update({percentage})` (sin tocar `active`/`activatedAtMonth`), `deactivate()`, `activate(currentMonth)` (reset de activación) (data-model §1.1); verificar T004 en verde
- [X] T011 Crear `src/application/savings/SavingsAllocationRepository.ts` (puerto: `findByAccountId`, `save` upsert, `isDeducted(allocationId, month)`, `registerDeduction(config, month, amountCents)` en tx que devuelve `boolean`, `findDeductedAmount(allocationId, month)` → `number | null` — data-model §1.2) y `src/application/savings/dto.ts` (`SavingsAllocationDTO`: accountId, percentage, active, activatedAtMonth — data-model §4)
- [X] T012 Crear `src/application/savings/ConfigureSavingsAllocation.ts`: resolver cuenta vía `AccountRepository` (rechaza `type === "shared"` con `SharedAccountSavingsError`), cargar ingreso regular vía `RegularIncomeRepository.findByAccountId` (`null` → `MissingRegularIncomeError`, paridad de existencia —no estado— con `ConfigureCommonContribution`), validar `SavingsPercentage.fromPercent(...)` y `appliedToCents(income.amountCents) ≥ 1` (literal de data-model §1.1); alta `SavingsAllocation.create({..., activatedAtMonth: currentMonth})`, edición `existing.update({percentage})` + `existing.activate(currentMonth)` solo si estaba inactiva → `save` → DTO (data-model §1.2, research §5); verificar T005 en verde
- [X] T013 [P] Crear `src/application/savings/DeactivateSavingsAllocation.ts` (`existing.deactivate()` → `save`; sin config → `SavingsAllocationNotFoundError`) y `src/application/savings/GetSavingsAllocation.ts` (`execute(accountId) → SavingsAllocationDTO | null`); verificar T007 en verde
- [X] T014 Crear `src/application/savings/MaterializeSavingsAllocations.ts`: `ensureForAccountAndMonth(accountId, month, currentMonth)` con las guardas en orden de data-model §1.2.1 (research §3) — config existe, `active`, `id !== null` → no-op; ventana lexicográfica `activatedAtMonth ≤ month ≤ currentMonth` (FR-003); `!isDeducted` (FR-004: fila congelada, ni duplica ni reajusta); ingreso regular existe **y activo** → si no, no-op **sin registrar** (mes abierto); `appliedToCents ≥ 1` → si no, no-op sin registrar; `registerDeduction(config, month, amountCents)` — **sin** re-sync del mes en curso (base plana, diferencia explícita con 021) y sin tocar `movements`; verificar T006 en verde
- [X] T015 Crear `src/application/savings/GetMonthSavings.ts`: `execute(accountId, month) → MonthSavingsDTO {configured: boolean; amountCents: number}` (interfaz junto al caso de uso, data-model §1.2.2), importe = `findDeductedAmount(config.id, month)` de la fila del registro **nunca recálculo** (research §1), mes inválido → throw Error; se invoca tras el materializador y nunca lo dispara; verificar T007 en verde

### Persistencia

- [X] T016 [P] Crear `src/infrastructure/db/schema/savings-allocations.ts` con `savingsAllocations` (id PK, `account_id` integer NOT NULL UNIQUE → accounts, `percentage` integer NOT NULL, `active` 0/1, `activated_at_month` text, `created_at`, `updated_at`) y `savingsAllocationMonths` (id PK, `savings_allocation_id` → savings_allocations ON DELETE CASCADE, `month` text, `amount_cents` integer NOT NULL, `created_at`, `UNIQUE (savings_allocation_id, month)`), reexportar ambas en `src/infrastructure/db/schema/index.ts` (data-model §2.1); **sin** cambios en `seed-data.ts` (no hay etiqueta ni catálogo nuevo, a diferencia de 019)
- [X] T017 Generar la migración aditiva con drizzle-kit (`npx drizzle-kit generate`) a partir del esquema de T016, renombrarla/verificarla como `drizzle/0006_porcentaje-ahorro.sql` (patrón manual de `0002`/`0004`/`0005`; constitución V), revisar el SQL (dos `CREATE TABLE`, FK, índice único; cero destructivos; **sin** INSERT — research §8; `drizzle/meta/_journal.json` consistente) y aplicarla en dev con `npm run db:migrate`
- [X] T018 [P] Crear `src/infrastructure/db/mappers/savings-allocation.mapper.ts` (fila ⇄ entidad, patrón `common-contribution.mapper.ts`; reexportar en `mappers/index.ts`) y `src/infrastructure/db/DrizzleSavingsAllocationRepository.test.ts` (rojo, contra `createTestDb` libsql `:memory:` con migraciones reales): `save` inserta y hace upsert por `account_id` devolviendo entidad con id; `findByAccountId` rehidrata; `isDeducted` antes/después de registrar; `registerDeduction` inserta la fila del registro con `amount_cents` congelado (`INSERT ... ON CONFLICT (savings_allocation_id, month) DO NOTHING RETURNING id`, un solo INSERT en tx — más simple que 019, sin movimiento) y devuelve `true`; segunda inserción del mismo par `(config, mes)` → `false` (perdió la carrera); `findDeductedAmount` devuelve el importe de la fila o `null`; el registro no crea movimiento alguno en `movements`; ejecutar y confirmar rojo
- [X] T019 Crear `src/infrastructure/db/DrizzleSavingsAllocationRepository.ts`: `findByAccountId` (SELECT → `SavingsAllocation.rehydrate` vía mapper), `save` (`onConflictDoUpdate` target `account_id` returning), `isDeducted` (`SELECT 1 ... LIMIT 1`), `registerDeduction` (tx: `INSERT INTO savings_allocation_months ON CONFLICT (savings_allocation_id, month) DO NOTHING RETURNING id` → fila: `true`; sin fila: `false`), `findDeductedAmount` (`select amount_cents` por `(savings_allocation_id, month)`) (data-model §2.2); verificar T018 en verde
- [X] T020 Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (cambio aditivo: las suites existentes no cambian de forma)

**Checkpoint**: Ahorro operativo de dominio a BD (`ConfigureSavingsAllocation`/`MaterializeSavingsAllocations`/`GetMonthSavings` utilizables); `movements`, `regular_incomes`, `common_contributions` y el resto de la app intactos.

---

## Phase 3: User Story 1 - Configurar el porcentaje de ahorro y verlo restado del disponible cada mes (Priority: P1) 🎯 MVP

**Goal**: Ítem «Ahorro» con 4 estados en el menú ⋮ de la tarjeta de cuenta personal (tras «Aportación», patrón 020/019), diálogo «Ahorro mensual» espejo del de aportación con un solo campo «Porcentaje (%)» entero (`useActionState` + intents `save`/`deactivate`), action `configureSavingsAllocation` con Zod de cadenas en frontera y `revalidatePath("/", "layout")`, lectura de configs en `/`, tercer materializador secuencial en `/accounts/[accountId]` tras 018/019 y bloque «KPIs del mes» amendado a 3 métricas (aportación común, ahorro del mes, saldo neto) (FR-001–FR-007, SC-001–SC-004).

**Independent Test**: Quickstart Q1–Q10: sin ingreso regular el ítem queda deshabilitado con «Requiere ingreso regular»; configurar 10 % sobre ingreso de 3.000 € → KPI «Ahorro del mes» 300,00 € y «Saldo del mes» neto (movimientos − 300,00 €) sin ningún movimiento nuevo (el cierre conserva el bruto: difieren exactamente en la deducción); consultas repetidas estables; cambio a 15 % solo-adelante; desactivar/reactivar con reset; validación con mensajes exactos («12,5» rechazado); cuenta común sin menú ni bloque KPIs; sin retroactivo ni futuro; agregados sin cambios.

### Tests para US1 (primero, en rojo)

- [X] T021 [P] [US1] Crear `src/infrastructure/primary/actions/configure-savings-allocation.action.test.ts` (rojo, mockeando casos de uso con `vi.mock`/`vi.hoisted` como las actions existentes): Zod con mensajes exactos de ui-contract §3 (vacío «El porcentaje es obligatorio.», formato «Introduce un porcentaje entero entre 1 y 100 (ej. 10).», cero «El porcentaje debe ser mayor que cero.», > 100 «El porcentaje no puede ser mayor que 100.»), `parseIntegerPercentage("10") = 10`, `("100") = 100`; **«12,5» y «12.5» no matchean el patrón** → error de formato (cadenas, nunca `parseFloat`), `intent="deactivate"` valida solo accountId y delega en `DeactivateSavingsAllocation`, éxito save/deactivate → `{status: "success"}` con «Ahorro guardado»/«Ahorro desactivado» y `revalidatePath("/", "layout")` llamada (mock), errores de dominio mapeados (`InvalidSavingsAllocationError` → `percentage` o su campo, `MissingRegularIncomeError`/`SharedAccountSavingsError`/`SavingsAllocationNotFoundError` → `_form` con sus literales, resto → `_form` «No se ha podido guardar el ahorro. Inténtalo de nuevo.») y `values.percentage` conservado; nada persiste con error de validación; ejecutar y confirmar rojo
- [X] T022 [P] [US1] Crear `src/infrastructure/primary/ui/savings-config-dialog.test.tsx` (rojo, action mockeada): diálogo titulado «Ahorro mensual» vacío sin config y pre-rellenado «10» con config (`String(config.percentage)`, sin `formatBasisPointsForInput`), foco inicial en «Porcentaje (%)», guardado con éxito (toast «Ahorro guardado», cierre), desactivación con toast «Ahorro desactivado» (botón «Desactivar» solo si config existe y activa), errores `role="alert"` por campo con valores conservados y diálogo abierto, «Guardando…» y disabled en `isPending` (anti-doble-envío), «Cancelar»/Escape cierran sin enviar; sin preview de importe; ejecutar y confirmar rojo
- [X] T023 [P] [US1] Ampliar `src/infrastructure/primary/ui/account-card-grid.test.tsx` (rojo): función pura `savingsMenuStatus` devuelve «Requiere ingreso regular»/«Sin configurar»/«Activo»/«Desactivado» según DTOs; el ítem «Ahorro» aparece tercero bajo «Ingreso regular» y «Aportación» solo en cuentas personales con estado a la derecha; con `regularIncome === null` el ítem está deshabilitado y no abre diálogo; con ingreso abre el diálogo dentro de la tarjeta (montaje condicional, instancia fresca); la cuenta común sigue sin menú; ejecutar y confirmar rojo
- [X] T024 [P] [US1] Ampliar `src/infrastructure/primary/ui/account-month-kpis.test.tsx` (rojo): `dl` de 3 celdas en orden congelado «Aportación común» · «Ahorro del mes» · «Saldo del mes»; sin config → ahorro 0,00 € con subtexto «Sin ahorro configurado» y saldo neto = bruto; con ahorro → importe formateado (300,00 €) sin subtexto y neto = bruto − ahorro (props `savings` + `netMonthBalanceCents`); neto negativo en rojo con signo U+2212; mes consultado reflejado en la etiqueta (ui-contract §4); ejecutar y confirmar rojo

### Frontera (Server Action) y UI

- [X] T025 [US1] Crear `src/infrastructure/primary/actions/savings-form.schema.ts`: `INTEGER_PERCENTAGE_PATTERN = /^\d{1,3}$/` + `parseIntegerPercentage` por manipulación de cadenas (nunca `parseFloat`; paridad `contribution-form.schema.ts`), con los mensajes de ui-contract §3
- [X] T026 [US1] Crear `src/infrastructure/primary/actions/configure-savings-allocation.action.ts`: `percentageSchema` (patrón + `parseIntegerPercentage` ∈ [1, 100] con literales de ui-contract §3; rama propia para `intent="deactivate"` que valida solo `accountId` con `z.string().regex(/^\d+$/)`), `ConfigureSavingsAllocationState` unión discriminada (idle/success/error con `errors` por campo + `values`) espejo de la de aportación (ui-contract §5), delegación en `ConfigureSavingsAllocation`/`DeactivateSavingsAllocation` con `currentMonth()` del adaptador, mapeo de errores de dominio a campos (nunca lanzar al cliente) y `revalidatePath("/", "layout")` en éxito; verificar T021 en verde
- [X] T027 [US1] Crear `src/infrastructure/primary/ui/savings-config-dialog.tsx` (client, espejo estructural de `common-contribution-config-dialog.tsx`): título «Ahorro mensual», único campo label «Porcentaje (%)» con `id="savings-percentage"`, `inputMode="numeric"`, placeholder «10» y `defaultValue` vacío o `String(config.percentage)`; foco programado al abrir (`onOpenAutoFocus` + `preventDefault`, guard de éxito único con `useActionState(configureSavingsAllocation)`); botones self-end en orden fijo «Cancelar» (outline, `type="button"`) · «Desactivar» (outline, `name="intent" value="deactivate"`, solo si config existe y activa) · «Guardar» (`name="intent" value="save"`); `isPending` deshabilita todo con «Guardando…»; errores por campo bajo el input (`role="alert"`, `aria-describedby`) y banner `_form`; toasts sonner de éxito; sin preview de importe (ui-contract §2/§3/§7); verificar T022 en verde
- [X] T028 [US1] Modificar `src/infrastructure/primary/ui/account-card-grid.tsx`: exportar la función pura `savingsMenuStatus(savings, regularIncome)` con los 4 literales congelados («Activo»/«Desactivado» en masculino, a diferencia de la aportación — ui-contract §1); prop nueva `savingsAllocations: Record<number, SavingsAllocationDTO | null>`; tercer `DropdownMenuItem` «Ahorro» bajo «Aportación» con estado a la derecha (`ml-auto text-muted-foreground`), deshabilitado (sin diálogo) cuando falta el ingreso regular; montaje condicional de `SavingsConfigDialog` **dentro de la tarjeta** (excepción documentada AGENTS.md, catálogo estable, instancia fresca por apertura); trigger ⋮ y stretched-link intactos (020); verificar T023 en verde
- [X] T029 [US1] Modificar `src/infrastructure/primary/ui/account-month-kpis.tsx` (amenda 022): props `netContribution`, `savings: MonthSavingsDTO`, `netMonthBalanceCents` y `month` (data-model §1.3); `dl` de `grid-cols-2` a `grid grid-cols-3 gap-3` con «Aportación común» (intacta) · «Ahorro del mes» (`formatAmountCents(savings.amountCents)`; subtexto «Sin ahorro configurado» solo con `configured: false`) · «Saldo del mes» (`formatSignedCents(netMonthBalanceCents)`, rojo si negativo; label intacto de 022); sticky y accesibilidad intactos (ui-contract §4/§8); componente sigue siendo server presentacional puro — la resta vive en la página (research §4); verificar T024 en verde
- [X] T030 [US1] Modificar `src/app/page.tsx`: en el mismo bucle serial de cuentas personales, leer además `GetSavingsAllocation.execute(accountId)` por cuenta (instanciando `DrizzleSavingsAllocationRepository`) y pasar `savingsAllocations` como prop a `AccountCardGrid` (research §5); el render de tarjetas sigue sin mostrar importes (020)
- [X] T031 [US1] Modificar `src/app/accounts/[accountId]/page.tsx`: instanciar `MaterializeSavingsAllocations`/`GetMonthSavings` con `DrizzleSavingsAllocationRepository` y llamar `ensureForAccountAndMonth(AccountId(account.id), month, currentMonth())` **inmediatamente después** de `MaterializeCommonContributions` y antes del `Promise.all` (tres awaits secuenciales; mismo render cubre listado, cierre y balance; único disparador, ADR 0016/0017; research §4); añadir `GetMonthSavings` al `Promise.all` para cuentas personales (espejo de `netContribution`) y componer **una única resta** `netMonthBalanceCents = closure.monthBalanceCents − savings.amountCents` pasada a `AccountMonthKpis` junto a `savings` (la UI jamás recalcula); `/summary`, `/annual` y la cuenta común quedan intactos (FR-007)
- [X] T032 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (SC-005 parcial)

**Checkpoint**: US1 funcional: configurar desde el menú ⋮ de la tarjeta y ver el KPI de ahorro con el saldo neto del mes al consultar la cuenta, sin movimientos; suites unitarias y de componentes en verde.

---

## Phase 4: E2E del flujo crítico (FR-009, constitución III)

**Purpose**: Spec nueva en fichero propio con combinación cuenta/mes exclusiva verificada contra la matriz de ocupación (**Cuenta de Miembro B (cuenta 2) + mes en curso real dinámico**; `porcentaje-ahorro` corre entre `panel-cuentas` y `registro-movimientos`, con la cuenta 2 libre al llegar — research §6). La **limpieza total final** es obligatoria para no contaminar a specs posteriores. Las 13 specs existentes quedan intactas (`kpis-fijos-cuenta` sigue verde: aserciones tolerantes y sin ahorro configurado el neto coincide con el bruto).

- [ ] T033 [US1] Crear `e2e/porcentaje-ahorro.spec.ts` (serial, Miembro B + mes en curso, helpers locales `currentMonthIso()` al estilo de 018/019): setup defensivo (desactivar aportación si apareciera activa), A1 dependencia (sin ingreso regular → ítem «Ahorro» deshabilitado con «Requiere ingreso regular»); tras configurar ingreso regular 3.000,00 → «Sin configurar»); A2 configurar 10 % → toast «Ahorro guardado» y en la cuenta: KPI «Ahorro del mes» 300,00 € + «Saldo del mes» neto reducido en 300,00 €, **sin ningún movimiento nuevo** en el listado y cierre con «Saldo del mes» bruto (KPI y cierre difieren exactamente en la deducción; FR-007/edge «Sin doble cómputo»); A3 idempotencia (recargas ×2 y navegación ‹ › → deducción exactamente una vez, importe estable); A4 validación («12,5» rechazado con su mensaje, nada guardado); A5 mes futuro (› desde el mes en curso) sin deducción; A6 limpieza total UI-driven: desactivar ahorro → desactivar ingreso regular → borrar todos los movimientos creados → verificar listado vacío (research §6)
- [ ] T034 [US1] Ejecutar `npm run test:e2e` y verificar las 14 specs en verde (las 13 existentes sin cambios esperados — ajustar solo si un literal afectado lo exige)

**Checkpoint**: Flujo crítico «configurar ingreso regular + porcentaje de ahorro → consultar mes → ver deducción estable y saldo neto, sin movimiento» cubierto end-to-end (SC-005).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva y roadmap maestro actualizados en el mismo cambio (constitución III DoD, FR-008, research §8). **Sin ADR nuevo** (research §8: consecuencia directa de ADR 0016/0017 + decisiones de la spec).

- [ ] T035 [P] Actualizar `docs/architecture/diagrams/`: extender `domain-model.md` con `SavingsAllocation`/`SavingsPercentage`/puerto/5 casos de uso/adaptador (base: data-model §1.4) y la secuencia de la página de cuenta con el tercer materializador y `GetMonthSavings` (base: plan.md §Diagramas de diseño); actualizar `docs/architecture/overview.md` con el módulo nuevo si procede
- [ ] T036 [P] Actualizar `AGENTS.md` (FR-008, research §8): amendar la convención «Bloque KPIs sticky en cuentas personales» a 3 métricas (aportación común · ahorro del mes · saldo neto de ahorro compuesto una única vez en la página) y registrar la convención nueva «apartado informativo con registro de meses con importe congelado, sin movimiento» (variante del patrón de 018/019; sin re-sync del mes en curso)
- [ ] T037 Preparar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-008): marcar la fila `023-porcentaje-ahorro` como Completada y añadir nota datada 2026-10 de la amenda al contrato de 022 (bloque KPIs con ahorro y saldo neto); el «seguimiento del ahorro como tipo de movimiento» sigue diferido (Out of Scope de la spec)
- [ ] T038 Validar manualmente los escenarios Q1–Q10 de `specs/023-porcentaje-ahorro/quickstart.md` con `npm run dev` sobre BD migrada (`npm run db:migrate`; seed sin cambios); dejar el estado limpio al terminar (desactivar ahorro e ingreso, borrar movimientos de prueba)
- [ ] T039 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-005, DoD)

**Checkpoint**: Documentación viva, AGENTS.md, roadmap y quickstart sincronizados con la implementación; feature entregada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Depende de Phase 1. **Bloquea US1** (la action, el menú/diálogo y las páginas consumen los casos de uso y el repositorio). Dentro de la fase: tests rojos (T003–T007) → dominio (T008–T010) → puerto + aplicación (T011–T015) → persistencia (T016–T019) → gate (T020); la dirección de dependencias es hacia abajo, nunca al revés (constitución VII).
- **US1 (Phase 3)**: Depende de Phase 2 completa. Tests rojos primero (T021–T024) → schema frontera (T025) → action (T026) → diálogo (T027) → menú/tarjeta (T028) → KPIs (T029) → `/` (T030) → página de cuenta (T031) → gate (T032).
- **E2E (Phase 4)**: Depende de Phase 3 (UI completa operativa).
- **Polish (Phase 5)**: Depende de todas las anteriores (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US1 (P1, única)**: Tras Phase 2. Independientemente testable vía quickstart Q1–Q10 y las suites por capa; el MVP de la feature es la propia US1 completa (Phase 1–4).

### Within Each User Story

- Tests primero y en rojo antes de su SUT (T003–T007 → T008–T019; T021–T024 → T025–T029).
- Dominio (T008–T010) antes del puerto (T011) y de los casos de uso (T012–T015 los consumen); esquema (T016) antes de la migración (T017) y del repositorio (T018–T019).
- Schema de frontera (T025) antes de la action (T026 lo usa); action (T026) antes del diálogo (T027 la llama); diálogo (T027) antes del grid (T028 lo monta); KPIs (T029) antes de la página de cuenta (T031 le pasa las props); grid (T028) antes de `/` (T030 le pasa las props).
- E2E tras la UI completa; gates acumulativos al final de cada fase.

### Parallel Opportunities

- Phase 2: T003 ∥ T004 ∥ T005 ∥ T006 ∥ T007 (ficheros distintos, en rojo); luego T008 en paralelo con T009 (ficheros distintos; T010 depende de ambos); T013 en paralelo con T012/T014/T015 tras T011 (ficheros distintos); T016 (schema) ∥ T018 (test de repos, rojo) tras T017.
- Phase 3: T021 ∥ T022 ∥ T023 ∥ T024 (ficheros distintos, en rojo).
- Phase 5: T035 ∥ T036 (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Launch red tests together:
Task: "Create SavingsPercentage.test.ts (src/domain/savings/)"
Task: "Create SavingsAllocation.test.ts (src/domain/savings/)"
Task: "Create ConfigureSavingsAllocation.test.ts (src/application/savings/)"
Task: "Create MaterializeSavingsAllocations.test.ts (src/application/savings/)"
Task: "Create DeactivateSavingsAllocation + GetSavingsAllocation + GetMonthSavings tests"

# Tras el rojo, dominio en paralelo (ficheros distintos):
Task: "Create SavingsAllocationId.ts + SavingsAllocationErrors.ts"
Task: "Create SavingsPercentage.ts (entero 1–100 + half-up entero)"
# y después la entidad, puerto y casos de uso (secuenciales por dependencia):
Task: "Create SavingsAllocation.ts"
Task: "Create SavingsAllocationRepository.ts (port) + dto.ts"
# en la frontera (secuenciales):
Task: "Create savings-form.schema.ts (INTEGER_PERCENTAGE_PATTERN)"
Task: "Create configure-savings-allocation.action.ts"
Task: "Create savings-config-dialog.tsx"
Task: "Modify account-card-grid.tsx (ítem «Ahorro» + diálogo)"
Task: "Modify account-month-kpis.tsx (3 métricas + saldo neto)"
Task: "Modify src/app/page.tsx (lee configs) y src/app/accounts/[accountId]/page.tsx (3er materializador + resta neta)"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Complete Phase 1: línea base verde
2. Complete Phase 2: backend fundacional (dominio → aplicación → persistencia, aditivo con migración `0006`, sin seed)
3. Complete Phase 3: US1 — menú ⋮ + diálogo + action + KPIs de 3 métricas + enganche en `/` y página de cuenta (quickstart Q1–Q10)
4. **STOP and VALIDATE**: `npm run lint && npm run typecheck && npm run test` + validación manual Q1–Q10
5. Complete Phase 4: e2e del flujo crítico (`porcentaje-ahorro.spec.ts`, con limpieza total final obligatoria)
6. Complete Phase 5: docs vivas, AGENTS.md, roadmap (FR-008) y gates completos (SC-005)

### Incremental Delivery

- Feature de una sola US (constitución II): el valor de usuario llega con Phase 3. Phase 2 es un checkpoint técnico (config/deducción utilizables solo vía código, sin UI), no un despliegue parcial.

### Parallel Team Strategy

- Para 1 desarrollador (real): estrictamente secuencial por fases. Con varios: tras los tests rojos de Phase 2, dominio/aplicación/persistencia avanzan en ficheros distintos; T021 ∥ T022 ∥ T023 ∥ T024 en rojo; docs de Phase 5 en paralelo.

---

## Notes

- [P] tasks = different files, no dependencies
- El negocio vive en dominio/aplicación (`SavingsPercentage`, guardas de deducción §1.2.1, semántica de activación/reactivación); las páginas solo orquestan «deducir antes de leer» (único disparador) y componen la resta neta una única vez; la UI no decide nada de negocio (constitución VII)
- La idempotencia y el congelado viven en `savings_allocation_months` (`UNIQUE (config, mes)` + `ON CONFLICT DO NOTHING` en tx + fila append-only con `amount_cents` congelado): el KPI lee la fila (`GetMonthSavings`), **nunca** recalcula (research §1); no existe borrado del mes ni re-sync del mes en curso (base plana, FR-002/FR-004)
- El saldo base de movimientos (`closure.monthBalanceCents`, contrato de 022 y base del cierre) no incluye el ahorro; el KPI de saldo lo resta explícitamente sobre esa base → KPI y cierre coherentes por construcción, difieren exactamente en el importe deducido (edge «Sin doble cómputo», FR-007)
- `currentMonth` entra como parámetro calculado por el adaptador (`ui/format.ts`): aplicación pura y tests deterministas, sin puerto Clock (ADR 0016/0017)
- La comparación de meses `YYYY-MM` es lexicográfica (invariante del formato); la deducción es por mes consultado
- El VO guarda el porcentaje como **entero 1–100** (sin puntos base): hace irrepresentables los decimales y desacopla el módulo de `common-contribution` (FR-006); el redondeo half-up aplica solo al importe (`floor((cents×pct + 50)/100)`), nunca al porcentaje
- E2E en fichero propio (Miembro B + mes en curso): corre entre `panel-cuentas` y `registro-movimientos` sobre la BD compartida, por lo que la limpieza total de A6 (desactivar configs + borrar movimientos + verificar listado vacío) es obligatoria, no cosmética (research §6); `workers: 1` y aislamiento cuenta/mes por spec intactos; `registro-movimientos` aserta el balance histórico absoluto de la cuenta 1, que la deducción (sin movimiento) no toca
- `movements`, `regular_incomes`, `common_contributions`, cierre mensual, resumen global, cuenta anual, balance acumulado, agregados de lectura, formularios de movimiento y página de la cuenta común intactos (FR-007, Out of Scope): el ahorro es una deducción informativa que no computa en ningún agregado
- Commit after each task or logical group (Conventional Commits, en español el enunciado cuando aporte claridad)
