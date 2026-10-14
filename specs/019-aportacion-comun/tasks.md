---
description: "Task list for feature 019 implementation"
---

# Tasks: Aportación porcentual a la cuenta común por miembro

**Input**: Design documents from `/specs/019-aportacion-comun/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-009 los exige explícitamente (unidad dominio/aplicación/repositorio, action, componentes y e2e del flujo crítico; constitución III). En rojo primero donde la feature añade comportamiento nuevo (`ContributionPercentage`, `CommonContribution`, los cuatro casos de uso, `DrizzleCommonContributionRepository`, action `configureCommonContribution`, ítem de menú y diálogo); las suites nuevas se escriben contra los contratos congelados de data-model/ui-contract.

**Organization**: Una única user story pequeña (US1, P1 — constitución II, sin excepción): configurar una vez el porcentaje de aportación y ver el gasto materializado al consultar el mes en la página de la cuenta. El cambio baja por las capas en la dirección de dependencias (VII): VO + entidad + errores puros en dominio → cuatro casos de uso + puerto en aplicación → repositorio Drizzle (dos tablas nuevas + dato de etiqueta en migración aditiva `0004`) → Server Action → ítem «Aportación» en el menú ⋮ + diálogo + lecturas en `/` y `/accounts/[accountId]` → e2e. **`movements`, `regular_incomes`, formularios de movimiento (013/014), cierres/resumen/anual y el diálogo de 018 intactos** (FR-003); `/summary` y `/annual` no materializan (ADR 0016/0017).

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
- [ ] T002 Confirmar la rama `feature/019-aportacion-comun` activa y el árbol limpio (creada por la extensión git de Spec Kit; worktree actualizado si se usa)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la fase fundacional.

---

## Phase 2: Foundational (Dominio → Aplicación → Persistencia — bloquea US1)

**Purpose**: Vertical del backend de la aportación: VO `ContributionPercentage` (puntos base 1–10 000 + half-up entero), entidad `CommonContribution` (ciclo espejo de `RegularIncome`), 4 errores de dominio, puerto `CommonContributionRepository`, cuatro casos de uso (configurar/desactivar/leer/materializar) y repositorio Drizzle con la tabla de registro de meses + etiqueta «Aportación Común» garantizada (migración + seed + ensure). Todo aditivo: `movements`, `regular_incomes`, `tags` estructuralmente intactas.

**Nota**: Conceptualmente estas tareas sirven solo a US1, pero no llevan label de historia: son prerrequisito compartido (backend) de todo lo que viene después (action + menú/diálogo + páginas + e2e).

### Tests primero (en rojo)

- [ ] T003 [P] Crear `src/domain/common-contribution/ContributionPercentage.test.ts` (rojo): `fromBasisPoints` rechaza no enteros, `0`, negativos y `> 10 000` con `InvalidCommonContributionError`; `basisPoints` accessor; `equals`; tabla half-up congelada de data-model §1.1 (25 % × 200 000 → 50 000; 33,33 % × 200 000 → 66 660; 25 % × 150 050 → 37 513 (.5 hacia arriba); 12,5 % × 200 000 → 25 000; y 0,01 % × 500 → 0 para documentar el edge §7); ejecutar y confirmar rojo
- [ ] T004 [P] Crear `src/domain/common-contribution/CommonContribution.test.ts` (rojo): `create` nace `active: true` con `activatedAtMonth = currentMonth`; `rehydrate` conserva todo; `update({percentage})` revalida y conserva `active`/`activatedAtMonth`; `deactivate()` conserva `activatedAtMonth`; `activate(currentMonth)` resetea `activatedAtMonth`; `dueDateForMonth("2026-10")` → `"2026-10-01"` (día 1 fijo); porcentaje inválido en `create`/`update` → `InvalidCommonContributionError("percentage", …)`; `activatedAtMonth` malformado → error de campo `activatedAtMonth`; ejecutar y confirmar rojo
- [ ] T005 [P] Crear `src/application/common-contribution/ConfigureCommonContribution.test.ts` (rojo) con dobles en memoria de `CommonContributionRepository`/`RegularIncomeRepository`/`AccountRepository`: alta nace activa con `activatedAtMonth = currentMonth`, edición conserva `activatedAtMonth`, reactivación de config inactiva resetea a `currentMonth`, cuenta no encontrada → `AccountNotFoundError`, cuenta común → `SharedAccountContributionError`, sin ingreso regular → `MissingRegularIncomeError`, ingreso con el que el porcentaje redondea a 0 céntimos → `InvalidCommonContributionError("percentage", "El porcentaje aplicado a tu ingreso regular debe resultar en al menos 0,01 €.")`; ejecutar y confirmar rojo
- [ ] T006 [P] Crear `src/application/common-contribution/MaterializeCommonContributions.test.ts` (rojo) con dobles en memoria: primera consulta del mes en curso materializa (`Movement.create` gasto `nature: "personal"`, `date: ${month}-01`, nota `Aportación común de {memberName}`, etiqueta resuelta por slug, `Money.fromCents(appliedToCents(income.amountCents))` + `registerMaterialization`), consulta repetida no duplica (`isMaterialized`), mes < `activatedAtMonth` nunca (sin retroactivo), mes > `currentMonth` nunca (futuro), cambio de porcentaje no toca mes ya registrado y aplica al pendiente, base = importe del ingreso al momento de generar, sin config o inactiva → no-op, sin ingreso regular o inactivo → no-op (FR-006), cálculo < 1 céntimo → no-op **sin registrar el mes** (§7), etiqueta inexistente → la crea (`findBySlug("aportacion-comun")` ?? `Tag.create` + `save`), `memberName` ausente → nota «Aportación común de miembro»; ejecutar y confirmar rojo
- [ ] T007 [P] Crear `src/application/common-contribution/GetCommonContribution.test.ts` y `src/application/common-contribution/DeactivateCommonContribution.test.ts` (rojos, doble en memoria): `GetCommonContribution` devuelve `CommonContributionDTO | null`; `DeactivateCommonContribution` desactiva conservando `activatedAtMonth`, y sin config → `CommonContributionNotFoundError`; ejecutar y confirmar rojo

### Dominio y aplicación

- [ ] T008 [P] Crear `src/domain/common-contribution/CommonContributionId.ts` (branded id entero > 0, patrón `RegularIncomeId`) y `src/domain/common-contribution/CommonContributionErrors.ts` (`InvalidCommonContributionError(field, message)` con fields `"percentage" | "activatedAtMonth"`, `SharedAccountContributionError` «La cuenta común no puede tener aportación.», `CommonContributionNotFoundError` «No existe aportación configurada para esta cuenta.», `MissingRegularIncomeError` «Configura primero el ingreso regular de este miembro.», con los literales congelados de data-model §1.1)
- [ ] T009 Crear `src/domain/common-contribution/ContributionPercentage.ts` (VO inmutable `Object.freeze`): `fromBasisPoints` (rechaza no enteros y fuera de `1..10 000`), `appliedToCents(amountCents) = floor((amountCents × basisPoints + 5_000) / 10_000)` — aritmética entera pura, sin flotantes ni `Math.round` (research §1) — y `equals`; verificar T003 en verde
- [ ] T010 Crear `src/domain/common-contribution/CommonContribution.ts` (entidad inmutable, patrón `RegularIncome`): campos `id/accountId/percentage(ContributionPercentage)/active/activatedAtMonth(YYYY-MM)`; factories `create`/`rehydrate` y métodos `update({percentage})` (sin tocar `active`/`activatedAtMonth`), `deactivate()`, `activate(currentMonth)` (reset de activación) y `dueDateForMonth(month)` → `${month}-01` (data-model §1.1); verificar T004 en verde
- [ ] T011 Crear `src/application/common-contribution/CommonContributionRepository.ts` (puerto: `findByAccountId`, `save` upsert, `isMaterialized`, `registerMaterialization(config, month, movement)` transaccional que devuelve `boolean` — data-model §1.2) y `src/application/common-contribution/dto.ts` (`CommonContributionDTO`: accountId, percentageBasisPoints, active, activatedAtMonth — data-model §4)
- [ ] T012 Crear `src/application/common-contribution/ConfigureCommonContribution.ts`: resolver cuenta vía `AccountRepository` (rechaza `type === "shared"` con `SharedAccountContributionError`), cargar ingreso regular vía `RegularIncomeRepository.findByAccountId` (`null` → `MissingRegularIncomeError`), validar `ContributionPercentage.fromBasisPoints(...)` y `appliedToCents(income.amountCents) ≥ 1` (literal de research §7); alta `CommonContribution.create({..., activatedAtMonth: currentMonth})`, edición `existing.update({percentage})` + `existing.activate(currentMonth)` solo si estaba inactiva → `save` → DTO (data-model §1.2, research §2); verificar T005 en verde
- [ ] T013 [P] Crear `src/application/common-contribution/GetCommonContribution.ts` (`execute(accountId) → CommonContributionDTO | null`) y `src/application/common-contribution/DeactivateCommonContribution.ts` (`existing.deactivate()` → `save`; sin config → `CommonContributionNotFoundError`); verificar T007 en verde
- [ ] T014 Crear `src/application/common-contribution/MaterializeCommonContributions.ts`: `ensureForAccountAndMonth(accountId, month, currentMonth)` con las guardas en orden de data-model §1.2.1 — config existe, `active`, `id !== null` → no-op; ventana lexicográfica `activatedAtMonth ≤ month ≤ currentMonth` (FR-005); `!isMaterialized` (FR-002); ingreso regular existe y activo → si no, no-op (FR-006); `appliedToCents ≥ 1` → si no, no-op sin registrar (§7); ensure de etiqueta `TagRepository.findBySlug("aportacion-comun")` ?? `Tag.create({name: "Aportación Común", slug: "aportacion-comun", status: "active"})` + `save` (research §4); `memberName` vía `AccountRepository`; `Movement.create({accountId, type: "expense", date: config.dueDateForMonth(month), note: "Aportación común de {memberName ?? "miembro"}", amount: Money.fromCents(...), nature: "personal", tagId})` + `registerMaterialization`; verificar T006 en verde

### Persistencia

- [ ] T015 [P] Crear `src/infrastructure/db/schema/common-contributions.ts` con `commonContributions` (id PK, `account_id` integer NOT NULL UNIQUE → accounts, `percentage_basis_points` integer NOT NULL, `active` 0/1, `activated_at_month` text, `created_at`, `updated_at`) y `commonContributionMonths` (id PK, `common_contribution_id` → common_contributions ON DELETE CASCADE, `month` text, `created_at`, `UNIQUE (common_contribution_id, month)`), reexportar ambas en `src/infrastructure/db/schema/index.ts` (data-model §2.1) y añadir `{ name: "Aportación Común", slug: "aportacion-comun" }` a `SEED_TAGS` en `src/infrastructure/db/seed-data.ts` (research §4)
- [ ] T016 Generar la migración aditiva con drizzle-kit (`npx drizzle-kit generate`) a partir del esquema de T015, renombrarla/verificarla como `drizzle/0004_aportacion-comun.sql`, añadir manualmente al final `INSERT OR IGNORE INTO tags (name, slug, status) VALUES ('Aportación Común', 'aportacion-comun', 'active');` (idempotente por `tags.slug` UNIQUE; patrón de la `0002` manual — constitución V, data-model §2.1), revisar el SQL (dos `CREATE TABLE`, FK, índice único; cero destructivos; `drizzle/meta/_journal.json` consistente) y aplicarla en dev con `npm run db:migrate`
- [ ] T017 [P] Crear `src/infrastructure/db/mappers/common-contribution.mapper.ts` (fila ⇄ entidad, patrón `regular-income.mapper.ts`; reexportar en `mappers/index.ts`) y `src/infrastructure/db/DrizzleCommonContributionRepository.test.ts` (rojo, contra `createTestDb` libsql `:memory:` con migraciones reales): `save` inserta y hace upsert por `account_id` devolviendo entidad con id; `findByAccountId` rehidrata; `isMaterialized` antes/después de registrar; `registerMaterialization` inserta fila + movimiento en una tx (id `coalesce(max(id),0)+1`, patrón `DrizzleRegularIncomeRepository`) y devuelve `true`; segunda inserción del mismo par `(config, mes)` → `false` **sin** crear movimiento (perdió la carrera); el movimiento creado es visible a `DrizzleMovementRepository.listByMonthAndAccount` y a `DrizzleAccountRepository.getBalance`; la migración sembró la etiqueta `aportacion-comun`; ejecutar y confirmar rojo
- [ ] T018 Crear `src/infrastructure/db/DrizzleCommonContributionRepository.ts`: `findByAccountId` (SELECT → `CommonContribution.rehydrate` vía mapper), `save` (`onConflictDoUpdate` target `account_id` returning), `isMaterialized` (`SELECT 1 ... LIMIT 1`), `registerMaterialization` (tx Drizzle: `INSERT INTO common_contribution_months ON CONFLICT (common_contribution_id, month) DO NOTHING RETURNING id`; solo si devuelve fila, insert del movimiento en la misma tx → `true`) (data-model §2.2); verificar T017 en verde
- [ ] T019 Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (cambio aditivo: las suites existentes no cambian de forma)

**Checkpoint**: Aportación operativa de dominio a BD (`ConfigureCommonContribution`/`MaterializeCommonContributions` utilizables); `movements`, `regular_incomes` y el resto de la app intactos; etiqueta «Aportación Común» garantizada en BD.

---

## Phase 3: User Story 1 - Configurar el porcentaje de aportación y verlo generado automáticamente cada mes (Priority: P1) 🎯 MVP

**Goal**: Ítem «Aportación» con 4 estados en el menú ⋮ de la tarjeta de cuenta personal (020), diálogo espejo del de 018 con un solo campo «Porcentaje (%)» (`useActionState` + intents `save`/`deactivate`), action `configureCommonContribution` con Zod en frontera y `revalidatePath("/", "layout")`, lectura de configs en `/` y materialización perezosa en `/accounts/[accountId]` tras la de 018 (FR-001–FR-007, SC-001–SC-004).

**Independent Test**: Quickstart Q1–Q10: sin ingreso regular el ítem queda deshabilitado con «Requiere ingreso regular»; configurar 25 % sobre ingreso de 2.000 € → gasto −500,00 € con etiqueta «Aportación Común» sin alta manual; consultas repetidas y `/summary`/`/annual` sin duplicados; cambio a 30 % solo-adelante; edición/borrado del generado como movimiento corriente (borrar no regenera); desactivar/reactivar con reset; validación con mensajes exactos; cuenta común sin menú; sin retroactivo ni futuro.

### Tests para US1 (primero, en rojo)

- [ ] T020 [P] [US1] Crear `src/infrastructure/primary/actions/configure-common-contribution.action.test.ts` (rojo, mockeando casos de uso con `vi.mock`/`vi.hoisted` como las actions existentes): Zod con mensajes exactos de ui-contract §3 (vacío «El porcentaje es obligatorio.», formato «Introduce un porcentaje válido (ej. 25 o 12,5).», cero «El porcentaje debe ser mayor que cero.», > 100 «El porcentaje no puede ser mayor que 100.»), `parsePercentageToBasisPoints("25" | "25,0" | "25.00") = 2500`, `("12,5") = 1250`, `("33,33") = 3333` (cadenas, nunca `parseFloat`), `intent="deactivate"` valida solo accountId y delega en `DeactivateCommonContribution`, éxito save/deactivate → `{status: "success"}` con «Aportación guardada»/«Aportación desactivada» y `revalidatePath("/", "layout")` llamada (mock), errores de dominio mapeados (`InvalidCommonContributionError` → `percentage` o su campo, `MissingRegularIncomeError`/`SharedAccountContributionError`/`CommonContributionNotFoundError` → `_form`, resto → `_form` «No se ha podido guardar la aportación. Inténtalo de nuevo.») y `values.percentage` conservado; nada persiste con error de validación; ejecutar y confirmar rojo
- [ ] T021 [P] [US1] Crear `src/infrastructure/primary/ui/common-contribution-config-dialog.test.tsx` (rojo, action mockeada): diálogo titulado «Aportación a la cuenta común» vacío sin config y pre-rellenado «25»/«12,5» con config (`formatBasisPointsForInput`), foco inicial en «Porcentaje (%)», guardado con éxito (toast «Aportación guardada», cierre), desactivación con toast «Aportación desactivada» (botón «Desactivar» solo si config existe y activa), errores `role="alert"` por campo con valores conservados y diálogo abierto, «Guardando…» y disabled en `isPending` (anti-doble-envío), «Cancelar»/Escape cierran sin enviar; ejecutar y confirmar rojo
- [ ] T022 [P] [US1] Ampliar `src/infrastructure/primary/ui/account-card-grid.test.tsx` (rojo): función pura `commonContributionMenuStatus` devuelve «Requiere ingreso regular»/«Sin configurar»/«Activa»/«Desactivada» según DTOs; el ítem «Aportación» aparece segundo bajo «Ingreso regular» solo en cuentas personales con estado a la derecha; con `regularIncome === null` el ítem está deshabilitado y no abre diálogo; con ingreso abre el diálogo dentro de la tarjeta (montaje condicional, instancia fresca); la cuenta común sigue sin menú; ejecutar y confirmar rojo

### Frontera (Server Action) y UI

- [ ] T023 [US1] Añadir `formatBasisPointsForInput(basisPoints: number): string` a `src/infrastructure/primary/ui/format.ts` (2500 → «25», 1250 → «12,5», 3333 → «33,33»; sin coma flotante: manipulación de cadenas sobre el entero de puntos base) con casos en `src/infrastructure/primary/ui/format.test.ts` (data-model §4, research §6)
- [ ] T024 [US1] Crear `src/infrastructure/primary/actions/configure-common-contribution.action.ts`: `percentageSchema` (patrón `^\d{1,3}([.,]\d{1,2})?$` + `parsePercentageToBasisPoints` ∈ (0, 10 000], por manipulación de cadenas; rama propia para `intent="deactivate"` que valida solo `accountId`), `ConfigureCommonContributionState` unión discriminada (idle/success/error con `errors` por campo + `values`) espejo de la de 018 (ui-contract §5), delegación en `ConfigureCommonContribution`/`DeactivateCommonContribution`, mapeo de errores de dominio a campos (nunca lanzar al cliente) y `revalidatePath("/", "layout")` en éxito; verificar T020 en verde
- [ ] T025 [US1] Crear `src/infrastructure/primary/ui/common-contribution-config-dialog.tsx` (client, espejo estructural de `regular-income-config-dialog.tsx`): título «Aportación a la cuenta común», único campo label «Porcentaje (%)» con `id="common-contribution-percentage"`, `inputMode="decimal"`, placeholder «25» y `defaultValue` vacío o `formatBasisPointsForInput(bp)`; foco programado al abrir (`onOpenAutoFocus` + `preventDefault`, guard de éxito único con `useActionState(configureCommonContribution)`); botones self-end en orden fijo «Cancelar» (outline, `type="button"`) · «Desactivar» (outline, `name="intent" value="deactivate"`, solo si config existe y activa) · «Guardar» (`name="intent" value="save"`); `isPending` deshabilita todo con «Guardando…»; errores por campo bajo el input (`role="alert"`, `aria-describedby`) y banner `_form`; toasts sonner de éxito; sin preview de importe (ui-contract §2/§3/§7); verificar T021 en verde
- [ ] T026 [US1] Modificar `src/infrastructure/primary/ui/account-card-grid.tsx`: exportar la función pura `commonContributionMenuStatus(contribution, regularIncome)` con los 4 literales congelados (ui-contract §1); prop nueva `commonContributions: Record<number, CommonContributionDTO | null>`; segundo `DropdownMenuItem` «Aportación» bajo «Ingreso regular» con estado a la derecha (`ml-auto text-muted-foreground`), deshabilitado (sin diálogo) cuando falta el ingreso regular; montaje condicional de `CommonContributionConfigDialog` **dentro de la tarjeta** (excepción documentada AGENTS.md, catálogo estable, instancia fresca por apertura); trigger ⋮ y stretched-link intactos (020); verificar T022 en verde
- [ ] T027 [US1] Modificar `src/app/page.tsx`: en el mismo bucle serial de cuentas personales, leer además `GetCommonContribution.execute(accountId)` por cuenta y pasar `commonContributions` como prop a `AccountCardGrid` (research §6.4); el render de tarjetas sigue sin mostrar importes (020)
- [ ] T028 [US1] Modificar `src/app/accounts/[accountId]/page.tsx`: instanciar `MaterializeCommonContributions` y llamar `ensureForAccountAndMonth(accountId, month, currentMonth())` **inmediatamente después** de `MaterializeRegularIncomes` y antes del `Promise.all` (dos awaits secuenciales; mismo render cubre listado, cierre y balance; único disparador, ADR 0016/0017; research §3.2); `/summary` y `/annual` quedan intactos
- [ ] T029 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (SC-005 parcial)

**Checkpoint**: US1 funcional: configurar desde el menú ⋮ de la tarjeta y ver el gasto del mes materializado exactamente una vez; suites unitarias y de componentes en verde.

---

## Phase 4: E2E del flujo crítico (FR-009, constitución III)

**Purpose**: Spec nueva en fichero propio con combinación cuenta/mes exclusiva (**Cuenta de Miembro B (cuenta 2) + mes en curso real dinámico**, libre según verificación de research §8; helpers locales `currentMonthIso()` al estilo de 018). **`aportacion-comun` corre primero alfabéticamente** sobre la BD compartida: la limpieza final de A6 es obligatoria para no re-materializar a specs posteriores. Las 9 specs existentes quedan intactas.

- [ ] T030 [US1] Crear `e2e/aportacion-comun.spec.ts` (serial, Miembro B + mes en curso): A1 dependencia (sin ingreso regular → ítem «Aportación» con «Requiere ingreso regular» deshabilitado; tras configurar ingreso regular 2.000,00 → «Sin configurar»), A2 configurar 25 % → gasto −500,00 con nota «Aportación común de Miembro B» y etiqueta «Aportación Común» exactamente 1 vez, sin cambios automáticos en la cuenta común, A3 idempotencia (`/summary` ×2, `/annual` ×2, reload de la cuenta → conteo 1), A4 editar a 30 % → el mes ya generado conserva 500,00, A5 eliminar la aportación → definitiva (no reaparece), A6 limpieza: eliminar los movimientos generados y desactivar aportación e ingreso regular de B (restaura el estado pre-019; research §8)
- [ ] T031 [US1] Ejecutar `npm run test:e2e` y verificar las 10 specs en verde (las 9 existentes sin cambios esperados — ajustar solo si un literal afectado lo exige)

**Checkpoint**: Flujo crítico «configurar ingreso regular + porcentaje → consultar mes → ver aportación sin duplicados → borrar no regenera → desactivar» cubierto end-to-end (SC-005).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva, ADR 0017 y roadmap maestro actualizados en el mismo cambio (constitución III DoD, research §9, FR-008).

- [ ] T032 [P] Crear `docs/architecture/adr/0017-aportacion-comun-porcentaje-materializacion.md`: porcentaje en puntos base con redondeo half-up entero (extensión de ADR 0007), segundo materializador perezoso bajo patrón 0016 (tabla registro propia `common_contribution_months`, mismo disparador único, agregados sin materializar), resolución de etiqueta por slug con ensure, base = ingreso regular al momento de generar, parada sin ingreso/inactivo (research §9.1)
- [ ] T033 [P] Actualizar `docs/architecture/diagrams/`: crear `aportacion-comun-secuencia.md` (base: plan.md §Diagramas de diseño), extender `domain-model.md` con `CommonContribution`/`ContributionPercentage`/puerto/4 casos de uso (base: data-model §1.4) y añadir la variante de aportación en `panel-cuentas-sequence.md` si procede; actualizar `docs/architecture/overview.md` con el módulo nuevo
- [ ] T034 [P] Actualizar `AGENTS.md`: generalizar la convención «Materialización perezosa» a ambos materializadores (018 y 019: único disparador en la página de cuenta antes de leer, registro de meses como idempotencia, nunca en agregados) (regla de oro 6, research §9.3)
- [ ] T035 Preparar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-008): añadir la fila `019-aportacion-comun` (Estado: la que proceda al ejecutar; «Completada» se verifica en `/speckit.finish`) y amendar la línea de alcance diferido sobre aportaciones: la aportación mensual porcentual queda cubierta por 019 como gasto propio con etiqueta «Aportación Común», revocando la asunción provisional de anotarla como ingreso en la cuenta común (contrapartida manual), con nota datada 2026-10 (research §9.4)
- [ ] T036 Validar manualmente los escenarios Q1–Q10 de `specs/019-aportacion-comun/quickstart.md` con `npm run dev` sobre BD migrada y sembrada (`npm run db:migrate && npm run db:seed`)
- [ ] T037 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-005, DoD)

**Checkpoint**: Documentación viva, ADR, roadmap y quickstart sincronizados con la implementación; feature entregada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Depende de Phase 1. **Bloquea US1** (la action, el menú/diálogo y las páginas consumen los casos de uso y el repositorio). Dentro de la fase: tests rojos (T003–T007) → dominio (T008–T010) → puerto + aplicación (T011–T014) → persistencia (T015–T018) → gate (T019); la dirección de dependencias es hacia abajo, nunca al revés (constitución VII).
- **US1 (Phase 3)**: Depende de Phase 2 completa. Tests rojos primero (T020–T022) → helper de formato (T023) → action (T024) → diálogo (T025) → menú/tarjeta (T026) → `/` (T027) → página de cuenta (T028) → gate (T029).
- **E2E (Phase 4)**: Depende de Phase 3 (UI completa operativa).
- **Polish (Phase 5)**: Depende de todas las anteriores (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US1 (P1, única)**: Tras Phase 2. Independientemente testable vía quickstart Q1–Q10 y las suites por capa; el MVP de la feature es la propia US1 completa (Phase 1–4).

### Within Each User Story

- Tests primero y en rojo antes de su SUT (T003–T007 → T008–T018; T020–T022 → T024–T026).
- Dominio (T008–T010) antes del puerto (T011) y de los casos de uso (T012–T014 los consumen); esquema (T015) antes de la migración (T016) y del repositorio (T017–T018).
- Action (T024) antes del diálogo (T025 la llama); diálogo (T025) antes del grid (T026 lo monta); grid (T026) antes de `/` (T027 le pasa las props).
- E2E tras la UI completa; gates acumulativos al final de cada fase.

### Parallel Opportunities

- Phase 2: T003 ∥ T004 ∥ T005 ∥ T006 ∥ T007 (ficheros distintos, en rojo); luego T008 en paralelo con T009 si la entidad se escribe tras el VO (ficheros distintos; T010 depende de ambos); T013 tras T011 en paralelo con T012/T014 (ficheros distintos); T15 (schema+seed) ∥ T017 (test de repos, rojo) tras T016.
- Phase 3: T020 ∥ T021 ∥ T022 (ficheros distintos, en rojo).
- Phase 5: T032 ∥ T033 ∥ T034 (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Launch red tests together:
Task: "Create ContributionPercentage.test.ts (src/domain/common-contribution/)"
Task: "Create CommonContribution.test.ts (src/domain/common-contribution/)"
Task: "Create ConfigureCommonContribution.test.ts (src/application/common-contribution/)"
Task: "Create MaterializeCommonContributions.test.ts (src/application/common-contribution/)"
Task: "Create GetCommonContribution.test.ts + DeactivateCommonContribution.test.ts"

# Tras el rojo, dominio en paralelo (ficheros distintos):
Task: "Create CommonContributionId.ts + CommonContributionErrors.ts"
Task: "Create ContributionPercentage.ts (basisPoints + half-up entero)"
# y después la entidad, puerto y casos de uso (secuenciales por dependencia):
Task: "Create CommonContribution.ts"
Task: "Create CommonContributionRepository.ts (port) + dto.ts"
# en la frontera (secuenciales):
Task: "Add formatBasisPointsForInput to format.ts"
Task: "Create configure-common-contribution.action.ts"
Task: "Create common-contribution-config-dialog.tsx"
Task: "Modify account-card-grid.tsx (ítem «Aportación» + diálogo)"
Task: "Modify src/app/page.tsx (lee configs) y src/app/accounts/[accountId]/page.tsx (materializa)"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Complete Phase 1: línea base verde
2. Complete Phase 2: backend fundacional (dominio → aplicación → persistencia, aditivo con migración `0004` + dato de etiqueta)
3. Complete Phase 3: US1 — menú ⋮ + diálogo + action + enganche en `/` y página de cuenta (quickstart Q1–Q10)
4. **STOP and VALIDATE**: `npm run lint && npm run typecheck && npm run test` + validación manual Q1–Q10
5. Complete Phase 4: e2e del flujo crítico (`aportacion-comun.spec.ts`, con limpieza final obligatoria)
6. Complete Phase 5: ADR 0017, docs vivas, AGENTS.md, roadmap (FR-008) y gates completos (SC-005)

### Incremental Delivery

- Feature de una sola US (constitución II): el valor de usuario llega con Phase 3. Phase 2 es un checkpoint técnico (config/materialización utilizables solo vía código, sin UI), no un despliegue parcial.

### Parallel Team Strategy

- Para 1 desarrollador (real): estrictamente secuencial por fases. Con varios: tras los tests rojos de Phase 2, dominio/aplicación/persistencia avanzan en ficheros distintos; T020 ∥ T021 ∥ T022 en rojo; docs de Phase 5 en paralelo.

---

## Notes

- [P] tasks = different files, no dependencies
- El negocio vive en dominio/aplicación (`ContributionPercentage`, guardas de materialización §1.2.1, semántica de activación/reactivación); las páginas solo orquestan «materializar antes de leer» (único disparador) y la UI no decide nada de negocio (captura porcentaje, pinta DTO) (constitución VII)
- La idempotencia vive en `common_contribution_months` (`UNIQUE (config, mes)` + `ON CONFLICT DO NOTHING` en tx), **nunca** en la existencia del movimiento: así el borrado es definitivo (FR-004/escenario 5) y `movements` queda intacta (FR-003)
- `currentMonth` entra como parámetro calculado por el adaptador (`ui/format.ts`): aplicación pura y tests deterministas, sin puerto Clock (ADR 0016/0017)
- La comparación de meses `YYYY-MM` es lexicográfica (invariante del formato); la materialización es por mes consultado
- Etiqueta «Aportación Común» garantizada por triple vía: seed (T015), `INSERT OR IGNORE` en la migración `0004` (T016) y ensure por slug en cada generación (T014) — sobrevive a renombrados/borrados futuros del catálogo (research §4)
- E2E en fichero propio (Miembro B + mes en curso): corre **primero** alfabéticamente sobre la BD compartida, por lo que la limpieza final de A6 (borrar movimientos + desactivar ambas configs) es obligatoria, no cosmética (research §8.2); `workers: 1` y aislamiento cuenta/mes por spec intactos
- `movements`, `regular_incomes`, cierre mensual, resumen global, cuenta anual y formularios de movimiento intactos (FR-003, Out of Scope): la aportación es un movimiento corriente que computa con las reglas actuales
- Commit after each task or logical group (Conventional Commits, en español el enunciado cuando aporte claridad)
