# Tasks: Registro de Movimientos con Tags

**Input**: Design documents from `/specs/002-registro-movimientos/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/ui-contract.md, contracts/create-movement-action.md, quickstart.md, `.specify/memory/constitution.md`

**Tests**: REQUERIDOS en esta feature (constitución, principio III: la lógica de negocio MUST estar cubierta por tests automatizados y el flujo crítico "registrar movimiento" MUST tener e2e con Playwright en CI). Cada módulo incluye sus tests co-localizados junto al SUT (`*.test.ts` / `*.test.tsx`).

**Organization**: Una única user story (US1, P1) que entrega el scaffolding completo + modelo de datos + pantalla principal. Fases: Setup → Foundational (persistencia y semilla) → US1 (dominio → aplicación → adaptadores → e2e) → Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js: `src/` (domain, application, app, infrastructure) en la raíz del repositorio, conforme a la estructura del [plan.md](./plan.md).
- Tests co-localizados junto a su SUT; e2e en `e2e/`.

---

## Phase 1: Setup (Scaffolding de la aplicación)

**Purpose**: Primer código del repositorio: monolito Next.js (App Router) + TypeScript estricto + tooling de calidad. Hasta ahora NO existe `package.json` ni código fuente (asunción de la spec).

- [ ] T001 Inicializar el monolito Next.js (App Router) con TypeScript estricto: `package.json` con dependencias (next, react, react-dom, drizzle-orm ~0.44.x, @libsql/client, zod, sonner) y devDependencies (typescript, drizzle-kit, tsx), `tsconfig.json` en modo strict con paths `@/*` → `./src/*`, y adaptadores mínimos `src/app/layout.tsx`, `src/app/globals.css` y `src/app/page.tsx` (placeholder en español) según estructura del plan
- [ ] T002 Configurar Tailwind CSS e inicializar shadcn/ui: `components.json`, `src/app/globals.css` con el tema base y componentes copiados y versionados en `src/infrastructure/primary/ui/components/ui/` (button, input, label, checkbox, select, radio-group, sonner) — única librería de componentes autorizada (ADR 0005)
- [ ] T003 [P] Configurar ESLint 9 (flat config con `eslint-config-next/core-web-vitals` + `/typescript` + `eslint-config-prettier/flat`) en `eslint.config.mjs` y Prettier en `prettier.config.mjs`, con scripts `lint` y `format` en `package.json` (research.md §4)
- [ ] T004 [P] Configurar Vitest con `test.projects` en `vitest.config.mts`: proyecto `node` para `src/{domain,application,infrastructure}/**/*.test.ts` y proyecto `ui` (jsdom, @vitejs/plugin-react, vite-tsconfig-paths) para `src/infrastructure/primary/**/*.test.tsx`, con setup de @testing-library/jest-dom y script `test` (research.md §4)
- [ ] T005 [P] Configurar Playwright en `playwright.config.ts` con `webServer: { command: 'npm run build && npm run start', reuseExistingServer: !CI }` y `workers: CI ? 1 : undefined`, directorio `e2e/` y script `test:e2e` (research.md §4)
- [ ] T006 [P] Crear workflow de CI en `.github/workflows/ci.yml`: job de calidad (lint + typecheck + vitest) y job e2e (`playwright install --with-deps` + build + start + reporte como artefacto), en jobs separados (ADR 0006)
- [ ] T007 Verificar el scaffolding: `npm install`, `npm run lint` y `npm run typecheck` en verde, y `npm run dev` renderiza el placeholder en `http://localhost:3000`

---

## Phase 2: Foundational (Persistencia y datos preconfigurados)

**Purpose**: Esquema Drizzle + migraciones + cliente + seed: infraestructura que bloquea toda la historia de usuario (FR-001, FR-013).

**⚠️ CRITICAL**: US1 no puede implementarse hasta completar esta fase.

