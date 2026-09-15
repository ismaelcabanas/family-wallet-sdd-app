# Implementation Plan: Resumen Mensual Global

**Branch**: `feature/006-resumen-global-mensual` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-resumen-global-mensual/spec.md`

## Summary

Primera feature de salida a nivel familiar del roadmap: resumen global del mes seleccionado que agrega las tres cuentas — totales de ingresos/gastos por naturaleza, saldo del mes global y desgloses de gastos por tag y por miembro — en una vista propia `/resumen`, con la coherencia céntimo a céntimo con los cierres por cuenta de 005 garantizada estructuralmente. Feature de **solo lectura**: sin escrituras, sin cambios de esquema ni migraciones.

Enfoque técnico (detalles y alternativas en [research.md](./research.md)):
- **Cálculo en el dominio por composición**: VO `GlobalMonthlySummary` cuya factory delega los KPIs agregados en `MonthlyClosure.fromMovements` (única fuente de las reglas de agregación, ADR 0010) y añade en pasada propia el desglose por miembro (atribución por dueño de la cuenta de pago; bucket "Cuenta común" para la cuenta compartida). La coherencia FR-002 (global = Σ cierres) es estructural y queda clavada con un test de invariante.
- **Lectura propia del mes**: nuevo método de puerto `MovementRepository.listByMonth(month)` (query existente sin filtro de cuenta); cuentas vía `AccountRepository.findAll()` (ya expone `memberName`). Caso de uso `GetGlobalMonthlySummary` autocontenido, como `GetMonthlyClosure` en 005.
- **Vista propia `/resumen?month=`**: adaptador server fino con searchParams validados por Zod (patrón ADR 0008), selector de mes reutilizable (`month-selector.tsx`) y panel servidor `global-summary-panel.tsx` espejo del de 005; enlace "Resumen global" desde la pantalla principal (único cambio en `/`).
- **Testing**: tests del VO (incluida la invariante de coherencia), del caso de uso con dobles, del repositorio contra libsql `:memory:`, RTL de componentes y e2e Playwright con KPIs exactos en un mes propio.

## Technical Context

**Language/Version**: TypeScript 5.x en modo estricto sobre Node.js LTS; Next.js (App Router) estable actual.

**Primary Dependencies**: las ya fijadas por 002 (next, react, drizzle-orm 0.44.x, @libsql/client, zod, tailwindcss + shadcn/ui copiado en el repo). **Cero dependencias nuevas**.

**Storage**: sin cambios — SQLite/Turso vía Drizzle (esquema de 002/003 intacto; el resumen es una vista derivada y no se persiste nada, FR-005).

**Testing**: Vitest (projects node/ui, co-localizados con el SUT) y Playwright (nueva spec e2e `resumen-global.spec.ts`). Patrones de 002/005.

**Target Platform**: Web (escritorio y móvil), Vercel + Turso; sin cambios.

**Project Type**: web-app (monolito Next.js, App Router); sin proyectos ni paquetes nuevos; una ruta nueva (`/resumen`).

**Performance Goals**: FR-008 — resumen de un mes con hasta 300 movimientos < 3 s; la query `listByMonth` escanea la tabla (el índice `(account_id, date)` no indexa rangos solo por fecha): sub-milisegundo a escala familiar; sin índice nuevo (FR-005 prohíbe migraciones; research §2).

**Constraints**: aritmética exacta en céntimos sin coma flotante (FR-006, ADR 0007); UI en español (FR-007); solo gastos en los desgloses (FR-004); sin persistencia nueva (FR-005).

**Scale/Scope**: 1 usuario, ~100–500 movimientos/mes, 1 ruta nueva + 1 enlace en `/`, 1 VO de dominio nuevo + 1 método de puerto + 1 caso de uso + 2 componentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Estado pre-diseño | Notas |
|---|-----------|-------------------|-------|
| I | Simplicidad Primero | ✅ PASS | Sin dependencias ni proyectos nuevos; un método de puerto nuevo y una ruta nueva justificadas por el producto (vista de ámbito familiar distinto del de cuenta). El cálculo reutiliza `MonthlyClosure` por composición en lugar de duplicarlo. |
| II | Spec-Driven Development | ✅ PASS | Este plan deriva de `specs/006-resumen-global-mensual/spec.md` (Draft, sin marcadores pendientes; la clarificación de granularidad de saldos quedó registrada en el roadmap para `010-cuadre-mensual`, fuera de alcance aquí). |
| III | Calidad Verificada | ✅ PASS | Lógica de negocio (VO `GlobalMonthlySummary`, incluida la invariante global = Σ cierres) con tests unitarios; caso de uso con dobles; repositorio contra libsql `:memory:`; componentes con RTL; e2e Playwright con KPIs exactos; gates de CI existentes. |
| IV | TypeScript Estricto + Zod en fronteras | ✅ PASS | Única frontera nueva: `searchParams.month` de `/resumen`, validada con Zod (mismo esquema que `/`). Sin `any`; VO y DTOs tipados. |
| V | Persistencia SQLite con Drizzle | ✅ PASS | Sin cambios de esquema ni migraciones (FR-005): único cambio de persistencia es un método de lectura más en el adaptador Drizzle existente. |
| VI | Producto en español, código en inglés | ✅ PASS | Etiquetas exactas en contracts/ui-contract.md §3 ("Resumen global de {Mes}", "Desglose por miembro", "Cuenta común"...); identificadores en inglés con ampliación del glosario (`GlobalMonthlySummary`, `memberBreakdown`, `listByMonth`). |
| VII | Hexagonal + DDD Táctico | ✅ PASS | El cálculo es dominio puro (VO que compone VO con `Money`); el método `listByMonth` se define en el puerto de la aplicación y lo implementa el adaptador Drizzle; la UI solo formatea. Sin CQRS/EDA/eventos. |

**Resultado**: sin violaciones → Phase 0 autorizada.

## Project Structure

### Documentation (this feature)

```text
specs/006-resumen-global-mensual/
├── plan.md                     # This file (/speckit.plan command output)
├── research.md                 # Phase 0 output (/speckit.plan command)
├── data-model.md               # Phase 1 output (/speckit.plan command)
├── quickstart.md               # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── ui-contract.md          # Contrato de la ruta /resumen, el panel y el enlace en /
└── tasks.md                    # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
├── src/
│   ├── domain/                          # Núcleo puro (cero dependencias externas)
│   │   └── movement/
│   │       ├── GlobalMonthlySummary.ts        # NUEVO: VO resumen global (compone MonthlyClosure + desglose por miembro)
│   │       └── GlobalMonthlySummary.test.ts   # NUEVO: tests del VO, incluida la invariante global = Σ cierres (TDD)
│   ├── application/                     # Casos de uso + puertos (depende solo de domain)
│   │   └── movement/
│   │       ├── dto.ts                         # AMPLIADO: GlobalMonthlySummaryDTO, MemberBreakdownEntryDTO
│   │       ├── MovementRepository.ts          # AMPLIADO: listByMonth(month)
│   │       ├── GetGlobalMonthlySummary.ts     # NUEVO: resumen del mes vía puertos (movimientos + cuentas)
│   │       └── GetGlobalMonthlySummary.test.ts# NUEVO
│   ├── app/
│   │   ├── page.tsx                           # AMPLIADO: enlace "Resumen global" (único cambio en /)
│   │   └── resumen/
│   │       └── page.tsx                       # NUEVO: adaptador server fino (searchParams month con Zod)
│   └── infrastructure/
│       ├── db/
│       │   ├── DrizzleMovementRepository.ts   # AMPLIADO: listByMonth (query sin filtro de cuenta)
│       │   └── DrizzleMovementRepository.test.ts # AMPLIADO: listByMonth contra libsql :memory:
│       └── primary/
│           └── ui/
│               ├── month-selector.tsx             # NUEVO: selector de mes cliente reutilizable (sin cuenta)
│               ├── month-selector.test.tsx        # NUEVO (jsdom + RTL)
│               ├── global-summary-panel.tsx       # NUEVO: componente servidor del panel
│               └── global-summary-panel.test.tsx  # NUEVO (jsdom + RTL)
├── e2e/
│   └── resumen-global.spec.ts             # NUEVO: KPIs exactos tras registrar en las tres cuentas (mes propio)
└── docs/architecture/
    └── adr/0012-resumen-global-composicion-cierre.md  # NUEVO (fase implementación)
