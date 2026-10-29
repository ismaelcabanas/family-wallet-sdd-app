---
description: "Task list for feature 008 implementation"
---

# Tasks: Gestión de cuentas y miembros — renombrado y nombre de cuenta personal derivado

**Input**: Design documents from `/specs/008-gestion-cuentas-miembros/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-007 los exige explícitamente (dominio/aplicación con reglas de validación y derivación, repositorios con migración real, actions, componentes y e2e nueva + enmienda N1; constitución III). En rojo primero donde la feature añade comportamiento nuevo (`Member.rename`, `Account.name` nullable + `rename`, `RenameMember`/`RenameAccount`, `personalAccountDisplayName`, repos ampliados, actions, diálogos y grid); las suites nuevas se escriben contra los contratos congelados de data-model/ui-contract.

**Organization**: Una única user story pequeña (US1, P1 — constitución II, alcance reducido por el propietario 2026-10-29): renombrar miembros —con el nombre mostrado de su cuenta personal **derivado siempre** como «Cuenta de {miembro}»— y renombrar la cuenta común, desde el panel `/`. El cambio baja por las capas en la dirección de dependencias (VII): esquema + migración `0007` (name nullable + índices `lower(name)`) → dominio puro (`rename` + invariantes + errores) → aplicación (puertos ampliados + `RenameMember`/`RenameAccount` + función pura de derivación) → repos Drizzle (derivación en `findAll`, `findByName` nocase, traducción de carrera) → seed idempotente por atribución → actions Zod + diálogos patrón 004 + ⋮ en las 3 tarjetas → e2e con restauración final. **`movements`, configs 018/019/023, cierres/resúmenes/anual/balance, materializadores y `src/app/` intactos** (FR-005, SC-002): renombrar solo cambia etiquetas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js (App Router): `src/` en la raíz del repositorio; e2e en `e2e/`; migraciones en `drizzle/`; docs vivos en `docs/architecture/`; roadmap maestro en `specs/001-family-wallet/spec.md`.
- Tests co-localizados junto a su SUT (`*.test.ts(x)`); repositorios contra libsql `:memory:` con las migraciones reales de `drizzle/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar línea base verde y la rama feature antes de tocar código.

- [ ] T001 Verificar línea base verde ejecutando `npm run lint && npm run typecheck && npm run test` (todo debe pasar antes de cualquier cambio)
- [ ] T002 Confirmar la rama `feature/008-gestion-cuentas-miembros` activa y el árbol limpio (creada por la extensión git de Spec Kit)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la fase fundacional.

---

## Phase 2: Foundational (Esquema → Dominio → Aplicación → Persistencia → Seed — bloquea US1)

**Purpose**: Vertical del modelo de nombres: migración `0007_*` (`accounts.name` nullable con NULL en personales + índices `lower(name)` en `members`/`accounts`, patrón tags de 004), `Member.rename`/`Account.rename` (reconstrucción validada, ADR 0011) con errores de duplicado/no-renombrable/no-encontrado, puertos ampliados (`findById`/`findByName`/`update`), casos de uso `RenameMember`/`RenameAccount` (espejo de `RenameTag`), función pura `personalAccountDisplayName` aplicada en `DrizzleAccountRepository.findAll` (→ `AccountDTO.name` = nombre mostrado) y seed idempotente por `(type, member_id)`. Todo el histórico queda intocado (SC-002).

**Nota**: Conceptualmente estas tareas sirven solo a US1, pero no llevan label de historia: son prerrequisito compartido (backend) de todo lo que viene después (actions, menús/diálogos, e2e).

### Tests primero (en rojo) — módulos puros

