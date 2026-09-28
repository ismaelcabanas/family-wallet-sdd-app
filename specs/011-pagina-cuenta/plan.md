# Implementation Plan: Página de Cuenta

**Branch**: `feature/011-pagina-cuenta` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-pagina-cuenta/spec.md`

## Summary

Página propia por cuenta (`/accounts/[accountId]?month=YYYY-MM`) con el listado del mes agrupado por fecha (fila rediseñada: tags prominentes, nota en pequeño «concepto · descripción», importe a la derecha con color semántico y distintivo de naturaleza), edición/eliminación con los diálogos de 003, selector ‹ mes/año › acotado al futuro, cierre mensual (005) y **balance acumulado hasta el fin del mes consultado**. `/` queda intacta como pasarela hasta `012-panel-cuentas`. Feature de presentación sobre lo existente: sin cambios de dominio ni migraciones; única excepción el corte de fecha opcional del puerto de balance (FR-006).

Enfoque técnico (detalles y alternativas en [research.md](./research.md)):
- **Ruta dinámica fina con 404 explícito**: `src/app/accounts/[accountId]/page.tsx` valida `accountId`/`month` con Zod (patrón ADR 0008); cuenta inexistente → `notFound()`, nunca fallback a otra cuenta; mes inválido → mes actual (FR-001).
- **Balance con corte**: puerto `AccountRepository.getBalance(id, asOf?)` (fecha inclusive, opcional — `/` no cambia) + implementación Drizzle con `lte(date, asOf)`; helper puro `monthEndIsoDate` en `format.ts` (research §2).
- **Agrupación como presentación**: componente cliente nuevo `GroupedMovementList` que agrupa con un `reduce` el orden ya devuelto por `ListMovements` (`date DESC, id DESC`), con los diálogos de 003 montados a nivel del listado y el estado vacío interno (convención del repo). `movement-list.tsx` queda intacto para `/` (research §3).
- **Selector `MonthStepper`**: ‹ siempre, › deshabilitado en mes ≥ actual, picker de salto directo, `router.replace` preservando la cuenta (research §4).
- **Revalidación**: las 3 Server Actions añaden `revalidatePath("/accounts/[accountId]", "page")` para recalcular la vista tras escribir (research §5).
- **Testing**: 5 niveles — helpers (`monthEndIsoDate`, `shiftMonth`), repositorio (`asOf` inclusive/exclusivo, regresión sin corte), acciones (doble `revalidatePath`), RTL de los 2 componentes nuevos, y e2e nuevo `pagina-cuenta.spec.ts` en la combinación propia **Cuenta de Miembro B · abril 2026** (aislamiento verificado contra los balances absolutos que afirman las specs existentes) (research §7).

## Technical Context

**Language/Version**: TypeScript 5.x en modo estricto sobre Node.js LTS; Next.js 16 (App Router) — `params`/`searchParams` son promesas (`await`).

**Primary Dependencies**: las ya fijadas por 002 (next, react, drizzle-orm 0.44.x, @libsql/client, zod, tailwindcss + shadcn/ui copiado en el repo). **Cero dependencias nuevas.**

**Storage**: sin cambios — SQLite/Turso vía Drizzle (esquema de 002/003 intacto); única ampliación de persistencia es el parámetro opcional `asOf` en `getBalance` (lectura agregada, sin DDL).

**Testing**: Vitest (projects node/ui, co-localizados con el SUT) y Playwright (nueva spec e2e `pagina-cuenta.spec.ts`; las 5 existentes deben pasar intactas). Patrones de 003/005/009.

**Target Platform**: Web (escritorio primero; usable en móvil), Vercel + Turso; sin cambios.

**Project Type**: web-app (monolito Next.js, App Router); sin proyectos ni paquetes nuevos; una ruta dinámica nueva.

**Performance Goals**: SC-003 — página de cuenta con hasta 300 movimientos del mes < 3 s; mismas 5 lecturas paralelas que `/` hoy (cuentas, movimientos del mes, balance con corte, tags, cierre), la agrupación es O(n) en cliente sobre datos ya ordenados.

**Constraints**: aritmética en céntimos enteros sin cambios (ADR 0007); UI en español; sin migraciones ni cambios de dominio/aplicación salvo la firma del puerto de balance (FR-009); `/` intacta (FR-007); nunca navegación a meses futuros desde la UI (FR-005).

**Scale/Scope**: 1 usuario, ~100–500 movimientos/mes, 1 ruta nueva + 2 componentes nuevos + 1 componente ampliado (subtítulo) + 1 helper-prop + 2 helpers de calendario; e2e nuevo.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Estado pre-diseño | Notas |
|---|-----------|-------------------|-------|
| I | Simplicidad Primero | ✅ PASS | Sin dependencias, proyectos ni paquetes nuevos: una ruta, dos componentes cliente, un parámetro opcional en un puerto existente y dos helpers puros. Componente nuevo en lugar de rediseñar el compartido: es la vía **más simple que no rompe** los e2e congelados de `/` (research §3). |
| II | Spec-Driven Development | ✅ PASS | Este plan deriva de `specs/011-pagina-cuenta/spec.md` (Draft con 3 clarificaciones resueltas en sesión 2026-09-27: balance a mes, 404, tope de navegación). |
| III | Calidad Verificada | ✅ PASS | Helpers y `asOf` con tests unitarios/de repositorio; acciones con aserciones de revalidación; componentes con RTL (Server Actions mockeadas, patrón del repo); e2e nuevo del flujo de la página; las 5 specs e2e existentes intactas como criterio (SC-004). |
| IV | TypeScript Estricto + Zod en fronteras | ✅ PASS | Frontera nueva: `params.accountId` y `searchParams.month` de la ruta, validados con Zod (patrón ADR 0008); parámetro opcional tipado en el puerto; sin `any`. |
| V | Persistencia SQLite con Drizzle | ✅ PASS | Sin cambios de esquema ni migraciones (FR-009): la única modificación es una condición opcional (`lte`) en la query agregada existente del adaptador Drizzle. |
| VI | Producto en español, código en inglés | ✅ PASS | Textos exactos en contracts/ui-contract.md §3 («Acumulado hasta {Mes de YYYY}», «Personal»/«Común», cabeceras `<time>`); identificadores en inglés con glosario ampliado (`MonthStepper`, `GroupedMovementList`, `asOf`, `monthEndIsoDate`, `shiftMonth`). |
| VII | Hexagonal + DDD Tactico | ✅ PASS | Sin dominio nuevo: la agrupación por fecha es presentación sobre el orden del puerto (FR-002); el cálculo monetario sigue en la agregación del repositorio (ADR 0009); la firma `asOf` nace en el puerto de aplicación y la implementa Drizzle; la UI nunca calcula dinero (agrupa, concatena, formatea). Sin CQRS/EDA/eventos. |

**Resultado**: sin violaciones → Phase 0 autorizada.

## Project Structure

### Documentation (this feature)

```text
specs/011-pagina-cuenta/
├── plan.md                     # This file (/speckit.plan command output)
├── research.md                 # Phase 0 output (/speckit.plan command)
├── data-model.md               # Phase 1 output (/speckit.plan command)
├── quickstart.md               # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── ui-contract.md          # Contrato de la ruta, el listado agrupado y el selector de mes
└── tasks.md                    # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
├── src/
│   ├── application/                      # Casos de uso + puertos (depende solo de domain)
│   │   └── account/
│   │       └── AccountRepository.ts      # AMPLIADO: getBalance(id, asOf?) — corte de fecha opcional
│   ├── app/
│   │   ├── page.tsx                      # INTACTO (FR-007): / sigue siendo la pasarela
│   │   └── accounts/
│   │       └── [accountId]/
│   │           └── page.tsx              # NUEVO: adaptador server fino (Zod + notFound + 5 lecturas)
│   └── infrastructure/
│       ├── db/
│       │   ├── DrizzleAccountRepository.ts     # AMPLIADO: lte(date, asOf) en getBalance
│       │   └── DrizzleRepositories.test.ts     # AMPLIADO: asOf inclusive/exclusivo + regresión sin corte
│       └── primary/
│           ├── actions/
│           │   ├── create-movement.action.ts   # AMPLIADO: revalidatePath("/accounts/[accountId]", "page")
│           │   ├── create-movement.action.test.ts
│           │   ├── update-movement.action.ts   # AMPLIADO: ídem
│           │   ├── update-movement.action.test.ts
│           │   ├── delete-movement.action.ts   # AMPLIADO: ídem
│           │   └── delete-movement.action.test.ts
│           └── ui/
│               ├── format.ts                         # AMPLIADO: monthEndIsoDate, shiftMonth
│               ├── format.test.ts                    # AMPLIADO
│               ├── account-balance.tsx               # AMPLIADO: subtítulo como prop («Acumulado hasta …»)
│               ├── account-balance.test.tsx          # NUEVO (jsdom + RTL; no existe batería previa)
│               ├── grouped-movement-list.tsx         # NUEVO: listado agrupado por fecha + diálogos + vacío
│               ├── grouped-movement-list.test.tsx    # NUEVO (jsdom + RTL)
│               ├── month-stepper.tsx                 # NUEVO: ‹ › + picker con tope de futuro
│               └── month-stepper.test.tsx            # NUEVO (jsdom + RTL)
├── e2e/
│   └── pagina-cuenta.spec.ts               # NUEVO: Miembro B · abril 2026 (agrupación, navegación, 404, fila)
└── docs/architecture/
    ├── overview.md                          # AMPLIADO (fase implementación): ruta nueva
    └── diagrams/                            # AMPLIADO (fase implementación): C4/secuencia reutilizando estos diagramas
