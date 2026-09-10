# Implementation Plan: Cierre Mensual por Cuenta

**Branch**: `feature/005-cierre-mensual` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-cierre-mensual/spec.md`

## Summary

Segunda feature entregable del roadmap: panel de cierre mensual con los KPIs del Excel de Balance para el mes/cuenta seleccionados — total de ingresos, total de gastos, gastos compartidos, gastos personales, saldo del mes y desglose de gastos por tag — integrado en la pantalla principal construida por 002. Feature de **solo lectura**: sin nuevas escrituras, sin cambios de esquema ni migraciones, sin nuevos puertos de persistencia.

Enfoque técnico (detalles y alternativas en [research.md](./research.md)):
- **Cálculo en el dominio**: VO `MonthlyClosure` con factory pura `fromMovements` que agrega con `Money` (ADR 0007); la regla "multi-etiquetado no duplica totales, computa una vez por tag" vive en el dominio, cubierta por tests.
- **Caso de uso autocontenido**: `GetMonthlyClosure` depende del puerto `MovementRepository` y obtiene los movimientos del mes por sí mismo (`execute(accountId, month)`); sin acoplamiento al listado, sin agregación SQL dedicada y sin persistencia de totales (extensión del ADR 0009 → ADR 0010).
- **UI**: componente servidor `monthly-closure-panel.tsx` entre el formulario y el listado; la UI solo formatea con los helpers es-ES existentes más `formatSignedCents` (saldo con signo contable `+`/`−`/sin signo si es 0).
- **Testing**: tests unitarios del VO y del caso de uso (dobles), test de componente jsdom/RTL, e2e Playwright que registra movimientos y verifica KPIs exactos.

## Technical Context

**Language/Version**: TypeScript 5.x en modo estricto sobre Node.js LTS; Next.js (App Router) estable actual.

**Primary Dependencies**: las ya fijadas por 002 (next, react, drizzle-orm 0.44.x, @libsql/client, zod, tailwindcss + shadcn/ui copiado en el repo). **Cero dependencias nuevas**.

**Storage**: sin cambios — SQLite/Turso vía Drizzle (esquema de 002 intacto; el cierre es una vista derivada y no se persiste).

**Testing**: Vitest (projects node/ui, co-localizados con el SUT) y Playwright (nueva spec e2e del panel de cierre). Patrones de 002 (research.md §4 de 002).

**Target Platform**: Web (escritorio y móvil), Vercel + Turso; sin cambios.

**Project Type**: web-app (monolito Next.js, App Router); sin proyectos ni paquetes nuevos.

**Performance Goals**: SC-002 del cierre de un mes con hasta 300 movimientos < 3 s; la agregación es en memoria sobre los DTOs del mes ya cargados (sub-milisegundo), el coste dominante es el render que ya existe.

**Constraints**: aritmética exacta en céntimos sin coma flotante (FR-007, ADR 0007); UI en español; el cierre se limita al mes seleccionado (sin balance acumulado, FR-005); sin cambios de esquema ni migraciones (FR-009).

**Scale/Scope**: 1 usuario, ~100–500 movimientos/mes, 1 pantalla (se añade una región), 1 VO de dominio nuevo + 1 caso de uso + 1 componente.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Estado pre-diseño | Notas |
|---|-----------|-------------------|-------|
| I | Simplicidad Primero | ✅ PASS | Sin dependencias, proyectos ni puertos nuevos: se reutiliza `MovementRepository.listByMonthAndAccount` y los DTOs ya cargados; el cierre es un VO de dominio + un caso de uso + un componente. |
| II | Spec-Driven Development | ✅ PASS | Este plan deriva de `specs/005-cierre-mensual/spec.md` (Draft con 2 clarificaciones resueltas en sesión 2026-09-10). |
| III | Calidad Verificada | ✅ PASS | La lógica de negocio del cierre (VO `MonthlyClosure`) con tests unitarios; caso de uso con dobles; componente con RTL; e2e Playwright verifica KPIs exactos tras registrar movimientos; gates de CI existentes. |
| IV | TypeScript Estricto + Zod en fronteras | ✅ PASS | Sin nuevas fronteras de entrada de datos (feature de solo lectura; los searchParams ya se validan con Zod en `page.tsx`); tipado fuerte con VOs y DTOs existentes. |
| V | Persistencia SQLite con Drizzle | ✅ PASS | Sin cambios de esquema ni migraciones: requisito FR-009 de la propia spec (vista derivada, ADR 0009 extendido). |
| VI | Producto en español, código en inglés | ✅ PASS | Etiquetas de KPIs en español definidas en contracts/; identificadores en inglés con ampliación del glosario (`MonthlyClosure`, `month balance`, `tag breakdown`). |
| VII | Hexagonal + DDD Táctico | ✅ PASS | El cálculo de KPIs es lógica de dominio pura en `src/domain/` (VO con `Money`); el caso de uso en `src/application/` orquesta sin nuevos puertos; la UI solo formatea. Sin CQRS/EDA/eventos. |

**Resultado**: sin violaciones → Phase 0 autorizada.

## Project Structure

### Documentation (this feature)

```text
specs/005-cierre-mensual/
├── plan.md                     # This file (/speckit.plan command output)
├── research.md                 # Phase 0 output (/speckit.plan command)
├── data-model.md               # Phase 1 output (/speckit.plan command)
├── quickstart.md               # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── ui-contract.md          # Contrato del panel de cierre en la pantalla principal
└── tasks.md                    # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
├── src/
│   ├── domain/                          # Núcleo puro (cero dependencias externas)
│   │   └── movement/
│   │       ├── MonthlyClosure.ts        # NUEVO: VO cierre mensual + factory fromMovements
│   │       └── MonthlyClosure.test.ts   # NUEVO: tests del VO (TDD)
│   ├── application/                     # Casos de uso + puertos (depende solo de domain)
│   │   └── movement/
│   │       ├── dto.ts                   # AMPLIADO: MonthlyClosureDTO, TagBreakdownEntryDTO
│   │       ├── GetMonthlyClosure.ts     # NUEVO: cierre del mes vía puerto MovementRepository + VO
│   │       └── GetMonthlyClosure.test.ts# NUEVO
│   ├── app/
│   │   └── page.tsx                     # AMPLIADO: integra el panel (lectura propia vía GetMonthlyClosure)
│   └── infrastructure/
│       └── primary/
│           └── ui/
│               ├── format.ts            # AMPLIADO: formatSignedCents (saldo con signo)
│               ├── format.test.ts       # AMPLIADO
│               ├── monthly-closure-panel.tsx  # NUEVO: componente servidor del panel
│               └── monthly-closure-panel.test.tsx # NUEVO (jsdom + RTL)
├── e2e/
│   └── cierre-mensual.spec.ts           # NUEVO: KPIs exactos tras registrar movimientos
└── docs/architecture/
    └── adr/0010-cierre-mensual-servicio-dominio.md  # NUEVO (fase implementación)