- [ ] T003 [P] Crear `src/domain/member/Member.test.ts` (rojo): `rename("Isma")` devuelve nueva instancia congelada con el MISMO `id` y nombre trimado; `rename("  Sole  ")` → «Sole»; `rename("")`/`rename("   ")` → `InvalidMemberError` «El nombre del miembro es obligatorio.»; `create`/`rehydrate` existentes sin regresión; ejecutar y confirmar rojo
- [ ] T004 [P] Crear `src/domain/account/Account.test.ts` (rojo): `create`/`rehydrate` con `name: string | null` e invariante type↔nombre (`shared` con nombre vacío/espacios → `InvalidAccountError` «El nombre de la cuenta es obligatorio.»; `personal` con `name !== null` → `InvalidAccountError` «Las cuentas personales no tienen nombre propio: se deriva del miembro.»; `personal` con `name: null` ok; reglas type↔memberId actuales sin cambios); `rename` en `shared` devuelve nueva instancia con mismo id/type/memberId y nombre trimado; `rename` en `personal` → `AccountNotRenamableError` «Las cuentas personales no se renombran: su nombre se deduce del miembro.»; `rename("")` en común → `InvalidAccountError` «El nombre de la cuenta es obligatorio.»; ejecutar y confirmar rojo
- [ ] T005 [P] Crear `src/application/member/RenameMember.test.ts` (rojo) con mocks `vi.fn()` por método del puerto: happy path (findById devuelve miembro → `update` recibe la instancia renombrada exacta y su salida se devuelve); id inexistente → `MemberNotFoundError` «El miembro seleccionado no existe.»; nombre vacío → `InvalidMemberError`; duplicado nocase (`findByName("Isma")` devuelve OTRO miembro con distinto id) → `DuplicateMemberNameError` `Ya existe un miembro con el nombre "Isma".`; autorenombrado (mismo id) no es duplicado; ejecutar y confirmar rojo
- [ ] T006 [P] Crear `src/application/account/RenameAccount.test.ts` (rojo) con mocks `vi.fn()`: happy path en `shared` (update recibe la instancia renombrada exacta); id inexistente → `AccountNotFoundError`; cuenta `personal` → `AccountNotRenamableError`; duplicado nocase con otra cuenta (`findByName` con distinto id) → `DuplicateAccountNameError` `Ya existe una cuenta con el nombre "Cuenta conjunta".`; autorenombrado no es duplicado; ejecutar y confirmar rojo
- [ ] T007 [P] Crear `src/application/account/display-name.test.ts` (rojo): `personalAccountDisplayName("Isma")` → «Cuenta de Isma»; `personalAccountDisplayName("")` → «Cuenta de » (función pura sin validación — la validación vive en el dominio); `personalAccountDisplayName(null)` → «Cuenta de miembro» (fallback, paridad con notas/etiquetas); ejecutar y confirmar rojo

### Dominio

- [ ] T008 [P] Implementar en `src/domain/member/Member.ts` el método `rename(name): Member` (trim + no vacío → `InvalidMemberError`; devuelve nueva instancia congelada con el mismo `id`, patrón `Tag.rename`/ADR 0011) y añadir en `src/domain/member/MemberErrors.ts` `DuplicateMemberNameError` (`` `Ya existe un miembro con el nombre "${name}".` ``) y `MemberNotFoundError` («El miembro seleccionado no existe.») con los literales congelados de data-model §1.3; verificar T003 en verde
- [ ] T009 [P] Implementar en `src/domain/account/Account.ts` el campo `name: string | null` con la invariante type↔nombre en `create`/`rehydrate` y el método `rename(name): Account` (solo `shared`: `personal` → `AccountNotRenamableError`; trim + no vacío → `InvalidAccountError`; conserva id/type/memberId), y añadir en `src/domain/account/AccountErrors.ts` `DuplicateAccountNameError` (`` `Ya existe una cuenta con el nombre "${name}".` ``) y `AccountNotRenamableError` («Las cuentas personales no se renombran: su nombre se deduce del miembro.») (data-model §1.2/§1.3, research §3); verificar T004 en verde

### Aplicación (puertos, derivación y casos de uso)