- [ ] T008 Crear excepción base de dominio `DomainError` en `src/domain/shared/DomainError.ts` (sin dependencias externas, principio VII)
- [ ] T009 Definir el esquema Drizzle completo en `src/infrastructure/db/schema/`: `members`, `accounts` (UNIQUE(name), member_id NULL si común), `tags` (UNIQUE(slug) + `uniqueIndex("tags_name_nocase_uq").on(sql\`lower(name)\`)`, FR-007), `movements` (`amount_cents: integer`, `date` TEXT ISO, índice `(account_id, date)`) y `movement_tags` (PK compuesta, FKs con onDelete cascade) según data-model.md §2.1
- [ ] T010 Crear `drizzle.config.ts` (SQLite fichero dev) y `drizzle.prod.config.ts` (Turso: url + authToken por env), generar la migración inicial con drizzle-kit y versionarla en `drizzle/`, y añadir script `db:migrate` (migración por script explícito, nunca en runtime serverless; research.md §3.1)
- [ ] T011 Crear el cliente de BD en `src/infrastructure/db/client.ts`: `file:./db.sqlite` en dev, `libsql://` + authToken en prod por env, con entry `/web` en Vercel (research.md §3.7)
- [ ] T012 Crear datos precargados tipados en `src/infrastructure/db/seed-data.ts` (2 miembros placeholders editables "Miembro A"/"Miembro B", 3 cuentas: 2 personales + 1 común, 12 tags activas con slug: Hogar, Coche, Salud, Alimentación, Ocio, Viaje, Ropa, Regalos, Suscripciones online, Sin Clasificar, Vivienda, Hipoteca) y el script idempotente `scripts/seed.ts` (tsx, `onConflictDoNothing` sobre claves naturales) con script `db:seed` (research.md §3.2)
- [ ] T013 Verificar la foundational: `npm run db:migrate` crea el SQLite local y `npm run db:seed` ejecutado DOS veces no duplica ni falla (idempotencia)

**Checkpoint**: Persistencia lista — puede comenzar US1.

---

## Phase 3: User Story 1 - Registrar gastos e ingresos con tags (Priority: P1) 🎯 MVP

**Goal**: Registrar movimientos (gasto/ingreso) con fecha, concepto, descripción opcional, importe, cuenta, tipo, naturaleza (solo gastos) y 0..n tags del catálogo; verlos en el listado del mes/cuenta con balance acumulado, con validación por campo y persistencia (FR-001..FR-018).

**Independent Test**: Registrar movimientos de cada tipo (gasto personal, gasto compartido —incluido uno compartido pagado desde cuenta personal—, gasto sin tags e ingreso) y verificar que quedan guardados con sus campos y tags, que el balance de la cuenta se actualiza, que aparecen en el listado del mes/cuenta correspondientes y que persisten tras reiniciar `npm run dev` (quickstart.md E1–E8).

### Dominio (TDD: tests primero, en rojo antes de implementar)

- [ ] T014 [P] [US1] Escribir tests unitarios de `Money` en `src/domain/movement/Money.test.ts`: `fromCents` exige entero > 0 y ≤ 999.999.999,99 €, `fromCentsOrZero` permite 0/negativos, `add`/`subtract` aritmética entera exacta sin floats (10,29 + 0,01 = 10,30), inmutabilidad, rechazos con `InvalidMoneyError`
- [ ] T015 [US1] Implementar el VO `Money` en `src/domain/movement/Money.ts` e `InvalidMoneyError` en `src/domain/movement/MovementErrors.ts` conforme a data-model.md §1.1 (ADR 0007: céntimos enteros, sin conversión a/from float)
- [ ] T016 [P] [US1] Crear VOs de enums e IDs en el dominio: `src/domain/movement/MovementType.ts` ('expense'|'income'), `src/domain/movement/ExpenseNature.ts` ('personal'|'shared'), `src/domain/account/AccountType.ts` ('personal'|'shared'), `src/domain/tag/TagStatus.ts` ('active'|'inactive') y wrappers `MemberId.ts`, `AccountId.ts`, `TagId.ts`, `MovementId.ts` (number)
- [ ] T017 [US1] Escribir tests unitarios de `Movement.create` en `src/domain/movement/Movement.test.ts`: naturaleza obligatoria en gastos y prohibida en ingresos, concepto no vacío tras trim, amount > 0, tagIds deduplicados, fecha ISO de calendario, inmutabilidad (data-model.md §1.2)
- [ ] T018 [US1] Implementar la entidad `Movement` en `src/domain/movement/Movement.ts` (factory `create`, raíz del agregado, inmutable) y `InvalidMovementError` en `src/domain/movement/MovementErrors.ts`
- [ ] T019 [P] [US1] Implementar entidades y errores restantes: `src/domain/account/Account.ts` + `src/domain/account/AccountErrors.ts` (invariante memberId obligatorio si personal / null si shared), `src/domain/tag/Tag.ts` + `src/domain/tag/TagErrors.ts` (`DuplicateTagNameError` case-insensitive, `InactiveTagError`), `src/domain/member/Member.ts` (data-model.md §1.2, §1.4)

