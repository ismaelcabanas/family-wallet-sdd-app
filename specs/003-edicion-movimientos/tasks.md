# Tasks: Edición y Eliminación de Movimientos

**Input**: Design documents from `/specs/003-edicion-movimientos/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: INCLUIDOS (obligatorios por constitución III; estrategia por capas en research.md §5). Cada test se escribe ANTES de su implementación y debe fallar primero.

**Organization**: Una única user story (US1, P1). Fases: Setup → Foundational (extracciones compartidas alta/edición, esquema) → US1 (dominio → aplicación → infraestructura → frontera/actions → UI → e2e) → Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Ejecutable en paralelo (ficheros distintos, sin dependencias de tareas incompletas)
- **[US1]**: Tarea de la user story 1 (spec.md)
- Todas las tareas incluyen la ruta exacta del fichero

## Path Conventions

- Monolito Next.js (App Router) en la raíz: `src/domain/`, `src/application/`, `src/app/`, `src/infrastructure/`
- Tests co-localizados con su SUT (`*.test.ts(x)`); e2e en `e2e/`; migraciones en `drizzle/`
- Gates tras cada tarea: `npm run lint && npm run typecheck && npm run test`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Componentes shadcn nuevos que requiere la UI de US1

- [X] T001 Copiar y versionar los componentes shadcn `dialog.tsx` y `alert-dialog.tsx` en `src/infrastructure/primary/ui/components/ui/`, adaptando los imports a la convención del repo (paquete unificado `radix-ui`, p. ej. `import { Dialog as DialogPrimitive } from "radix-ui"`, igual que `select.tsx`/`checkbox.tsx`); instalar peers `@radix-ui/react-dialog`/`@radix-ui/react-alert-dialog` solo si el paquete unificado no cubre los primitivos (ADR 0005; research.md §4)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cambios de comportamiento neutro y esquema que US1 necesita y que el alta (002) reutiliza tal cual. **⚠️ CRITICAL**: US1 no puede empezar hasta completar esta fase.

- [X] T002 [P] Añadir columna `updated_at` (TEXT ISO 8601 UTC, nullable) a `src/infrastructure/db/schema/movements.ts` y generar la migración versionada `ALTER TABLE movements ADD COLUMN updated_at TEXT` en `drizzle/` (drizzle-kit generate sobre `drizzle.config.ts`); aplicar con `npm run db:migrate` y verificar que el seed y los tests existentes siguen en verde
- [X] T003 [P] Extraer el schema Zod del formulario y sus helpers (`movementFormSchema`, `extractFormData`, `toFormValues`, `parseAmountToCents`) de `src/infrastructure/primary/actions/create-movement.action.ts` al nuevo `src/infrastructure/primary/actions/movement-form.schema.ts`; refactorizar `create-movement.action.ts` para consumirlo sin cambio de comportamiento (regresión: `create-movement.action.test.ts` sin cambios)
- [X] T004 [P] Extraer los resolutores privados (`resolveNature`, `resolveTagIds`) de `src/application/movement/CreateMovement.ts` al nuevo `src/application/movement/movement-inputs.ts` (funciones de módulo); refactorizar `CreateMovement` para consumirlo sin cambio de comportamiento (regresión: `CreateMovement.test.ts` sin cambios)
- [X] T005 [P] Ampliar `src/infrastructure/primary/ui/format.ts` con `formatDate` (fecha larga es-ES: "14 de septiembre de 2026"), `formatCentsForInput` ("78,50", coma decimal sin separador de miles, para prefill) y `formatSignedAmountCents` (signo contable U+2212 según tipo: "−85,00 €"); extender `src/infrastructure/primary/ui/format.test.ts`

**Checkpoint**: Fundación lista (esquema migrado, validación y formateo compartidos); US1 puede empezar.

---

## Phase 3: User Story 1 - Editar y eliminar movimientos (Priority: P1) 🎯 MVP

**Goal**: Editar cualquier campo de un movimiento existente (fecha, concepto, descripción, importe, cuenta, tipo, naturaleza, tags) reutilizando el formulario y validaciones del alta, y eliminar con confirmación que muestra los datos; listado, balance y cierre se recalculan solos (vistas derivadas).

**Independent Test**: Editar cada campo de un movimiento (incluidos cuenta, mes y tipo) y eliminar otro, verificando que listado, balance de cabecera y cierre mensual (005) reflejan el estado correcto sin pasos manuales (spec.md US1; escenarios E1–E7 de quickstart.md).

### Dominio

- [X] T006 [US1] Ampliar `src/domain/movement/Movement.test.ts` con los casos de `Movement.recreate` (revalida las mismas invariantes que `create` —un caso por campo: concepto, fecha, importe, naturaleza por tipo, mínimo una tag—, preserva `id` y `createdAt`, deduplica tags); verificar que fallan antes de implementar
- [X] T007 [US1] Implementar `Movement.recreate(id, input, createdAt)` en `src/domain/movement/Movement.ts` compartiendo el builder privado con `create` (sin setters ni updates parciales, ADR 0011) y añadir `MovementNotFoundError` (mensaje exacto "El movimiento ya no existe.") a `src/domain/movement/MovementErrors.ts`

### Aplicación

- [X] T008 [US1] Añadir `UpdateMovementDTO` a `src/application/movement/dto.ts` (movementId, accountId, type, date, concept, description, amountCents, nature, tagIds; data-model §4) y ampliar el puerto `src/application/movement/MovementRepository.ts` con `findById(id): Promise<Movement | null>`, `update(movement): Promise<void>` y `delete(id): Promise<void>`
- [X] T009 [P] [US1] Escribir `src/application/movement/UpdateMovement.test.ts` con dobles en memoria del puerto: movimiento inexistente → `MovementNotFoundError`; resolución de naturaleza/tags idéntica a la creación vía `movement-inputs`; cuenta inexistente → `AccountNotFoundError`; `update` llamado con el `Movement` reconstruido preservando `id`/`createdAt`; verificar que falla antes de implementar
- [X] T010 [US1] Implementar `src/application/movement/UpdateMovement.ts` (findById → resolver inputs con `movement-inputs` → `Movement.recreate` con `createdAt` original → update)
- [X] T011 [P] [US1] Escribir `src/application/movement/DeleteMovement.test.ts` con dobles: movimiento inexistente → `MovementNotFoundError`; `delete` llamado con el id; verificar que falla antes de implementar
- [X] T012 [US1] Implementar `src/application/movement/DeleteMovement.ts` (findById → delete)

### Infraestructura (persistencia)

- [X] T013 [US1] Ampliar `src/infrastructure/db/DrizzleMovementRepository.test.ts` (libsql `:memory:` + migraciones de `drizzle/`): `findById` con/sin tags y no encontrado (null); `update` sustituye fila + conjunto de tags (incluido cambio de cuenta y fecha), pone `updated_at` y no toca `id`/`created_at`; `delete` borra la fila y sus `movement_tags` sin tocar el catálogo `tags`; verificar que falla antes de implementar
- [X] T014 [US1] Implementar `findById` (mismo shape de join que `listByMonthAndAccount`, mapper de rehidratación en `src/infrastructure/db/mappers/movement.mapper.ts`), `update` (batch atómico `db.batch` de UPDATE fila + DELETE/INSERT de tags, pone `updated_at`) y `delete` (DELETE físico, cascade FK de `movement_tags`) en `src/infrastructure/db/DrizzleMovementRepository.ts`

### Frontera (Server Actions)

- [X] T015 [P] [US1] Escribir `src/infrastructure/primary/actions/update-movement.action.test.ts` con `vi.mock` de los casos de uso: Zod rechaza `movementId`/`currentAccountId`/`currentMonth` inválidos; éxitos con los mensajes exactos de contracts/ui-contract.md §4 ("Movimiento actualizado", variantes "ahora está en {Mes YYYY}"/"{cuenta}"/"{cuenta} · {Mes YYYY}"); `MovementNotFoundError` llega al estado de error; verificar que falla antes de implementar
- [X] T016 [US1] Implementar `src/infrastructure/primary/actions/update-movement.action.ts`: reutiliza `movement-form.schema` + `movementId` (entero positivo), `currentAccountId` y `currentMonth` (`YYYY-MM`) ocultos; la action compone el aviso "movido" comparando cuenta/mes finales con el contexto de pantalla (la UI nunca decide); `revalidatePath("/")` y estados de error con los textos de ui-contract §4
- [X] T017 [P] [US1] Escribir `src/infrastructure/primary/actions/delete-movement.action.test.ts` con `vi.mock` del caso de uso: Zod rechaza `movementId` inválido; éxito ("Movimiento eliminado") y `MovementNotFoundError` con los textos exactos; verificar que falla antes de implementar
- [X] T018 [US1] Implementar `src/infrastructure/primary/actions/delete-movement.action.ts`: schema propio mínimo (`movementId`), invoca `DeleteMovement`, `revalidatePath("/")` y estados de error de ui-contract §4

### UI

- [X] T019 [US1] Ampliar `src/infrastructure/primary/ui/movement-form.test.tsx` con el modo edición de `MovementFormFields`: prefill desde `initialValues` (importe vía `formatCentsForInput`, tags marcadas, naturaleza), "Cuenta" como `Select` con todas las cuentas, naturaleza dinámica según la cuenta elegida (común → fija "Compartido"; personal → radios habilitados; ingreso → bloque oculto, ui-contract §2.1) y submit con la action mockeada; verificar que falla antes de implementar
- [X] T020 [US1] Implementar el modo edición en `src/infrastructure/primary/ui/movement-form.tsx` (props `initialValues` y `accounts`; el modo alta queda intacto; mismos campos, orden y mensajes de error que el alta, FR-002/FR-006)
- [X] T021 [US1] Escribir `src/infrastructure/primary/ui/edit-movement-dialog.test.tsx` (jsdom + RTL): abre con el formulario precargado, cancelar no llama a la action, éxito cierra el diálogo y tuestea el mensaje (incluido el de "movido"), error `_form` mantiene el diálogo abierto; verificar que falla antes de implementar
- [X] T022 [US1] Implementar `src/infrastructure/primary/ui/edit-movement-dialog.tsx` (client): `Dialog` de shadcn con `MovementFormFields` en modo edición, campos ocultos `movementId`/`currentAccountId`/`currentMonth`, botones "Cancelar"/"Guardar cambios" con estado pendiente ("Guardando…"), submit vía `updateMovement` (ui-contract §2)
- [X] T023 [US1] Escribir `src/infrastructure/primary/ui/delete-movement-dialog.test.tsx` (jsdom + RTL): muestra concepto, importe (`formatSignedAmountCents`) y fecha (`formatDate`) del movimiento, "Cancelar" no llama a la action, "Eliminar" invoca `deleteMovement` y tuesta, "Eliminando…" en pendiente; verificar que falla antes de implementar
- [X] T024 [US1] Implementar `src/infrastructure/primary/ui/delete-movement-dialog.tsx` (client): `AlertDialog` destructivo de confirmación con los datos del movimiento (ui-contract §3)
- [X] T025 [US1] Ampliar `src/infrastructure/primary/ui/movement-list.tsx` con botones de icono por fila ✏️/🗑️ (`aria-label="Editar {concepto}"`/`"Eliminar {concepto}"` + `title`, ui-contract §5) que abren los diálogos, y `src/app/page.tsx` pasando al listado `accounts`, `tags`, `currentAccountId` y `currentMonth` (ya cargados en la página)

### E2E (flujo crítico)

- [X] T026 [US1] Crear `e2e/edicion-movimientos.spec.ts` (serie dentro del fichero, estado de BD compartido — decisión del revisor 2026-09-14; mismas convenciones de 005: puerto 3100, BD e2e aislada): registra → edita el importe (85,00 → 78,50) → verifica fila, balance y cierre recalculados; elimina con confirmación → verifica listado, balance y cierre; cubre toast "Movimiento actualizado" y "Movimiento eliminado"

**Checkpoint**: US1 completa: edición de todos los campos, eliminación con confirmación, avisos "movido" y recálculo automático de vistas derivadas.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentación y verificación global

- [X] T027 [P] Redactar `docs/architecture/adr/0011-edicion-reconstruccion-validada.md`: edición por reconstrucción validada (`recreate` preserva `id`/`createdAt`), puerto `findById`/`update` (batch + `updated_at`)/`delete` físico, `updated_at` como auditoría técnica solo en BD; alternativas rechazadas de research.md §1–§2
- [X] T028 [P] Actualizar `docs/architecture/overview.md` y diagramas afectados (nuevos casos de uso, métodos del puerto, acciones de fila y diálogos); README/AGENTS.md solo si fijan convención nueva
- [X] T029 Ejecutar los gates completos (`npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`) y validar manualmente los escenarios E1–E7 de `specs/003-edicion-movimientos/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — T001 puede empezar de inmediato
- **Foundational (Phase 2)**: independiente de Phase 1 (T002–T005 no tocan los componentes shadcn) — BLOQUEA a US1
- **US1 (Phase 3)**: depende de Phase 2 completa (T002 → T013/T014; T003 → T015/T016; T004 → T009/T010; T005 → T019–T024) y de T001 (diálogos)
- **Polish (Phase 4)**: depende de US1 completa (T027/T028 pueden arrancar cuando las decisiones de T007/T014 están materializadas; T029 al final)

