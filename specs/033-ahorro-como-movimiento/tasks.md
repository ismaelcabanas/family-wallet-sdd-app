# Tasks: El ahorro mensual como movimiento editable

**Branch**: `feature/033-ahorro-como-movimiento` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Input**: Design documents from `/specs/033-ahorro-como-movimiento/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/interfaces.md ✅, quickstart.md ✅

**Tests**: REQUERIDOS por FR-007 (unidad de casos de uso, repositorio libsql `:memory:`, actions Zod, componentes jsdom, e2e del recorrido completo). Co-localizados junto al SUT (`*.test.ts(x)`), paridad del mapa de tests de 032 (research R10).

**Organization**: Una única user story (US1, P1 — granularidad constitución II). Fases: fundación de esquema/dominio/puerto → implementación de la US por capas (aplicación → frontera → UI → e2e) → documentación y gates.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Paralelizable (ficheros distintos, sin dependencias de tareas incompletas)
- **[Story]**: US1 (única historia de la feature)
- Todas las tareas incluyen ruta exacta de fichero

## Path Conventions

Monolito Next.js (App Router) con arquitectura hexagonal: `src/domain/`, `src/application/`, `src/app/`, `src/infrastructure/`. Ver «Project Structure» de [plan.md](./plan.md).

---

## Phase 1: Setup (Esquema y dominio compartido)

**Purpose**: Migración, esquema Drizzle, seed y símbolos de dominio que todo lo demás depende. El monolito ya existe: no hay inicialización de proyecto.

- [X] T001 Ampliar esquema Drizzle con enlace blando `movementId: integer("movement_id")` (nullable, sin FK) en `savingsAllocationMonths` en `src/infrastructure/db/schema/savings-allocations.ts`
- [X] T002 Crear migración `drizzle/0009_ahorro-movimiento.sql` (sentencias exactas de data-model «Persistencia»: `ALTER TABLE savings_allocation_months ADD COLUMN movement_id integer;` + `INSERT OR IGNORE` de la etiqueta protegida «Ahorro» id 101 en categoría genérica) y registrarla en `drizzle/meta/_journal.json` + snapshot según convención de las migraciones existentes; verificar con `npm run db:migrate` sobre BD limpia (paridad `0004`/`0008`)
- [X] T003 [P] Añadir etiqueta protegida al seed: `SEED_TAGS` += `{ name: "Ahorro", slug: "ahorro" }` en `src/infrastructure/db/seed-data.ts` (idempotente por slug, categoría genérica resuelta por el seed)
- [X] T004 [P] Ampliar `src/domain/tag/SystemTags.ts` con `SAVINGS_TAG_SLUG = "ahorro"` y añadirlo a `SYSTEM_TAG_SLUGS` (todas las protecciones existentes aplican por construcción: Select de etiqueta, retag masivo 029, `/tags` 026, edición bloqueada); ampliar `src/domain/tag/SystemTags.test.ts`
- [X] T005 [P] Ampliar `src/domain/savings/SavingsAllocationErrors.ts` con `SavingsAlreadyExistsError` (mensaje por defecto «Ya existe un ahorro registrado para este mes.», familia `DomainError`, paridad `ContributionAlreadyExistsError`)

**Checkpoint**: esquema, migración, seed y dominio listos; `npm run db:migrate && npm run db:seed` en verde.

---

## Phase 2: Foundational (Puerto y adaptador de persistencia)

**Purpose**: Contrato del puerto de ahorro ampliado y su implementación Drizzle — bloquea toda la US. `registerDeduction` se conserva provisionalmente para no romper el typecheck; se jubila en T010.

**⚠️ CRITICAL**: La US no puede empezar hasta completar esta fase.

- [X] T006 Ampliar el puerto `src/application/savings/SavingsAllocationRepository.ts` con los 5 métodos del contrato: `registerMaterialization(config, month, movement): Promise<boolean>`, `registerManualSavings(config, month, movement): Promise<MovementId | null>`, `findDeductedMovement(allocationId, month): Promise<Movement | null>`, `findDeductedMonthByMovement(movementId): Promise<string | null>`, `withdrawDeductionForMovement(movementId): Promise<boolean>` (contracts «Puerto: SavingsAllocationRepository»; `registerDeduction` se jubila en T010)
- [X] T007 Implementar los 5 métodos nuevos en `src/infrastructure/db/DrizzleSavingsAllocationRepository.ts` (tx única con `coalesce(max(movements.id),0)+1`, upsert `ON CONFLICT (config, mes) DO UPDATE SET movement_id, amount_cents WHERE movement_id IS NULL RETURNING` para manual, `ON CONFLICT DO NOTHING RETURNING` para materialización, retirada uniforme movimiento+fila — sentencias exactas en contracts «Contrato de persistencia», paridad `DrizzleCommonContributionRepository`) y ampliar `src/infrastructure/db/DrizzleSavingsAllocationRepository.test.ts` contra libsql `:memory:` con migraciones reales: manual inserta/enlaza, re-enlace de huérfana legacy sincronizando `amount_cents`, unicidad → `null` sin insertar movimiento, materialización fila+movimiento atómica e idempotente, retirada uniforme borra ambos, migración 0009 sembró la etiqueta «Ahorro»

**Checkpoint**: puerto + adaptador verificados; la US puede comenzar.

---

## Phase 3: User Story 1 - Registrar, editar y borrar el ahorro de cualquier mes como un movimiento (Priority: P1) 🎯 MVP

**Goal**: El ahorro se comporta como un movimiento (dual de 032): alta manual en cualquier mes con tipo «Ahorro» (config existente, sin exigir activa), fila del registro enlazada en la misma transacción, materializador que crea movimiento, KPIs y agregados coherentes por construcción, edición con identidad fija y borrado uniforme reversible.

**Independent Test** (spec US1): en una cuenta personal con config de ahorro (aunque esté inactiva), mes pasado p. ej. 2026-05: alta manual tipo «Ahorro» → fila en listado con chip «Ahorro», KPI «Ahorro del mes» = importe exacto, «Saldo del mes» descuenta una sola vez, «Gasto personal» lo excluye, `/summary` lo cuenta como gasto; edición de importe reflejada en KPI; borrado → mes a 0 y admite otro registro.

### Implementación — Aplicación

- [X] T008 [P] [US1] Crear caso de uso `src/application/savings/RegisterManualSavings.ts` (dual de `RegisterManualContribution`: validaciones cuenta personal → `SharedAccountSavingsError`, config existe **sin exigir activa** → `SavingsAllocationNotFoundError`, pre-check `findDeductedMovement` + guarda transaccional → `SavingsAlreadyExistsError`, etiqueta por `SAVINGS_TAG_SLUG`, `Movement.create` con `type: "expense"`, `nature: "personal"`, nota vacía → `"Ahorro"`, persistencia `registerManualSavings` en la misma tx) y su test `src/application/savings/RegisterManualSavings.test.ts` (escenarios de research R10: movimiento+fila juntos, cuenta común → error, config inexistente → error, config inactiva → OK, unicidad pre-check y carrera perdida, nota por defecto, naturaleza/etiqueta implícitas)
- [X] T009 [P] [US1] Ampliar `src/application/savings/GetMonthSavings.ts` con `backedByMovement` en `MonthSavingsDTO` (`src/application/savings/dto.ts`): movimiento enlazado (`findDeductedMovement`) como importe cuando existe, si no fila congelada (`findDeductedAmount`), sin config → `{configured: false, amountCents: 0, backedByMovement: false}`; sin heurística lazy; ampliar `src/application/savings/GetMonthSavings.test.ts` con las tres lecturas
- [X] T010 [US1] Ampliar `src/application/savings/MaterializeSavingsAllocations.ts`: constructor gana `TagRepository`, compone `Movement.create` (gasto, naturaleza propia, fecha `${month}-01`, nota «Ahorro», importe `SavingsPercentage.appliedToCents` del ingreso bruto regular) y persiste vía `registerMaterialization` (fila + movimiento en la misma tx); guardas de 023 intactas (config activa, ventana `activatedAtMonth ≤ month ≤ currentMonth`, `isDeducted` corto-circuito, ingreso regular existente y activo, `amountCents ≥ 1` → no-op); **jubilar `registerDeduction`** del puerto `src/application/savings/SavingsAllocationRepository.ts`, del adaptador `src/infrastructure/db/DrizzleSavingsAllocationRepository.ts` y de sus tests; ampliar `src/application/savings/MaterializeSavingsAllocations.test.ts` (movimiento+fila en la misma llamada, idempotencia por registro, guardas intactas, R5)
- [X] T011 [P] [US1] Ampliar `src/application/movement/UpdateMovement.ts` con colaborador `SavingsAllocationRepository`: `findDeductedMonthByMovement(id) !== null` → identidad congelada (solo importe, nota y fecha; `type`/`nature`/`tagId` a los del existente, espejo de la detección de aportación 032); ampliar `src/application/movement/UpdateMovement.test.ts`
- [X] T012 [P] [US1] Ampliar `src/application/movement/DeleteMovement.ts` con colaborador `SavingsAllocationRepository`: tras la retirada de aportación (032), `withdrawDeductionForMovement(id)` — **borrado uniforme** movimiento + fila en la misma tx (cualquier origen), si ninguna retirada aplica → borrado ordinario; ampliar `src/application/movement/DeleteMovement.test.ts`

### Implementación — Frontera (Zod + Server Actions)

- [X] T013 [P] [US1] Ampliar `src/infrastructure/primary/actions/movement-form.schema.ts`: `MovementFormType` += `"savings"` y rama `superRefine` espejo de `contribution` (`nature` presente → issue «El ahorro lleva naturaleza propia implícita.», `tagId` no nulo → issue «El ahorro lleva la etiqueta «Ahorro» implícita.», nota opcional con return temprano)
- [X] T014 [US1] Ampliar `src/infrastructure/primary/actions/create-movement.action.ts` con la ruta `data.type === "savings"` → `RegisterManualSavings` (éxito → `{ status: "success", message: "Ahorro registrado", intent }` + `revalidatePath("/", "layout")`; `SavingsAlreadyExistsError`/`SharedAccountSavingsError`/`SavingsAllocationNotFoundError` → `errors._form`); ampliar `src/infrastructure/primary/actions/create-movement.action.test.ts` (Zod rutúa, éxito, error de unicidad → `_form` con `role="alert"`)
- [X] T015 [P] [US1] Ampliar `src/infrastructure/primary/actions/update-movement.action.ts` con el mapeo `type === "savings"` → `{ type: "expense", nature: null, tagId: null }` (espejo de la rama `contribution`); ampliar `src/infrastructure/primary/actions/update-movement.action.test.ts`

### Implementación — UI (adaptadores inbound)

- [X] T016 [P] [US1] Ampliar `src/infrastructure/primary/ui/movement-form.tsx`: prop `savingsOption?: ContributionOption` (reutiliza el tipo tri-estado; mutuamente excluyente con `contributionOption` en modo `locked`), 4.º radio `value="savings"` solo con `savingsOption !== "off"`, `savingsOption === "locked"` → `<input type="hidden" name="type" value="savings">` + `RadioGroup disabled`, con tipo «Ahorro» elegido sin fieldset de naturaleza ni bloque «Etiqueta», `initialType`/sincronización de error/listener `reset` (restauración del RadioGroup de Radix, familia SC-004/032) ampliados a `"savings"`; ampliar `src/infrastructure/primary/ui/movement-form.test.tsx` (radio ofrecido con `savingsAvailable` y oculto sin él, envío `type=savings` sin naturaleza/etiqueta, edición bloqueada con radios disabled, restauración tras error)
- [X] T017 [P] [US1] Arrastrar la disponibilidad hasta el formulario: `src/infrastructure/primary/ui/create-movement-dialog.tsx` gana `savingsAvailable?: boolean` (→ `savingsOption={savingsAvailable ? "available" : "off"}`) y `src/infrastructure/primary/ui/grouped-movement-list.tsx` hace passthrough (paridad `contributionAvailable`); ampliar sus tests
- [X] T018 [P] [US1] Ampliar `src/infrastructure/primary/ui/edit-movement-dialog.tsx`: detección por slug en cliente (`movement.tag.slug === SAVINGS_TAG_SLUG` → `savingsOption="locked"`, paridad 032); ampliar `src/infrastructure/primary/ui/edit-movement-dialog.test.tsx`
- [X] T019 [US1] Ampliar `src/app/accounts/[accountId]/page.tsx`: pasar `savingsAvailable={savings.configured}` (existencia de config, no «activa») hasta el listado y ajustar las **dos únicas restas de composición** (R6): `personalExpenseCents = closure.personalExpenseCents − netContribution.amountCents − savings.amountCents` y `netMonthBalanceCents = closure.monthBalanceCents − (savings.backedByMovement ? 0 : savings.amountCents)` — la UI jamás recalcula (constitución VII; `AccountMonthKpis` sin cambios de contrato)

### E2E

- [X] T020 [US1] Crear `e2e/ahorro-movimiento.spec.ts` (cuenta 1 × 2026-05 + mes en curso, serial dentro del fichero): alta manual en mes pasado (KPI exacto, saldo con descuento único, gasto personal excluyente, `/summary` contándolo como gasto), unicidad con `role="alert"`, edición de importe reflejada en KPI, borrado uniforme reversible, materializador idempotente en mes en curso con config activa y **limpieza total al final** (borrar movimientos de ahorro e ingreso regular generados, desactivar configs) — el fichero corre primero alfabéticamente y debe restaurar la BD (research R9)
- [X] T021 [US1] Actualizar `e2e/porcentaje-ahorro.spec.ts` (023) al nuevo mundo: A2 pasa de «sin movimiento nuevo» a fila visible con chip «Ahorro» (−300,00) y listado +1, saldo neto esperado = `grossCents` tal cual; A6 (limpieza) borra también el movimiento de ahorro para dejar la cuenta 2 como hoy (research R9)

**Checkpoint**: US1 completa — validar con el «Independent Test» y los escenarios E1-E8 de [quickstart.md](./quickstart.md).

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentación en el mismo cambio (FR-008, constitución DoD) y gates finales.

- [X] T022 [P] Crear ADR `docs/architecture/adr/0025-ahorro-como-movimiento.md`: segunda vía de escritura del registro + enlace blando + composición condicional del saldo; diferencias deliberadas con 032/021 (config como ancla sin exigir activa, borrado uniforme, sin backfill); relacionado con ADR 0022/0024 (research R11)
- [X] T023 [P] Ampliar `AGENTS.md`: nuevo bloque de convención 033 (ahorro como movimiento) y actualización del apartado 023 para referir al ahorro-movimiento (research R11)
- [X] T024 [P] Marcar la fila `033-ahorro-como-movimiento` como Completada en el roadmap maestro `specs/001-family-wallet/spec.md`
- [X] T025 Ejecutar gates y validación final: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` en verde (SC-004) + recorrido manual de [quickstart.md](./quickstart.md) (E1-E8)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 → T002 (la migración refleja el esquema); T003, T004, T005 paralelos entre sí y con T002
- **Phase 2 (Foundational)**: T006 → T007 — BLOQUEA toda la US
- **Phase 3 (US1)**: depende de Phase 2 completa
- **Phase 4 (Polish)**: depende de Phase 3 completa