### Aplicación (puertos + casos de uso, TDD)

- [ ] T020 [US1] Definir DTOs y puertos en `src/application/`: `src/application/movement/dto.ts` (CreateMovementDTO, MovementDTO), puertos `src/application/movement/MovementRepository.ts`, `src/application/account/AccountRepository.ts` (incluye `getBalance`), `src/application/tag/TagRepository.ts` y `src/application/member/MemberRepository.ts` (los puertos viven en aplicación, no en dominio; constitución VII)
- [ ] T021 [US1] Escribir tests del caso de uso `CreateMovement` en `src/application/movement/CreateMovement.test.ts` con dobles en memoria de los puertos: happy path con tags, naturaleza por defecto `'shared'` si la cuenta es común, rechazo de tag inexistente/inactiva, rechazo de naturaleza en ingreso, verificación de que el repositorio recibe el agregado con tagIds deduplicados
- [ ] T022 [US1] Implementar `CreateMovement` en `src/application/movement/CreateMovement.ts`: orquesta validación de cuenta y tags activas, aplica reglas de naturaleza (FR-005) y persiste vía `MovementRepository`
- [ ] T023 [P] [US1] Implementar queries de lectura en `src/application/movement/ListMovements.ts` (mes+cuenta, orden fecha descendente), `src/application/account/ListAccounts.ts` y `src/application/tag/ListActiveTags.ts`, con sus tests co-localizados usando dobles de los puertos

### Infraestructura saliente (adaptadores Drizzle)

- [ ] T024 [P] [US1] Implementar mappers dominio ↔ tablas en `src/infrastructure/db/mappers/` (fila ↔ Movement/Account/Tag/Member, `amount_cents` ↔ `Money`, sin floats)
- [ ] T025 [US1] Escribir tests de integración de `DrizzleMovementRepository` en `src/infrastructure/db/DrizzleMovementRepository.test.ts` contra libsql `:memory:` aplicando las migraciones de `drizzle/` (research.md §4): alta de movimiento + tags atómica (`db.batch`), listado por mes/cuenta con rango semicerrado `[YYYY-MM-01, mesSiguiente-01)` sargable, filtro solo por fecha del movimiento (FR-004)
- [ ] T026 [US1] Implementar `DrizzleMovementRepository` en `src/infrastructure/db/DrizzleMovementRepository.ts` (implementa el puerto: create con `db.batch` atómico, listByMonthAndAccount con tags incluidas, orden por fecha descendente)
- [ ] T027 [P] [US1] Implementar `DrizzleAccountRepository` en `src/infrastructure/db/DrizzleAccountRepository.ts` (incluye `getBalance`: `SUM(CASE WHEN type='income' THEN amount_cents ELSE -amount_cents END)`, ADR 0009), `DrizzleTagRepository` en `src/infrastructure/db/DrizzleTagRepository.ts` y `DrizzleMemberRepository` en `src/infrastructure/db/DrizzleMemberRepository.ts`, con tests de integración `:memory:` que verifican balance exacto con ingresos + gastos (SC-003) y unicidad case-insensitive de tags (FR-007)

### Adaptador inbound: Server Action + UI