```

**Structure Decision**: misma estructura por capas concéntricas que 002 (`docs/architecture/overview.md`): dominio y aplicación módulos puros; `page.tsx` adaptador fino; UI en `src/infrastructure/primary/ui/`. Los tests co-localizados con su SUT; e2e en `e2e/` (spec nueva, serie dentro del fichero por estado compartido de BD). **No se tocan** `schema/`, `drizzle/`, repositorios ni Server Actions: el cierre consume el puerto `MovementRepository` existente.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |

**Decisiones de diseño que requieren ADR en la fase de implementación** (recogido aquí para que `/speckit.tasks` lo incluya):
- **ADR 0010 — Cierre mensual calculado como servicio de dominio con lectura propia del mes**: el caso de uso obtiene los movimientos vía el puerto existente (`listByMonthAndAccount`) y agrega con el VO `MonthlyClosure`; se rechazan la agregación SQL dedicada, la persistencia de totales y pasar al caso de uso los DTOs cargados por el listado (acoplamiento a la forma de carga; revertido tras challenge del revisor).

## Constitution Check (post-diseño, Phase 1)

Re-evaluación tras generar [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md) y [quickstart.md](./quickstart.md):

| # | Principio | Estado post-diseño | Notas |
|---|-----------|--------------------|-------|
| I | Simplicidad Primero | ✅ PASS | 3 ficheros nuevos de código + 3 ampliaciones puntuales; sin puertos/deps nuevos (alternativas rechazadas en research.md §1–§2). |
| II | Spec-Driven Development | ✅ PASS | Cada FR-001..FR-011 traza a un artefacto: FR-001/008/010 → ui-contract; FR-002/003/004/006 → VO `MonthlyClosure` (data-model §1.1); FR-005 → ui-contract §1 (ausencia de balance acumulado); FR-007 → data-model §3 (aritmética/formato; §1.1); FR-009 → ADR 0010; FR-011 → research.md §1. |
| III | Calidad Verificada | ✅ PASS | quickstart.md define la verificación manual de los 6 escenarios de aceptación; tests por capa + e2e con KPIs exactos en CI. |
| IV | TypeScript Estricto + Zod | ✅ PASS | Sin nuevas fronteras de datos; VO y DTOs tipados; sin `any`. |
| V | SQLite con Drizzle | ✅ PASS | Cero cambios de esquema/migraciones (FR-009 verificado: no hay DDL en el plan). |
| VI | Español / inglés | ✅ PASS | Etiquetas y textos exactos del panel en contracts/ui-contract.md §3; glosario ampliado en data-model.md §4. |
| VII | Hexagonal + DDD Táctico | ✅ PASS | Cálculo (lógica de negocio) en dominio puro con `Money`; UI solo formatea (data-model §3: dónde vive cada regla); el caso de uso no introduce puertos nuevos. |

**Resultado**: diseño aprobado; sin desviaciones que justificar. El plan queda listo para `/speckit.tasks`.