```

**Structure Decision**: misma estructura por capas concéntricas que 002/005 (`docs/architecture/overview.md`): dominio y aplicación módulos puros; `src/app/resumen/page.tsx` adaptador inbound fino (patrón ADR 0008 de searchParams); UI en `src/infrastructure/primary/ui/`. Tests co-localizados con su SUT; e2e en `e2e/` (spec nueva, serie dentro del fichero por estado compartido de BD, mes propio sin colisión con 002/003/005). **No se tocan** `schema/`, `drizzle/` ni Server Actions: el resumen consume `MovementRepository` y `AccountRepository` existentes (más el nuevo método de lectura).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |

**Decisiones de diseño que requieren ADR en la fase de implementación** (recogido aquí para que `/speckit.tasks` lo incluya):
- **ADR 0012 — Resumen global por composición del cierre**: `GlobalMonthlySummary` delega los KPIs agregados en `MonthlyClosure` (única fuente de reglas; FR-002 como garantía estructural) y calcula solo el desglose por miembro; lectura propia del mes vía nuevo método de puerto `listByMonth`; vista en ruta propia `/resumen`. Alternativas rechazadas en research.md §1–§3 (VO duplicado, composición en aplicación, agregación SQL, sección global en `/`).

## Constitution Check (post-diseño, Phase 1)

Re-evaluación tras generar [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md) y [quickstart.md](./quickstart.md):

| # | Principio | Estado post-diseño | Notas |
|---|-----------|--------------------|-------|
| I | Simplicidad Primero | ✅ PASS | 6 ficheros nuevos de código + 5 ampliaciones puntuales; reutilización por composición y helpers existentes (`format.ts`, `buildMonthWindow`, patrones de 005); alternativas rechazadas en research.md §1–§3. |
| II | Spec-Driven Development | ✅ PASS | Cada FR-001..FR-008 traza a un artefacto: FR-001/002/007/008 → ui-contract §1–§3; FR-002 (coherencia) → data-model §1.1 invariante 2 + research §1; FR-003/004 → VO (data-model §1.1, research §4); FR-005 → §2 (sin DDL); FR-006 → §3; FR-007 (ruta) → ui-contract §1; FR-008 → research §2. |
| III | Calidad Verificada | ✅ PASS | quickstart.md define la verificación manual de los 7 escenarios (E1–E7); tests por capa (VO con invariante de coherencia, use case, repo libsql, RTL) + e2e con KPIs exactos en CI. |
| IV | TypeScript Estricto + Zod | ✅ PASS | Frontera nueva acotada: `month` en `/resumen` con Zod (ui-contract §1.1); VO/DTOs tipados; sin `any`. |
| V | SQLite con Drizzle | ✅ PASS | Cero cambios de esquema/migraciones (FR-005 verificado: no hay DDL en el plan; solo un método de lectura del adaptador). |
| VI | Español / inglés | ✅ PASS | Etiquetas y textos exactos en contracts/ui-contract.md §3; glosario ampliado en data-model.md §5 ("Cuenta común" = `memberName: null`, etiqueta solo en UI). |
| VII | Hexagonal + DDD Táctico | ✅ PASS | Cálculo en dominio puro (VO compone VO con `Money`); `listByMonth` nace en el puerto de aplicación y lo implementa Drizzle (data-model §2.1); la UI solo formatea (§3: dónde vive cada regla). Sin CQRS/EDA/eventos. |

**Resultado**: diseño aprobado; sin desviaciones que justificar. El plan queda listo para `/speckit.tasks`.
