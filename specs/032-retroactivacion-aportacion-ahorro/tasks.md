# Tasks: Registro manual de la aportación común en meses pasados

**Input**: Design documents from `/specs/032-retroactivacion-aportacion-ahorro/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create feature documentation structure in specs/032-retroactivacion-aportacion-ahorro/
- [X] T002 Review existing codebase structure (src/domain, src/application, src/infrastructure)
- [X] T003 [P] Verify database schema supports the feature (common_contribution_months, Movement, Tag)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T004 [P] Review MovementRepository implementation in src/infrastructure/db/repositories/
- [X] T005 [P] Review ContributionConfigRepository implementation in src/infrastructure/db/repositories/
- [X] T006 [P] Review TagRepository implementation in src/infrastructure/db/repositories/
- [X] T007 [P] Verify Drizzle schema for common_contribution_months table
- [X] T008 [P] Review MovementUseCase implementation in src/application/
- [X] T009 [P] Review GetMonthNetContribution use case in src/application/

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Registrar a mano la aportación común de un mes pasado (Priority: P1) 🎯 MVP

**Goal**: Permitir al usuario registrar manualmente el gasto de aportación común de meses pasados mediante un tipo de gasto independiente, escribiendo la fila del registro de materialización en la misma transacción

**Independent Test**: Se puede probar creando un movimiento de tipo «Aportación común» en un mes pasado y verificando que aparece en el listado, el KPI «Aportación común» muestra el importe correcto, y los agregados (/summary, /annual) lo cuentan

### Implementation for User Story 1

#### Paso 1: Definir la lógica de negocio en el dominio

- [X] T010 [P] [US1] Implement MovementType enum en src/domain/movement/MovementType.ts con valor «CONTRIBUTION»
- [X] T011 [P] [US1] Implement CreateMovementUseCase en src/application/movement/CreateMovementUseCase.ts con lógica de validación de unicidad
- [X] T012 [US1] Implement CreateMovementUseCase.execute() que consulte common_contribution_months por configId y mes antes de crear
- [X] T013 [US1] Implement CreateMovementUseCase.execute() que escriba la fila del registro en la misma transacción (ON CONFLICT DO NOTHING)
- [X] T014 [US1] Implement CreateMovementUseCase.validateUniqueness() que lance ContributionAlreadyExistsError si existe registro
- [X] T015 [US1] Implement ContributionAlreadyExistsError en src/domain/movement/exceptions/

#### Paso 2: Adaptar el repositorio para soportar la lógica

- [X] T016 [P] [US1] Implement MovementRepository.create() en src/infrastructure/db/repositories/movement-repository.ts para escribir movement_id en common_contribution_months
- [X] T017 [P] [US1] Implement MovementRepository.create() con transacción que haga INSERT en movements y luego INSERT en common_contribution_months
- [X] T018 [P] [US1] Implement ContributionConfigRepository.existsForMonth() para consultar existencia de registro por configId y mes

#### Paso 3: Adaptar la UI del formulario de alta de movimiento

- [X] T019 [P] [US1] Implement SelectMovementTypeDialog en src/infrastructure/primary/ui/movement/create-movement-dialog.tsx con opción «Aportación común»
- [X] T020 [US1] Implement SelectMovementTypeDialog con lógica que, al seleccionar «Aportación común», implícite naturaleza propia y etiqueta «Aportación Común»
- [X] T021 [US1] Implement SelectMovementTypeDialog con guardia que oculte el tipo en cuenta común (sin config de aportación)
- [X] T022 [P] [US1] Implement SelectMovementTypeDialog con validación de unicidad en el submit (llamada al use case)
- [X] T023 [US1] Implement SelectMovementTypeDialog con error UI con role="alert" al mostrar error de duplicado
- [X] T024 [P] [US1] Implement SelectMovementTypeDialog con revalidatePath("/", "layout") en éxito

#### Paso 4: Integración y validación

- [X] T025 [US1] Implement SelectMovementTypeDialog con botón de cancelar que no guarde nada
- [X] T026 [US1] Implement SelectMovementTypeDialog con toast de éxito al crear movimiento de aportación
- [X] T027 [US1] Implement SelectMovementTypeDialog con toast de error al intentar crear duplicado

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 1 - Edge Cases y Reglas de Negocio

**Goal**: Cubrir todos los casos de borde definidos en la spec

### Edge Case: Mes dentro de ventana de config activa

- [X] T028 [US1] Implement SelectMovementTypeDialog con lógica que permita registro manual en mes en curso (no bloquee por estar en ventana activa)
- [X] T029 [US1] Implement SelectMovementTypeDialog con validación que respete la fila existente si el materializador ya generó una

### Edge Case: Segundo movimiento de aportación en un mes

- [X] T030 [US1] Implement SelectMovementTypeDialog con error de unicidad al intentar crear segundo movimiento en mismo mes
- [X] T031 [US1] Implement SelectMovementTypeDialog con mensaje claro: «Ya existe una aportación registrada para este mes»

### Edge Case: Sin config de aportación activa

- [X] T032 [US1] Implement SelectMovementTypeDialog con guardia que oculte el tipo «Aportación común» si no hay config activa
- [X] T033 [US1] Implement SelectMovementTypeDialog con toast informativo: «Esta cuenta no tiene configurada la aportación común»

### Edge Case: Borrado del movimiento manual

- [X] T034 [US1] Implement MovementUseCase.delete() que elimine también la fila del registro en la misma transacción
- [X] T035 [US1] Implement MovementUseCase.delete() con lógica que verifique que el movimiento es de tipo CONTRIBUTION antes de borrar registro

### Edge Case: Edición del movimiento de aportación

- [X] T036 [US1] Implement MovementUseCase.update() que mantenga inmutable el tipo, naturaleza y etiqueta para movimientos de tipo CONTRIBUTION
- [X] T037 [US1] Implement MovementUseCase.update() que permita solo editar importe, nota y fecha

### Edge Case: Cuenta común

- [X] T038 [US1] Implement SelectMovementTypeDialog con guardia que oculte el tipo «Aportación común» en cuenta común
- [X] T039 [US1] Implement SelectMovementTypeDialog con validación que verifique accountId de cuenta personal

### Edge Case: Importe manual incorrecto

- [X] T040 [US1] Implement SelectMovementTypeDialog sin validación contra porcentajes de la config
- [X] T041 [US1] Implement SelectMovementTypeDialog que acepte cualquier importe positivo

**Checkpoint**: All edge cases covered and tested

---

## Phase 5: User Story 1 - Tests

**Goal**: Cubrir la feature con tests de unidad, integración y e2e

### Tests de Unidad

- [X] T042 [P] [US1] Unit test for CreateMovementUseCase.create() with new contribution (src/application/movement/CreateMovementUseCase.test.ts)
- [X] T043 [P] [US1] Unit test for CreateMovementUseCase.validateUniqueness() with existing record (src/application/movement/CreateMovementUseCase.test.ts)
- [X] T044 [P] [US1] Unit test for CreateMovementUseCase.validateUniqueness() with no existing record (src/application/movement/CreateMovementUseCase.test.ts)
- [X] T045 [P] [US1] Unit test for MovementRepository.create() writes to common_contribution_months (src/infrastructure/db/repositories/movement-repository.test.ts)
- [X] T046 [P] [US1] Unit test for MovementRepository.delete() deletes both movement and record (src/infrastructure/db/repositories/movement-repository.test.ts)
- [X] T047 [P] [US1] Unit test for ContributionConfigRepository.existsForMonth() (src/infrastructure/db/repositories/contribution-config-repository.test.ts)

### Tests de Componente

- [X] T048 [P] [US1] Component test for SelectMovementTypeDialog shows CONTRIBUTION option with active config (src/infrastructure/primary/ui/movement/create-movement-dialog.test.tsx)
- [X] T049 [P] [US1] Component test for SelectMovementTypeDialog hides CONTRIBUTION option without active config (src/infrastructure/primary/ui/movement/create-movement-dialog.test.tsx)
- [X] T050 [P] [US1] Component test for SelectMovementTypeDialog implies OWN nature and protected tag (src/infrastructure/primary/ui/movement/create-movement-dialog.test.tsx)
- [X] T051 [P] [US1] Component test for SelectMovementTypeDialog shows error with role="alert" on duplicate (src/infrastructure/primary/ui/movement/create-movement-dialog.test.tsx)
- [X] T052 [P] [US1] Component test for SelectMovementTypeDialog revalidates page on success (src/infrastructure/primary/ui/movement/create-movement-dialog.test.tsx)

### Tests E2E

- [X] T053 [P] [US1] E2E test for creating manual contribution in past month (e2e/contribution-manual.test.ts)
- [X] T054 [P] [US1] E2E test for duplicate contribution error (e2e/contribution-manual.test.ts)
- [X] T055 [P] [US1] E2E test for contribution appearing in KPI and summary (e2e/contribution-manual.test.ts)
- [X] T056 [P] [US1] E2E test for deleting contribution removes record (e2e/contribution-manual.test.ts)

**Checkpoint**: All tests passing - feature ready for production

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T057 [P] Documentation: Update AGENTS.md with manual contribution registration pattern
- [X] T058 [P] Documentation: Create ADR for manual contribution registration (docs/architecture/adr/adr-XXX-manual-contribution.md)
- [X] T059 [P] Documentation: Update roadmap maestro specs/001-family-wallet/spec.md marking 032 as completed
- [X] T060 [P] Run quickstart.md validation for feature 032
- [X] T061 [P] Code cleanup and ensure no dead code from discarded approaches (retro-activation of configs)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories

### Within Each User Story

- Domain implementation before repository adaptation
- Repository adaptation before UI implementation
- Core implementation before edge cases
- Story complete before moving to next phase

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Domain tasks T010, T011, T015 can run in parallel
- Repository tasks T016, T017, T018 can run in parallel
- UI tasks T019, T020, T021, T022, T024 can run in parallel
- All unit tests marked [P] can run in parallel
- All component tests marked [P] can run in parallel
- All E2E tests marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all domain tasks together:
Task: "Implement MovementType enum in src/domain/movement/MovementType.ts"
Task: "Implement CreateMovementUseCase in src/application/movement/CreateMovementUseCase.ts"
Task: "Implement ContributionAlreadyExistsError in src/domain/movement/exceptions/"

# Launch all repository tasks together:
Task: "Implement MovementRepository.create() in src/infrastructure/db/repositories/movement-repository.ts"
Task: "Implement ContributionConfigRepository.existsForMonth()"

# Launch all UI tasks together:
Task: "Implement SelectMovementTypeDialog with CONTRIBUTION option"
Task: "Implement SelectMovementTypeDialog with OWN nature and protected tag"
Task: "Implement SelectMovementTypeDialog with uniqueness validation"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: Core User Story 1 implementation
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add core User Story 1 (T010-T027) → Test independently → Deploy/Demo (MVP!)
3. Add edge cases (T028-T041) → Test independently
4. Add tests (T042-T056) → All tests passing
5. Add documentation (T057-T061) → Feature complete

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: Domain implementation (T010-T015)
   - Developer B: Repository adaptation (T016-T018)
   - Developer C: UI implementation (T019-T027)
3. Developer D: Edge cases (T028-T041)
4. Developer E: Tests (T042-T056)
5. All developers: Documentation (T057-T061)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

## Summary

- **Total tasks**: 61
- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 9 tasks
- **Phase 3 (Core US1)**: 17 tasks
- **Phase 4 (Edge Cases US1)**: 13 tasks
- **Phase 5 (Tests US1)**: 14 tasks
- **Phase N (Polish)**: 5 tasks
- **Parallel opportunities**: Multiple [P] tasks per phase
- **MVP scope**: Phase 1 + Phase 2 + Phase 3 (core implementation)
