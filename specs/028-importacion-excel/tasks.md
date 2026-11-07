---

description: "Task list for feature 028 implementation"
---

# Tasks: Importación de movimientos desde Excel (prueba de concepto)

**Input**: Design documents from `/specs/028-importacion-excel/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/import-sheet-action.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-009 los exige explícitamente (unitarios del parseo y mapeo con fixtures de la muestra real, integración transaccional del repositorio, action mockeada, componente del asistente y e2e del flujo completo; constitución III). Co-localizados junto a su SUT (`*.test.ts(x)`, AGENTS.md «Tests»).

**Organization**: Una única user story pequeña (US1, P1 — constitución II, sin excepción): subir la hoja mensual CSV de una cuenta y un mes, previsualizar lo detectado y confirmar una importación transaccional. Superficie de cambio (plan «Project Structure»): **sin dominio, esquema ni migraciones** (FR-006/FR-007) — nuevo módulo `src/application/import/` (DTOs, núcleo puro `buildSheetImportPlan`, `BuildSheetImportPreview`, `ConfirmSheetImport`, puerto `SheetImportRepository`), parser propio `sheet-csv.ts` (cero dependencias nuevas, research §1), adaptador `DrizzleSheetImportRepository` (tx todo-o-nada), action directa `importSheetAction` (familia ADR 0015), página `/import` + ítem «Importar» en `GlobalNav`, asistente `import-sheet-wizard.tsx`, e2e propia y documentación (FR-010).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

- Monolito Next.js (App Router): `src/` en la raíz del repositorio; e2e en `e2e/`; docs vivos en `docs/architecture/`; roadmap maestro en `specs/001-family-wallet/spec.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar línea base verde y la rama feature antes de tocar código.

- [x] T001 Verificar línea base verde ejecutando `npm run lint && npm run typecheck && npm run test` (todo debe pasar antes de cualquier cambio)
- [x] T002 Confirmar la rama `feature/028-importacion-excel` activa y el árbol limpio (creada por la extensión git de Spec Kit)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la implementación.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: El **motor de importación** compartido por previsualizar y confirmar (todo lo que la US1 consume): parser CSV estricto, núcleo puro `buildSheetImportPlan` (clasificación, dialecto, mapeo, totales — data-model §2.1), DTOs, casos de uso y puerto. Sin IO en el núcleo (testeable con literales); **sin tocar dominio/esquema** (FR-006). Tests primero en rojo (T003–T006), implementación después (T007–T012).

### Tests (en rojo)

