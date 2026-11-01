---

description: "Task list for feature 024 implementation"
---

# Tasks: KPI de gasto personal del mes en la página de cuenta personal

**Input**: Design documents from `/specs/024-kpi-gasto-personal/`

**Prerequisites**: plan.md (required) ✅, spec.md (required) ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: Incluidos porque FR-008 los exige explícitamente (tests de componente del bloque KPIs + flujo e2e con importes exactos; constitución III). La resta de composición vive en `page.tsx` y se verifica en e2e — no se crea una capa nueva de testeo de páginas RSC (research §4, precedente 022/023).

**Organization**: Una única user story pequeña (US1, P1 — constitución II, sin excepción): ver de un vistazo el gasto personal del mes junto al saldo para decidir gastos futuros. Es una **agregación de lectura pura**: superficie de cambio exacta = 2 ficheros de producto modificados (`src/app/accounts/[accountId]/page.tsx`, `src/infrastructure/primary/ui/account-month-kpis.tsx`), su suite de componente amendada, 1 e2e nuevo (`e2e/kpi-gasto-personal.spec.ts`) y documentación (FR-009). **Cero cambios** en dominio, aplicación, puertos, repositorios, esquema/migraciones, seed, actions, formularios, agregados, cierre y cuenta común (FR-005/FR-006; data-model §2, research §6).

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
- [x] T002 Confirmar la rama `feature/024-kpi-gasto-personal` activa y el árbol limpio (creada por la extensión git de Spec Kit; worktree actualizado si se usa)

**Checkpoint**: Repositorio en verde y rama feature activa; se puede empezar la implementación.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prerrequisitos compartidos que bloquearían las user stories.

**Sin tareas**: la feature es lectura pura sobre infraestructura existente — no hay esquema, migraciones, entidades, casos de uso, puertos ni queries nuevas que preparar (FR-005; data-model §1–§2, research §6). El bloque KPIs de 022/023 y los casos de uso que la página ya invoca (`GetMonthlyClosure`, `GetMonthNetContribution`) son el fundamento y quedan intactos.

**Checkpoint**: Ninguno necesario — la implementación de US1 puede empezar inmediatamente tras Phase 1.

---

## Phase 3: User Story 1 - Consultar el gasto personal del mes junto al saldo, de forma continua (Priority: P1) 🎯 MVP

**Goal**: El bloque «KPIs del mes» de las cuentas personales pasa de 3 a **4 métricas** con «Gasto personal» en segunda posición (orden congelado Aportación común · Gasto personal · Ahorro del mes · Saldo del mes; grid `grid-cols-2 sm:grid-cols-4`), alimentado por la resta única de composición `personalExpenseCents = closure.personalExpenseCents − netContribution.amountCents` que la página calcula con los datos ya leídos y pasa como prop (FR-001–FR-004; ui-contract §1–§3).

**Independent Test**: Quickstart Q1–Q6: configurar ingreso regular 2.000,00 € y aportación 25 % en Miembro B, registrar gasto común 60,00 € y gastos personales 120,55 € + 80,00 € → bloque con 4 métricas: Gasto personal **200,55 €** (excluye aportación y comunes), Aportación común **440,00 €**, Saldo del mes **+1.299,45 €**; mes anterior → 0,00 € sin subtexto; sticky visible al recorrer listado largo; alta de gasto actualiza el KPI en el mismo ciclo; cuenta común sin bloque.

### Tests para US1 (primero, en rojo)

- [x] T003 [P] [US1] Amendar `src/infrastructure/primary/ui/account-month-kpis.test.tsx` (rojo, ui-contract §4 + research §7 caso a–e): extender `renderKpis`/`RenderKpisInput` con `personalExpenseCents: number` y pasarla como prop en todos los renders; actualizar el test de orden congelado a **4** métricas `["Aportación común", "Gasto personal", "Ahorro del mes", "Saldo del mes"]` (vía `getAllByRole("definition")` + `previousElementSibling`); actualizar el test de región/grid: `dl.className` contiene `grid-cols-2` y `sm:grid-cols-4` (ya no `grid-cols-3`) con sticky `top-0 z-20` intacto; añadir caso importe exacto: `personalExpenseCents: 20055` → `/^200,55[\s\u00A0\u202F]€$/` sin signo U+2212 y `className` sin `text-red-600`; añadir caso mes sin gastos computables: `personalExpenseCents: 0` → `/^0,00[\s\u00A0\u202F]€$/` en la celda «Gasto personal» **sin** subtexto de ningún tipo (`queryByText(/Sin .* configurad/)` ausente en la celda — nunca «Sin configurar»); ejecutar y confirmar rojo

### Implementación para US1

