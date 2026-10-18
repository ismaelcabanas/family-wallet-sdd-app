---
description: "Task list for feature 021 implementation"
---

# Tasks: Descuento de gastos comunes en la aportación mensual

**Input**: Design documents from `/specs/021-descuento-gastos-comunes/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/behavior-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-010 los exige explícitamente (unidad dominio/aplicación del cálculo neto, repositorios contra libsql `:memory:`, y flujo e2e del ajuste sin duplicados; constitución III). En rojo primero donde la feature añade comportamiento nuevo (`netAppliedToCents`, `MaterializeCommonContributions` reescrito, `sumSharedExpenseCents`, enlace blando + retirada en el repositorio de aportaciones); las ampliaciones se escriben contra los contratos congelados de data-model §1.2.1 y behavior-contract.

**Organization**: Una única user story pequeña (US1, P1 — constitución II, sin excepción): cada gasto de naturaleza común del mes en la cuenta personal reduce automáticamente la aportación de ese mes al consultar la cuenta. El cambio baja por las capas en la dirección de dependencias (VII): operación neta del VO puro en dominio → puertos extendidos + `MaterializeCommonContributions` reescrito (generación neta, re-sincronización del mes en curso, retirada) en aplicación → migración `0005` (columna `movement_id`) + repositorios Drizzle extendidos → inyección del puerto de movimientos en la página de cuenta (único disparador, ADR 0016/0017) → e2e en fichero propio. **Sin UI nueva**: formularios, actions, diálogos, cierres, `/summary` y `/annual` intactos (FR-008); el cambio es invisible salvo en el importe.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js (App Router): `src/` en la raíz del repositorio; migraciones en `drizzle/`; e2e en `e2e/`; docs vivos en `docs/architecture/`; roadmap maestro en `specs/001-family-wallet/spec.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar línea base verde y la rama feature antes de tocar código.

- [x] T001 Verificar línea base verde ejecutando `npm run lint && npm run typecheck && npm run test` (todo debe pasar antes de cualquier cambio)
- [x] T002 Confirmar la rama `feature/021-descuento-gastos-comunes` activa y el árbol limpio (creada por la extensión git de Spec Kit; worktree actualizado si se usa)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la fase fundacional.

---

## Phase 2: Foundational (Dominio → Aplicación → Persistencia — bloquea US1)

**Purpose**: Vertical del backend del descuento: `ContributionPercentage.netAppliedToCents` (max(0, bruto − gastos), enteros puros), puertos extendidos (`findMaterializedMovement`, `withdrawMaterialization`, `sumSharedExpenseCents`), `MaterializeCommonContributions` reescrito según las guardas §1.2.1 (generación neta + re-sincronización del mes en curso + retirada) y repositorios Drizzle con la columna blanda `movement_id` (migración `0005`, solo `ALTER TABLE`). Todo modificación quirúrgica: `movements`, `common_contributions`, `regular_incomes`, actions y CRUD intactos.

**Nota**: Conceptualmente estas tareas sirven solo a US1, pero no llevan label de historia: son prerrequisito compartido (backend) del enganche en la página y del e2e.

### Tests primero (en rojo)