- [x] T003 [P] Crear `src/infrastructure/primary/actions/sheet-csv.test.ts` (rojo; fixtures derivados de la muestra real «Balance 2026.xlsx - Enero Isma.csv», research §1/§10): RFC 4180 estricto (comillas, comas embebidas `"Maria, Zoe, Aisha"`, `""` escapadas, CRLF y LF, BOM UTF-8); cabecera exacta de 13 columnas acepta y filas totalmente vacías se descartan; cabecera alterada/renombrada o nº de columnas ≠ 13 → error «La estructura del fichero no coincide con la esperada (cabecera de 13 columnas de la hoja mensual).»; comillas sin cerrar → «El fichero no es un CSV válido.»; cero filas de datos → «El fichero no contiene movimientos.»; las filas con ≠ 13 celdas pasan al resultado como `SheetCellsRow` (la celda no el núcleo reporta el error de fila)
- [x] T004 [P] Crear `src/application/import/sheet-import-plan.test.ts` (rojo; literales sin IO, data-model §2.1/§3 y research §2–§3/§7–§8): un caso por tipo de la tabla de mapeo (`Gasto`→expense/personal, `Gasto Común`→expense/shared, `Gasto Fijo`→expense/personal, `Ingreso`→income con etiqueta opcional; `Ahorro` y concepto `Aportación Común` exacto tras trim → `ignored`; «Aportación Cuenta Común» **se importa**); fecha vacía → `{month}-01` y fecha de otro mes → error de fila; nota fusionada «Concepto — Descripción» / solo concepto / solo descripción / vacía → error; importes «7.85»→785 y «1366.54»→136654 céntimos (punto decimal, sin `parseFloat`), `0`/negativo/coma decimal/texto → error de fila; gasto sin categoría → error, ingreso sin categoría → sin etiqueta; etiqueta activa match case-insensitive → `tagId`, colisión con desactivada → error de fila, sin equivalente → `createsTag` con dedupe por `lower(name)`; totales sobre filas importables con los valores verificados de la muestra (186,75 € / 73,52 € / 3.300,00 € — SC-002); validación `Movement.create` por fila con `TagId(-1)` centinela (los errores de dominio como «La nota es obligatoria.» llegan como motivo de fila)
- [x] T005 [P] Crear `src/application/import/BuildSheetImportPreview.test.ts` (rojo; dobles en memoria — `InMemoryCatalogTagRepository` de 026 y espejos de `AccountRepository`/`CategoryRepository`, data-model §2.2/§4): devuelve `SheetImportPreviewDTO` completa (`accountName` nombre mostrado, filas ok/ignored/error en orden de línea, totales, `tagsToCreate` en orden de primera aparición); cuenta inexistente → `AccountNotFoundError`; sin categoría genérica → `CategoryNotFoundError`; nunca escribe nada
- [x] T006 [P] Crear `src/application/import/ConfirmSheetImport.test.ts` (rojo; dobles en memoria + doble del puerto, data-model §2.2/§2.3): plan válido → `persist` con `ExecutableImportPlan` (solo filas ok + `tagsToCreate`) y `{status:"imported"}` con contadores; plan con errores o 0 movimientos → `{status:"invalid"}` **sin llamar** `persist` (FR-005); el plan se recalcula fresco desde `rows` (no desde la previsualización)

### Implementación

- [x] T007 [P] Crear `src/application/import/dto.ts` (data-model §4): `SheetPreviewRowDTO`, `SheetImportTotalsDTO`, `SheetImportPreviewDTO` (tipos puramente declarativos, sin IO)
- [x] T008 Crear `src/application/import/sheet-import-plan.ts` (data-model §2.1): `SheetCellsRow`, `PlanInput`, `PlannedMovement`, `PlanRow`, `ImportPlan` + función pura `buildSheetImportPlan` aplicando las reglas 1–8 congeladas (clasificación en orden, dialecto `^\d{1,9}(\.\d{1,2})?$` parseado a céntimos por string, fechas §8, nota fusionada §3, tabla de mapeo §2, resolución de etiqueta §7 con centinela `TagId(-1)` nunca persistido, totales SC-002) → T004 en verde
- [x] T009 [P] Crear `src/application/import/SheetImportRepository.ts` (puerto, data-model §2.3): `ExecutableImportPlan` (movimientos ok + tagsToCreate) e interfaz `persist(plan): Promise<{movementsCreated, tagsCreated}>` — paridad del patrón de multi-escritura (`TagRepository.mergeInto`, `registerMaterialization`); la transacción vive en el adaptador
- [x] T010 Crear `src/infrastructure/primary/actions/sheet-csv.ts` (data-model §6.1; importa `SheetCellsRow` de la aplicación): `SHEET_COLUMNS` — const congelada con las 13 cabeceras exactas de la hoja (literales del CSV como datos, glosario §9) — y `parseSheetCsv(text): { ok: true; rows } | { ok: false; message }` con parser RFC 4180 propio (~50 líneas, research §1), mensajes congelados del contrato §2 → T003 en verde
- [x] T011 Crear `src/application/import/BuildSheetImportPreview.ts` (data-model §2.2): `execute({accountId, month, rows})` leyendo `AccountRepository.findById` (→ `AccountNotFoundError`; `accountName` como nombre mostrado — derivado en personales, ADR 0020), `TagRepository.findAll` (activas para match, desactivadas para colisión) y `CategoryRepository.findBySlug(DEFAULT_CATEGORY_SLUG)` (→ `CategoryNotFoundError`), delegando en `buildSheetImportPlan` → T005 en verde
- [x] T012 Crear `src/application/import/ConfirmSheetImport.ts` (data-model §2.2): mismas lecturas que T011, recalcula el plan fresco, persiste vía `SheetImportRepository` solo si no hay errores y hay ≥1 movimiento, `{status:"invalid"}` en caso contrario (FR-005) → T006 en verde