- [ ] T010 [P] Crear `src/application/account/display-name.ts` con la función pura `personalAccountDisplayName(memberName: string | null): string` = `` `Cuenta de ${memberName ?? "miembro"}` `` (data-model §2.2, research §4); verificar T007 en verde
- [ ] T011 [P] Ampliar el puerto `src/application/member/MemberRepository.ts` con `findById(id: MemberId): Promise<Member | null>`, `findByName(name: string): Promise<Member | null>` (case-insensitive) y `update(member: Member): Promise<Member>` (MemberId requerido; traduce la carrera UNIQUE) (data-model §2.1)
- [ ] T012 [P] Ampliar el puerto `src/application/account/AccountRepository.ts` con `findByName(name: string): Promise<Account | null>` (case-insensitive; solo nombres almacenados — las personales, con NULL, nunca matchean) y `update(account: Account): Promise<Account>` (AccountId requerido; traduce la carrera UNIQUE) (data-model §2.1)
- [ ] T013 Crear `src/application/member/RenameMember.ts` con el flujo exacto de `RenameTag` (research §2): `findById` → null: `MemberNotFoundError`; `member.rename(name)`; `findByName(renamed.name)` → existe con `id !== member.id`: `DuplicateMemberNameError`; `update(renamed)` → devuelve el miembro; **no toca** cuentas, movimientos, tags, configs ni balances (FR-001); verificar T005 en verde
- [ ] T014 Crear `src/application/account/RenameAccount.ts` con el mismo flujo contra `AccountRepository`: `findById` → null: `AccountNotFoundError`; `account.rename(name)` (guarda `AccountNotRenamableError` para personales); `findByName` → otra cuenta: `DuplicateAccountNameError`; `update(renamed)` (data-model §2.3, FR-002/FR-004); verificar T006 en verde

### Persistencia (esquema, migración, repos y seed)

- [ ] T015 [P] Modificar `src/infrastructure/db/schema/members.ts` (sustituir `members_name_unique` por `uniqueIndex("members_name_nocase_uq").on(sql\`lower(${table.name})\`)`, espejo de `tags_name_nocase_uq` de 004) y `src/infrastructure/db/schema/accounts.ts` (`name: text("name")` nullable + `uniqueIndex("accounts_name_nocase_uq").on(sql\`lower(${table.name})\`)`) (data-model §3.1, research §1)
- [ ] T016 Generar la migración con drizzle-kit (`npx drizzle-kit generate`) a partir del esquema de T015, renombrarla como `drizzle/0007_nombre-cuenta-derivado.sql` (nombre final: el que genere drizzle-kit con prefijo `0007_`), **ajustarla a mano** en el INSERT de accounts (recreación `__new_accounts` estilo `0002` con `CASE WHEN "type" = 'personal' THEN NULL ELSE "name" END`, preservando ids — FKs de movements y configs intactas; índices nocase según data-model §3.2), verificar `drizzle/meta/_journal.json` consistente, aplicarla en dev con `npm run db:migrate` y comprobar con `sqlite3 db.sqlite "SELECT id, name, type, member_id FROM accounts"` que las personales quedan a NULL (quickstart, Prerrequisitos)
- [ ] T017 [P] Ampliar `src/infrastructure/db/DrizzleRepositories.test.ts` (rojo; libsql `:memory:` con migraciones reales de `drizzle/`): fixtures de cuentas personales insertadas con `name: null`; `accountRepository.findAll` devuelve DTO con **nombre derivado** para las personales («Cuenta de {memberName}», nunca NULL) y el almacenado para la común; `memberRepository.findById` rehidrata; `memberRepository.findByName` nocase («isma» encuentra «Isma») y `accountRepository.findByName` nocase (las personales con NULL nunca matchean); `update` persiste el renombrado; carrera UNIQUE: violación de `members_name_nocase_uq`/`accounts_name_nocase_uq` traducida a `DuplicateMemberNameError`/`DuplicateAccountNameError` (espejo `translateUniqueViolation` de tags, research §2); enmendar los asserts existentes de `findAll` (líneas 52–67) al DTO derivado; ejecutar y confirmar rojo
- [ ] T018 Implementar en `src/infrastructure/db/DrizzleMemberRepository.ts` los métodos del puerto T011: `findById` (SELECT → `Member.rehydrate`), `findByName` (`sql\`lower(${members.name}) = lower(${name})\``, espejo de tags) y `update` (UPDATE … WHERE id, envolviendo la escritura y traduciendo la violación de `members_name_nocase_uq` → `DuplicateMemberNameError`) (data-model §3.3, research §2)
- [ ] T019 Implementar en `src/infrastructure/db/DrizzleAccountRepository.ts` los métodos `findByName` (nocase sobre `accounts.name` — filas NULL nunca matchean) y `update` (traducción `accounts_name_nocase_uq` → `DuplicateAccountNameError`), y aplicar la derivación en `findAll` a través de `src/infrastructure/db/mappers/account.mapper.ts`: `AccountDTO.name = type === "shared" ? storedName : personalAccountDisplayName(memberName)` — **`AccountDTO.name` pasa a ser el nombre mostrado** con la forma del DTO intacta (data-model §2.2/§3.3, research §4); verificar T017 en verde (junto a T018)
- [ ] T020 Adaptar el seed para idempotencia con `name` NULL en personales (research §7): `src/infrastructure/db/seed-data.ts` (`SEED_ACCOUNTS` pasa a `{ name: string | null; type; memberName }` — personales a `name: null`, común con `SHARED_ACCOUNT_NAME`; mismos 2 miembros y 3 cuentas) y `scripts/seed.ts` (la común con `onConflictDoNothing({ target: accounts.name })`; cada personal solo si NO existe cuenta con `(type = 'personal', member_id = miembro resuelto)` — select previo); ejecutar `npm run db:seed` dos veces y verificar que sigue habiendo exactamente 3 cuentas y 2 miembros
- [ ] T021 Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde; si el nullable de `Account.name` obliga a ajustar fixtures/llamadas tipográficamente en otras suites, ajustarlas **sin cambiar semántica** (ninguna vista ni consumidor cambia de forma: `AccountDTO` es idéntico)

