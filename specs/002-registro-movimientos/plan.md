# Implementation Plan: Registro de Movimientos con Tags

**Branch**: `002-registro-movimientos` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-registro-movimientos/spec.md`

## Summary

Primera feature implementable del roadmap: registra gastos e ingresos con tags sobre 3 cuentas preconfiguradas (2 personales + 1 común), sin login (usuario único, modo PoC). Entrega el **scaffolding completo de la aplicación** (monolito Next.js App Router + arquitectura hexagonal, capa a capa: dominio → aplicación → adaptadores), el modelo de datos base (Miembro, Cuenta, Movimiento, Tag), la precarga de datos y la pantalla principal con formulario siempre visible, selectores de cuenta/mes, listado mensual y balance acumulado.

Enfoque técnico (detalles y alternativas en [research.md](./research.md)):
- **Dinero exacto**: VO de dominio `Money` con céntimos enteros (`number`); parseo por string en la frontera (Zod), nunca `parseFloat * 100`.
- **Mutación**: Server Action (`'use server'`) + `useActionState` con errores por campo y conservación de valores; `revalidatePath` actualiza listado/balance en el mismo roundtrip.
- **Estado de pantalla**: cuenta activa + mes como URL searchParams (`/?account=<id>&month=YYYY-MM`), render en servidor; sin librería de estado.
- **Persistencia**: Drizzle ORM 0.44.x + `@libsql/client` (fichero SQLite en dev, Turso en prod); migraciones versionadas en `drizzle/`; seed idempotente por script (`onConflictDoNothing` sobre claves naturales).
- **Balance**: derivado on-the-fly (`SUM(amount_cents)`), no persistido.
- **Testing**: Vitest (projects: node para dominio/aplicación/infra, jsdom para UI), repositorios contra libsql `:memory:`, Playwright e2e del flujo crítico en CI.

## Technical Context

**Language/Version**: TypeScript 5.x en modo estricto sobre Node.js LTS; Next.js (App Router) en su versión estable actual.

**Primary Dependencies**: next, react, drizzle-orm 0.44.x, @libsql/client (entry `/web` en Vercel), zod, tailwindcss + shadcn/ui (componentes copiados y versionados en el repo; el toast usa el componente `sonner` del registro de shadcn/ui, cubierto por ADR 0005).

**Storage**: SQLite vía Drizzle ORM — fichero local en desarrollo, Turso (libSQL) en producción (Vercel serverless, sin estado en filesystem). Migraciones versionadas en `drizzle/`, aplicadas por script explícito (`db:migrate`), nunca en build/startup serverless.

**Testing**: Vitest (unitarios + integración + componentes con Testing Library) y Playwright (e2e del flujo de registro, en CI). Config en [research.md §4](./research.md).

**Target Platform**: Web (escritorio y móvil), desplegada en Vercel + Turso (plan gratuito).

**Project Type**: web-app (monolito Next.js, App Router).

**Performance Goals**: SC-001 registro de un movimiento completo < 30 s (medición manual); SC-002 movimiento guardado visible en listado con tags < 2 s. Operativa: aggregates SQL sub-milisegundo con índice `(account_id, date)`.

**Constraints**: Aritmética monetaria exacta sin coma flotante (FR-003); sin estado persistente en serverless (todo dato vive en Turso); infraestructura gratuita; UI en español; usuario único sin login (modo PoC aceptado en la spec).

**Scale/Scope**: 1 usuario (unidad familiar), ~100–500 movimientos/mes, 1 pantalla principal, 4 entidades + 1 tabla de unión.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Estado pre-diseño | Notas |
|---|-----------|-------------------|-------|
| I | Simplicidad Primero | ✅ PASS | Un único proyecto Next.js; ninguna librería de estado ni proyecto adicional. La única incorporación externa (toast `sonner`) proviene del registro de shadcn/ui ya autorizado por ADR 0005. |
| II | Spec-Driven Development | ✅ PASS | Este plan deriva de `specs/002-registro-movimientos/spec.md` (Draft con clarificaciones resueltas). |
| III | Calidad Verificada | ✅ PASS | Gates lint + typecheck + tests en CI (GitHub Actions); lógica de negocio (Money, naturaleza, balance) con tests unitarios; flujo crítico "registrar movimiento" con Playwright e2e en CI (ADR 0006). |
| IV | TypeScript Estricto + Zod en fronteras | ✅ PASS | Zod en la Server Action (frontera del formulario) y en la validación del contexto de pantalla (searchParams). Dominio tipado fuerte con VOs. |
| V | Persistencia SQLite con Drizzle | ✅ PASS | Drizzle ORM + SQLite/Turso; migraciones versionadas en `drizzle/` como única vía de evolución del esquema. |
| VI | Producto en español, código en inglés | ✅ PASS | UI y docs en español; identificadores en inglés con glosario ES↔EN en [data-model.md](./data-model.md). |
| VII | Hexagonal + DDD Táctico | ✅ PASS | Dominio puro (VOs `Money`, `MovementType`, `ExpenseNature`), puertos en `src/application/`, adaptadores en `src/infrastructure/` + `src/app/`; sin CQRS/EDA/eventos de dominio. Estructura conforme a `docs/architecture/overview.md`. |

**Resultado**: sin violaciones → Phase 0 autorizada.

## Project Structure

### Documentation (this feature)

```text
specs/002-registro-movimientos/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── ui-contract.md           # Contrato de la pantalla principal
│   └── create-movement-action.md # Contrato de la Server Action de registro
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
.
├── src/
│   ├── domain/                          # Núcleo puro (cero dependencias externas)
│   │   ├── shared/
│   │   │   └── DomainError.ts
│   │   ├── member/
│   │   │   ├── Member.ts
│   │   │   └── MemberId.ts
│   │   ├── account/
│   │   │   ├── Account.ts
│   │   │   ├── AccountId.ts
│   │   │   ├── AccountType.ts           # 'personal' | 'shared'
│   │   │   └── AccountErrors.ts
│   │   ├── movement/
│   │   │   ├── Movement.ts
│   │   │   ├── MovementId.ts
│   │   │   ├── Money.ts                 # céntimos enteros, inmutable
│   │   │   ├── MovementType.ts          # 'expense' | 'income'
│   │   │   ├── ExpenseNature.ts         # 'personal' | 'shared' (solo gastos)
│   │   │   └── MovementErrors.ts
│   │   └── tag/
│   │       ├── Tag.ts
│   │       ├── TagId.ts
│   │       ├── TagStatus.ts             # 'active' | 'inactive'
│   │       └── TagErrors.ts
│   ├── application/                     # Casos de uso + puertos (depende solo de domain)
│   │   ├── movement/
│   │   │   ├── CreateMovement.ts        # Caso de uso de registro
│   │   │   ├── ListMovements.ts         # Query mes+cuenta
│   │   │   ├── MovementRepository.ts    # Puerto de salida
│   │   │   └── dto.ts                   # CreateMovementDTO, MovementDTO, etc.
│   │   ├── account/
│   │   │   ├── AccountRepository.ts     # Puerto de salida (incluye getBalance)
│   │   │   └── ListAccounts.ts
│   │   ├── tag/
│   │   │   ├── TagRepository.ts         # Puerto de salida
│   │   │   └── ListActiveTags.ts
│   │   └── member/
│   │       └── MemberRepository.ts      # Puerto de salida
│   ├── app/                             # Adaptador inbound fino (solo ruteo Next.js)
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── page.tsx                     # Pantalla principal; lee searchParams, delega en use cases
│   └── infrastructure/
│       ├── db/                          # Adaptador outbound: persistencia Drizzle
│       │   ├── schema/                  # members, accounts, tags, movements, movement_tags
│       │   ├── client.ts                # file: dev / libsql: prod
│       │   ├── mappers/                 # dominio <-> tablas
│       │   ├── DrizzleMovementRepository.ts
│       │   ├── DrizzleAccountRepository.ts
│       │   ├── DrizzleTagRepository.ts
│       │   ├── DrizzleMemberRepository.ts
│       │   └── seed-data.ts             # Miembros, cuentas y catálogo precargado (tipado)
│       └── primary/                     # Adaptador inbound: UI y acciones
│           ├── actions/
│           │   └── create-movement.action.ts   # 'use server': Zod -> use case -> revalidatePath
│           └── ui/
│               ├── components/ui/       # shadcn/ui (copiado y versionado)
│               ├── movement-form.tsx    # 'use client': useActionState
│               ├── account-month-selector.tsx
│               ├── movement-list.tsx
│               ├── account-balance.tsx
│               └── empty-state.tsx
├── e2e/                                 # Playwright (flujo crítico de registro)
├── scripts/
│   └── seed.ts                          # Seed idempotente (tsx)
├── drizzle/                             # Migraciones SQL versionadas (committed)
├── drizzle.config.ts
├── drizzle.prod.config.ts               # Turso (url + authToken por env)
├── vitest.config.mts                    # projects: node + ui (jsdom)
├── eslint.config.mjs
├── prettier.config.mjs
├── playwright.config.ts
├── .github/workflows/ci.yml             # lint + typecheck + vitest + e2e
└── package.json
```

**Structure Decision**: estructura por capas concéntricas conforme a `docs/architecture/overview.md` (fuente de truth arquitectónica): `src/domain/` y `src/application/` son módulos puros sin imports de Next/React/Drizzle/Zod; `src/app/` contiene solo los ficheros que Next.js rutea (adaptadores finos); los Server Actions y componentes viven en `src/infrastructure/primary/`. Los tests unitarios/de integración se co-localizan junto a su SUT (`*.test.ts`); los e2e en `e2e/`. No se crean paquetes ni proyectos adicionales.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |

**Decisiones de diseño que requieren ADR en la fase de implementación** (recogido aquí para que `/speckit.tasks` lo incluya):
- **ADR 0007 — Dinero como céntimos enteros**: VO `Money` con `amount_cents: integer`; parseo por string en frontera; `Intl.NumberFormat('es-ES')` solo en adaptadores de UI.
- **ADR 0008 — Mutación vía Server Actions y estado de pantalla en searchParams**: `useActionState` + `revalidatePath('/')`; cuenta/mes activos como URL searchParams renderizados en servidor (sin librería de estado cliente).
- **ADR 0009 — Balance derivado, no persistido**: `SUM(amount_cents)` con índice `(account_id, date)`; evita drift y recálculos al editar/eliminar (feature 003).

## Constitution Check (post-diseño, Phase 1)

Re-evaluación tras generar [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/) y [quickstart.md](./quickstart.md):

| # | Principio | Estado post-diseño | Notas |
|---|-----------|--------------------|-------|
| I | Simplicidad Primero | ✅ PASS | Sin proyectos ni paquetes extra; se rechazan decimal.js/dinero.js/Zustand/Route Handler + fetch (ver research.md). |
| II | Spec-Driven Development | ✅ PASS | Cada FR-001..FR-018 de la spec traza a un elemento del data-model/contracts/quickstart. |
| III | Calidad Verificada | ✅ PASS | quickstart.md define la verificación manual de los 7 escenarios de aceptación + e2e Playwright del flujo crítico; CI ejecuta todos los gates. |
| IV | TypeScript Estricto + Zod | ✅ PASS | Contrato de la Server Action valida FormData con Zod (amount como string → céntimos, sin float); errores por campo tipados. |
| V | SQLite con Drizzle | ✅ PASS | Esquema Drizzle + migraciones versionadas; seed por script idempotente (no runtime); libsql `:memory:` en tests de repositorio. |
| VI | Español / inglés | ✅ PASS | Glosario ES↔EN en data-model.md; textos de UI y errores de validación definidos en español en contracts/. |
| VII | Hexagonal + DDD Táctico | ✅ PASS | data-model.md separa vista de dominio (VOs, invariantes) de vista de persistencia (tablas Drizzle con mappers); puertos definidos en application/; el dominio no conoce Zod (validación de input en frontera, invariantes en VOs). |

**Resultado**: diseño aprobado; sin desviaciones que justificar. El plan queda listo para `/speckit.tasks`.