**Checkpoint**: Motor completo en verde por SUT (T003–T006 con T008/T010/T011/T012); las superficies de US1 (adaptador Drizzle, action, UI) pueden empezar en paralelo.

---

## Phase 3: User Story 1 - Importar la hoja mensual de una cuenta con previsualización y confirmación (Priority: P1) 🎯 MVP

**Goal**: Página `/import` (nav «Importar») con asistente de dos pasos — selección de cuenta/mes/fichero y previsualización con totales, filas ignoradas y errores por fila — y confirmación transaccional todo-o-nada que crea movimientos y etiquetas nuevas por la vía de escritura existente (`Movement.create`, FR-006); materializaciones y agregados intactos (FR-007).

**Independent Test**: Quickstart Q1–Q5: importar la muestra real (previsualización con 12+1 movimientos, filas 34/36 ignoradas, totales 186,75/73,52/3.300,00 €, fechas a día 1); fila inválida → error por fila y confirmar deshabilitado sin altas (Q2); estructura no reconocida → error de formato sin crear nada (Q3); etiqueta nueva «Mascotas» en la genérica (Q4); `/summary`, `/annual` y KPIs con reglas vigentes (Q5).

### Tests (en rojo)

- [x] T013 [P] [US1] Crear `src/infrastructure/db/DrizzleSheetImportRepository.test.ts` (rojo; integración contra libsql `:memory:` con las migraciones de `drizzle/`, patrón `DrizzleTagRepository.test.ts` de 026, research §6/§10): persiste M etiquetas nuevas (activas, en la categoría genérica, slug único con sufijo `-2…` si colisiona — paridad `CreateTag`) + N movimientos con `tagId` resuelto (existente o recién creado) y devuelve contadores; dedupe de categorías repetidas en el fichero = una etiqueta; **fallo intermedio ⇒ rollback total** (p. ej. un movimiento inválido por `Movement.create` a mitad ⇒ ni etiquetas ni movimientos — FR-005/SC-003)
- [x] T014 [P] [US1] Crear `src/infrastructure/primary/actions/import-sheet.action.test.ts` (rojo; `vi.mock` de `BuildSheetImportPreview`/`ConfirmSheetImport`, contrato import-sheet-action.md §1–§5): Zod de args con los mensajes congelados (cuenta «Selecciona una cuenta.», mes «Selecciona un mes.», fichero «Adjunta el fichero CSV de la hoja mensual.», > 512 KB «El fichero es demasiado grande (máximo 512 KB).», sin `.csv` «El fichero debe ser un CSV exportado de Google Sheets.»); errores de fichero del parser §2 tal cual; `intent:"preview"` → `{status:"preview"}` con el DTO y **sin revalidar**; `intent:"confirm"` → `{status:"imported"}` + `revalidatePath("/", "layout")` solo en éxito; `AccountNotFoundError`/`CategoryNotFoundError`/plan inválido al confirmar → `{status:"error"}` con los mensajes de §4
- [x] T015 [P] [US1] Extender `src/infrastructure/primary/ui/global-nav.test.tsx` (rojo; ui-contract §1): nuevo ítem **«Importar»** → `/import` con `aria-current="page"` cuando `active="import"` (unión del prop ampliada; orden y literales existentes intactos)
- [x] T016 [P] [US1] Crear `src/infrastructure/primary/ui/import-sheet-wizard.test.tsx` (rojo; jsdom con `importSheetAction` mockeada, ui-contract §2–§4): paso 1 con labels «Cuenta»/«Mes»/«Fichero CSV» controlados y «Previsualizar importación» deshabilitado sin los tres datos («Previsualizando…» en curso); paso 2 renderiza «{N} movimientos para {cuenta} · {mes}», totales formateados, regiones «Etiquetas que se crearán»/«Filas ignoradas» («Fila {n}: fila de configuración de la hoja»)/«Filas con error» (`role="alert"`), tabla «Movimientos detectados» con «(nueva)» y naturaleza «—» en ingresos; «Confirmar importación (N movimientos)» deshabilitado con errores o 0 movimientos; cambio de cuenta/mes/fichero tras previsualizar invalida y vuelve al paso 1; éxito «Importación completada: {N} movimientos» con enlace a `/accounts/{id}?month={mes}`; error de action en `role="alert"` sin salir del paso 1

