# Implementation Plan: Edición y Eliminación de Movimientos

**Branch**: `feature/003-edicion-movimientos` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-edicion-movimientos/spec.md`

## Summary

Tercera feature entregable del roadmap (FR-008 del maestro): editar cualquier campo de un movimiento existente —incluidos cuenta, mes y tipo— y eliminarlo con confirmación, desde la pantalla principal de 002. Los balances, listados y cierres (005) se recalculan solos por ser vistas derivadas (ADR 0009/0010): **no hay lógica de recálculo**. Único cambio de esquema: `updated_at` (auditoría técnica en persistencia, clarificación 2026-09-14).

Enfoque técnico (detalles y alternativas en [research.md](./research.md)):
- **Reconstrucción validada**: `Movement.recreate(id, input, createdAt)` ejecuta las mismas invariantes que `create` preservando identidad y `createdAt`; sin setters ni updates parciales (ADR 0011, se redacta en implementación).
- **Puerto +3**: `findById`/`update`/`delete` en `MovementRepository`; `update` sustituye fila + tags en un batch atómico y pone `updated_at` (TEXT ISO, NULL = nunca editado, fuera de dominio/DTOs); `delete` físico con cascade de FK (sin borrado lógico, YAGNI).
- **Validación compartida por construcción** (FR-002): resolutores de aplicación extraídos a `movement-inputs.ts` y schema Zod de frontera extraído a `movement-form.schema.ts`, reutilizados por alta y edición — mismos mensajes garantizados.
- **UI**: `MovementFormFields` gana modo edición (cuenta como `Select`, naturaleza dinámica por cuenta elegida); diálogos shadcn nuevos (`dialog`, `alert-dialog`) para editar y para confirmar el borrado con los datos del movimiento; la action compone el aviso "ahora está en {cuenta/mes}" (FR-007) y la UI solo lo muestra.
- **Testing**: dominio (`recreate`), aplicación (dobles), repositorio (libsql `:memory:`), RTL de diálogos/formulario y e2e nuevo en serie dentro del fichero.

## Technical Context

**Language/Version**: TypeScript 5.x en modo estricto sobre Node.js LTS; Next.js (App Router) estable actual.

**Primary Dependencies**: las de 002 + **2 peers Radix de shadcn**: `@radix-ui/react-dialog` y `@radix-ui/react-alert-dialog` (componentes copiados y versionados; ADR 0005). Ninguna otra dependencia nueva.

**Storage**: SQLite/Turso vía Drizzle. **Un único cambio de esquema**: `movements.updated_at` TEXT nullable (auditoría técnica; clarificación 2026-09-14) con su migración versionada en `drizzle/`; el resto son UPDATE/DELETE sobre tablas existentes.

**Testing**: Vitest (projects node/ui, co-localizados con el SUT) y Playwright (spec e2e nueva). Patrones de 002/005 (research.md §5).

**Target Platform**: Web (escritorio y móvil), Vercel + Turso; sin cambios.

**Project Type**: web-app (monolito Next.js, App Router); sin proyectos ni paquetes nuevos.

**Performance Goals**: SC-003 de la spec (corrección completa < 30 s, interacción); las queries nuevas son por `id` (PK) o batch de ≤ 12 filas de tags: coste despreciable junto a las 5 queries ya existentes de la pantalla.

**Constraints**: aritmética exacta en céntimos sin coma flotante (ADR 0007); validaciones de edición idénticas al alta con los mismos mensajes (FR-002); UI en español; misma pantalla sin navegación (FR-006); eliminación física sin papelera (YAGNI).

**Scale/Scope**: 1 usuario, ~100–500 movimientos/mes, 1 pantalla (se añaden acciones de fila y 2 diálogos), 1 factory de dominio + 2 casos de uso + 3 métodos de puerto/repositorio + 2 Server Actions + 3 componentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Estado pre-diseño | Notas |
|---|-----------|-------------------|-------|
| I | Simplicidad Primero | ✅ PASS | Sin proyectos ni patrones nuevos: 2 extracciones lineales (schema, resolutores) + 1 factory; las 2 deps nuevas son peers oficiales de componentes shadcn (ADR 0005), evaluadas en research.md §4. |
| II | Spec-Driven Development | ✅ PASS | Este plan deriva de `specs/003-edicion-movimientos/spec.md` (Draft con 2 clarificaciones resueltas en sesión 2026-09-14). |
| III | Calidad Verificada | ✅ PASS | Invariantes de `recreate` con tests unitarios; casos de uso con dobles; repositorio contra libsql `:memory:` + migraciones; diálogos con RTL; flujo crítico editar/eliminar con e2e Playwright en CI (research.md §5). |
| IV | TypeScript Estricto + Zod en fronteras | ✅ PASS | Dos fronteras nuevas (actions de edición y eliminación) validadas con Zod en runtime, con schema compartido con el alta (FR-008); sin `any`. |
| V | Persistencia SQLite con Drizzle | ✅ PASS | Único DDL: `updated_at` (TEXT ISO) vía migración versionada con drizzle-kit — la única vía de evolución del esquema (constitución V); el resto son UPDATE/DELETE sobre el esquema de 002 (data-model §2). |
| VI | Producto en español, código en inglés | ✅ PASS | Textos exactos de diálogos y toasts en contracts/ui-contract.md §4; identificadores en inglés con glosario ampliado (data-model §5: `recreate`, `movement-inputs`, hard delete). |
| VII | Hexagonal + DDD Táctico | ✅ PASS | Revalidación de invariantes en el dominio (`Movement`); casos de uso en aplicación con puertos ampliados; Zod solo en frontera; la UI nunca decide el aviso de "movido" (lo compone la action). Sin CQRS/EDA/eventos. |

**Resultado**: sin violaciones → Phase 0 autorizada.

## Project Structure

### Documentation (this feature)

```text
specs/003-edicion-movimientos/
├── plan.md                     # This file (/speckit.plan command output)
├── research.md                 # Phase 0 output (/speckit.plan command)
├── data-model.md               # Phase 1 output (/speckit.plan command)
├── quickstart.md               # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── ui-contract.md          # Contrato de acciones de fila y diálogos de edición/borrado
└── tasks.md                    # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
├── src/
│   ├── domain/                          # Núcleo puro (cero dependencias externas)
│   │   └── movement/
│   │       ├── Movement.ts              # AMPLIADO: factory recreate (builder privado compartido con create)
│   │       ├── Movement.test.ts         # AMPLIADO: recreate revalida invariantes y preserva id/createdAt
│   │       └── MovementErrors.ts        # AMPLIADO: MovementNotFoundError
│   ├── application/                     # Casos de uso + puertos (depende solo de domain)
│   │   └── movement/
│   │       ├── dto.ts                   # AMPLIADO: UpdateMovementDTO
│   │       ├── MovementRepository.ts    # AMPLIADO: findById / update / delete
│   │       ├── movement-inputs.ts       # NUEVO: resolución de naturaleza y tags (extraída de CreateMovement)
│   │       ├── CreateMovement.ts        # REFACTORIZADO: consume movement-inputs (sin cambio de comportamiento)
│   │       ├── CreateMovement.test.ts   # (sin cambios: regresión del refactor)
│   │       ├── UpdateMovement.ts        # NUEVO: findById → recreate → update
│   │       ├── UpdateMovement.test.ts   # NUEVO (dobles del puerto)
│   │       ├── DeleteMovement.ts        # NUEVO: findById → delete
│   │       └── DeleteMovement.test.ts   # NUEVO (dobles del puerto)
│   ├── app/
│   │   └── page.tsx                     # AMPLIADO: pasa accounts/tags/contexto de vista al listado
│   └── infrastructure/
│       ├── db/
│       │   ├── schema/movements.ts               # AMPLIADO: updated_at (TEXT ISO nullable)
│       │   ├── DrizzleMovementRepository.ts      # AMPLIADO: findById / update (batch, pone updated_at) / delete
│       │   ├── DrizzleMovementRepository.test.ts # AMPLIADO (libsql :memory: + migraciones)
│       │   └── mappers/movement.mapper.ts        # AMPLIADO: fila join → Movement rehydrated
│       └── primary/
│           ├── actions/
│           │   ├── movement-form.schema.ts         # NUEVO: schema Zod + parseo compartidos (extraído de create)
│           │   ├── create-movement.action.ts       # REFACTORIZADO: usa schema compartido
│           │   ├── create-movement.action.test.ts  # (sin cambios: regresión del refactor)
│           │   ├── update-movement.action.ts       # NUEVO: valida, edita, compone aviso "movido", revalida
│           │   ├── update-movement.action.test.ts  # NUEVO (vi.mock de use cases)
│           │   ├── delete-movement.action.ts       # NUEVO
│           │   └── delete-movement.action.test.ts  # NUEVO (vi.mock de use cases)
│           └── ui/
│               ├── format.ts                     # AMPLIADO: formatDate (fecha larga es-ES) + céntimos→texto de prefill
│               ├── format.test.ts                # AMPLIADO
│               ├── components/ui/dialog.tsx      # NUEVO (shadcn, copiado y versionado)
│               ├── components/ui/alert-dialog.tsx# NUEVO (shadcn, copiado y versionado)
│               ├── movement-form.tsx             # AMPLIADO: MovementFormFields en modo edición (cuenta Select)
│               ├── movement-form.test.tsx        # AMPLIADO
│               ├── edit-movement-dialog.tsx      # NUEVO (client): diálogo con el formulario precargado
│               ├── edit-movement-dialog.test.tsx # NUEVO (jsdom + RTL)
│               ├── delete-movement-dialog.tsx    # NUEVO (client): confirmación con datos del movimiento
│               ├── delete-movement-dialog.test.tsx # NUEVO (jsdom + RTL)
│               └── movement-list.tsx             # AMPLIADO: botones editar/eliminar por fila
├── e2e/
│   └── edicion-movimientos.spec.ts      # NUEVO: editar importe/fecha/cuenta y eliminar (serie en el fichero)
├── drizzle/
│   └── NNNN_movements_updated_at.sql    # NUEVO: única migración (ALTER TABLE ADD COLUMN updated_at)
└── docs/architecture/
    └── adr/0011-edicion-reconstruccion-validada.md  # NUEVO (fase implementación)
