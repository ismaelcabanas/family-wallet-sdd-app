# Tasks: Cuenta de Resultados Anual

**Input**: Design documents from `/specs/009-cuenta-resultados-anual/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/ui-contract.md, quickstart.md, `.specify/memory/constitution.md`, checklists/financiera.md (**gate pendiente: 13 ítems sin marcar — la sanity review del propietario debe resolverse antes de `/speckit.implement`**)

**Tests**: REQUERIDOS en esta feature (constitución, principio III: la lógica de negocio —agregación anual, medias, saldo acumulado— MUST estar cubierta por tests automatizados). Cada módulo incluye sus tests co-localizados junto al SUT (`*.test.ts` / `*.test.tsx`); repositorio contra libsql `:memory:`; e2e en `e2e/`.

**Organization**: Una única user story (US1, P1). **Sin fases de Setup ni Foundational**: la feature es de solo lectura — sin dependencias, esquema, migraciones ni datos nuevos (FR-008); la US1 comienza directamente. Fases: Dominio → Aplicación → Persistencia → UI → e2e → Polish, conforme a la dependencia hexagonal.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js existente: `src/` (domain, application, app, infrastructure) conforme a [plan.md](./plan.md).
- Tests co-localizados junto a su SUT; e2e en `e2e/`.

---

## Phase 1: User Story 1 - Dominio (TDD: tests primero, en rojo)

**Goal**: VO puro `AnnualIncomeStatement` que compone 12 `GlobalMonthlySummary` (única fuente de KPIs mensuales, FR-006 estructural) y añade en pasas propias la atribución de ingresos por miembro, el saldo acumulado desde enero, las medias /12 y la fusión anual de tags (data-model §1.1, ADR 0013).

- [X] T001 [P] [US1] Escribir tests unitarios del VO `AnnualIncomeStatement` en `src/domain/movement/AnnualIncomeStatement.test.ts`: happy path multimes/multicuenta; **invariante FR-006** (KPIs de cada mes del VO anual = `GlobalMonthlySummary.fromMovements` de ese mes, y `tagRows` = fusión de los 12 `tagBreakdown`); atribución de ingresos por miembro (cuenta personal → `memberId` del dueño; cuenta común → fila `null` «Cuenta común»; el ingreso no aparece en desgloses de gastos); **agrupación por identidad** (homónimos → filas distintas; varias cuentas personales del mismo miembro → una fila); catálogo completo siempre presente con ceros (FR-002); saldo acumulado running desde enero (meses a cero no alteran la acumulación; total de «Saldo acumulado» = total anual de «Saldo»; FR-012); **sin media en «Saldo acumulado»**; medias /12 con redondeo al céntimo (`Math.round(totalCents / 12)`, p. ej. total 100,00 € → 8,33 €); multi-tag computa en cada tag sin duplicar gasto real mensual ni anual; partición por mes con fechas de diciembre/enero (años contiguos fuera; la factory es total sobre inputs ya filtrados por el año); año vacío → 12 resúmenes a ceros, filas completas a cero, `tagRows = []` (FR-007); gasto compartido pagado desde cuenta personal computa en «Sin gastos personales» y gasto personal desde la común en «Gasto real» (semántica 002/005/006 heredada por composición); orden de `tagRows` (total anual desc, empate `tagName` asc `localeCompare es`); orden de `memberIncomeRows` (catálogo por `id`, «Cuenta común» al final); inmutabilidad del VO (research §7.1)
- [X] T002 [US1] Implementar el VO `AnnualIncomeStatement` (con `AnnualStatementMovementInput` —hereda `GlobalSummaryMovementInput` + `date: string` usada SOLO para particionar por mes—, `MemberRef`, `MemberIncomeRow`, `MonthlyTotalsRow`, `AnnualTagRow`) en `src/domain/movement/AnnualIncomeStatement.ts`: factory `fromMovements(inputs, accounts, members)` que particiona por mes derivado de `date` y **compone** 12 `GlobalMonthlySummary.fromMovements(inputs del mes, accounts)` (meses vacíos incluidos) como única fuente de los KPIs (FR-006 estructural), y calcula en pasas propias: `memberIncomeRows` (una fila por miembro del catálogo con `Money[]` de 12 celdas, ingresos atribuidos al dueño de la cuenta de registro —cuenta común → `memberId: null`—, orden del catálogo, fila «Cuenta común» al final), `totalIncomeRow`/`expenseRealRow`/`noPersonalExpenseRow`/`balanceRow` (`MonthlyTotalsRow` desde `incomeTotal`/`expenseTotal`/`sharedExpenseTotal`/`monthBalance` de cada resumen), `accumulatedBalanceRow` (running total desde enero, `totalCents` = `balanceRow.totalCents`, sin media) y `tagRows` (fusión por `tagId` de los 12 `tagBreakdown`, solo gastos, orden total anual desc + `tagName` asc `es`); `averageCents = Math.round(totalCents / 12)` en todas las filas salvo acumulado (único redondeo de la feature, ADR 0007); `Object.freeze`; cero dependencias externas (data-model.md §1.1/§1.6)

**Checkpoint**: composición e invariantes protegidos por tests en verde.

---

## Phase 2: User Story 1 - Aplicación (TDD)

**Goal**: DTOs anuales, contrato de lectura `listByYear` en el puerto con su implementación Drizzle, y caso de uso autocontenido sobre tres puertos (movimientos + cuentas + miembros).

- [X] T003 [P] [US1] Ampliar `src/application/movement/dto.ts` con `AnnualIncomeStatementDTO` (`monthlySummaries: GlobalMonthlySummaryDTO[]` —12, reutilizado de 006—, `memberIncomeRows`, `totalIncomeRow`, `expenseRealRow`, `noPersonalExpenseRow`, `balanceRow`, `accumulatedBalanceRow`, `tagRows`), `MemberIncomeRowDTO` (`memberId: number | null`, `memberName: string | null`, `monthlyIncomeCents: number[]` —12, índice 0 = enero—, `totalCents`, `averageCents`), `MonthlyTotalsRowDTO` (`monthlyCents: number[]` —admite negativos en `balanceRow`—, `totalCents`, `averageCents`), `AccumulatedBalanceRowDTO` (`monthlyCents`, `totalCents` —sin `averageCents`, FR-012—) y `AnnualTagRowDTO` (`tagId`, `tagName`, `monthlyCents`, `totalCents`, `averageCents`) según data-model.md §4 (céntimos enteros; el formateo EUR es exclusivo del adaptador UI)
- [X] T004 [US1] Ampliar el puerto `MovementRepository` en `src/application/movement/MovementRepository.ts` con `listByYear(year: string): Promise<MovementDTO[]>` e implementarlo en `src/infrastructure/db/DrizzleMovementRepository.ts` (declaración e implementación en el mismo cambio para mantener el árbol compilando; actualizar los dobles de tests existentes que implementan el puerto si el typecheck lo exige; precede al caso de uso, que consume el método): la query de `listByMonth` con el rango ampliado al año — `gte(date, "YYYY-01-01")` + `lt(date, "{YYYY+1}-01-01")` (rango semicerrado sargable, sin 31-dic del año anterior ni 1-ene del siguiente) —, mismas `LEFT JOIN` de tags y `ORDER BY date DESC, id DESC`, mismo mapeo `mapJoinedRowsToMovementDTOs` (data-model.md §2.1)
- [X] T005 [P] [US1] Escribir tests de `GetAnnualIncomeStatement` en `src/application/movement/GetAnnualIncomeStatement.test.ts` con dobles en memoria de `MovementRepository` (con `listByYear`), `AccountRepository` (`findAll`) y `MemberRepository` (`findAll`): rechaza año con formato inválido (regex `^\d{4}$`) sin llamar a los puertos; llama a los puertos con `(year)` y `()`; mapea `MovementDTO[]`+`AccountDTO[]`+`Member[]` → inputs de dominio (incluida `date` en cada input, tags completas, `accountId`) y devuelve un `AnnualIncomeStatementDTO` idéntico al cálculo directo de `AnnualIncomeStatement.fromMovements` sobre los mismos datos (12 `monthlySummaries` coherentes con `GlobalMonthlySummary.fromMovements` de cada mes)
- [X] T006 [US1] Implementar `GetAnnualIncomeStatement` en `src/application/movement/GetAnnualIncomeStatement.ts`: constructor con `MovementRepository`, `AccountRepository` y `MemberRepository`, `execute(year: string)` valida `/^\d{4}$/`, lee `listByYear(year)` + `findAll()` (cuentas) + `findAll()` (miembros) en paralelo, mapea a `AnnualStatementMovementInput[]` + `SummaryAccountRef[]` + `MemberRef[]`, calcula vía `AnnualIncomeStatement.fromMovements` y mapea a `AnnualIncomeStatementDTO` en céntimos enteros (misma forma que `GetGlobalMonthlySummary`; autocontenido, sin acoplamiento a la pantalla)

**Checkpoint**: `execute(year)` devuelve la cuenta de resultados anual verificable con dobles.

---

## Phase 3: User Story 1 - Persistencia (tests del adaptador)

**Goal**: batería del adaptador Drizzle para la lectura completa del año.

- [X] T007 [US1] Ampliar `src/infrastructure/db/DrizzleMovementRepository.test.ts` (libsql `:memory:` + migraciones de `drizzle/`, patrones existentes): `listByYear` devuelve movimientos de TODAS las cuentas del año con sus tags, respeta el rango exacto (sin 31-dic del año anterior ni 1-ene del año siguiente), y año vacío → `[]`; comparativa con `listByMonth` (la unión de las 12 llamadas mensuales del año = el resultado de `listByYear`, coherencia de fuentes)

**Checkpoint**: lectura del año completa y verificada contra la BD real.

---

## Phase 4: User Story 1 - Adaptador inbound (UI)

**Goal**: vista propia `/annual` con selector de año y panel servidor que solo formatea; enlaces de entrada desde `/` y `/summary` y de cruce a `/summary` (ui-contract íntegro).

- [X] T008 [P] [US1] Ampliar `src/infrastructure/primary/ui/format.ts` con `currentYear(now)` (año actual `YYYY`), `buildYearWindow(center: string, radius = 6)` (13 años alrededor del visible, análogo a `buildMonthWindow`) y `MONTH_SHORT_LABELS` (`["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]`), y ampliar `src/infrastructure/primary/ui/format.test.ts` con sus tests co-localizados (research §3)
- [X] T009 [P] [US1] Crear el componente cliente `YearSelector` en `src/infrastructure/primary/ui/year-selector.tsx` según contracts/ui-contract.md §1.3: `YearSelector({ year })`, `Select` shadcn existente con `aria-label="Año visible"`, opciones de `buildYearWindow(year, 6)` con etiqueta literal `String(year)`, navegación a `/annual?year=…` vía `router.replace` dentro de `startTransition` con `opacity-60` pendiente (análogo exacto a `month-selector.tsx` de 006)
- [X] T010 [P] [US1] Escribir tests de `YearSelector` en `src/infrastructure/primary/ui/year-selector.test.tsx` (jsdom + RTL): renderiza la ventana de 13 años con `aria-label="Año visible"` y navega a `/annual?year=` al seleccionar (mock de `useRouter`)
- [X] T011 [P] [US1] Crear el componente servidor `AnnualStatementPanel` en `src/infrastructure/primary/ui/annual-statement-panel.tsx` según contracts/ui-contract.md §2–§3: dos `<section aria-labelledby>` — 1) **tabla mensual** con título **"Cuenta de resultados de {Año}"** como ÚNICO título visible de la vista: tabla semántica (`<table>`, `<th scope="col">` para las 12 columnas Ene–Dic (`MONTH_SHORT_LABELS`) + "Total año" + "Media mensual", `<th scope="row">` para rótulos) con filas en orden fijo: cada miembro del catálogo, "Cuenta común" (`memberId: null`), "Total ingresos", "Gasto real", "Sin gastos personales", "Saldo" y "Saldo acumulado" (filas de saldo con `formatSignedCents` en celdas, total y media; la fila "Saldo acumulado" muestra "—" en la celda de media, FR-012); 2) **desglose de gastos por tag** con título "Desglose de gastos por tag": misma estructura de columnas, una fila por tag con gastos en el año (orden del DTO) + filas finales "Gasto real" y "Sin gastos personales" (FR-005) + nota permanente multi-tag de 005/006; todas las celdas visibles siempre con valor formateado incluido `0,00 €` (cero explícito, FR-007); estado vacío del desglose "Sin gastos este año." (la tabla mensual NO se oculta); importes con `formatAmountCents`/`formatSignedCents` existentes; contenedor `overflow-x-auto` para las 15 columnas y `tabular-nums`; la UI nunca calcula (constitución VII)
- [X] T012 [P] [US1] Escribir tests de UI en `src/infrastructure/primary/ui/annual-statement-panel.test.tsx` (jsdom + RTL): filas de miembros y "Cuenta común" con formato es-ES (helpers o espacio no rompible), celdas a `0,00 €` en meses vacíos, fila "Saldo acumulado" con media "—" y total = total anual de "Saldo", media mensual = total/12 redondeada al céntimo (p. ej. 2.100,00 € → 175,00 €), saldos con signo `+`/`−` (U+2212)/sin signo si 0, filas "Gasto real" y "Sin gastos personales" presentes en ambas tablas, nota multi-tag visible y "Sin gastos este año." en año sin gastos
- [X] T013 [US1] Crear la ruta `src/app/annual/page.tsx` (server, adaptador fino): validar `searchParams.year` con Zod (`/^\d{4}$/`, default `currentYear()`; patrón ADR 0008 igual que `/summary`), instanciar `GetAnnualIncomeStatement` con `DrizzleMovementRepository` + `DrizzleAccountRepository` + `DrizzleMemberRepository`, renderizar cabecera con enlaces "Volver" a `/` y "Resumen global" → `/summary?month={year}-01` (cross-nav de vistas familiares, ui-contract §1.2) junto a "Family Wallet" (SIN título de página propio: el título vive en el panel), `YearSelector` y `AnnualStatementPanel` (ui-contract §1.1)
- [X] T014 [P] [US1] Añadir el enlace "Cuenta de resultados" en `src/app/page.tsx`: en la cabecera, junto a "Resumen global", enlazando a `/annual?year={año del mes activo del selector}` (preserva el contexto temporal; ui-contract §1.2; ÚNICO cambio en la pantalla principal — regiones de 002/003/005/006 intactas)
- [X] T015 [P] [US1] Añadir el enlace "Cuenta de resultados" en `src/app/summary/page.tsx`: en la cabecera, junto a "Volver", enlazando a `/annual?year={año del mes visible}` (ui-contract §1.2; ÚNICO cambio en `/summary`)