### Implementación

- [x] T017 [P] [US1] Crear `src/infrastructure/db/DrizzleSheetImportRepository.ts` (data-model §5): una única `db.transaction` que (1) resuelve slugs únicos de las etiquetas nuevas contra el catálogo (`deriveTagSlug` + sufijo, paridad `CreateTag`) y las inserta con `RETURNING id` (activas, `categoryId` de la genérica); (2) por cada movimiento resuelve `tagId`, construye `Movement.create(...)` — validación de dominio autoritativa dentro de la tx — e inserta en `movements`; cualquier error revierte todo → T013 en verde
- [x] T018 [US1] Crear `src/infrastructure/primary/actions/import-sheet.action.ts` (data-model §6.2; acción directa `"use server"`, familia ADR 0015 — composición inline `new BuildSheetImportPreview(new DrizzleAccountRepository(db), …)` / `new ConfirmSheetImport(…, new DrizzleSheetImportRepository(db))`): `ImportSheetResult` (`idle | preview | imported | error`), Zod de args (contrato §1), `await file.text()` → `parseSheetCsv` con errores de fichero §2, dispatch por `intent` a preview/confirm, traducción de errores de aplicación §4, `revalidatePath("/", "layout")` solo en éxito de confirmación → T014 en verde
- [x] T019 [P] [US1] Modificar `src/infrastructure/primary/ui/global-nav.tsx`: ampliar la unión de `active` con `"import"` y añadir el `Link` **«Importar»** → `/import` (sin `month`; posición y resto de ítems intactos) → T015 en verde
- [x] T020 [US1] Crear `src/infrastructure/primary/ui/import-sheet-wizard.tsx` (ui-contract §2–§4; `Select` shadcn controlados — SC-004 —, `input type="file" accept=".csv,text/csv"` con el `File` en estado del cliente, invocación directa de `importSheetAction` en `useTransition`, invalidación de la previsualización al cambiar cuenta/mes/fichero, botones «Previsualizar importación»/«Confirmar importación (N movimientos)»/«Volver», estado importado con enlace; la UI **nunca** calcula totales ni mapea — solo renderiza `SheetImportPreviewDTO`, constitución VII) → T016 en verde
- [x] T021 [US1] Crear `src/app/import/page.tsx` (ui-contract §1): servidor, `GlobalNav active="import"`, título «Importar hoja mensual», `ListAccounts` y `buildMonthWindow(currentMonth(), 24)` + `monthLabel` (de `ui/format.ts`) como props del asistente
- [x] T022 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (incluye el resto de suites existentes: cambio no destructivo, FR-006/FR-007; dominio, `/summary`, `/annual`, KPIs y materializaciones sin cambios esperados)

**Checkpoint**: US1 funcional: `/import` navegable con asistente completo, previsualización informada, confirmación transaccional y movimientos visibles/editables en la página de cuenta (esc. 1–5).

