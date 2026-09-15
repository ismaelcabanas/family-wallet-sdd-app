# Tasks: Resumen Mensual Global

**Input**: Design documents from `/specs/006-resumen-global-mensual/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/ui-contract.md, quickstart.md, `.specify/memory/constitution.md`, checklists/design-review.md (**gate pendiente: 32 ítems sin marcar — la revisión del propietario debe resolverse antes de `/speckit.implement`**)

**Tests**: REQUERIDOS en esta feature (constitución, principio III: la lógica de negocio —totales y agregaciones— MUST estar cubierta por tests automatizados). Cada módulo incluye sus tests co-localizados junto al SUT (`*.test.ts` / `*.test.tsx`); repositorio contra libsql `:memory:`; e2e en `e2e/`.

**Organization**: Una única user story (US1, P1). **Sin fases de Setup ni Foundational**: la feature no añade dependencias, esquema, migraciones ni datos (FR-005); la US1 comienza directamente. Fases: Dominio → Aplicación → Persistencia → UI → e2e → Polish, conforme a la dependencia hexagonal.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js existente: `src/` (domain, application, app, infrastructure) conforme a [plan.md](./plan.md).
- Tests co-localizados junto a su SUT; e2e en `e2e/`.

---

## Phase 1: User Story 1 - Dominio (TDD: tests primero, en rojo)

**Goal**: VO puro `GlobalMonthlySummary` que compone `MonthlyClosure` (única fuente de reglas agregadas) y añade el desglose por miembro con sus invariantes (data-model §1.1, ADR 0012).

- [ ] T001 [P] [US1] Escribir tests unitarios del VO `GlobalMonthlySummary` en `src/domain/movement/GlobalMonthlySummary.test.ts`: KPIs agregados idénticos a `MonthlyClosure.fromMovements` sobre la unión (delegación); **invariante de coherencia** (VO global sobre la unión del mes = Σ `MonthlyClosure` de cada cuenta, KPI a KPI, y `tagBreakdown` global = fusión de los por cuenta); atribución por miembro (gastos de cuenta personal al `memberName` de su dueño según naturaleza; gastos de la cuenta común al bucket `null` con SU naturaleza, incluido un gasto personal pagado desde la común); Σ `memberBreakdown` (personal+shared de todas las filas) = `expenseTotal`; ingresos fuera de ambos desgloses; multi-tag computa en cada tag sin duplicar el total; mes vacío → totales a cero y desgloses vacíos; orden de `memberBreakdown` (total desc, nombre asc `localeCompare es`, fila `null` al final en empates); imputabilidad por nombre (dos cuentas personales del mismo miembro fusionan); inmutabilidad del VO
- [ ] T002 [US1] Implementar el VO `GlobalMonthlySummary` (con `GlobalSummaryMovementInput`, `SummaryAccountRef` y `MemberBreakdownEntry`) en `src/domain/movement/GlobalMonthlySummary.ts`: factory `fromMovements(inputs, accounts)` que **compone** `MonthlyClosure.fromMovements(inputs)` para los KPIs agregados y `tagBreakdown` (sin reimplementar reglas) y calcula `memberBreakdown` en pasada propia con `Money`; cero dependencias externas (data-model.md §1.1/§1.6, ADR 0007)

**Checkpoint**: composición e invariantes protegidos por tests en verde.

---

## Phase 2: User Story 1 - Aplicación (TDD)

**Goal**: DTOs, caso de uso autocontenido y contrato de lectura `listByMonth` en el puerto.

- [ ] T003 [P] [US1] Ampliar `src/application/movement/dto.ts` con `GlobalMonthlySummaryDTO` y `MemberBreakdownEntryDTO` (`memberName: string | null`, `personalCents`, `sharedCents`; céntimos enteros) según data-model.md §4
- [ ] T004 [P] [US1] Escribir tests de `GetGlobalMonthlySummary` en `src/application/movement/GetGlobalMonthlySummary.test.ts` con dobles en memoria de `MovementRepository` (con `listByMonth`) y `AccountRepository` (`findAll`): rechaza mes con formato inválido (regex `^\d{4}-(0[1-9]|1[0-2])$`); llama a los puertos con `(month)` y `()`; mapea `MovementDTO[]`+`AccountDTO[]` → inputs de dominio (tags completas por movimiento, `accountId` en cada input) y devuelve un `GlobalMonthlySummaryDTO` idéntico al cálculo directo de `GlobalMonthlySummary.fromMovements` sobre los mismos datos
- [ ] T005 [US1] Implementar `GetGlobalMonthlySummary` en `src/application/movement/GetGlobalMonthlySummary.ts`: constructor con `MovementRepository` y `AccountRepository`, `execute(month: string)` valida el mes, lee `listByMonth(month)` + `findAll()`, calcula vía `GlobalMonthlySummary.fromMovements` y mapea a DTO (misma forma que `GetMonthlyClosure`; autocontenido, sin acoplamiento a la pantalla)

**Checkpoint**: `execute(month)` devuelve el resumen global verificable con dobles.

---

## Phase 3: User Story 1 - Persistencia (adaptador outbound)

**Goal**: método de lectura `listByMonth` en el puerto y el adaptador Drizzle, con el árbol compilando en verde al cerrar la fase.

- [ ] T006 [US1] Ampliar el puerto `MovementRepository` en `src/application/movement/MovementRepository.ts` con `listByMonth(month: string): Promise<MovementDTO[]>` e implementarlo en `src/infrastructure/db/DrizzleMovementRepository.ts`: la query de `listByMonthAndAccount` sin filtro de cuenta — rango semicerrado sargable `[month-01, mes siguiente)` con cruce de año (`nextMonthFirstDay`), `LEFT JOIN` de tags, `ORDER BY date DESC, id DESC`, mapeo con `mapJoinedRowsToMovementDTOs` (data-model.md §2.1; el typecheck fuerza la implementación en ambos ficheros en el mismo cambio)
- [ ] T007 [US1] Ampliar `src/infrastructure/db/DrizzleMovementRepository.test.ts` (libsql `:memory:` + migraciones de `drizzle/`, patrones existentes): `listByMonth` devuelve movimientos de TODAS las cuentas del mes con sus tags, respeta el rango exacto (sin meses contiguos ni movimientos de otros meses/años), y mes vacío → `[]`; comparativa con `listByMonthAndAccount` por cuenta (la unión de las tres llamadas = el resultado de `listByMonth`)

**Checkpoint**: lectura del mes completa y verificada contra la BD real.

---

## Phase 4: User Story 1 - Adaptador inbound (UI)

**Goal**: vista propia `/resumen` con selector de mes y panel servidor que solo formatea; enlace de entrada desde `/` (ui-contract íntegro).

- [ ] T008 [P] [US1] Crear el componente cliente `MonthSelector` en `src/infrastructure/primary/ui/month-selector.tsx` según contracts/ui-contract.md §1.3: `Select` shadcn existente con `buildMonthWindow(month, 24)` y `monthLabel`, label "Mes", navegación `router.replace("/resumen?month=…")` en `startTransition` con `opacity-60` pendiente (variant del selector de 002 sin cuenta; reutilizable para 009)
- [ ] T009 [P] [US1] Escribir tests de `MonthSelector` en `src/infrastructure/primary/ui/month-selector.test.tsx` (jsdom + RTL): renderiza la ventana de meses con etiqueta "Mes" y navega a `/resumen?month=` al seleccionar (mock de `useRouter`)
- [ ] T010 [P] [US1] Crear el componente servidor `GlobalSummaryPanel` en `src/infrastructure/primary/ui/global-summary-panel.tsx` según contracts/ui-contract.md §2–§3: `<section aria-labelledby>` con título "Resumen global de {Mes YYYY}" (`monthLabel`), grid de KPIs "Ingresos"/"Gastos" sin signo y "Saldo del mes" con `formatSignedCents` existente, sub-desglose "Gastos compartidos"/"Gastos personales", "Desglose por tag" con la nota permanente de 005 y "Desglose por miembro" con cabeceras "personales"/"compartidos", fila "Cuenta común" para `memberName: null`, orden (total desc, nombre asc, "Cuenta común" al final), filas solo con gastos; estados vacíos "Sin gastos este mes." en ambos desgloses y KPIs a `0,00 €` sin ocultar el panel; apilado móvil
- [ ] T011 [P] [US1] Escribir tests de UI en `src/infrastructure/primary/ui/global-summary-panel.test.tsx` (jsdom + RTL): KPIs y ambos desgloses con formato es-ES (helpers o espacio no rompible), fila "Cuenta común" cuando `memberName: null`, miembros sin gastos sin fila, orden y empates del desglose por miembro, nota multi-tag visible, "Sin gastos este mes." en mes vacío, saldo positivo/negativo/cero exacto sin signo
- [ ] T012 [US1] Crear la ruta `src/app/resumen/page.tsx` (server, adaptador fino): validar `searchParams.month` con Zod (`/^\d{4}-(0[1-9]|1[0-2])$/`, default `currentMonth()`; mismo patrón que `/`, ADR 0008), instanciar `GetGlobalMonthlySummary` con `DrizzleMovementRepository`+`DrizzleAccountRepository`, renderizar enlace "Volver" a `/`, `MonthSelector` y `GlobalSummaryPanel` (ui-contract §1.1)
- [ ] T013 [US1] Añadir el enlace "Resumen global" en `src/app/page.tsx`: en la cabecera, junto al título "Family Wallet", enlazando a `/resumen?month={mes activo}` (ui-contract §1.2; ÚNICO cambio en la pantalla principal — regiones de 002/003/005 intactas)

**Checkpoint**: `npm run dev` muestra `/resumen` con los KPIs globales del mes y la navegación desde `/` funciona.

---

## Phase 5: User Story 1 - E2E

- [ ] T014 [US1] Escribir el test e2e `e2e/resumen-global.spec.ts` (specs en serie dentro del fichero, BD `e2e.sqlite`, **mes propio sin colisión: 2026-06**): registrar vía UI movimientos en las tres cuentas de 2026-06 (Cuenta común: gasto 850,00 "Hipoteca" compartido tags Vivienda+Hipoteca; personal Miembro A: ingreso 2.100,00 + gasto 60,00 personal Coche; personal Miembro B: gasto 150,50 compartido Alimentación), navegar desde el enlace "Resumen global" de `/` y verificar los KPIs exactos (Ingresos `2.100,00 €`, Gastos `1.060,50 €`, Saldo del mes `+1.039,50 €`, Gastos compartidos `1.000,50 €`, Gastos personales `60,00 €`, desglose por tag con Vivienda/Hipoteca `850,00 €` + Coche + Alimentación `150,50 €`, desglose por miembro con filas de ambos miembros y "Cuenta común" `850,00 €`); verificar un mes vacío → KPIs a ceros y "Sin gastos este mes." (el cambio de mes queda en verificación manual — quickstart E6, mismo criterio que 005)

**Checkpoint**: US1 completa — el resumen global sustituye el cruce manual de los tres cierres en su alcance.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T015 [P] Registrar el ADR en `docs/architecture/adr/0012-resumen-global-composicion-cierre.md`: resumen global por composición del cierre (única fuente de reglas agregadas; FR-002 como garantía estructural + test de invariante), lectura propia del mes vía nuevo método de puerto `listByMonth`, vista en ruta propia `/resumen`; se rechazan el VO duplicado, la composición en aplicación, la agregación SQL y la sección global en `/` (plan.md §Complexity Tracking, research.md §1–§3)
- [ ] T016 [P] Actualizar la documentación de arquitectura en el mismo cambio reutilizando los diagramas del plan como base: `docs/architecture/overview.md` (ruta `/resumen`, `GetGlobalMonthlySummary`, VO, `listByMonth`), `docs/architecture/diagrams/domain-model.md` (clase `GlobalMonthlySummary`, data-model.md §1.6) y `docs/architecture/diagrams/c4.md` (nueva vista en el contenedor web); valorar fichero de secuencia propio con el diagrama de plan.md §Diagramas
- [ ] T017 Ejecutar la verificación manual completa de `specs/006-resumen-global-mensual/quickstart.md` (E1–E7 + comprobación inicial + verificaciones adicionales) sobre `npm run dev` con BD migrada y sembrada
- [ ] T018 Verificar los gates finales: `npm run lint`, `npm run typecheck`, `npm run test` y `npm run test:e2e` en verde en local, y CI de GitHub Actions en verde tras push

---

## Dependencies & Execution Order

### Phase Dependencies

- **Dominio (Phase 1)**: sin dependencias — empezar por aquí.
- **Aplicación (Phase 2)**: T004/T005 dependen del VO (T002) y de los DTOs (T003).
- **Persistencia (Phase 3)**: T006/T007 independientes del caso de uso (solo del puerto); el caso de uso solo es verde de extremo a extremo al cerrar la fase.
- **UI (Phase 4)**: la ruta (T012) depende de T005 (caso de uso), T006 (repo) y T008/T010 (componentes); el enlace (T013) depende solo del contrato de la ruta.
- **E2E (Phase 5)**: depende de T012/T013.
- **Polish (Phase 6)**: T015/T016 pueden arrancar tras T002/T005 (decisiones ya materializadas); T017 requiere T014; T018 es siempre el último.

### Within User Story 1

- TDD: T001 → T002; T004 → T005; T007 junto a T006 (el test del repo necesita la query); T009/T011 junto a sus implementaciones.
- T003 (DTOs) antes de T004/T010 (ambos consumen los tipos).
- T012 depende de T005, T006, T008 y T010; T014 depende de T012/T013.

### Parallel Opportunities

- Arranque: T001, T003 y T008 en paralelo (ficheros distintos, sin dependencias).
- UI: T009 tras T008 y T011 tras T010 (mismo módulo, conviene secuencia); T012/T013 en secuencias cortas.
- Polish: T015 y T016 en paralelo (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Bloque inicial (en paralelo):
Task: "T001 [P] [US1] Tests de GlobalMonthlySummary en src/domain/movement/GlobalMonthlySummary.test.ts"
Task: "T003 [P] [US1] DTOs GlobalMonthlySummaryDTO y MemberBreakdownEntryDTO en src/application/movement/dto.ts"
Task: "T008 [P] [US1] MonthSelector en src/infrastructure/primary/ui/month-selector.tsx"

# Bloque polish (en paralelo):
Task: "T015 [P] ADR 0012 en docs/architecture/adr/"
Task: "T016 [P] overview.md + diagrams/domain-model.md + c4.md"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Dominio con composición e invariantes protegidos (T001–T002).
2. Aplicación con caso de uso autocontenido (T003–T005).
3. Persistencia con la lectura completa del mes (T006–T007).
4. UI + ruta `/resumen` + enlace (T008–T013).
5. **STOP y VALIDAR**: quickstart E1–E7 manualmente + gates en verde.
6. Polish: ADR 0012, docs y verificación final (T015–T018).

### Incremental Delivery

1. Dominio → lógica de negocio verificable con tests unitarios.
2. Aplicación → resumen obtenible por (month) con dobles.
3. Persistencia → lectura real del mes completa.
4. UI → vista visible en `npm run dev`.
5. E2E + Polish → Definition of Done de la constitución.

---

## Notes

- [P] tasks = different files, no dependencies
- [US1] label mapea cada tarea a la user story para trazabilidad
- Cada par test→implementación debe verse en rojo antes de implementar (TDD)
- Commit tras cada tarea o grupo lógico (Conventional Commits, en español si aporta claridad)
- Verificar los checkpoints antes de avanzar de fase
- La feature no crea migraciones ni dependencias: `db:migrate`/`db:seed` existentes bastan (FR-005)
- **Gate previo a `/speckit.implement`**: resolver `checklists/design-review.md` (32 ítems, propiedad del revisor)