- [x] T004 [US1] Modificar `src/infrastructure/primary/ui/account-month-kpis.tsx` (amenda 022/023): prop nueva `personalExpenseCents: number` en el tipo inline (data-model §1.4; la compone la página, el componente solo formatea); `dl` de `mt-2 grid grid-cols-3 gap-3` a **`mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4`**; nueva celda en **segunda posición**: `<dt>` «Gasto personal» (`text-xs text-muted-foreground`) + `<dd>` `formatAmountCents(personalExpenseCents)` con `text-xl font-semibold tabular-nums` — magnitud **sin signo ni `text-red-600`**, **sin subtexto ni estados** (lectura pura, nunca «Sin configurar»; ui-contract §1, research §3); celdas de aportación/ahorro/saldo, región sticky, `h2` y etiqueta pasiva de mes intactos (ui-contract §1/§5); sigue siendo server component presentacional puro (constitución VII); verificar T003 en verde
- [x] T005 [US1] Modificar `src/app/accounts/[accountId]/page.tsx`: dentro del condicional `account.type === "personal" && netContribution !== null && savings !== null`, añadir al render de `AccountMonthKpis` la prop `personalExpenseCents={closure.personalExpenseCents - netContribution.amountCents}` — **resta única de composición** (Σ gastos propios del cierre − importe del movimiento de aportación enlazado; precedente `netMonthBalanceCents` de 022/023; research §1, ui-contract §2); **nada más cambia**: los 3 awaits secuenciales de materialización (018 → 019 → 023) y el `Promise.all` intactos (FR-005), cuenta común/agregados/cierre sin tocar (FR-006)
- [x] T006 [US1] Ejecutar `npm run lint && npm run typecheck && npm run test` y verificar todo en verde (incluye el resto de suites existentes: cambio no destructivo, SC-005 parcial)

**Checkpoint**: US1 funcional: las cuentas personales muestran el bloque de 4 métricas con el gasto personal del mes consultado; suites unitarias y de componentes en verde; cuenta común y agregados intactos.

---

## Phase 4: E2E del flujo crítico (FR-008, constitución III)

**Purpose**: Spec nueva en fichero propio con la única combinación viable verificada contra la matriz de ocupación: **Cuenta de Miembro B (`/accounts/2`) + mes en curso real dinámico** (research §5: cuenta 1 descartada porque K0 de `kpis-fijos-cuenta.spec.ts` exige «Sin aportación configurada»; un mes pasado fijo no puede tener aportación materializada). `kpi-gasto-personal` corre entre `ingresos-regulares` y `kpis-fijos-cuenta` sobre `e2e.sqlite` compartida (`workers: 1`); la **limpieza total final que restaura el estado de entrada** (espejo D11) es obligatoria, no cosmética.

- [x] T007 [US1] Crear `e2e/kpi-gasto-personal.spec.ts` (serial en el fichero, helpers locales `currentMonthIso()`/`currentMonthLabel()` y `registerMovement`/`deleteMovement`/`openSettingsMenu` espejo de `e2e/descuento-gastos-comunes.spec.ts`) cubriendo G1–G7 (research §7): **G1** barrido defensivo (borrar «Hipoteca» si existe) + configurar desde el menú ⋮ de la tarjeta en `/` ingreso regular **2.000,00** y aportación **25 %**; **G2** gastos de distinta naturaleza — personales **120,55** y **80,00** (Personal, tag Ocio) + común **60,00** (Compartido, tag Vivienda) → región «KPIs del mes» con 4 métricas y «Gasto personal» **200,55 €**, «Aportación común» **440,00 €** (500 − 60, neta de 021), «Saldo del mes» **+1.299,45 €**, con aserción de coherencia KPI gasto = «Gastos personales» del cierre − KPI aportación (exclusión exacta FR-002, sin dobles conteos); **G3** tanda de 12 gastos personales de **10,00** → KPI **320,55** al alta (FR-007) y región KPIs en viewport al bajar al fondo del listado (SC-001, sticky); **G4** ‹ mes anterior → KPI **0,00 €** con etiqueta pasiva del mes consultado (SC-004) y › vuelve a **320,55**; **G5** ingreso manual (p. ej. 500,00) no computa (KPI estable en 320,55); **G6** `/accounts/3` (Cuenta común) sin región «KPIs del mes» (esc. 6); **G7** limpieza total UI-driven con restauración del estado de entrada (espejo D11): borrar todos los movimientos creados del mes (ingreso regular y aportación materializados, gastos de la tanda, ingreso manual), desactivar aportación e ingreso regular, restaurar «Hipoteca» **850,00** Compartido, y verificar KPI final **0,00 €**

  > **Desviación documentada (nombre y posición del fichero)**: implementado como `e2e/cuenta-kpi-gasto-personal.spec.ts` (no `kpi-gasto-personal.spec.ts`). La combinación investigada en research §5 (cuenta 2 + mes en curso, entre `ingresos-regulares` y `kpis-fijos-cuenta`) es inviable: `descuento-gastos-comunes.spec.ts` D10 borra el movimiento de aportación del mes en curso (borrado del usuario → fila de `common_contribution_months` colgante y definitiva, empeorada por reuso de rowid que la apunta a movimientos inocentes de specs posteriores), y el registro `regular_income_months` de A6 impide ademés regenerar el ingreso regular del mes. Con la fila envenenada, NINGUNA spec posterior puede materializar la aportación de la cuenta 2 en el mes en curso. Solución: ordenar el fichero nuevo ANTES de `descuento` (alfabético `cuenta-k…` < `descuento`), donde la entrada es el estado limpio de salida de `aportacion-comun` A6 (fila retirada por regla): barrido defensivo extendido a los 3 residuos de `cierre-mensual` («Aportación» +1920,00 ingreso, «Gasolina» −60,00, «Hipoteca» −850,00 — con re-verificación tras recarga: los borrados rápidos secuenciales dejan un render intermedio que oculta filas y haría saltarse deletions condicionales), ingreso manual «Ingreso base» 2.000,00 que suple al ingreso regular no regenerable (identidad de importes congelados), y G7 retira la aportación POR REGLA (gasto común ≥ bruto → `withdrawMaterialization` borra movimiento y fila) antes de desactivar configs, dejando la fila sana para D1. La restauración final devuelve los 3 residuos de `cierre-mensual` (estado de entrada de `descuento`), verificando KPI final 0,00 € antes de restaurar.