- [x] T003 [P] Ampliar `src/domain/common-contribution/ContributionPercentage.test.ts` (rojo) con la tabla neta congelada de data-model §1.1: `netAppliedToCents(200000, 12000)` con 25 % → 38000; `netAppliedToCents(200000, 12055)` → 37945 (céntimos exactos); `netAppliedToCents(200000, 50000)` → 0 (suelo); `netAppliedToCents(200000, 62000)` → 0 (excedente, nunca negativo ni arrastre); además `appliedToCents` intacto (regresión half-up existente); ejecutar y confirmar rojo
- [x] T004 [P] Ampliar `src/application/common-contribution/MaterializeCommonContributions.test.ts` (rojo) extendiendo los dobles en memoria con los tres métodos nuevos (`findMaterializedMovement`, `withdrawMaterialization`, `sumSharedExpenseCents`) y el doble de `MovementRepository` en el constructor: matriz de research §8.4 — generación neta directa en primera consulta (escenario 7: se materializa ya descontando, no bruta-then-ajustada), generación con neto 0 → no-op **sin registrar el mes**, re-sincronización del mes en curso por alta/edición/eliminación de gastos comunes (`movements.update` con `Movement.recreate(movement.id, {…campos intactos…, amount: Money.fromCents(neto)}, movement.createdAt)`), idempotencia sin escritura si el neto iguala el importe vigente (4h), retirada con neto 0 → `withdrawMaterialization` (4g) y regeneración posterior si los gastos bajan, borrado del usuario (fila presente, movimiento `null`) → no-op definitivo aunque cambie el neto (4c, FR-006), mes cerrado registrado (`month !== currentMonth`) → congelado (4a, FR-003), config **desactivada** re-sincroniza el mes en curso ya generado pero **no genera** meses nuevos (5a solo en generación; clarify 2026-10-18, escenario 13), ingreso regular ausente/inactivo en re-sincronización → conserva el último importe (4e), sin config o ventana `activatedAtMonth ≤ month ≤ currentMonth` fuera → no-op; ejecutar y confirmar rojo
- [x] T005 [P] Ampliar `src/infrastructure/db/DrizzleMovementRepository.test.ts` (rojo, contra `createTestDb` libsql `:memory:`): `sumSharedExpenseCents(accountId, month)` suma solo gastos `nature = "shared"` de esa cuenta con fecha en el mes — excluye gastos personales, ingresos, otras cuentas y otros meses (edge «mes al que pertenece»); devuelve 0 (coalesce) sin movimientos; ejecutar y confirmar rojo
- [x] T006 [P] Ampliar `src/infrastructure/db/DrizzleCommonContributionRepository.test.ts` (rojo, contra `createTestDb` con migraciones reales): `registerMaterialization` persiste `movement_id` del movimiento insertado en la misma tx (fila legible con enlace válido); `findMaterializedMovement` devuelve el movimiento por enlace directo, resuelve **perezosamente** una fila legacy (`movement_id` NULL) por la heurística acotada (misma cuenta, `date = {month}-01`, `type = "expense"`, `nature = "personal"`, etiqueta slug `aportacion-comun`, nota con prefijo `Aportación común de `, `ORDER BY id LIMIT 1`) y persiste el enlace (auto-sanado), y devuelve `null` tras borrado del usuario (enlace huérfano o sin coincidencia); `withdrawMaterialization` borra movimiento enlazado + fila del registro en una tx y es idempotente (`false` si la fila ya no existe); la tx sigue perdiendo la carrera limpiamente en doble inserción del par `(config, mes)`; ejecutar y confirmar rojo

### Dominio, aplicación y persistencia