**Checkpoint**: Modelo de nombres operativo de esquema a aplicación: `RenameMember`/`RenameAccount` utilizables, `findAll` deriva «Cuenta de {miembro}», unicidad nocase con backstop BD, seed idempotente; movimientos, configs y agregados intactos.

---

## Phase 3: User Story 1 - Poner nombres reales a miembros y a la cuenta común desde el panel (Priority: P1) 🎯 MVP

**Goal**: «Renombrar miembro» como **primer** ítem del ⋮ de cada tarjeta personal (abre `RenameMemberDialog` con el nombre vigente precargado); la tarjeta de la cuenta común **gana ⋮** («Configuración de {nombre}») con único ítem «Renombrar cuenta» (abre `RenameAccountDialog`); ambos diálogos replican `rename-tag-dialog.tsx` de 004 (input controlado, `role="alert"`, valor conservado); Server Actions `renameMember`/`renameAccount` (Zod trim + `min(1)` con mensajes exactos + `revalidatePath("/", "layout")`) (FR-001–FR-006, SC-001). Panel, páginas de cuenta y agregados muestran los nombres nuevos (derivado incluido) en la siguiente lectura, con importes idénticos (SC-002).

**Independent Test**: Quickstart Q1–Q7: renombrar «Miembro A»→«Isma» desde ⋮ → tarjeta «Cuenta de Isma», `<h1>`/balance de su página, desglose de `/summary` y fila de `/annual` con los mismos importes; renombrar la común → tarjeta y página con el nuevo nombre; vacío conserva lo tecleado con error claro; duplicado nocase bloqueado; configs 018/019/023 intactas; el clic en ⋮ nunca navega.

### Tests para US1 (primero, en rojo)