**Checkpoint**: `npm run dev` muestra `/annual` con la tabla mensual y el desglose por tag del año, y la navegación desde `/` y `/summary` funciona.

---

## Phase 5: User Story 1 - E2E

- [X] T016 [US1] Escribir el test e2e `e2e/cuenta-resultados-anual.spec.ts` (specs en serie dentro del fichero, BD `e2e.sqlite`, **aislamiento propio sin colisión: registrar SOLO en la cuenta de Miembro B y en el año 2027** —enero y julio con datos—, año vacío 2028; research §7): registrar vía UI en la cuenta de Miembro B ingresos (nómina) y gastos personal y compartido multi-tag en enero y julio de 2027, navegar desde el enlace "Cuenta de resultados" de `/` y verificar cifras exactas (ingreso de B por mes y su total año/media, "Total ingresos", "Gasto real", "Sin gastos personales", "Saldo" y "Saldo acumulado" de enero y julio con running total, filas del desglose por tag con celdas mensuales, total y media); verificar el año vacío 2028 → estructura completa a `0,00 €` y "Sin gastos este año." (el cambio de año queda en verificación manual — quickstart E6, mismo criterio que 005/006)

**Checkpoint**: US1 completa — la cuenta de resultados anual sustituye el Excel "Cuenta Resultados" en su alcance.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 [P] Registrar el ADR en `docs/architecture/adr/0013-cuenta-resultados-anual-composicion-resumenes.md`: cuenta de resultados anual por composición de 12 resúmenes globales (FR-006 como garantía estructural + test de invariante), lectura propia del año vía nuevo método de puerto `listByYear`, atribución de ingresos por miembro, saldo acumulado desde enero (FR-012) y medias /12 con redondeo al céntimo (único punto de redondeo, ADR 0007); vista en ruta propia `/annual`; se rechazan el VO con bucles propios, la composición en aplicación (12 × `GetGlobalMonthlySummary`), la agregación SQL y 12 × `listByMonth` (plan.md §Complexity Tracking, research.md §1–§4)
- [X] T018 [P] Actualizar la documentación de arquitectura en el mismo cambio reutilizando los diagramas del plan como base: `docs/architecture/overview.md` (ruta `/annual`, `GetAnnualIncomeStatement`, VO `AnnualIncomeStatement`, `listByYear`), `docs/architecture/diagrams/domain-model.md` (clase `AnnualIncomeStatement`, data-model.md §1.6), `docs/architecture/diagrams/c4.md` (nueva vista en el contenedor web) y fichero de secuencia `docs/architecture/diagrams/cuenta-anual-sequence.md` con el diagrama de plan.md §Diagramas
- [X] T019 Ejecutar la verificación manual completa de `specs/009-cuenta-resultados-anual/quickstart.md` (E1–E8 + comprobación inicial + verificaciones adicionales) sobre `npm run dev` con BD migrada y sembrada — **verificado manualmente por el propietario (2026-09-24); la parte automatizable (gates, e2e con cifras exactas de E1–E3 y E5) en verde**
- [X] T020 Verificar los gates finales: `npm run lint`, `npm run typecheck`, `npm run test` y `npm run test:e2e` en verde en local, y CI de GitHub Actions en verde tras push