- [x] T007 [P] Implementar `netAppliedToCents(incomeCents: number, sharedExpenseCents: number): number` en `src/domain/common-contribution/ContributionPercentage.ts`: `max(0, this.appliedToCents(incomeCents) − sharedExpenseCents)` — enteros puros, el redondeo half-up vive solo en `appliedToCents` (FR-001, research §1); verificar T003 en verde
- [x] T008 [P] Ampliar los puertos: `src/application/common-contribution/CommonContributionRepository.ts` gana `findMaterializedMovement(contributionId: CommonContributionId, month: string): Promise<Movement | null>` y `withdrawMaterialization(contributionId: CommonContributionId, month: string): Promise<boolean>`; `src/application/movement/MovementRepository.ts` gana `sumSharedExpenseCents(accountId: AccountId, month: string): Promise<number>` (data-model §1.2, behavior-contract §6)
- [x] T009 Reescribir el flujo de `src/application/common-contribution/MaterializeCommonContributions.ts` según las guardas congeladas de data-model §1.2.1: constructor gana `movements: MovementRepository` (tercer parámetro); guardas 1–3 intactas (config existe con id; ventana lexicográfica `activatedAtMonth ≤ month ≤ currentMonth`, sin tocar `active` aquí); rama de re-sincronización si `isMaterialized` — 4a `month !== currentMonth` → return (congelado), 4b `findMaterializedMovement`, 4c `null` → return (borrado del usuario definitivo), 4d–4e ingreso regular existe y activo → si no, conserva importe, 4f `neto = config.percentage.netAppliedToCents(income.amount.amountCents, await movements.sumSharedExpenseCents(accountId, month))`, 4g `neto < 1` → `withdrawMaterialization` y return (retirada), 4h `neto === movement.amount.amountCents` → return (sin escritura), 4i distinto → `movements.update(Movement.recreate(movement.id, {accountId, type, date, note, amount: Money.fromCents(neto), nature, tagId}, movement.createdAt))`; rama de generación — 5a `!config.active` → return (la guarda de activa SOLO aquí; clarify 2026-10-18), 5b–5c ingreso activo + neto (no bruto), 5d `neto < 1` → return **sin registrar el mes**, 5e ensure de etiqueta + nota + `Movement.create` + `registerMaterialization` intactos de 019 (research §2/§5); verificar T004 en verde
- [x] T010 Crear `drizzle/0005_descuento-gastos-comunes.sql` con la única sentencia `ALTER TABLE common_contribution_months ADD COLUMN movement_id integer;` (sin datos; research §7), añadir su entrada a `drizzle/meta/_journal.json` (siguiendo el patrón de la `0004` manual) y añadir `movementId: integer("movement_id")` — sin `references` — a `commonContributionMonths` en `src/infrastructure/db/schema/common-contributions.ts`; aplicar en dev con `npm run db:migrate` y verificar `CREATE TABLE`/columna en BD
- [x] T011 [P] Implementar `sumSharedExpenseCents` en `src/infrastructure/db/DrizzleMovementRepository.ts`: `SELECT coalesce(sum(amount_cents), 0) FROM movements WHERE account_id = ? AND type = 'expense' AND nature = 'shared' AND date >= '{month}-01' AND date < '{nextMonth}-01'` — reutilizando `nextMonthFirstDay` del fichero (rango idéntico a `listByMonthAndAccount`, índice `idx_movements_account_date`; data-model §2.2); verificar T005 en verde
- [x] T012 Implementar en `src/infrastructure/db/DrizzleCommonContributionRepository.ts`: `registerMaterialization` calcula la id (`coalesce(max(movements.id), 0) + 1`) antes de insertar y persiste `movementId` en la fila del registro dentro de la misma tx (firma pública invariante `Promise<boolean>`; data-model §2.2); `findMaterializedMovement` — lee la fila, si `movement_id` no es NULL → `movements` por id (`null` si fue borrado: enlace huérfano a propósito), si es NULL (legacy) → heurística acotada de T06 con join a `tags` por slug `aportacion-comun` y `LIKE 'Aportación común de %'`, `ORDER BY movements.id LIMIT 1`, persiste el enlace resuelto y devuelve el movimiento, sin coincidencia → `null` (mes congelado); `withdrawMaterialization` — tx: `SELECT movement_id` → `DELETE movements` si existe → `DELETE FROM common_contribution_months WHERE (config, month)`, devuelve `true` si borró fila (idempotente); verificar T006 en verde
- [x] T013 Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (cambio quirúrgico: actions, UI y suites existentes sin cambios de forma)

**Checkpoint**: Maquinaria completa y testeada de dominio a BD: cálculo neto, re-sincronización del mes en curso con retirada, enlace blando con auto-sanado y SUM sellada; falta solo el enganche del disparador (página) para que US1 entregue valor.

---

## Phase 3: User Story 1 - La aportación del mes descuenta los gastos comunes ya pagados (Priority: P1) 🎯 MVP

**Goal**: Único cambio de adaptador inbound: `src/app/accounts/[accountId]/page.tsx` inyecta `movementRepository` (ya instanciado en la página) en `MaterializeCommonContributions`, activando la re-sincronización en la misma lectura que materializa — tras cualquier alta/edición/eliminación de un gasto común del mes en curso, la siguiente consulta de la cuenta muestra la aportación neta, una sola vez, sin edición manual (FR-001–FR-007, SC-001–SC-004).