- [ ] T022 [P] [US1] Crear `src/infrastructure/primary/actions/rename-member.action.test.ts` (rojo, mockeando `RenameMember` con `vi.mock`/`vi.hoisted` como `rename-tag.action.test.ts`): Zod `{memberId, name}` (trim + `min(1)` → «El nombre del miembro es obligatorio.», nada persiste); éxito → `{status: "success"}` con «Miembro renombrado» y `revalidatePath("/", "layout")` llamada (mock); errores de dominio mapeados a `error.message` (`InvalidMemberError`, `DuplicateMemberNameError`, `MemberNotFoundError`); error inesperado → «No se ha podido renombrar el miembro.»; `values.name` conservado ante error; ejecutar y confirmar rojo
- [ ] T023 [P] [US1] Crear `src/infrastructure/primary/actions/rename-account.action.test.ts` (rojo, ídem): Zod `{accountId, name}` con «El nombre de la cuenta es obligatorio.»; éxito → «Cuenta renombrada» + `revalidatePath("/", "layout")`; errores de dominio mapeados (`InvalidAccountError`, `DuplicateAccountNameError`, `AccountNotRenamableError`, `AccountNotFoundError`); inesperado → «No se ha podido renombrar la cuenta.»; valor conservado; ejecutar y confirmar rojo
- [ ] T024 [P] [US1] Crear `src/infrastructure/primary/ui/rename-member-dialog.test.tsx` (rojo, action mockeada, espejo de `rename-tag-dialog.test.tsx`): diálogo titulado «Renombrar miembro» con label «Nombre del miembro» precargado con el nombre vigente y `memberId` oculto; foco inicial en el input; guardado con éxito → toast «Miembro renombrado» y cierre; error con `role="alert"` + `aria-describedby`, **valor tecleado conservado** (input controlado, patrón 004/SC-004) y diálogo abierto; «Guardando…»/disabled en `isPending`; «Cancelar»/Escape cierran sin enviar; ejecutar y confirmar rojo
- [ ] T025 [P] [US1] Crear `src/infrastructure/primary/ui/rename-account-dialog.test.tsx` (rojo, ídem): diálogo «Renombrar cuenta» con label «Nombre de la cuenta» precargado con el nombre almacenado y `accountId` oculto; toast «Cuenta renombrada»; mismos patrones de error/valor conservado/pending/cancelación; ejecutar y confirmar rojo
- [ ] T026 [P] [US1] Ampliar `src/infrastructure/primary/ui/account-card-grid.test.tsx` (rojo): trigger ⋮ presente en las **3 tarjetas** (`getByRole("button", { name: "Configuración de Cuenta de Miembro A" })`, ídem B, «Configuración de Cuenta común»); tarjeta personal: ítem «Renombrar miembro» **primero** (antes de «Ingreso regular») y SIN «Renombrar cuenta»; tarjeta común: único ítem «Renombrar cuenta» y SIN «Renombrar miembro» ni ítems de config; la selección abre el diálogo correspondiente montado dentro de la tarjeta (montaje condicional, instancia fresca); el botón ⋮ NO está dentro del `<a>` (invariante stretched-link); ítems 020/018/019/023 intactos; ejecutar y confirmar rojo

### Frontera (Server Actions) y UI

- [ ] T027 [US1] Crear `src/infrastructure/primary/actions/rename-member.action.ts` (espejo de `rename-tag.action.ts`): Zod `{memberId: z.string().regex(/^\d+$/), name: z.string().trim().min(1, "El nombre del miembro es obligatorio.")}`, estado unión discriminada (idle/success/error con `message` + `values`), delegación en `RenameMember`, mapeo de errores de dominio a `error.message` (nunca lanzar al cliente), `revalidatePath("/", "layout")` en éxito (los nombres viven en panel, cuenta, `/summary` y `/annual`) (ui-contract §3, research §5); verificar T022 en verde
- [ ] T028 [US1] Crear `src/infrastructure/primary/actions/rename-account.action.ts` (ídem): Zod `{accountId, name}` con «El nombre de la cuenta es obligatorio.», delegación en `RenameAccount`, mismos mapeos y `revalidatePath("/", "layout")` (ui-contract §4); verificar T023 en verde
- [ ] T029 [P] [US1] Crear `src/infrastructure/primary/ui/rename-member-dialog.tsx` (client, patrón `rename-tag-dialog.tsx` de 004): título «Renombrar miembro», label «Nombre del miembro», input **controlado** con `useState` (anti-reset de React 19) precargado con el nombre vigente, `<input type="hidden" name="memberId">`, botones «Cancelar» (`type="button"`) / «Guardar» (submit, `disabled={isPending}`), `useActionState(renameMember, …)`, toast sonner «Miembro renombrado» + cierre al éxito, error `role="alert"` + `aria-describedby` con el valor conservado (ui-contract §3/§7); verificar T024 en verde
- [ ] T030 [P] [US1] Crear `src/infrastructure/primary/ui/rename-account-dialog.tsx` (client, ídem patrón): título «Renombrar cuenta», label «Nombre de la cuenta», input controlado precargado con el nombre almacenado de la común, `<input type="hidden" name="accountId">`, «Cancelar»/«Guardar», toast «Cuenta renombrada» (ui-contract §4/§7); verificar T025 en verde
- [ ] T031 [US1] Modificar `src/infrastructure/primary/ui/account-card-grid.tsx`: ítem «Renombrar miembro» como **primero** del menú ⋮ de cada tarjeta personal (vía `account.memberId`/`account.memberName` del DTO, abre `RenameMemberDialog`); la tarjeta común gana trigger ⋮ (mismo patrón stretched-link + `relative z-10`, ≥ 44 px, `aria-label={`Configuración de ${account.name}`}`) con único ítem «Renombrar cuenta» (abre `RenameAccountDialog`); ambos diálogos montados condicionalmente **dentro de la tarjeta** (catálogo estable, excepción documentada AGENTS.md); el clic en ⋮ nunca navega; el resto de ítems y la etiqueta de tipo intactos (ui-contract §1–§2/§7, research §5); verificar T026 en verde
- [ ] T032 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde; confirmar que `src/app/` (página `/`, páginas de cuenta, `/summary`, `/annual`) **no requiere cambios**: ya consumen `AccountDTO.name` (ahora nombre mostrado) y `memberName` — la propagación es por construcción (plan.md «Project Structure», research §4)