- [ ] T028 [US1] Implementar la Server Action `createMovement` en `src/infrastructure/primary/actions/create-movement.action.ts` (`'use server'`): esquema Zod de FormData (amount regex `^\d{1,9}([.,]\d{1,2})?$` parseado a céntimos por string sin parseFloat, fecha de calendario real, naturaleza condicional, tagIds deduplicados), mapeo de `ZodError`/excepciones de dominio a `CreateMovementState` con errores por campo y `values` conservados, mensajes exactos en español del contrato, `revalidatePath('/')` en éxito y sin redirect (contracts/create-movement-action.md íntegro; ADR 0008)
- [ ] T029 [US1] Escribir tests de la action en `src/infrastructure/primary/actions/create-movement.action.test.ts` mockeando `CreateMovement` con `vi.mock`: errores y mensajes por campo (importe vacío/0/negativo/`abc`/`1.234,56`, concepto vacío, naturaleza ausente en gasto, naturaleza en ingreso), conservación de `values`, nada se persiste en fallo, éxito devuelve `status: 'success'`
- [ ] T030 [P] [US1] Crear helper de formateo es-ES en `src/infrastructure/primary/ui/format.ts`: importe con Intl `es-ES` EUR y signo contable explícito (`−85,00 €` gasto / `+1.500,00 €` ingreso; cuidado con el espacio no rompible en tests, research.md §1)
- [ ] T031 [P] [US1] Crear componente `account-balance.tsx` en `src/infrastructure/primary/ui/account-balance.tsx`: balance acumulado de la cuenta activa (histórico completo), formato español, puede ser negativo, actualizado tras cada registro (ui-contract §2.2; depende de T030)
- [ ] T032 [P] [US1] Crear componente `empty-state.tsx` en `src/infrastructure/primary/ui/empty-state.tsx`: estado vacío "Aún no hay movimientos en este mes. Registra el primero con el formulario superior." (FR-018)
- [ ] T033 [P] [US1] Crear componente `movement-list.tsx` en `src/infrastructure/primary/ui/movement-list.tsx`: columnas fecha, concepto (descripción secundaria), importe con signo, tipo ("Gasto"/"Ingreso"), naturaleza ("Personal"/"Compartido", solo gastos), chips de tags y chip "Sin clasificar" si no lleva tags, orden fecha descendente (FR-009; depende de T030)
- [ ] T034 [P] [US1] Crear componente `account-month-selector.tsx` en `src/infrastructure/primary/ui/account-month-selector.tsx` (`'use client'`): dropdowns de cuenta (3 cuentas, parámetro primario) y mes (navegable pasado/futuro), sincroniza la URL `/?account=<id>&month=YYYY-MM` con `router.replace` + `useTransition` (ui-contract §1, §2.1; ADR 0008)
- [ ] T035 [US1] Crear el formulario `movement-form.tsx` en `src/infrastructure/primary/ui/movement-form.tsx` (`'use client'`): `useActionState` con la action T028, campos según ui-contract §2.3 (fecha default hoy, cuenta activa no editable como hidden `accountId`, tipo gasto/ingreso default gasto, naturaleza preseleccionada 'personal' editable en cuenta personal y 'shared' deshabilitada en la común, checkboxes del catálogo activo), errores por campo bajo su input con `aria-describedby`, valores conservados tras fallo (`defaultValue`), toast "Movimiento guardado" + reset a defaults + botón "Guardando…" `pending` en éxito (FR-011, FR-014..FR-016)
- [ ] T036 [US1] Componer la pantalla principal en `src/app/page.tsx` (adaptador fino, render en servidor): leer y validar searchParams `account` (default: primera cuenta personal) y `month` (default: mes actual), ejecutar los use cases (ListAccounts, ListActiveTags, ListMovements, getBalance) e integrar selectores (T034), balance (T031), formulario (T035), listado (T033) y estado vacío (T032) según ui-contract, con layout responsive apilado en móvil (ui-contract §4)
- [ ] T037 [US1] Escribir tests de UI (jsdom + RTL) del formulario en `src/infrastructure/primary/ui/movement-form.test.tsx`: render con defaults según tipo de cuenta, errores por campo con mensajes del contrato, valores conservados tras fallo, naturaleza deshabilitada en cuenta común, toast y reset en éxito