**Independent Test**: Quickstart Q1–Q11: ingreso 2.000 € + 25 % → aportación −500,00; gasto común 120,00 → −380,00 al consultar; suma y céntimos exactos; edición/eliminación reflejadas; suelo cero con desaparición y reaparición; idempotencia con 5+ consultas y `/summary`/`/annual`; meses cerrados congelados; gasto personal/ingreso/otras cuentas sin efecto; borrado de la aportación definitivo; desactivación a mitad de mes sigue ajustando el mes en curso.

### Implementation para US1

- [x] T014 [US1] Modificar `src/app/accounts/[accountId]/page.tsx`: pasar `movementRepository` como tercer argumento del constructor de `MaterializeCommonContributions` (línea de construcción; el repositorio ya existe en la página, L45) manteniendo los dos `await` secuenciales tras `MaterializeRegularIncomes` y antes del `Promise.all` (mismo render cubre listado, cierre y balance; único disparador, ADR 0016/0017; plan §Componentes); sin ningún otro cambio en la página, actions ni vistas (FR-008)
- [x] T015 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde; con `npm run dev`, comprobar humo del flujo (configurar 25 % sobre 2.000 €, registrar gasto común 120 €, consultar → −380,00 € único)

**Checkpoint**: US1 funcional end-to-end por la UI existente: la aportación del mes en curso refleja los gastos comunes al consultar la cuenta; suites unitarias y de repositorio en verde.

---

## Phase 4: E2E del flujo crítico (FR-010, constitución III)

**Purpose**: Spec nueva en fichero propio con la única combinación viable (**Cuenta de Miembro B (`/accounts/2`) + mes en curso real**, research §8.1): corre tras `cierre-mensual` sobre la BD compartida `e2e.sqlite`, por lo que el **barrido inicial determinista** del gasto compartido «Hipoteca» (850,00) y la **restauración final exacta + desactivación** de aportación e ingreso regular son obligatorios para no contaminar a `pagina-cuenta`/`gestion-tags` ni romper el estado que `cierre-mensual` dejó. Las 10 specs existentes quedan intactas.

- [ ] T016 [US1] Crear `e2e/descuento-gastos-comunes.spec.ts` (serial, helpers locales al estilo de 019): barrido inicial (eliminar «Hipoteca» del mes en curso de B si existe); D1 configurar ingreso 2.000,00 + 25 % → aportación −500,00 única (nota «Aportación común de Miembro B»); D2 gasto compartido 120,55 → −379,45 (céntimos exactos); D3 idempotencia (recargas + `/summary` + `/annual` → 1 ítem, mismo importe); D4 segundo gasto 80 → −299,45 (suma); D5 editar 120,55 → 150 → −270; D6 eliminar el de 80 → −350; D7 gasto 400 (total ≥ bruto) → la aportación **desaparece** (suelo cero); D8 eliminar el de 400 → **reaparece** a −350 (retirada → regeneración); D9 gasto personal + ingreso sin efecto; D10 eliminar la aportación → no reaparece aunque cambie el neto (definitivo); D11 limpieza final: re-registrar «Hipoteca» (850,00, compartido, etiqueta Hipoteca, mes en curso) y desactivar aportación e ingreso regular de B (restaura el estado pre-021; research §8.2/§8.3)
- [ ] T017 [US1] Ejecutar `npm run test:e2e` y verificar las 11 specs en verde (las 10 existentes sin cambios esperados — ajustar solo si un literal afectado lo exige; orden alfabético e `workers: 1` intactos)

**Checkpoint**: Flujo crítico «aportación materializada → registrar/editar/eliminar gasto común → consultar → aportación ajustada exactamente una vez (o retirada/reaparición)» cubierto end-to-end (SC-005).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva, ADR 0019 y roadmap maestro actualizados en el mismo cambio (constitución III DoD, research §9, FR-009).