### Within User Story 1

- Aplicación: T008, T009, T011, T012 paralelos entre sí (ficheros distintos, solo dependen del puerto T006/T007); **T010 después de T007** (jubila `registerDeduction` en puerto + adaptador)
- Frontera: T013 paralelo con la aplicación; T014 depende de T008 + T013; T015 depende de T013 (paralelo con T014)
- UI: T016 depende de T013; T017 y T018 dependen de T016 (paralelos entre sí); T019 depende de T009 (DTO `backedByMovement`) y T017 (`savingsAvailable`)
- E2E: T020 y T021 después de toda la implementación (T014-T019); entre sí paralelos por convención de aislamiento (ficheros con combinación cuenta/mes propia)

### Parallel Opportunities

- T003 + T004 + T005 (dominio/seed, ficheros distintos)
- T008 + T009 + T011 + T012 (casos de uso, ficheros distintos)
- T015 ∥ T014; T017 ∥ T018; T020 ∥ T021 (e2e con BD aislada por combinación cuenta/mes)
- T022 + T023 + T024 (documentación)

---

## Parallel Example: User Story 1

```bash
# Tras Phase 2 (T006+T007), lanzar en paralelo los casos de uso:
Task: "T008 RegisterManualSavings en src/application/savings/RegisterManualSavings.ts"
Task: "T009 GetMonthSavings backedByMovement en src/application/savings/GetMonthSavings.ts"
Task: "T011 UpdateMovement identidad congelada en src/application/movement/UpdateMovement.ts"
Task: "T012 DeleteMovement borrado uniforme en src/application/movement/DeleteMovement.ts"
```