```

**Structure Decision**: misma estructura por capas concéntricas que 002–009 (`docs/architecture/overview.md`): dominio sin cambios; `src/app/accounts/[accountId]/page.tsx` adaptador inbound fino (patrón ADR 0008; en Next 16 `params`/`searchParams` se resuelven con `await`); UI nueva en `src/infrastructure/primary/ui/`. Tests co-localizados con su SUT; e2e en `e2e/` (spec nueva en serie, combinación cuenta/mes propia según AGENTS.md — research §7). **No se tocan** `src/domain/`, `schema/`, `drizzle/`, ni `movement-list.tsx`/`account-month-selector.tsx` (la UI de `/` queda congelada hasta 012).

## Diagramas de diseño

Foto del diseño de esta feature (mermaid, como la documentación viva del proyecto); `docs/architecture/diagrams/` se extiende en la fase de implementación reutilizándolos como base. El diagrama de clases del modelo vive en [data-model.md §1.3](./data-model.md) (no hay piezas de dominio nuevas).

### Componentes que intervienen

```mermaid
flowchart LR
    U((Usuario))

    subgraph Inbound["Adaptadores inbound — src/app, src/infrastructure/primary"]
        AccPage["/accounts/[accountId] page.tsx (server; Zod + notFound)"]
        Stepper["MonthStepper (client, ‹ › + picker)"]
        GroupList["GroupedMovementList (client; agrupa por fecha, diálogos de 003, vacío)"]
        Form["MovementForm (002, reutilizado)"]
        ClosureP["MonthlyClosurePanel (005, reutilizado)"]
        BalanceC["AccountBalance (ampliado: subtítulo acumulado)"]
        Actions["Server Actions 002/003 (+ revalidatePath '/accounts/[accountId]')"]
    end

    subgraph Aplicacion["Capa de aplicación — src/application"]
        LA["ListAccounts"]
        LM["ListMovements"]
        GMC["GetMonthlyClosure (005)"]
        LAT["ListActiveTags"]
        PortAcc["«port» AccountRepository"]
        PortMov["«port» MovementRepository"]
    end

    subgraph Outbound["Adaptadores outbound — src/infrastructure/db"]
        DrizzleAcc["DrizzleAccountRepository (getBalance + asOf)"]
        DrizzleMov["DrizzleMovementRepository"]
        LibSQL[("SQLite / Turso (libSQL)")]
    end

    U --> Stepper
    U --> GroupList
    U --> Form
    Stepper -- "/accounts/{id}?month=…" --> AccPage
    AccPage --> LA
    AccPage --> LM
    AccPage --> GMC
    AccPage --> LAT
    AccPage --> PortAcc : "getBalance(id, monthEndIsoDate(month))"
    LM --> PortMov : "listByMonthAndAccount"
    GMC --> PortMov
    LA --> PortAcc
    LAT --> DrizzleAcc
    AccPage --> BalanceC
    AccPage --> ClosureP
    AccPage --> Form
    AccPage --> GroupList : "MovementDTO[] (orden date/id DESC)"
    GroupList --> Actions : "editar / eliminar"
    Form --> Actions : "alta"
    DrizzleAcc -. implementa .-> PortAcc
    DrizzleMov -. implementa .-> PortMov
    DrizzleAcc --> LibSQL
    DrizzleMov --> LibSQL