---

## Dependencies & Execution Order

### Phase Dependencies

- **Dominio (Phase 1)**: sin dependencias — empezar por aquí.
- **Aplicación (Phase 2)**: T005/T006 dependen del VO (T002), de los DTOs (T003) y del puerto (T004, que habilita la compilación del caso de uso).
- **Persistencia (Phase 3)**: T007 tras T004 (extiende la batería del adaptador).
- **UI (Phase 4)**: T009 depende de T008 (`buildYearWindow`); T011/T012 dependen de T003 (tipos DTO) y T008 (`MONTH_SHORT_LABELS`); la ruta (T013) depende de T004, T006, T008, T009 y T011; los enlaces (T014/T015) dependen solo del contrato de la ruta (ui-contract §1.2) y pueden ir en paralelo con T013.
- **E2E (Phase 5)**: T016 depende de T013/T014.
- **Polish (Phase 6)**: T017/T018 pueden arrancar tras T002/T006 (decisiones ya materializadas); T019 requiere T016; T020 es siempre el último.

### Within User Story 1

- TDD: T001 → T002; T005 (rojo) → T006 (verde); T007 junto a T004; en UI, tests co-localizados junto a su implementación (T008 con sus tests, T010 tras T009, T012 tras T011).
- T003 (DTOs) antes de T005/T011/T012 (consumen los tipos); T004 (puerto) antes de T006/T007 (el caso de uso llama a `listByYear`).
- T013 depende de T004, T006, T008, T009 y T011; T016 depende de T013/T014.