**Checkpoint**: US1 funcional: renombrado de miembro y de la cuenta común desde el panel con validación usable, toasts y revalidación de layout; panel y vistas derivadas muestran los nombres nuevos sin recarga manual (SC-001) y sin tocar un solo dato histórico (SC-002).

---

## Phase 4: E2E del flujo crítico (FR-007, constitución III)

**Purpose**: Spec nueva en fichero propio (`renombrado-cuentas-miembros.spec.ts`, serial, prefijos R1…) con restauración final de los nombres del seed; sin movimientos nuevos (sin contaminación numérica). Posición alfabética verificada con `workers: 1`: corre **tras** `registro-movimientos` (que aserta el balance histórico de «Cuenta de Miembro A» por nombre antes de cualquier renombrado) y **antes** de `resumen-global` (que lee nombres dinámicos ya restaurados) (research §8). Enmienda puntual de `panel-cuentas.spec.ts` N1 (la común ahora tiene ⋮).

- [ ] T033 [P] [US1] Crear `e2e/renombrado-cuentas-miembros.spec.ts` (serial, specs en serie dentro del fichero): R1 renombrar «Miembro A»→«Isma» desde ⋮ de su tarjeta → toast «Miembro renombrado», tarjeta «Cuenta de Isma», `<h1>` de su página de cuenta y fila «Isma» en `/summary` con los mismos importes; R2 renombrar la común → «Cuenta conjunta» → tarjeta y página con el nuevo nombre; R3 validación: vacío → «El nombre del miembro es obligatorio.» con valor conservado; duplicado nocase: renombrar «Miembro B»→«ISMA» con «Isma» existente → `Ya existe un miembro con el nombre "ISMA".` sin guardado; R4 trim: `  Sole  ` → «Sole» con tarjeta «Cuenta de Sole»; R5 **test final de restauración**: devolver los nombres del seed («Miembro A», «Miembro B», «Cuenta común») y verificar el panel inicial (ui-contract §6, research §8)
- [ ] T034 [P] [US1] Enmendar `e2e/panel-cuentas.spec.ts` N1 (depende de T031): «⋮ solo en personales» pasa a «⋮ en las 3 tarjetas» — el assert de ausencia del menú en la común (línea 48) se invierte (botón «Configuración de Cuenta común» visible con su ítem «Renombrar cuenta»); N2–N5 intactos (research §8)
- [ ] T035 [US1] Ejecutar `npm run test:e2e` y verificar todas las specs en verde (las existentes sin cambios esperados — la restauración final de la spec nueva protege a `resumen-global` y re-ejecuciones; ajustar solo si un literal afectado lo exige)

**Checkpoint**: Flujo crítico «renombrar miembro/cuenta común desde el panel → propagación a vistas con histórico intacto» cubierto end-to-end (SC-001/SC-002, FR-007).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva y roadmap maestro actualizados en el mismo cambio (constitución III DoD, FR-008, research §9). Incluye **ADR 0020** (cambia el esquema y el contrato de lectura de `accounts`: decisión de modelo, no simple patrón UI).