- [x] T008 [US1] Ejecutar `npm run test:e2e` y verificar las 16 specs en verde (las 15 existentes **sin cambios esperados** — en particular `kpis-fijos-cuenta.spec.ts` y `porcentaje-ahorro.spec.ts` siguen verdes: aislamiento de research §5; ajustar solo si un literal afectado lo exigiese)

**Checkpoint**: Flujo crítico «cuenta personal con gastos de distinta naturaleza → KPI exacto y visible al recorrer el listado → alta de gasto actualiza el KPI» cubierto end-to-end (SC-005).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación viva, convenciones y roadmap actualizados en el mismo cambio (constitución III DoD, FR-009). **Sin ADR nuevo** (research §8: consecuencia directa de los contratos 022/023 y de la composición de página ya registrada).

- [x] T009 [P] Actualizar `AGENTS.md` (FR-009): amendar la convención «Bloque KPIs sticky en cuentas personales (022, amendado por 023)» → «(022, amendado por 023 y 024)»: `dl` de **4 métricas** en orden congelado («Aportación común» · «Gasto personal» · «Ahorro del mes» · «Saldo del mes»), grid `grid grid-cols-2 gap-3 sm:grid-cols-4` (móvil 2×2), y la segunda resta de composición de la página `personalExpenseCents = closure.personalExpenseCents − netContribution.amountCents` (gasto personal del mes: naturaleza propia **excluida la aportación común**; lectura pura sin configuración ni materialización — FR-002)
- [x] T010 [P] Actualizar `docs/architecture/diagrams/pagina-cuenta-sequence.md` (FR-009): las referencias al bloque pasan de 3 a 4 métricas con «Gasto personal» y la resta de composición en el render y en la nota final (base: diagramas de plan.md); revisar `docs/architecture/overview.md`, `docs/architecture/diagrams/c4.md` y `domain-model.md` por si mencionan el bloque (hoy no lo hacen) y extender solo donde aplique
- [x] T011 [P] Actualizar el roadmap maestro `specs/001-family-wallet/spec.md` (FR-009): marcar la fila `024-kpi-gasto-personal` como **Completada**
- [x] T012 Validar manualmente los escenarios Q1–Q7 de `specs/024-kpi-gasto-personal/quickstart.md` con `npm run dev` sobre BD migrada y sembrada (`npm run db:migrate && npm run seed`; 024 no añade migraciones); dejar el estado limpio al terminar (desactivar configs, borrar movimientos de prueba)
- [x] T013 Ejecutar los gates completos `npm run lint && npm run typecheck && npm run test && npm run test:e2e` y verificar todo en verde (SC-005, DoD)

**Checkpoint**: Documentación viva, AGENTS.md, roadmap y quickstart sincronizados con la implementación; feature entregada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente.
- **Foundational (Phase 2)**: Vacía a propósito (lectura pura; FR-005) — no bloquea nada.
- **US1 (Phase 3)**: Depende de Phase 1. Test rojo primero (T003) → componente (T004) → página (T005, pasa la prop que T004 exige para el typecheck) → gate (T006).
- **E2E (Phase 4)**: Depende de Phase 3 (UI completa operativa para poder validar importes exactos).
- **Polish (Phase 5)**: Depende de todas las anteriores (docs y roadmap reflejan lo implementado).