### Parallel Opportunities

- Arranque: T001, T003 y T008 en paralelo (ficheros distintos, sin dependencias).
- UI: T009 → T010 y T011 → T012 en secuencias cortas por módulo; T014/T015 en paralelo con T013.
- Polish: T017 y T018 en paralelo (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Bloque inicial (en paralelo):
Task: "T001 [P] [US1] Tests de AnnualIncomeStatement en src/domain/movement/AnnualIncomeStatement.test.ts"
Task: "T003 [P] [US1] DTOs AnnualIncomeStatementDTO y filas en src/application/movement/dto.ts"
Task: "T008 [P] [US1] Helpers currentYear/buildYearWindow/MONTH_SHORT_LABELS en src/infrastructure/primary/ui/format.ts"

# Bloque UI (en paralelo por módulo):
Task: "T009 [P] [US1] YearSelector en src/infrastructure/primary/ui/year-selector.tsx"
Task: "T011 [P] [US1] AnnualStatementPanel en src/infrastructure/primary/ui/annual-statement-panel.tsx"

# Bloque polish (en paralelo):
Task: "T017 [P] ADR 0013 en docs/architecture/adr/"
Task: "T018 [P] overview.md + diagrams/domain-model.md + c4.md + cuenta-anual-sequence.md"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Dominio con composición e invariante FR-006 protegidos (T001–T002).
2. Aplicación: DTOs, puerto `listByYear` + Drizzle y caso de uso autocontenido (T003–T006).
3. Persistencia: batería del adaptador para la lectura completa del año (T007).
4. UI + ruta `/annual` + enlaces (T008–T015).
5. **STOP y VALIDAR**: quickstart E1–E8 manualmente + gates en verde.
6. Polish: ADR 0013, docs y verificación final (T017–T020).

### Incremental Delivery

1. Dominio → lógica de negocio verificable con tests unitarios.
2. Aplicación → cuenta anual obtenible por (year) con dobles.
3. Persistencia → lectura real del año completa.
4. UI → vista visible en `npm run dev`.
5. E2E + Polish → Definition of Done de la constitución.

---

## Notes

- [P] tasks = different files, no dependencies
- [US1] label mapea cada tarea a la user story para trazabilidad
- TDD en dominio y aplicación (los tests se escriben primero y se ven en rojo); en UI y adaptador Drizzle, tests co-localizados junto a la implementación (mismo criterio que 005/006)
- Commit tras cada tarea o grupo lógico (Conventional Commits, en español si aporta claridad)
- Verificar los checkpoints antes de avanzar de fase
- La feature no crea migraciones ni dependencias: `db:migrate`/`db:seed` existentes bastan (FR-008); el único cambio de persistencia es el método de lectura `listByYear`
- **Gate previo a `/speckit.implement`**: resolver `checklists/financiera.md` (13 ítems pendientes, propiedad del revisador)

---

## Phase 7: Convergence

- [X] T021 Eliminar la línea duplicada `annual/page.tsx` en el árbol de estructura de `docs/architecture/overview.md` (las líneas 61–62 repiten la misma entrada del adaptador inbound) per T018 (partial)