- [ ] T018 [P] Crear `docs/architecture/adr/0019-aportacion-neta-gastos-comunes.md`: modificación del cálculo de 019 — neto = bruto − Σ gastos comunes del mes con suelo 0 en céntimos enteros (extensión ADR 0007/0017), re-sincronización en lectura del mes en curso dentro de `ensureForAccountAndMonth` (único disparador; meses cerrados congelados; desactivación no congela el mes en curso, clarify 2026-10-18), enlace blando `movement_id` con resolución perezosa (frente a backfill SQL, por testabilidad), semántica retirada (neto 0, fila + movimiento, generación reabierta) frente a borrado del usuario (fila sin movimiento, definitivo) (research §9.1)
- [ ] T019 [P] Actualizar `docs/architecture/diagrams/aportacion-comun-secuencia.md` con la variante de re-sincronización del mes en curso (base: §Diagramas de diseño del plan; variante retirada incluida) y `docs/architecture/domain-model.md`/`overview.md` con la operación del VO, los métodos de puerto nuevos y la columna `movement_id` (sin entidades nuevas)
- [ ] T020 [P] Actualizar `AGENTS.md`: ampliar la convención «Materialización perezosa» con la nota de 021 — la aportación del mes en curso se re-sincroniza en la misma lectura (alta/edición/eliminación de gastos comunes ajustan el importe), retirada con neto 0 (fila + movimiento), borrado del usuario definitivo por la fila del registro, y la suma SQL sellada `sumSharedExpenseCents` como alcance (regla de oro 6, research §9.3)
- [ ] T021 [P] Preparar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-009): añadir la fila `021-descuento-gastos-comunes` (Estado: la que proceda al ejecutar; «Completada» se verifica en `/speckit.finish`) y nota datada 2026-10 amendando el cálculo de 019: la aportación mensual pasa a importe **neto** (bruto − gastos comunes del mes en la cuenta personal, suelo 0), con re-sincronización del mes en curso en lectura (research §9.4)
- [ ] T022 Validar manualmente los escenarios Q1–Q11 de `specs/021-descuento-gastos-comunes/quickstart.md` con `npm run dev` sobre BD migrada (`npm run db:migrate && npm run db:seed`)
- [ ] T023 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-005, DoD)