- [ ] T036 [P] Crear `docs/architecture/adr/0020-nombre-cuenta-personal-derivado.md`: `accounts.name` nullable (NULL en personales) + derivación en lectura (`personalAccountDisplayName` aplicada en `findAll` → `AccountDTO.name` = nombre mostrado) + unicidad nocase con índices `lower(name)` y backstop de carrera (research §1/§2/§4; alternativas rechazadas incluidas)
- [ ] T037 [P] Actualizar `docs/architecture/diagrams/`: extender `domain-model.md` con `Member.rename`, `Account.name: string | null` + `rename` solo-shared, puertos ampliados, `RenameMember`/`RenameAccount` y `personalAccountDisplayName` (base: data-model §1.4), y `panel-cuentas-sequence.md` con la variante «renombrar desde la tarjeta» (base: plan.md §Diagramas de diseño)
- [ ] T038 [P] Actualizar `AGENTS.md` (sección Convenciones, amenda de la convención de tarjetas de 020): el ⋮ existe en las 3 tarjetas (personales: «Renombrar miembro» primero + config 018/019/023; común: «Renombrar cuenta» como único ítem); el nombre mostrado de una cuenta personal es siempre el derivado «Cuenta de {miembro}» — nunca almacenado, la UI jamás lo concatena (derivación única en el repositorio)
- [ ] T039 [P] Actualizar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-008): marcar la fila 008 como **Completada en su mitad «renombrar»** con nota datada 2026-10-29 de que la mitad «añadir» (altas de miembros y cuentas) queda aplazada a una feature futura por decisión del propietario
- [ ] T040 Validar manualmente los escenarios Q1–Q7 de `specs/008-gestion-cuentas-miembros/quickstart.md` con `npm run dev` sobre BD migrada (`npm run db:migrate && npm run db:seed`); dejar los nombres del seed restaurados al terminar
- [ ] T041 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-003, DoD)

**Checkpoint**: Documentación viva, ADR, AGENTS.md, roadmap y quickstart sincronizados con la implementación; feature entregada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatemente.
- **Foundational (Phase 2)**: Depende de Phase 1. **Bloquea US1** (actions, menús/diálogos y e2e consumen los casos de uso, la derivación y el esquema). Dentro de la fase: tests rojos de módulos puros (T003–T007) → dominio (T008–T009) → derivación + puertos (T010–T012) → casos de uso (T013–T014) → esquema y migración (T015–T016) → test de repos (T017, necesita la migración para libsql `:memory:`) → repos + mapper (T018–T019) → seed (T020) → gate (T021); la dirección de dependencias es hacia abajo, nunca al revés (constitución VII).
- **US1 (Phase 3)**: Depende de Phase 2 completa. Tests rojos primero (T022–T026) → actions (T027–T028) → diálogos (T029–T030) → grid (T031) → gate + verificación de páginas intactas (T032).
- **E2E (Phase 4)**: Depende de Phase 3 (UI completa operativa).
- **Polish (Phase 5)**: Depende de todas las anteriores (docs, ADR y roadmap reflejan lo implementado); T040–T041 al final.

### User Story Dependencies

- **US1 (P1, única)**: Tras Phase 2. Independientemente testable vía quickstart Q1–Q7 y las suites por capa; el MVP de la feature es la propia US1 completa (Phase 1–4).

### Within Each User Story

- Tests primero y en rojo antes de su SUT (T003–T007 → T008–T014; T022–T026 → T027–T031).
- Dominio (T008–T009) antes de los puertos (T011–T012) y de los casos de uso (T013–T014 los consumen); `display-name` (T010) antes del repositorio que lo aplica (T019).
- Esquema (T015) antes de la migración (T016); migración antes del test de repos sobre `:memory:` (T017) y del seed (T020); repos (T018–T019) ponen T017 en verde.
- Actions (T027–T028) antes de los diálogos que las invocan (T029–T030); diálogos antes del grid que los monta (T031).
- E2E tras la UI completa; gates acumulativos al final de cada fase.

### Parallel Opportunities