```

> Nota: las dependencias apuntan siempre hacia el dominio (constitución VII); en esta feature el dominio no cambia: la página y los componentes consumen casos de uso/puertos existentes, y `GroupedMovementList` solo agrupa y formatea (nunca calcula dinero).

### Secuencia — happy path: abrir la página de una cuenta

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant S as MonthStepper (client)
    participant R as "/accounts/[accountId] page.tsx (server)"
    participant LA as ListAccounts
    participant LM as ListMovements
    participant AR as "«port» AccountRepository"
    participant GMC as GetMonthlyClosure
    participant DB as DrizzleAccountRepository + libSQL

    U->>S: pulsa ‹ (mes anterior)
    S->>R: GET /accounts/{id}?month=YYYY-MM (router.replace)
    R->>R: Zod: accountId válido + cuenta existe (si no → notFound()); month válido (si no → actual)
    R->>LA: execute()
    LA-->>R: AccountDTO[]
    R->>LM: execute(accountId, month)
    LM-->>R: MovementDTO[] (date DESC, id DESC)
    R->>AR: getBalance(id, monthEndIsoDate(month))
    AR->>DB: sum(signo por type) where accountId and date <= asOf
    DB-->>R: céntimos (acumulado a fin de mes)
    R->>GMC: execute(accountId, month)
    GMC-->>R: MonthlyClosureDTO
    R->>R: render: h1 + subtítulo, stepper, balance acumulado, formulario, cierre, listado
    R->>U: HTML de la página del mes (GroupedMovementList agrupa por fecha en cliente)
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |

**Decisiones de diseño destacadas (sin violación, registradas para `/speckit.tasks`)**:
- **Componente nuevo en vez de rediseñar el compartido**: `movement-list.tsx` alimenta `/` y sus e2e están congelados (SC-004); el rediseño de fila rompería aserciones de features cerradas. La duplicación acotada (cableado de diálogos) es temporal: 012 jubila el listado plano.
- **`asOf` por fecha y opcional en el puerto de balance** (no método nuevo ni semántica de mes): mantiene binaria la compatibilidad (`/` no cambia), deja la lógica de calendario en un helper de presentación y el corte inclusive se testea en el adaptador.

## Constitution Check (post-diseño, Phase 1)

Re-evaluación tras generar [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md) y [quickstart.md](./quickstart.md):

| # | Principio | Estado post-diseño | Notas |
|---|-----------|--------------------|-------|
| I | Simplicidad Primero | ✅ PASS | 5 ficheros nuevos de código (página, 2 componentes + tests, e2e) + 6 ampliaciones puntuales; sin deps/puertos nuevos (parámetro opcional en puerto existente); alternativas rechazadas en research §1–§5. |
| II | Spec-Driven Development | ✅ PASS | Cada FR-001..FR-010 traza a un artefacto: FR-001 → ui-contract §1 (404/fallback) + research §1; FR-002/003 → ui-contract §2 + data-model §1.2; FR-004 → ui-contract §2.3; FR-005 → ui-contract §4; FR-006 → data-model §2 + ui-contract §2.4; FR-007/008 → estructura (page.tsx intacto) + quickstart E7; FR-009 → data-model §1/§2 (sin dominio/DDL); FR-010 → ui-contract §3. |
| III | Calidad Verificada | ✅ PASS | quickstart.md define la verificación manual de los 7 escenarios (E1–E7); tests por capa (helpers, repositorio con corte inclusive, acciones con doble revalidación, RTL) + e2e nuevo y las 5 specs previas intactas (SC-004) en CI. |
| IV | TypeScript Estricto + Zod | ✅ PASS | Frontera nueva acotada y validada con Zod (`accountId` de ruta, `month` de query — ui-contract §1.1); `asOf?: string` tipado; sin `any`. |
| V | SQLite con Drizzle | ✅ PASS | Cero cambios de esquema/migraciones (FR-009 verificado: no hay DDL en el plan; solo `lte` opcional en la query agregada existente, cubierta por índice `(account_id, date)`). |
| VI | Español / inglés | ✅ PASS | Textos exactos en contracts/ui-contract.md §3; glosario ampliado en data-model.md §5 (`asOf`, `MonthStepper`, `GroupedMovementList`, `monthEndIsoDate`, `shiftMonth`). |
| VII | Hexagonal + DDD Táctico | ✅ PASS | Dominio intacto; agrupación y nota son presentación (data-model §1.2/§3); el cálculo del balance sigue en el adaptador de salida con firma definida en el puerto de aplicación (data-model §2); la UI nunca calcula dinero. Sin CQRS/EDA/eventos. |

**Resultado**: diseño aprobado; sin desviaciones que justificar. El plan queda listo para `/speckit.tasks`.