**Checkpoint**: Documentación viva, ADR, roadmap y quickstart sincronizados con la implementación; feature entregada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Depende de Phase 1. **Bloquea US1** (la página y el e2e consumen el use case reescrito y los puertos nuevos). Dentro de la fase: tests rojos (T003–T006) → VO + puertos (T007–T008) → use case (T009) → migración (T010) → repositorios (T011–T012) → gate (T013); la dirección de dependencias es hacia abajo, nunca al revés (constitución VII).
- **US1 (Phase 3)**: Depende de Phase 2 completa. Solo el enganche DI en la página (T014) y el gate + humo (T015).
- **E2E (Phase 4)**: Depende de Phase 3 (disparador operativo).
- **Polish (Phase 5)**: Depende de todas las anteriores (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US1 (P1, única)**: Tras Phase 2. Independientemente testable vía quickstart Q1–Q11 y las suites por capa; el MVP de la feature es la propia US1 completa (Phase 1–4).

### Within Each User Story

- Tests primero y en rojo antes de su SUT (T003–T006 → T007–T012).
- VO (T007) y puertos (T008) antes del use case (T009 consume ambos); puertos (T008) antes de los repos (T011–T012 los implementan); migración (T010) antes del repo de aportaciones (T012 ejercita `movement_id` contra migraciones reales).
- Página (T014) después del use case (T009 define su constructor); e2e (T016) tras la página; gates acumulativos al final de cada fase.

### Parallel Opportunities

- Phase 2: T003 ∥ T004 ∥ T005 ∥ T006 (ficheros distintos, en rojo); luego T007 ∥ T008 (ficheros distintos, sin dependencia mutua); tras T008+T010: T011 ∥ T012 (ficheros distintos: `DrizzleMovementRepository` vs `DrizzleCommonContributionRepository`).
- Phase 5: T018 ∥ T019 ∥ T020 ∥ T021 (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Launch red tests together:
Task: "Ampliar ContributionPercentage.test.ts (src/domain/common-contribution/)"
Task: "Ampliar MaterializeCommonContributions.test.ts (src/application/common-contribution/)"
Task: "Ampliar DrizzleMovementRepository.test.ts (src/infrastructure/db/)"
Task: "Ampliar DrizzleCommonContributionRepository.test.ts (src/infrastructure/db/)"

# Tras el rojo, VO y puertos en paralelo (ficheros distintos):
Task: "Implementar netAppliedToCents en ContributionPercentage.ts"
Task: "Ampliar CommonContributionRepository.ts y MovementRepository.ts (puertos)"
# secuenciales por dependencia:
Task: "Reescribir MaterializeCommonContributions.ts (guardas §1.2.1)"
Task: "Crear migración 0005 + columna en schema/common-contributions.ts"
# repositorios en paralelo (ficheros distintos):
Task: "Implementar sumSharedExpenseCents en DrizzleMovementRepository.ts"
Task: "Implementar enlace blando + withdraw en DrizzleCommonContributionRepository.ts"
# enganche del disparador:
Task: "Modificar src/app/accounts/[accountId]/page.tsx (inyecta movementRepository)"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Complete Phase 1: línea base verde
2. Complete Phase 2: backend (VO neto → puertos → use case con re-sincronización → migración `0005` → repos)
3. Complete Phase 3: US1 — enganche DI en la página de cuenta (quickstart Q1–Q11 verificables)
4. **STOP and VALIDATE**: `npm run lint && npm run typecheck && npm run test` + validación manual Q1–Q11
5. Complete Phase 4: e2e del flujo crítico (`descuento-gastos-comunes.spec.ts`, con barrido inicial y restauración final obligatorios)
6. Complete Phase 5: ADR 0019, docs vivas, AGENTS.md, roadmap (FR-009) y gates completos (SC-005)

### Incremental Delivery

- Feature de una sola US (constitución II): el valor de usuario llega con Phase 3. Phase 2 es un checkpoint técnico (cálculo y re-sincronización utilizables solo vía código, sin disparador), no un despliegue parcial.

### Parallel Team Strategy

- Para 1 desarrollador (real): estrictamente secuencial por fases. Con varios: tras los tests rojos de Phase 2, VO/puertos/use case/migración avanzan por dependencia y T011 ∥ T012 en ficheros distintos; docs de Phase 5 en paralelo.

---

## Notes

- [P] tasks = different files, no dependencies
- La regla de negocio vive en dominio y aplicación (`netAppliedToCents` y las guardas §1.2.1); la página solo cambia una línea de construcción (DI) y la UI no decide nada (constitución VII)
- La idempotencia sigue viviendo en `common_contribution_months` (`UNIQUE (config, mes)`), ahora también dueña del **enlace blando** `movement_id` (sin FK: el borrado del usuario no debe chocar y la fila debe sobrevivirle — research §3); el caso de uso nunca usa la heurística, solo el enlace
- Retirada ≠ borrado: neto 0 ⇒ `withdrawMaterialization` (movimiento **y fila**, generación reabierta); borrado del usuario ⇒ fila sin movimiento ⇒ no-op definitivo (FR-004/FR-006)
- La guarda `config.active` se evalúa SOLO en la rama de generación (5a): la desactivación detiene la generación futura, no congela el importe del mes en curso (clarify 2026-10-18, escenario 13, FR-007)
- `movements`, `regular_incomes`, actions, formularios, cierres, `/summary` y `/annual` intactos (FR-008): la aportación neta es un movimiento corriente; `/summary`/`/annual` pueden ir un ajuste por detrás hasta visitar la página de la cuenta (ADR 0016/0017, research §6)
- `currentMonth` sigue entrando como parámetro calculado por el adaptador (`ui/format.ts`): aplicación pura y tests deterministas, sin puerto Clock
- La comparación de meses `YYYY-MM` es lexicográfica (invariante del formato); la re-sincronización es por mes consultado, solo si es el mes en curso
- E2E en fichero propio (Miembro B + mes en curso): comparte obligadamente combinación con `cierre-mensual` (previo) y `pagina-cuenta`/`gestion-tags` (posteriores, sin asertos de contenido en ese mes); el barrido inicial + la restauración final hacen los asertos independientes y devuelven la BD intacta (research §8)
- Commit after each task or logical group (Conventional Commits, en español el enunciado cuando aporte claridad)
