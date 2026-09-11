# Tasks: Cierre Mensual por Cuenta

**Input**: Design documents from `/specs/005-cierre-mensual/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/ui-contract.md, quickstart.md, `.specify/memory/constitution.md`, checklists/design-review.md (gate 27/27 superado)

**Tests**: REQUERIDOS en esta feature (constitución, principio III: la lógica de negocio —cálculo de cierres y totales— MUST estar cubierta por tests automatizados). Cada módulo incluye sus tests co-localizados junto al SUT (`*.test.ts` / `*.test.tsx`); e2e del panel en `e2e/`.

**Organization**: Una única user story (US1, P1). **Sin fases de Setup ni Foundational**: la feature no añade dependencias, esquema, migraciones ni datos (FR-009); la US1 comienza directamente. Fases: Dominio → Aplicación → UI → e2e → Polish, capa a capa conforme a la dependencia hexagonal.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js existente: `src/` (domain, application, app, infrastructure) conforme a [plan.md](./plan.md).
- Tests co-localizados junto a su SUT; e2e en `e2e/`.

---

## Phase 1: User Story 1 - Dominio (TDD: tests primero, en rojo)

**Goal**: VO puro `MonthlyClosure` con las reglas de negocio del cierre (FR-002..FR-006) y sus 4 invariantes (data-model §1.1).

- [X] T001 [P] [US1] Escribir tests unitarios del VO `MonthlyClosure` en `src/domain/movement/MonthlyClosure.test.ts`: happy path con mezcla de gastos/ingresos y ambas naturalezas; invariante 1 (`sharedExpenseTotal + personalExpenseTotal = expenseTotal`); invariante 2 en su forma exacta (un gasto multi-tag computa íntegro en cada una de sus tags, la Σ del desglose puede exceder `expenseTotal`, el total de gastos NO se duplica); naturaleza de un ingreso ignorada aunque llegue poblada; lista vacía → todos los totales a cero (`Money` cero) y desglose vacío; saldo del mes negativo; orden del desglose por importe descendente con desempate por nombre ascendente (`localeCompare(…, 'es')`); inmutabilidad del VO
- [X] T002 [US1] Implementar el VO `MonthlyClosure` (con `ClosureMovementInput` y `TagBreakdownEntry`) en `src/domain/movement/MonthlyClosure.ts`: factory `fromMovements(inputs)`, campos `incomeTotal`/`expenseTotal`/`sharedExpenseTotal`/`personalExpenseTotal`/`monthBalance` como `Money` (`fromCentsOrZero` para el saldo, aritmética con `add`), `tagBreakdown` ordenado; cero dependencias externas (data-model.md §1.1, ADR 0007)

**Checkpoint**: invariantes del cierre protegidos por tests en verde.

---

## Phase 2: User Story 1 - Aplicación (TDD)

**Goal**: DTOs y caso de uso autocontenido que obtiene el mes vía puerto y calcula el cierre (rediseño del challenge del revisor, ADR 0010).

- [X] T003 [P] [US1] Ampliar `src/application/movement/dto.ts` con `MonthlyClosureDTO` y `TagBreakdownEntryDTO` (céntimos enteros, `tagBreakdown` con `tagId`/`tagName`/`amountCents`) según data-model.md §4
- [X] T004 [US1] Escribir tests de `GetMonthlyClosure` en `src/application/movement/GetMonthlyClosure.test.ts` con un doble en memoria de `MovementRepository`: rechaza mes con formato inválido (regex `^\d{4}-(0[1-9]|1[0-2])$`), llama al puerto con `(AccountId(accountId), month)`, mapea `MovementDTO[]` → `ClosureMovementInput[]` (tags completas por movimiento) y devuelve un `MonthlyClosureDTO` idéntico al cálculo directo de `MonthlyClosure.fromMovements` sobre los mismos datos
- [X] T005 [US1] Implementar `GetMonthlyClosure` en `src/application/movement/GetMonthlyClosure.ts`: constructor con el puerto `MovementRepository`, `execute(accountId: number, month: string)` valida el mes, lee `listByMonthAndAccount`, calcula vía `MonthlyClosure.fromMovements` y mapea a DTO (misma forma que `ListMovements`; sin acoplamiento al listado)

**Checkpoint**: `execute(accountId, month)` devuelve el cierre verificable con dobles.

---

## Phase 3: User Story 1 - Adaptador inbound (UI)

**Goal**: panel servidor en la pantalla principal, solo formatea (ui-contract íntegro).

- [X] T006 [P] [US1] Ampliar `src/infrastructure/primary/ui/format.ts` con `formatSignedCents(cents)` y su test co-localizado `format.test.ts`: `+949,50 €` positivo / `−51,20 €` negativo (U+2212) / `0,00 €` para cero **sin signo** (nunca `+0,00 €` ni `−0,00 €`), Intl es-ES EUR (ui-contract §3; cuidar el espacio no rompible en los tests)
- [X] T007 [P] [US1] Crear el componente servidor `MonthlyClosurePanel` en `src/infrastructure/primary/ui/monthly-closure-panel.tsx` según contracts/ui-contract.md §2–§3: `<section aria-labelledby>` con título "Cierre de {Mes YYYY}" (`monthLabel`), grid de KPIs "Ingresos" y "Gastos" sin signo y "Saldo del mes" con `formatSignedCents`, sub-desglose "Gastos compartidos"/"Gastos personales", desglose por tag ordenado (importe desc, desempate `localeCompare` es) solo con importe y sin límite de filas, nota permanente bajo el desglose ("Los gastos con varias tags computan en cada una; las filas pueden no sumar el total de gastos."), estados "Mes sin movimientos" (todo `0,00 €`) y "Mes con ingresos pero sin gastos" (Ingresos/Saldo > 0, Gastos y naturaleza `0,00 €`, desglose "Sin gastos este mes."), KPIs y filas apilados en móvil
- [X] T008 [P] [US1] Escribir tests de UI en `src/infrastructure/primary/ui/monthly-closure-panel.test.tsx` (jsdom + RTL): KPIs y desglose con formato es-ES (usando los helpers de formateo o el código del espacio no rompible), orden y desempate del desglose, nota informativa visible, "Sin gastos este mes." en ambos estados sin gastos, saldo positivo/negativo y cero exacto sin signo
- [X] T009 [US1] Integrar el panel en `src/app/page.tsx`: instanciar `GetMonthlyClosure` con `DrizzleMovementRepository`, añadirlo al `Promise.all` de lecturas existente y renderizar `MonthlyClosurePanel` entre el formulario y el listado (ui-contract §1; sin tocar las regiones de 002)

**Checkpoint**: `npm run dev` muestra el cierre del mes/cuenta con los KPIs correctos.

---

## Phase 4: User Story 1 - E2E

- [X] T010 [US1] Escribir el test e2e `e2e/cierre-mensual.spec.ts` (specs en serie dentro del fichero, BD `e2e.sqlite` recreada por `pretest:e2e`): registrar vía UI el escenario 1 en la cuenta común (ingreso 1.920,00 "Aportación" + gasto 850,00 "Hipoteca" con tags Vivienda+Hipoteca + gasto 120,50 "Luz" con tag Hogar) y verificar los KPIs exactos del panel (Ingresos `1.920,00 €`, Gastos `970,50 €`, Saldo del mes `+949,50 €`, Gastos compartidos `970,50 €`, Gastos personales `0,00 €`, desglose Vivienda `850,00 €` / Hipoteca `850,00 €` / Hogar `120,50 €` en ese orden); cambiar a una cuenta personal con gastos de ambas naturalezas (personal 60,00 / compartido 120,50 → Gastos `180,50 €`, personales `60,00 €`, compartidos `120,50 €`); verificar un mes vacío → todo a ceros y "Sin gastos este mes." (el cambio de mes y el movimiento de otro mes quedan en verificación manual — decisión del revisor, research.md §4)

**Checkpoint**: US1 completa — el cierre sustituye los KPIs manuales del Excel de Balance en su alcance.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T011 [P] Registrar el ADR en `docs/architecture/adr/0010-cierre-mensual-servicio-dominio.md`: cierre calculado como servicio de dominio con lectura propia del mes vía puerto existente; se rechazan la agregación SQL dedicada, la persistencia de totales y pasar al caso de uso los DTOs cargados por el listado (plan.md §Complexity Tracking, research.md §1)
- [X] T012 [P] Actualizar la documentación de arquitectura en el mismo cambio: `docs/architecture/overview.md` (nueva región de la pantalla principal, caso de uso `GetMonthlyClosure` y VO `MonthlyClosure`) y `docs/architecture/diagrams/c4.md` (panel en la vista de componentes) si procede
- [X] T013 Ejecutar la verificación manual completa de `specs/005-cierre-mensual/quickstart.md` (E1–E6 + comprobación inicial + verificaciones adicionales) sobre `npm run dev` con BD migrada y sembrada
- [ ] T014 Verificar los gates finales: `npm run lint`, `npm run typecheck`, `npm run test` y `npm run test:e2e` en verde en local, y CI de GitHub Actions en verde tras push

---

## Dependencies & Execution Order

### Phase Dependencies

- **Dominio (Phase 1)**: sin dependencias — empezar por aquí.
- **Aplicación (Phase 2)**: depende del VO (T002) y de los DTOs (T003).
- **UI (Phase 3)**: depende de T005 (caso de uso) y T006 (formato); la página (T009) integra todo y habilita el e2e.
- **E2E (Phase 4)**: depende de T009.
- **Polish (Phase 5)**: T011/T012 pueden arrancar en paralelo con el final de la US1 (tras T009); T013 requiere T010; T014 es siempre el último.

### Within User Story 1

- TDD: T001 → T002, T004 → T005, T006/T008 junto a sus implementaciones; cada test debe verse en rojo antes de implementar.
- T003 (DTOs) antes de T004/T007 (ambos consumen los tipos).
- T009 depende de T005 y T007; T010 depende de T009.

### Parallel Opportunities

- Arranque: T001, T003 y T006 en paralelo (ficheros distintos, sin dependencias entre sí).
- UI: T008 tras T007 (mismo módulo, conviene secuencia); T011 y T012 en paralelo (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Bloque inicial (en paralelo):
Task: "T001 [P] [US1] Tests de MonthlyClosure en src/domain/movement/MonthlyClosure.test.ts"
Task: "T003 [P] [US1] DTOs MonthlyClosureDTO y TagBreakdownEntryDTO en src/application/movement/dto.ts"
Task: "T006 [P] [US1] formatSignedCents en src/infrastructure/primary/ui/format.ts + test"

# Bloque polish (en paralelo):
Task: "T011 [P] ADR 0010 en docs/architecture/adr/"
Task: "T012 [P] overview.md y c4.md"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Dominio con invariantes protegidos (T001–T002).
2. Aplicación con caso de uso autocontenido (T003–T005).
3. UI + integración en la pantalla (T006–T009).
4. **STOP y VALIDAR**: quickstart E1–E6 manualmente + gates en verde.
5. Polish: ADR 0010, docs y verificación final (T011–T014).

### Incremental Delivery

1. Dominio → lógica de negocio verificable con tests unitarios.
2. Aplicación → cierre obtenible por (accountId, month) con dobles.
3. UI → panel visible en `npm run dev`.
4. E2E + Polish → Definition of Done de la constitución.

---

## Notes

- [P] tasks = different files, no dependencies
- [US1] label mapea cada tarea a la user story para trazabilidad
- Cada par test→implementación debe verse en rojo antes de implementar (TDD)
- Commit tras cada tarea o grupo lógico (Conventional Commits, en español si aporta claridad)
- Verificar los checkpoints antes de avanzar de fase
- La feature no crea migraciones: `db:migrate`/`db:seed` existentes bastan (FR-009)