### E2E (flujo crítico, ADR 0006)

- [ ] T038 [US1] Escribir el test e2e de Playwright del flujo crítico de registro en `e2e/registro-movimientos.spec.ts` contra `build + start` con BD migrada y sembrada: E1 gasto compartido de 850,00 € con tags Vivienda+Hipoteca en la cuenta común (visible con ambas tags, balance −850,00 €), E2 gasto compartido pagado desde cuenta personal, E3 ingreso nómina 1.500,00 € con balance actualizado, y validación de importe inválido sin guardado nada (quickstart.md E1–E4)

**Checkpoint**: US1 completa — la app sustituye al Excel en su alcance; verificar quickstart.md E1–E8 manualmente.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentación (incluidos diagramas UML/C4 del diseño que aporta US1), verificación de aceptación y gates finales (Definition of Done de la constitución).

- [ ] T039 [P] Registrar los ADRs de las decisiones de diseño del plan en `docs/architecture/adr/`: `0007-dinero-centimos-enteros.md`, `0008-server-actions-searchparams.md` y `0009-balance-derivado-no-persistido.md` (plan.md §Complexity Tracking)
- [ ] T040 [P] Actualizar `README.md` con puesta en marcha (install, db:migrate, db:seed, dev, gates), estructura de capas y comandos disponibles (espejo de quickstart.md)
- [ ] T041 [P] Actualizar `docs/architecture/overview.md` y `AGENTS.md` con las convenciones fijadas en implementación (tests co-localizados junto al SUT, vitest projects node/ui, formateo Intl es-ES solo en adaptadores UI, migración pre-deploy a Turso)
- [ ] T042 [P] Crear diagramas C4 en mermaid en `docs/architecture/diagrams/c4.md`: nivel contexto (navegador → monolito Next.js → Turso) y nivel contenedor/componente con la vista hexagonal construida por US1 (dominio, aplicación con puertos, adaptadores inbound Server Action + UI + page.tsx, adaptadores outbound repositorios Drizzle), enlazados desde `docs/architecture/overview.md` como documento vivo de la evolución del diseño (features 003+ los extienden)
- [ ] T043 [P] Crear diagrama de secuencia en mermaid del flujo crítico "registrar movimiento" en `docs/architecture/diagrams/registro-movimiento-sequence.md`: movement-form (useActionState) → Server Action createMovement (Zod, parse céntimos) → CreateMovement (aplicación) → MovementRepository (puerto) → DrizzleMovementRepository (db.batch) → Turso → revalidatePath('/') → render en servidor de listado/balance (ADR 0008), incluyendo el camino de error de validación (nada se persiste, valores conservados)
- [ ] T044 [P] Crear diagrama de clases UML en mermaid del modelo de dominio en `docs/architecture/diagrams/domain-model.md`: agregado `Movement` (raíz), VOs `Money`/`MovementType`/`ExpenseNature`, relaciones Member 1──0..1 Account 1──n Movement n──n Tag e invariantes clave (naturaleza solo en gastos, balance derivado), enlazado desde `docs/architecture/overview.md` y el glosario de data-model.md
- [ ] T045 Ejecutar la verificación manual completa de `specs/002-registro-movimientos/quickstart.md` (E1–E8 + comprobación inicial + verificación adicional) sobre `npm run dev` con BD migrada y sembrada
- [ ] T046 Verificar los gates finales: `npm run lint`, `npm run typecheck`, `npm run test` y `npm run test:e2e` en verde en local, y CI de GitHub Actions en verde tras push

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar por aquí (primer código del repositorio).
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEA US1.
- **US1 (Phase 3)**: Depende de Phase 2 completa; internamente secuencial por capas: dominio → aplicación → adaptadores salientes → adaptador inbound (action/UI) → e2e.
- **Polish (Phase 4)**: Depende de US1 completa (T038) para T045/T046; T039–T044 pueden arrancar en paralelo con el final de la fase US1.

### User Story Dependencies