### User Story Dependencies

- **US1 (P1, única)**: Sin dependencias entre historias (constitución II: una sola US). Independientemente testable vía quickstart Q1–Q7 y las suites por capa; el MVP de la feature es la propia US1 completa (Phase 1–4).

### Within Each User Story

- Tests primero y en rojo antes de su SUT (T003 → T004).
- Componente (T004) antes que la página (T005 le pasa la prop nueva; sin T004 el typecheck falla).
- Unit/component gates (T006) antes del e2e (T007–T008); gates completos acumulativos al final (T013).

### Parallel Opportunities

- Phase 3: T003 es el único fichero de test — sin paralelización interna (feature mínima).
- Phase 5: T009 ∥ T010 ∥ T011 (ficheros distintos: `AGENTS.md`, `docs/architecture/diagrams/`, `specs/001-family-wallet/spec.md`).

---

## Parallel Example: User Story 1

```bash
# Tras el rojo de T003, la implementación es estrictamente secuencial
# (2 ficheros de producto acoplados por la prop nueva):
Task: "Modify account-month-kpis.tsx (prop personalExpenseCents + 4a métrica + grid 2/4)"
Task: "Modify src/app/accounts/[accountId]/page.tsx (resta única → prop)"

# Docs de Phase 5 en paralelo (ficheros distintos):
Task: "Actualizar AGENTS.md (convención bloque KPIs 3→4)"
Task: "Actualizar docs/architecture/diagrams/pagina-cuenta-sequence.md"
Task: "Marcar fila 024 Completada en specs/001-family-wallet/spec.md"
```

---

## Implementation Strategy

### MVP First (US1 = feature completa)

1. Complete Phase 1: línea base verde y rama feature
2. Complete Phase 3: US1 — test rojo → componente de 4 métricas → resta en la página → gates (quickstart Q1–Q6 ya validables)
3. **STOP and VALIDATE**: `npm run lint && npm run typecheck && npm run test` + validación manual Q1–Q4
4. Complete Phase 4: e2e del flujo crítico (`kpi-gasto-personal.spec.ts` con G7 de limpieza obligatoria)
5. Complete Phase 5: docs vivas, AGENTS.md, roadmap (FR-009), quickstart Q1–Q7 y gates completos (SC-005)

### Incremental Delivery

- Feature de una sola US (constitución II): el valor de usuario llega con Phase 3 — al terminar T005 el KPI ya es visible y correcto; Phase 4 asegura el flujo crítico y Phase 5 cierra el DoD.

### Parallel Team Strategy

- Para 1 desarrollador (real): estrictamente secuencial. Con varios: T009 ∥ T010 ∥ T011 en Phase 5; el resto es una cadena corta de 2 ficheros acoplados que no merece repartirse.

---

## Notes

- [P] tasks = different files, no dependencies
- Lectura pura (FR-005): sin entidades, tablas, casos de uso, puertos ni queries nuevos; dominio, aplicación y persistencia **intactos** — el KPI reutiliza `closure.personalExpenseCents` y `netContribution.amountCents` ya leídos en el mismo `Promise.all` (cero consultas y renders adicionales)
- La resta vive **una única vez** en `page.tsx` (precedente congelado `netMonthBalanceCents` de 022/023); el componente es presentacional puro: solo formatea, jamás recalcula ni resta (constitución VII, ui-contract §3)
- La exclusión de la aportación es exacta porque 019 materializa con `nature: "personal"` (dentro de `personalExpenseCents`) y `GetMonthNetContribution` devuelve el importe del movimiento enlazado; invariante y tabla de casos en research §1 — sin código defensivo (YAGNI)
- Importes congelados del happy path: ingreso 2.000,00 − aportación bruta 500,00 + común 60,00 (neta 440,00) − personales 200,55 = saldo **+1.299,45**; KPI gasto personal **200,55** (research §7)
- E2E en fichero propio (Miembro B + mes en curso) con limpieza que restaura el estado de entrada (espejo D11): obligatoria sobre `e2e.sqlite` compartida con `workers: 1`; cuenta 1 descartada por K0 de `kpis-fijos-cuenta` (research §5)
- Fuera de alcance intocado (FR-006): cuenta común, cierre mensual, resumen global, cuenta de resultados anual, balance acumulado, formularios, menú ⋮ y semántica 018/019/021/023
- Commit after each task or logical group (Conventional Commits, en español el enunciado cuando aporte claridad)