- Phase 2: T003 ∥ T004 ∥ T005 ∥ T006 ∥ T007 (ficheros distintos, en rojo); luego T008 ∥ T009 ∥ T010 ∥ T011 ∥ T012 (ficheros distintos); T013 ∥ T014 (tras puertos y dominio); T015 ∥ T013/T014 (ficheros distintos); T017 tras T016 en paralelo con nada de repos (T018/T019 lo verdean); T018 ∥ T019 tras T016 (ficheros distintos).
- Phase 3: T022 ∥ T023 ∥ T024 ∥ T025 ∥ T026 (ficheros distintos, en rojo); luego T027 ∥ T028 y T029 ∥ T030 (ficheros distintos).
- Phase 4: T033 ∥ T034 (specs e2e distintas).
- Phase 5: T036 ∥ T037 ∥ T038 ∥ T039 (docs/AGENTS/roadmap, ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Launch red tests together:
Task: "Create rename-member.action.test.ts (src/infrastructure/primary/actions/)"
Task: "Create rename-account.action.test.ts (src/infrastructure/primary/actions/)"
Task: "Create rename-member-dialog.test.tsx (src/infrastructure/primary/ui/)"
Task: "Create rename-account-dialog.test.tsx (src/infrastructure/primary/ui/)"
Task: "Ampliar account-card-grid.test.tsx (⋮ en las 3 tarjetas)"

# Tras el rojo, actions y diálogos en paralelo (ficheros distintos):
Task: "Create rename-member.action.ts + rename-account.action.ts (secuencial si se prefiere)"
Task: "Create rename-member-dialog.tsx"
Task: "Create rename-account-dialog.tsx"
# y después el grid (monta ambos diálogos):
Task: "Modify account-card-grid.tsx (⋮ común + «Renombrar miembro» primero en personal)"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Complete Phase 1: línea base verde
2. Complete Phase 2: backend fundacional (esquema `0007` → dominio → aplicación → repos → seed)
3. Complete Phase 3: US1 — actions + diálogos + ⋮ en las 3 tarjetas (quickstart Q1–Q7)
4. **STOP and VALIDATE**: `npm run lint && npm run typecheck && npm run test` + validación manual Q1–Q7
5. Complete Phase 4: e2e del flujo crítico (`renombrado-cuentas-miembros.spec.ts` con restauración final + enmienda N1 de `panel-cuentas`)
6. Complete Phase 5: ADR 0020, docs vivas, AGENTS.md, roadmap (FR-008) y gates completos (SC-003)

### Incremental Delivery

- Feature de una sola US (constitución II, alcance reducido 2026-10-29): el valor de usuario llega con Phase 3. Phase 2 es un checkpoint técnico (renombrado operable solo vía código, sin UI), no un despliegue parcial.

### Parallel Team Strategy

- Para 1 desarrollador (real): estrictamente secuencial por fases. Con varios: tras los tests rojos de Phase 2, dominio/aplicación/esquema avanzan en ficheros distintos; T022–T026 en rojo en paralelo; docs de Phase 5 en paralelo.

---

## Notes

- [P] tasks = different files, no dependencies
- El negocio vive en dominio/aplicación (`rename` con invariantes, unicidad nocase con backstop BD, derivación en UNA función pura); la UI consume `AccountDTO.name` (nombre mostrado) y **jamás** concatena «Cuenta de» ni recalcula (constitución VII)
- `AccountDTO` no cambia de forma: cambia la semántica de `name` a «nombre mostrado» — todas las vistas (panel, cuenta, `/summary`, `/annual`) quedan intactas y con el seed no hay regresión visual (el derivado es literalmente el nombre actual)
- Renombrar **no escribe nada** fuera de `members`/`accounts`: notas materializadas congelan el nombre del momento (son contenido del movimiento, FR-001/SC-002); las materializaciones futuras usan el nombre vigente
- Las notas de migración: recreación de tabla preservando ids (FKs intactas); los índices nocase fallarían con duplicados case-insensitive previos — imposible con el seed actual (verificado en research §1)
- Literales congelados en `contracts/ui-contract.md` (§1–§4, §6): no improvisar variantes; mensajes de error exactos en las tablas de §3/§4
- E2E: `renombrado-cuentas-miembros.spec.ts` opera sin movimientos nuevos y **restaura los nombres del seed en el último test** (serial) — obligatorio, no cosmético: protege `resumen-global` y re-ejecuciones; el orden alfabético con `workers: 1` la sitúa tras `registro-movimientos` y antes de `resumen-global` (AGENTS.md, research §8)
- Altas de miembros/cuentas, borrado, cambio de tipo/atribución y renombrado independiente de cuentas personales quedan FUERA de alcance (FR-005): cualquier tarea que los requiera es señal de desviación del plan
- Commit after each task or logical group (Conventional Commits, en español el enunciado cuando aporte claridad)