---

## Phase 4: E2E del flujo crítico (FR-009, constitución III)

**Purpose**: Spec nueva en fichero propio con la combinación verificada libre por research §9: **Cuenta común · marzo de 2027** (ranura 2027 sin lectores en `e2e/`; `importacion-excel` corre alfabéticamente antes que `informe-anual-gastos`/`ingresos-regulares` sobre `e2e.sqlite` compartida con `workers: 1`). Fichero propio generado en buffer con `page.setInputFiles` (sin fixture en disco); **solo categorías del seed** (sin etiquetas nuevas: no contamina el catálogo global que `jerarquia-etiquetas` verifica); sin restauración necesaria (2027 es exclusivo de este spec).

- [x] T023 [US1] Crear `e2e/importacion-excel.spec.ts` (serial en el fichero; helpers espejo de los specs existentes, quickstart «Validación automatizada») cubriendo el flujo crítico «subida → previsualización → confirmación → listado»: **I1** happy path — `/import`, seleccionar Cuenta común y Marzo de 2027, adjuntar el CSV en buffer, previsualizar (totales y filas ignoradas visibles), confirmar («Importación completada») y verificar los movimientos en `/accounts/3?month=2027-03` con fecha/nota/importe/tipo/naturaleza/etiqueta correctos; **I2** copia con una fila inválida (importe `abc` o fecha de otro mes) → fila señalada «Fila {n}: {motivo}», confirmar deshabilitado y **nada creado** (SC-003); **I3** CSV con cabecera alterada → `role="alert"` «La estructura del fichero no coincide…» sin previsualización ni altas
- [x] T024 [US1] Ejecutar `npm run test:e2e` y verificar las 19 specs en verde (las 18 existentes **sin cambios esperados**; ajustar solo si un literal afectado lo exigiese)

**Checkpoint**: Flujo crítico de importación cubierto end-to-end (SC-001/SC-003/SC-004).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva, convenciones y roadmap actualizados en el mismo cambio (constitución III DoD, FR-010). **Sin ADR de librería** (cero dependencias nuevas, research §1); la acción directa extiende la excepción ADR 0015 ya aceptada con una nota (plan «Complexity Tracking»).

- [x] T025 [P] Amendar `docs/architecture/adr/0015-creacion-tags-inline-action-propia.md` con la extensión documentada por el plan: la familia de acciones directas cubre también `importSheetAction` con el `File` viajando como argumento desde **estado del cliente** (`useTransition`, sin `useActionState`+FormData porque el file input no puede ser controlado — SC-004/React 19)
- [x] T026 [P] Actualizar `AGENTS.md` con la convención «Importación de hoja mensual (028)»: página `/import` + nav «Importar», parser propio contra `SHEET_COLUMNS` congelada, núcleo puro `buildSheetImportPlan` compartido por preview/confirm, confirmación re-parsea y re-valida en servidor, puerto `SheetImportRepository` con la tx en el adaptador, etiquetas nuevas en la genérica dentro de la misma importación, sin deduplicación entre importaciones (PoC)
- [x] T027 [P] Actualizar la documentación viva de `docs/architecture/` (base: los diagramas de plan.md y data-model §8): `diagrams/domain-model.md` añade el módulo `application/import` (`buildSheetImportPlan`, casos de uso, puerto y `DrizzleSheetImportRepository`); nuevo diagrama de secuencia del flujo de importación (reutilizando el del plan); revisar y anotar `overview.md` y `diagrams/c4.md` donde mencionen las vías de entrada
- [x] T028 [P] Actualizar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-010): añadir la fila `028-importacion-excel` marcada **Completada** y amendar la asunción «No se migra el histórico de los Excel: se empieza de cero» y el ítem del alcance diferido «Importación de histórico desde Excel» conforme al resultado del PoC (vía validada para una hoja/cuenta/mes; importación masiva pendiente de feature futura)
- [x] T029 Validar manualmente los escenarios Q1–Q5 de `specs/028-importacion-excel/quickstart.md` con `npm run db:migrate && npm run db:seed && npm run dev` (Q1 con la muestra real «Balance 2026.xlsx - Enero Isma.csv»; Q2–Q4 con copias editadas; Q5 sobre agregados/materializaciones); dejar el estado limpio al terminar (meses importados de prueba eliminados si procede)
- [x] T030 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-004, DoD)

