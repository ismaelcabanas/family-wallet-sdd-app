# Tasks: Informe anual de gastos por categorías

**Input**: Design documents from `/specs/015-informe-anual-gastos/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ui-contracts.md ✅, quickstart.md ✅

**Tests**: Requeridos por FR-007 (agregación de dominio, caso de uso con puertos dobles, componentes UI y e2e).

**Organization**: Una única user story (P1) — la feature es un incremento único (constitución II). Fases: Setup → Foundational → US1 → Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 for user story tasks
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Sin inicialización nueva — el proyecto Next.js ya existe. Solo verificar el entorno.

- [ ] T001 Verificar entorno: `npm install && npm run db:migrate && npm run seed` en verde; sin cambios de esquema (FR-005)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Generalizaciones retrocompatibles de los que depende US1.

- [ ] T002 Generalizar `YearSelector` con prop `basePath` opcional (por defecto `"/annual"`, retrocompatible con 009) en `src/infrastructure/primary/ui/year-selector.tsx`
- [ ] T003 [P] Extender `src/application/movement/dto.ts` con `CategoryExpenseRowDTO` y `AnnualCategoryExpenseReportDTO` según `data-model.md` (sin tocar DTOs congelados)

**Checkpoint**: Base lista; US1 puede empezar.

---

## Phase 3: User Story 1 - Consultar el informe anual de gastos por mes y categoría (Priority: P1) 🎯 MVP

**Goal**: Informe de lectura pura en `/reports/annual-expenses?year=YYYY`: fila por categoría (todas), 12 columnas + «Media anual» (÷12 half-up), filas «Gasto mensual» y «Gastos personales», excluida la etiqueta protegida «Aportación Común», accesible desde el menú «Informes».

**Independent Test**: Registrar gastos de varias categorías en varios meses/cuentas, abrir el informe desde «Informes» y verificar celdas por categoría×mes, medias ÷ 12, filas de totales y exclusión de la aportación común (quickstart.md pasos 1–7).

### Tests for US1 (escribir primero, verificar que fallan)

- [ ] T004 [P] [US1] Tests del agregado `AnnualCategoryExpenseReport` en `src/domain/movement/AnnualCategoryExpenseReport.test.ts`: celdas categoría×mes, exclusión `CONTRIBUTION_TAG_SLUG`, etiquetas desactivadas computan, medias ÷ 12 half-up, año vacío (estructura completa a 0), fila «Gasto mensual», fila gastos personales (`nature=own` + `accountKind=personal`), orden de filas (genérica primero, resto es-ES)
- [ ] T005 [P] [US1] Tests del caso de uso con puertos dobles en `src/application/movement/GetAnnualCategoryExpenseReport.test.ts`: join tag→categoría en memoria, validación `^\d{4}$` con error de dominio, mapeo a DTO espejo del agregado
- [ ] T006 [P] [US1] Tests del componente tabla en `src/infrastructure/primary/ui/annual-expense-report-table.test.tsx`: filas en orden del DTO, 12 columnas «Ene»…«Dic» + «Media anual», totales en `tfooter`, `aria-label` «Informe de gastos por categoría de {año}», scroll horizontal
- [ ] T007 [P] [US1] Tests del menú «Informes» en `src/infrastructure/primary/ui/reports-nav-menu.test.tsx`: trigger «Informes», único ítem «Gastos por categoría» → `/reports/annual-expenses`, `aria-current` cuando `active === "reports"`

### Implementation for US1

- [ ] T008 [P] [US1] Crear agregado de dominio puro `AnnualCategoryExpenseReport` (factory `fromMovements(inputs, categories)`, VO `CategoryExpenseRow`, reglas 1–5 de `data-model.md`) en `src/domain/movement/AnnualCategoryExpenseReport.ts` — depende de T004
- [ ] T009 [P] [US1] Crear caso de uso `GetAnnualCategoryExpenseReport` (4 puertos existentes: `MovementRepository.listByYear`, `TagRepository.findAll`, `CategoryRepository.findAll`, `AccountRepository.findAll`; validación de año; mapeo DTO→primitivas) en `src/application/movement/GetAnnualCategoryExpenseReport.ts` — depende de T005, T008
- [ ] T010 [P] [US1] Crear `AnnualCategoryExpenseReportTable` (server presentacional puro, `formatAmountCents`, `overflow-x-auto`) en `src/infrastructure/primary/ui/annual-expense-report-table.tsx` — depende de T006
- [ ] T011 [P] [US1] Crear `ReportsNavMenu` (client, DropdownMenu shadcn, único ítem) en `src/infrastructure/primary/ui/reports-nav-menu.tsx` — depende de T007
- [ ] T012 [US1] Integrar `ReportsNavMenu` en `src/infrastructure/primary/ui/global-nav.tsx` (nuevo valor `active: "reports"`; enlaces existentes invariables — FR-004)
- [ ] T013 [US1] Crear página `src/app/reports/annual-expenses/page.tsx`: server component de lectura pura, Zod sobre `searchParams.year` con fallback `currentYear()`, wiring inline por render (patrón 009), `GlobalNav active="reports"` + `YearSelector basePath="/reports/annual-expenses"` + tabla, título «Informe anual de gastos» (contrato C1)
- [ ] T014 [US1] Crear spec e2e `e2e/informe-anual-gastos.spec.ts`: año propio 2024 (aislamiento de BD compartida), registra gastos en varias categorías/meses/cuentas vía UI y verifica filas, medias ÷ 12, totales y exclusión de «Aportación Común» (FR-007, SC-004)

**Checkpoint**: Informe navegable, calculado y verificado de forma independiente.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [ ] T015 [P] Actualizar roadmap maestro `specs/001-family-wallet/spec.md`: fila 015 Completada (realización de `015-anual-agrupada` con las categorías de 026) y anotar informe de aportaciones por miembro/mes como feature futura (FR-006)
- [ ] T016 Ejecutar gates: `npm run lint && npm run typecheck && npm run test && npm run test:e2e` en verde (SC-004) y validar quickstart.md
- [ ] T017 [P] Actualizar diagramas vivos en `docs/architecture/diagrams/` reutilizando los de plan.md como base (si procede según convención del repo)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias.
- **Foundational (Phase 2)**: Tras Setup; T002 y T003 en paralelo. BLOQUEA a US1.
- **US1 (Phase 3)**: Tras Foundational. Tests (T004–T007) primero y en rojo; luego implementación en paralelo por fichero; integración (T012–T014) al final.
- **Polish (Phase 4)**: Tras US1.

### Within US1

- Tests antes que implementación (T004→T008, T005→T009, T006→T010, T007→T011)
- Dominio (T008) antes que aplicación (T009)
- Componentes aislados (T010, T011) antes que integración (T012, T013)
- E2E (T014) con la página operativa (T013)

### Parallel Opportunities

- T002 ∥ T003 (Foundational)
- T004 ∥ T005 ∥ T006 ∥ T007 (tests, ficheros distintos)
- T008 ∥ T010 ∥ T011 tras sus tests (ficheros distintos)
- T015 ∥ T017 (Polish)

---

## Parallel Example: User Story 1

```bash
# Tests en paralelo (rojo):
Task: "Tests del agregado en src/domain/movement/AnnualCategoryExpenseReport.test.ts"
Task: "Tests del caso de uso en src/application/movement/GetAnnualCategoryExpenseReport.test.ts"
Task: "Tests de tabla en src/infrastructure/primary/ui/annual-expense-report-table.test.tsx"
Task: "Tests de menú en src/infrastructure/primary/ui/reports-nav-menu.test.tsx"

# Implementación en paralelo (verde):
Task: "Agregado en src/domain/movement/AnnualCategoryExpenseReport.ts"
Task: "Tabla en src/infrastructure/primary/ui/annual-expense-report-table.tsx"
Task: "Menú en src/infrastructure/primary/ui/reports-nav-menu.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (verificar entorno)
2. Phase 2: Foundational (T002–T003)
3. Phase 3: US1 completo (T004–T014)
4. **STOP and VALIDATE**: quickstart.md + gates automáticos
5. Phase 4: Polish (roadmap, gates, docs)

### Incremental Delivery

Feature de US única: el incremento es la feature completa. Checkpoints internos: dominio+aplicación verificados (T009) → UI integrada (T013) → e2e (T014).

---

## Notes

- Lectura pura: sin materialización, sin migraciones, sin puertos nuevos (FR-005)
- UI solo anidadora: ningún total/media se calcula en componentes (constitución VII)
- `YearSelector` retrocompatible: `basePath` opcional, por defecto `"/annual"` (009 intacto)
- Commits Conventional Commits tras cada tarea o grupo lógico; sin push/PR manual (hooks Spec Kit)