---

## Implementation Strategy

### MVP First (US1 única)

1. Phase 1: esquema + migración + seed + dominio
2. Phase 2: puerto + adaptador (CRÍTICO — bloquea la US)
3. Phase 3: aplicación → frontera → UI → e2e (orden de capas)
4. **STOP y VALIDAR**: Independent Test de la US + quickstart E1-E8 + gates
5. Phase 4: documentación (ADR, AGENTS.md, roadmap) y cierre

### Notas de ejecución

- Cada tarea debe dejar el árbol compilando y los gates en verde (`npm run lint && npm run typecheck && npm run test`); `registerDeduction` se conserva hasta T010 precisamente para eso
- La e2e comparte BD determinista con `workers: 1` (orden alfabético): `ahorro-movimiento.spec.ts` corre primero y su limpieza final es obligatoria (R9)
- Sin backfill: las filas congeladas por 023 quedan huérfanas a la espera de re-enlace manual (FR-002); cubierto por tests de repositorio, no por e2e

---

## Notes

- [P] = ficheros distintos, sin dependencias de tareas incompletas
- Paridad símbolo a símbolo con 032 salvo tres desviaciones decididas en clarify: config como ancla (sin exigir activa), borrado uniforme, sin backfill (research R1)
- Commits Conventional Commits tras cada tarea o grupo lógico (hooks de Spec Kit)
- Verificar tests nuevos en rojo antes de implementar cuando la tarea los crea de cero (T008)