- **US1 (P1)**: Única historia de la feature; puede empezar tras Phase 2. Sin dependencias entre historias.
- **Diagramas de diseño (T042–T044)**: Documentan lo construido por US1; pueden elaborarse en paralelo con el final de la fase US1 (tras T028–T036) y deben cerrarse antes de la verificación manual (T045).

### Within User Story 1

- Tests de cada módulo ANTES de su implementación (TDD): T014→T015, T017→T018, T021→T022, T025→T026, T029 tras T028, T037 tras T035.
- VOs/enums (T016) antes que entidades (T018, T019).
- Dominio (T014–T019) antes que aplicación (T020–T023); aplicación antes que adaptadores (T024–T027 para salida, T028 para entrada).
- La action (T028) depende del caso de uso (T022); el formulario (T035) depende de la action (T028) y del selector (T034); la página (T036) integra todo y habilita el e2e (T038).

### Parallel Opportunities

- Setup: T003, T004, T005 y T006 en paralelo tras T001–T002.
- Dominio: T014 (tests Money) y T016 (enums/IDs) en paralelo; T019 (Account/Tag/Member) en paralelo con la pareja T017–T018.
- Aplicación/infra: T023 (queries) y T024 (mappers) en paralelo; T027 (otros repositorios) en paralelo con T026 (movement repository).
- UI: T031, T032, T033, T034 (tras T030) en paralelo; T030 en paralelo con la action (T028–T029).
- Polish: T039, T040, T041 y los diagramas T042, T043, T044 (ficheros distintos) en paralelo.

---

## Parallel Example: User Story 1

```bash
# Bloque dominio (en paralelo):
Task: "T014 [P] [US1] Tests de Money en src/domain/movement/Money.test.ts"
Task: "T016 [P] [US1] Enums e IDs en src/domain/{movement,account,tag}/"

# Bloque UI (en paralelo, tras T028 y T030):
Task: "T031 [P] [US1] account-balance.tsx"
Task: "T032 [P] [US1] empty-state.tsx"
Task: "T033 [P] [US1] movement-list.tsx"
Task: "T034 [P] [US1] account-month-selector.tsx"

# Bloque polish (en paralelo):
Task: "T039 [P] ADRs 0007–0009 en docs/architecture/adr/"
Task: "T040 [P] README.md"
Task: "T041 [P] docs/architecture/overview.md + AGENTS.md"
Task: "T042 [P] Diagramas C4 en docs/architecture/diagrams/c4.md"
Task: "T043 [P] Diagrama de secuencia en docs/architecture/diagrams/registro-movimiento-sequence.md"
Task: "T044 [P] Diagrama de clases del dominio en docs/architecture/diagrams/domain-model.md"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Completar Phase 1: Setup (scaffolding + tooling + CI).
2. Completar Phase 2: Foundational (esquema, migraciones, cliente, seed idempotente).
3. Completar Phase 3: US1 capa a capa (dominio → aplicación → adaptadores → e2e).
4. **STOP y VALIDAR**: quickstart.md E1–E8 manualmente + gates en verde.
5. Demo/deploy (Vercel + Turso con migración y seed pre-deploy desde local).

### Incremental Delivery

1. Setup + Foundational → persistencia operativa (verificable con T013).
2. Dominio + aplicación → lógica de negocio verificable con tests unitarios.
3. Adaptadores + UI → pantalla principal usable en `npm run dev`.
4. E2E + Polish → Definition of Done de la constitución (gates CI en verde + documentación).

### Parallel Team Strategy

Con un único desarrollador (proyecto personal), el orden secuencial es el recomendado; los bloques [P] permiten intercalar trabajo sin conflictos de ficheros si hubiera capacidad adicional.

---

## Notes

- [P] tasks = different files, no dependencies
- [US1] label maps cada tarea a la user story para trazabilidad
- Cada par test→implementación debe verse en rojo antes de implementar (TDD)
- Commit tras cada tarea o grupo lógico (Conventional Commits, en español si aporta claridad)
- Verificar los checkpoints antes de avanzar de fase
- Evitar: tareas vagas, conflictos de mismo fichero, dependencias cruzadas entre historias