```

**Structure Decision**: misma estructura por capas concéntricas que 002/005 (`docs/architecture/overview.md`): dominio y aplicación módulos puros; `page.tsx` adaptador fino; Server Actions y UI en `src/infrastructure/primary/`. Tests co-localizados con su SUT (proyectos node/ui de Vitest); e2e en `e2e/` (spec nueva, en serie dentro del fichero por estado compartido de BD). Del esquema solo se toca `schema/movements.ts` (+ su migración en `drizzle/`) para `updated_at`; el seed y el resto de tablas quedan intactos.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |

**Decisiones de diseño que requieren ADR en la fase de implementación** (recogido aquí para que `/speckit.tasks` lo incluya):
- **ADR 0011 — Edición por reconstrucción validada y borrado físico**: `Movement.recreate` revalida todas las invariantes preservando `id`/`createdAt`; el puerto amplía `findById`/`update` (batch fila + replace de tags, pone `updated_at`)/`delete` físico apoyado en la FK cascade; `updated_at` como auditoría técnica solo en BD (TEXT ISO, NULL = nunca editado); se rechazan los updates parciales, el borrado lógico, el delete+recreate y la tabla de historial (research.md §1–§2).

## Constitution Check (post-diseño, Phase 1)

Re-evaluación tras generar [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md) y [quickstart.md](./quickstart.md):

| # | Principio | Estado post-diseño | Notas |
|---|-----------|--------------------|-------|
| I | Simplicidad Primero | ✅ PASS | 8 ficheros nuevos de código + ampliaciones puntuales; las 2 deps Radix son peers obligatorios de componentes shadcn ya autorizados (ADR 0005); alternativas más simples rechazadas caso a caso en research.md §1–§4. |
| II | Spec-Driven Development | ✅ PASS | Cada FR traza a un artefacto: FR-001/005/006/007 → ui-contract §1–§4; FR-002 → data-model §1.1/§3 (builder y schema compartidos); FR-003 → data-model §2 (delete + cascade) y ui-contract §3; FR-004 → ADR 0009/0010 (sin recálculo); FR-008 → data-model §3 (Zod en las 2 fronteras nuevas). |
| III | Calidad Verificada | ✅ PASS | quickstart.md E1–E7 verifica los 9 escenarios de aceptación; tests por capa + e2e del flujo crítico en CI (research.md §5). |
| IV | TypeScript Estricto + Zod | ✅ PASS | Actions de edición/eliminación validadas con Zod (incluido `movementId` y contexto de vista); schema compartido con el alta; sin `any`. |
| V | SQLite con Drizzle | ✅ PASS | Único DDL: `updated_at` (TEXT ISO) con migración versionada en `drizzle/` — la vía constitucional de evolución del esquema; `update` atómico vía `db.batch` (data-model §2). |
| VI | Español / inglés | ✅ PASS | Textos exactos de diálogos, botones y toasts en contracts/ui-contract.md §4; glosario ampliado en data-model.md §5. |
| VII | Hexagonal + DDD Táctico | ✅ PASS | Revalidación en el dominio puro (`recreate`); puertos en aplicación e implementación Drizzle en infraestructura; la UI solo muestra estados y mensajes que le entrega la action (el aviso "movido" no se calcula en componentes). |

**Resultado**: diseño aprobado; sin desviaciones que justificar. El plan queda listo para `/speckit.tasks`.