**Checkpoint**: Documentación viva, AGENTS.md, ADR 0015, diagramas, roadmap y quickstart sincronizados con la implementación; feature entregada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Depende de Phase 1. Tests rojo primero (T003 ∥ T004 ∥ T005 ∥ T006, ficheros distintos), luego impl: T007 ∥ (T008 → T009/T010) → T011/T012. **Bloquea toda US1**: action, casos de consumo y Drizzle dependen del motor.
- **US1 (Phase 3)**: Depende de Phase 2. Tres cadenas independientes que pueden intercalarse o repartirse: **(a) outbound** T013 → T017; **(b) action** T014 → T018; **(c) UI** T015 → T019 y T016 → T020 → T021. Gate T022 al final con las tres cadenas completas.
- **E2E (Phase 4)**: Depende de Phase 3 completa (UI operativa para validar el flujo).
- **Polish (Phase 5)**: Depende de todas las anteriores (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US1 (P1, única)**: Sin dependencias entre historias (constitución II: una sola US). Independientemente testable vía quickstart Q1–Q5 y las suites por capa; el MVP de la feature es la propia US1 completa (Phase 1–4).

### Within Each User Story

- Tests primero y en rojo antes de su SUT: T003 → T010; T004 → T008; T005 → T011; T006 → T012 (Phase 2); T013 → T017; T014 → T018; T015 → T019; T016 → T020 (Phase 3).
- T009 y T010 importan tipos de `sheet-import-plan.ts` (T008 primero); T011/T012 consumen `dto.ts` (T007) y el núcleo (T008).
- T018 (action) depende del parser (T010) y los casos de uso (T011/T012) de Phase 2; T020 (wizard) depende de la firma de T018; T021 (página) depende de T019 y T020.
- Unit/integration/component gates (T022) antes del e2e (T023–T024); gates completos acumulativos al final (T030).

### Parallel Opportunities

- Phase 2 tests: T003 ∥ T004 ∥ T005 ∥ T006 (ficheros distintos).
- Phase 2 impl: T007 ∥ T008 (ficheros distintos); T009 ∥ T010 tras T008; T011 ∥ T012 tras sus tipos.
- Phase 3 tests: T013 ∥ T014 ∥ T015 ∥ T016 (ficheros distintos).
- Phase 3 cadenas: outbound (a), action (b) y UI (c) en paralelo — no comparten ficheros.
- Phase 5: T025 ∥ T026 ∥ T027 ∥ T028 (ficheros distintos).

---

## Parallel Example: User Story 1

```bash
# Motor — tests en rojo en paralelo (ficheros distintos):
Task: "Crear sheet-csv.test.ts con fixtures de la muestra real (rojo)"
Task: "Crear sheet-import-plan.test.ts con la tabla de mapeo completa (rojo)"
Task: "Crear BuildSheetImportPreview.test.ts con dobles (rojo)"
Task: "Crear ConfirmSheetImport.test.ts con dobles (rojo)"

# US1 — tests en rojo en paralelo (ficheros distintos):
Task: "Crear DrizzleSheetImportRepository.test.ts de integración (rojo)"
Task: "Crear import-sheet.action.test.ts con vi.mock (rojo)"
Task: "Extender global-nav.test.tsx con «Importar» (rojo)"
Task: "Crear import-sheet-wizard.test.tsx (rojo)"

# US1 — las tres cadenas de adaptadores en paralelo (sin ficheros compartidos):
# (a) outbound: DrizzleSheetImportRepository.ts (tx todo-o-nada)
# (b) action:   import-sheet.action.ts (Zod + dispatch preview/confirm)
# (c) UI:       global-nav.tsx → import-sheet-wizard.tsx → app/import/page.tsx

# Docs de Phase 5 en paralelo (ficheros distintos):
Task: "Amendar ADR 0015 con el File en estado del cliente"
Task: "Actualizar AGENTS.md (convención Importación de hoja mensual 028)"
Task: "Actualizar docs/architecture/ (domain-model + secuencia importación)"
Task: "Añadir fila 028 Completada al roadmap maestro + amend del histórico"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Complete Phase 1: línea base verde y rama feature
2. Complete Phase 2: motor de importación (parser, núcleo puro, casos de uso, puerto), tests rojo primero en cada SUT
3. Complete Phase 3: US1 por cadenas (Drizzle ∥ action ∥ UI), tests rojo primero; gate T022 en verde
4. **STOP and VALIDATE**: validación manual Q1–Q3 con `npm run dev` y la muestra real
5. Complete Phase 4: e2e `importacion-excel.spec.ts` (Cuenta común · marzo 2027) + suite completa (19) en verde
6. Complete Phase 5: ADR 0015, AGENTS.md, diagramas, roadmap (FR-010), Q1–Q5 completos y gates totales (SC-004)

### Incremental Delivery

- Feature de una sola US (constitución II): el valor de usuario llega con Phase 3 — al terminar T021 ya se importa una hoja completa con previsualización y confirmación; Phase 4 asegura el flujo crítico end-to-end y Phase 5 cierra el DoD.

### Parallel Team Strategy

- Para 1 desarrollador (real): secuencial por bloques con los [P] internos como confirmaciones atómicas. Con varios: las tres cadenas de Phase 3 (outbound, action, UI) pueden repartirse; las cadenas críticas (T013→T017, T014→T018 y T016→T020→T021) no se parten.

---

## Notes

- [P] tasks = different files, no dependencies
- **Todo-o-nada por diseño (FR-005)**: la detección de errores ocurre íntegramente en preview; confirm recalcula el plan fresco en servidor (no confía en la previsualización ni en el cliente) y persiste en una única `db.transaction` del adaptador — nunca `CreateTag`+`CreateMovement` secuenciales (no atómico, research §6)
- **Dominio intacto (FR-006)**: `Movement.create` es la única vía de validación/escritura (ejecutada por fila en el núcleo puro con `TagId(-1)` centinela nunca persistido, y de nuevo autoritativa dentro de la tx); `CreateTag` se reutiliza solo como regla (slug único + genérica), no como llamada
- **Acción directa (familia ADR 0015)**: `importSheetAction` devuelve un resultado y se invoca con `useTransition`; el `File` viaja como argumento desde estado del cliente (un file input no puede ser controlado — SC-004, research §5); `revalidatePath("/", "layout")` solo en éxito de confirmación (paridad 027)
- **Cero dependencias nuevas** (parser CSV propio ~50 líneas, research §1): sin ADR de librería (FR-010); los literales del CSV (`Fecha de Operación`, …) viven como datos en `SHEET_COLUMNS` (glosario data-model §9)
- **Intocable (FR-007)**: dominio, esquema y migraciones, `/summary`, `/annual`, página de cuenta, KPIs, materializaciones (018/019/021/023) y agregados — la importación solo crea movimientos corrientes
- Sin deduplicación entre importaciones (PoC, Out of Scope): la previsualización con totales es la comprobación previa del usuario
- E2E: fichero propio, Cuenta común · marzo 2027 (ranura verificada libre, research §9), fichero en buffer por `page.setInputFiles`, solo categorías seed (el catálogo global queda intacto para `jerarquia-etiquetas`)
- Commit after each task or logical group (Conventional Commits, en español el enunciado cuando aporte claridad)