### Within US1 (orden estricto)

- Dominio antes que aplicación: T006 → T007; luego T008
- Aplicación antes que infraestructura de repo: T008 → (T009 ∥ T011) → T010 → T012 → T013 → T014
- Casos de uso antes que actions: T010 → T015 → T016; T012 → T017 → T018
- Actions y formateo antes que UI: T016/T018/T020 → T021 → T022; T018 → T023 → T024; T022/T024 → T025
- Todo antes que e2e: T025 → T026
- Cada test (T006, T009, T011, T013, T015, T017, T019, T021, T023) se escribe ANTES de su implementación y debe fallar primero (TDD)

### User Story Dependencies

- **US1 (P1)**: única story de la feature; puede empezar al completar Phase 2 (+ T001)

### Parallel Opportunities

- Phase 2: T002, T003, T004 y T005 en paralelo (ficheros distintos)
- Phase 3: T009 ∥ T011 (dobles de puertos distintos); T015 ∥ T017 (actions distintas); T019–T020 ∥ T023–T024 (pares formulario/diálogo edición vs. diálogo borrado, ficheros distintos)
- Phase 4: T027 ∥ T028

---

## Parallel Example: User Story 1

```bash
# Fase 2 en paralelo (ficheros distintos):
Task T002: "updated_at en src/infrastructure/db/schema/movements.ts + migración en drizzle/"
Task T003: "movement-form.schema.ts + refactor create-movement.action.ts"
Task T004: "movement-inputs.ts + refactor CreateMovement.ts"
Task T005: "helpers en format.ts + format.test.ts"

# Tras T008, tests de casos de uso en paralelo:
Task T009: "UpdateMovement.test.ts (dobles del puerto)"
Task T011: "DeleteMovement.test.ts (dobles del puerto)"

# Tras sus actions, diálogos en paralelo:
Task T021/T022: "edit-movement-dialog (test + impl)"
Task T023/T024: "delete-movement-dialog (test + impl)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T005) — CRITICAL: bloquea US1
3. Complete Phase 3: User Story 1 (T006–T026, capa a capa, TDD)
4. **STOP and VALIDATE**: gates en verde + escenarios E1–E7 de quickstart.md
5. Phase 4 (T027–T029): ADR, docs y validación final

### Incremental Delivery

1. Setup + Foundational → fundación lista (alta refactorizada sin cambio de comportamiento)
2. US1 completa → MVP: editar y eliminar con recálculo automático (sustituye al Excel en esta parte del alcance)
3. Polish → feature entregable (DoD de quickstart.md)

---

## Phase 5: Revisión de PR (post-implementación)

**Purpose**: Defecto detectado en la revisión manual de la PR #3 (2026-09-15): al eliminar el único movimiento visible, el toast "Movimiento eliminado" no aparecía. Comportamiento ya exigido por FR-007/ui-contract §4/quickstart E6 → bug de implementación contra la spec existente (sin cambios de spec): test de regresión en rojo + fix en la misma rama.

- [X] T030 [US1] Fix toast perdido al vaciar la vista: el swap `EmptyState`/`MovementList` en `page.tsx` desmontaba el listado y su diálogo antes de recibir el estado de `useActionState`; el estado vacío pasa a renderizarse dentro de `movement-list.tsx` (client). Regresiones: `movement-list.test.tsx` (RTL, diálogo sobrevive al refresco que vacía la lista) y `e2e/edicion-movimientos.spec.ts` E3 (eliminar el último movimiento → toast + estado vacío)

---

## Notes

- [P] = ficheros distintos, sin dependencias de tareas incompletas
- [US1] trazabilidad con la user story de spec.md (única)
- Cada test debe fallar antes de implementar (TDD); los tests de 002 actúan de regresión en los refactors T003/T004
- Commits Conventional tras cada tarea o grupo lógico (auto-commit de Spec Kit habilitado)
- Detener en cualquier checkpoint para validar la story de forma independiente
