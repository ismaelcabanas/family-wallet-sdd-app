# Implementation Plan: Aportación porcentual a la cuenta común por miembro

**Branch**: `feature/019-aportacion-comun` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-aportacion-comun/spec.md`

## Summary

Cada miembro configura, desde el menú ⋮ de la tarjeta de su cuenta personal (020), qué **porcentaje de su ingreso regular** (018) aporta cada mes a la cuenta común. La aportación se **materializa perezosamente** al consultar el mes en la página de la cuenta —como el ingreso regular de 018 (ADR 0016)— como **un único gasto de naturaleza propia** con la etiqueta «Aportación Común», nota «Aportación común de {miembro}» y fecha día 1, redondeado al céntimo con **half-up** determinista. Semántica solo-adelante idéntica a 018 (reactivar resetea el mes de activación; lo generado no se recalcula; el borrado es definitivo), idempotencia por registro de meses `(config, mes)` en transacción. Sin doble anotación: la cuenta común no cambia automáticamente (decisión del propietario).

**Enfoque técnico** (detalles y alternativas en [research.md](./research.md)):

- **VO `ContributionPercentage`** en puntos base enteros (1–10 000) con cálculo half-up por división entera `floor((cents×bp + 5 000)/10 000)` — sin flotantes (extensión de ADR 0007).
- **Agregado `CommonContribution`** espejo de `RegularIncome` (mismo ciclo de vida y semántica de `activatedAtMonth`) con puerto y 4 casos de uso propios; la dependencia del ingreso regular se lee por su puerto (`MissingRegularIncomeError` si falta).
- **Segundo materializador** `MaterializeCommonContributions` bajo el patrón del ADR 0016: mismo disparador único (página de cuenta, antes de lecturas), tabla registro `common_contribution_months` con `UNIQUE + ON CONFLICT DO NOTHING RETURNING` en la misma tx que el movimiento; agregados intactos. Patrón registrado en el **ADR 0017** (nuevo).
- **Etiqueta «Aportación Común»** garantizada por triple vía: seed idempotente, `INSERT OR IGNORE` en la migración `0004` (BDs existentes) y ensure por **slug** en cada generación (sobrevive a renombrados/borrados futuros del catálogo).
- **UI**: ítem «Aportación» junto a «Ingreso regular» con 4 estados (incl. «Requiere ingreso regular» deshabilitado — FR-006), diálogo espejo del de 018 con un solo campo «Porcentaje (%)», action `configureCommonContribution` con Zod en frontera y toasts congelados.
- **E2E** `aportacion-comun.spec.ts` con combinación propia (Cuenta de Miembro B + mes en curso) y **limpieza final obligatoria**: corre primero alfabéticamente sobre la BD compartida (research §8).

## Technical Context

**Language/Version**: TypeScript estricto sobre Next.js (App Router) — monolito existente; sin versiones nuevas.

**Primary Dependencies**: Next.js App Router + Server Actions, React, Drizzle ORM, Zod, Tailwind CSS + shadcn/ui (DropdownMenu/Dialog/Input/Label/Button ya versionados), sonner. Ninguna dependencia nueva.

**Storage**: SQLite (fichero en dev) / Turso libSQL (prod) vía Drizzle. Migración versionada `drizzle/0004_aportacion-comun.sql` (dos tablas + dato de etiqueta); `movements` y `regular_incomes` sin cambios.

**Testing**: Vitest (`test.projects` node + ui/jsdom) co-localizado con el SUT; repos contra libsql `:memory:` con migraciones reales; Playwright e2e (`workers: 1`, orden alfabético, `e2e.sqlite` recreada).

**Target Platform**: local (`npm run dev`) y Vercel serverless + Turso (sin estado en filesystem; sin cron — materialización en lectura).

**Project Type**: web-app monolito (Family Wallet).

**Performance Goals**: la materialización de la aportación no degrada apreciablemente la apertura del mes (edge de la spec): 1 SELECT de config + 1 de ingreso + 1 de registro + 1 tx de escritura como máximo, indexados por cuenta y `(config, mes)`.

**Constraints**: EUR en céntimos enteros con redondeo half-up (ADR 0007 + clarify 2026-10-14); sin doble anotación en la cuenta común; sin cambios en cierres/resumen/anual ni en formularios de movimiento; UI y specs en español.

**Scale/Scope**: uso individual, 3 cuentas (2 personales + 1 común), 2 miembros; una única US (constitución II, sin excepción).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Estado pre-diseño | Notas |
|---|-----------|-------------------|-------|
| I | Simplicidad Primero | ✅ PASS | Mismo monolito, cero dependencias nuevas; se reutilizan los patrones de 018/020 en lugar de abstraerlos (no hay «materializador genérico»); el único registro nuevo de decisión es el ADR 0017. |
| II | Spec-Driven Development | ✅ PASS | Spec aprobada con clarify (2026-10-14) y split 018/019 decidido por el propietario; este plan diseña FR-001..FR-009; FR-008 (roadmap) queda trazado en la estructura y tasks. |
| III | Calidad Verificada | ✅ PASS | FR-009 exige y este plan planifica: unit de dominio (tabla half-up), aplicación (idempotencia/solo-adelante/guardas), action, componentes, repositorios (tx) y e2e Playwright con combinación cuenta/mes propia (constitución III). |
| IV | TypeScript Estricto + Zod | ✅ PASS | Zod solo en la frontera de la action (patrón 018); validación de dominio en VO/entidad; sin `any`; parse de porcentaje por cadenas. |
| V | Persistencia SQLite con Drizzle | ✅ PASS | Evolución solo por migración versionada (`0004`, patrón de la `0002` manual); el dato de la etiqueta viaja en la misma migración; sin SQL ad hoc fuera de Drizzle. |
| VI | Producto en español, código en inglés | ✅ PASS | Literales UI en español congelados en ui-contract; identificadores en inglés (`CommonContribution`, `basisPoints`…); glosario ES↔EN en data-model §5. |
| VII | Arquitectura Hexagonal + DDD Táctico | ✅ PASS | Dominio puro nuevo (`common-contribution`) sin deps externas; puerto en `src/application`; adaptadores Drizzle/Actions/UI implementan; dependencias siempre hacia el dominio (diagrama §Componentes). |

**Resultado**: sin violaciones → Phase 0 autorizada.

## Project Structure

### Documentation (this feature)

```text
specs/019-aportacion-comun/
├── spec.md              # Especificación (aprobada con clarify 2026-10-14)
├── plan.md              # Este fichero (/speckit.plan)
├── research.md          # Phase 0 — 9 secciones de decisiones verificadas contra código
├── data-model.md        # Phase 1 — dominio, persistencia, validación, glosario
├── contracts/
│   └── ui-contract.md   # Phase 1 — literales y comportamientos congelados
├── quickstart.md        # Phase 1 — Q1–Q10 de validación manual
└── tasks.md             # Phase 2 (/speckit.tasks — NO lo crea este comando)
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── common-contribution/                          # NUEVO — agregado aportación
│       ├── CommonContribution.ts                     # entidad (ciclo espejo de RegularIncome)
│       ├── CommonContribution.test.ts
│       ├── CommonContributionId.ts                   # brand entero positivo
│       ├── CommonContributionErrors.ts               # 4 errores con literales congelados
│       ├── ContributionPercentage.ts                 # VO puntos base + half-up entero
│       └── ContributionPercentage.test.ts            # tabla de redondeo (data-model §1.1)
│   └── (movement/, regular-income/, tag/, account/, shared/)   # INTACTOS
├── application/
│   └── common-contribution/                          # NUEVO
│       ├── CommonContributionRepository.ts           # puerto (aplicación, constitución VII)
│       ├── dto.ts                                    # CommonContributionDTO (sin id)
│       ├── ConfigureCommonContribution.ts + .test.ts # guardas: personal, ingreso regular, ≥0,01 €
│       ├── DeactivateCommonContribution.ts + .test.ts
│       ├── GetCommonContribution.ts + .test.ts
│       └── MaterializeCommonContributions.ts + .test.ts  # guardas §1.2.1 + ensure etiqueta
│   └── (regular-income/, account/, tag/, movement/)  # INTACTOS (RegularIncomeRepository se consume, no se toca)
├── app/
│   ├── page.tsx                                      # MODIFICADO — lee GetCommonContribution por personal, pasa prop
│   └── accounts/[accountId]/page.tsx                 # MODIFICADO — MaterializeCommonContributions tras 018, antes del Promise.all
└── infrastructure/
    ├── db/
    │   ├── schema/
    │   │   ├── common-contributions.ts               # NUEVO — 2 tablas + UNIQUE (config, mes)
    │   │   └── index.ts                              # MODIFICADO — reexporta
    │   ├── DrizzleCommonContributionRepository.ts    # NUEVO — upsert + registerMaterialization en tx
    │   ├── DrizzleCommonContributionRepository.test.ts
    │   ├── mappers/common-contribution.mapper.ts     # NUEVO
    │   └── seed-data.ts                              # MODIFICADO — etiqueta «Aportación Común»
    └── primary/
        ├── actions/
        │   ├── configure-common-contribution.action.ts      # NUEVA — Zod, intents, revalidate, toasts
        │   └── configure-common-contribution.action.test.ts
        └── ui/
            ├── account-card-grid.tsx                 # MODIFICADO — ítem «Aportación» + estado + diálogo
            ├── account-card-grid.test.tsx            # MODIFICADO
            ├── common-contribution-config-dialog.tsx # NUEVO — espejo del de 018
            ├── common-contribution-config-dialog.test.tsx
            └── format.ts                             # MODIFICADO — formatBasisPointsForInput

drizzle/
└── 0004_aportacion-comun.sql                         # NUEVO — tablas + INSERT OR IGNORE etiqueta
e2e/
└── aportacion-comun.spec.ts                          # NUEVO — Miembro B + mes en curso, serial, limpieza final
docs/
└── architecture/
    ├── adr/0017-aportacion-comun-porcentaje-materializacion.md   # NUEVO
    └── diagrams/
        ├── aportacion-comun-secuencia.md             # NUEVO (base: §Diagramas de este plan)
        ├── domain-model.md                           # ACTUALIZADO — agregado nuevo
        └── panel-cuentas-sequence.md                 # ACTUALIZADO — variante aportación si procede
AGENTS.md                                              # ACTUALIZADO — convención de materialización generalizada
specs/001-family-wallet/spec.md                        # ACTUALIZADO (FR-008): fila 019 + amend alcance diferido + nota
```

**Structure Decision**: se mantiene la estructura hexagonal existente sin excepciones: el módulo nuevo `common-contribution` nace paralelo a `regular-income` en dominio y aplicación (misma convención de carpetas por agregado), la UI y las actions extienden los ficheros de 018/020 ya ubicados, y la persistencia añade su fichero de esquema + repositorio + mapper siguiendo el patrón Drizzle del repo. Nada se reorganiza.

## Diagramas de diseño

### Componentes que intervienen

```mermaid
flowchart LR
    U((Usuario))

    subgraph Inbound["Adaptadores inbound — src/app, src/infrastructure/primary"]
        HomePage["/ page.tsx (server; MODIFICADO: ListAccounts + GetRegularIncome + GetCommonContribution por cuenta personal)"]
        AccountPage["/accounts/[accountId] page.tsx (server; MODIFICADO: añade MaterializeCommonContributions antes de las lecturas)"]
        Action["configureCommonContribution (action NUEVA; Zod, intent save|deactivate, revalidatePath layout)"]
        Grid["AccountCardGrid + AccountSettingsMenu (client MODIFICADO: ítem «Aportación» + estado)"]
        Dialog["CommonContributionConfigDialog (client NUEVO; useActionState)"]
    end

    subgraph Aplicacion["Capa de aplicación — src/application"]
        ConfUC["ConfigureCommonContribution (NUEVO)"]
        DeactUC["DeactivateCommonContribution (NUEVO)"]
        GetUC["GetCommonContribution (NUEVO)"]
        MatUC["MaterializeCommonContributions (NUEVO)"]
        PortCC["«port» CommonContributionRepository (NUEVO)"]
        PortRI["«port» RegularIncomeRepository (intacto 018)"]
        PortTag["«port» TagRepository (intacto)"]
        PortAcc["«port» AccountRepository (intacto)"]
    end

    subgraph Dominio["Dominio — src/domain (puro)"]
        CC["CommonContribution (entidad NUEVA)"]
        Pct["ContributionPercentage (VO NUEVO; half-up entero)"]
        Movement["Movement / Money / Tag (INTACTOS)"]
    end

    subgraph Outbound["Adaptadores outbound — src/infrastructure/db"]
        DrizzleCC["DrizzleCommonContributionRepository (NUEVO; tx registro+movimiento)"]
        DrizzleRest["DrizzleRegularIncome/Tag/AccountRepository (INTACTOS)"]
        Schema["schema/common-contributions.ts + migración 0004 (NUEVOS)"]
        Seed["seed-data.ts (MODIFICADO: etiqueta «Aportación Común»)"]
    end

    SQL[("SQLite / Turso — movements y regular_incomes sin cambios")]

    U -->|"⋮ → «Aportación»"| Grid
    Grid -->|"monta condicional"| Dialog
    Dialog -->|"useActionState (FormData)"| Action
    Action --> ConfUC
    Action --> DeactUC
    HomePage -->|"accounts + regularIncomes + commonContributions (props)"| Grid
    HomePage -. lee .-> GetUC
    AccountPage -->|"ensureForAccountAndMonth(accountId, month, currentMonth)"| MatUC
    ConfUC --> PortCC
    ConfUC -. dependencia FR-006 .-> PortRI
    ConfUC --> PortAcc
    DeactUC --> PortCC
    GetUC --> PortCC
    MatUC --> PortCC
    MatUC -. base de cálculo .-> PortRI
    MatUC -. ensure etiqueta por slug .-> PortTag
    MatUC -. memberName .-> PortAcc
    ConfUC --> CC
    MatUC --> CC
    CC *-- Pct
    MatUC ..>|"create expense/personal/tag día 1"| Movement
    DrizzleCC -. implementa .-> PortCC
    DrizzleCC --> Schema
    DrizzleRest -. implementan .-> PortRI & PortTag & PortAcc
    DrizzleCC --> SQL
    DrizzleRest --> SQL
    Seed --> SQL
```

> Nota: todas las dependencias apuntan hacia el dominio; el dominio nuevo no importa Next/Drizzle/Zod. Cierres, resumen global, anual, formularios de movimiento y flujos de edición/eliminación **no participan** (intactos; FR-003 «reglas actuales»).

### Secuencia — happy path: configurar la aportación desde el menú ⋮ y consultar el mes (materialización)

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario (miembro)
    participant P as "/ page.tsx (server)"
    participant Grid as AccountSettingsMenu (client)
    participant Dlg as CommonContributionConfigDialog (client)
    participant A as configureCommonContribution (action)
    participant CUC as ConfigureCommonContribution (aplicación)
    participant AP as "/accounts/[accountId] page.tsx (server)"
    participant MUC as MaterializeCommonContributions (aplicación)
    participant PortCC as CommonContributionRepository (puerto)
    participant PortRI as RegularIncomeRepository (puerto)
    participant Dom as CommonContribution + ContributionPercentage (dominio)
    participant Mov as Movement (dominio)

    U->>P: abre / (panel de cuentas)
    P-->>U: tarjetas; ⋮ solo en personales (intacto 020)
    U->>Grid: clic ⋮ («Configuración de {cuenta}»)
    U->>Grid: selecciona «Aportación · Sin configurar»
    Grid->>Dlg: monta diálogo dentro de la tarjeta (instancia fresca)
    U->>Dlg: «25» → «Guardar» (FormData { accountId, percentage, intent: "save" })
    Dlg->>A: useActionState submit (controles disabled)
    A->>A: Zod: patrón + parsePercentageToBasisPoints → 2 500 bp ∈ (0, 10 000]
    A->>CUC: execute({ accountId, percentageBasisPoints, currentMonth })
    CUC->>PortRI: findByAccountId (dependencia FR-006)
    PortRI-->>CUC: ingreso regular activo (importe)
    CUC->>Dom: ContributionPercentage.fromBasisPoints + appliedToCents ≥ 1 céntimo
    CUC->>PortCC: save(CommonContribution.create — nace Activa, activatedAtMonth = mes en curso)
    A-->>Dlg: success + revalidatePath("/", "layout")
    Dlg-->>U: toast «Aportación guardada» y cierre

    U->>AP: consulta el mes en curso de su cuenta
    AP->>AP: MaterializeRegularIncomes (018, intacto)
    AP->>MUC: ensureForAccountAndMonth(accountId, mes, mesEnCurso)
    MUC->>PortCC: findByAccountId → activa; !isMaterialized(mes)
    MUC->>PortRI: ingreso regular existe y activo (base al momento de generar)
    MUC->>MUC: percentage.appliedToCents(incomeCents) — floor((cents×bp+5 000)/10 000) half-up
    MUC->>MUC: ensure etiqueta por slug «aportacion-comun» (crea si falta)
    MUC->>Mov: create expense / nature personal / día 1 / nota «Aportación común de {miembro}»
    MUC->>PortCC: registerMaterialization — tx: registro (config, mes) ON CONFLICT DO NOTHING + movimiento
    Note over PortCC: si otro render ganó la carrera: sin fila → no inserta movimiento (idempotente)
    AP->>AP: Promise.all(listado, balance, cierre) — lecturas ven el movimiento
    AP-->>U: listado del mes con el gasto −500,00 € con etiqueta «Aportación Común», exactamente 1 vez
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |

**Decisiones de diseño destacadas (sin violación, registradas para `/speckit.tasks`)**:

- **Porcentaje en puntos base + half-up entero** en el VO `ContributionPercentage` — sin flotantes ni `Math.round`; tabla de casos congelada (research §1, data-model §1.1).
- **Agregado y casos de uso espejo de 018**, sin extender `RegularIncome` ni materializador combinado (research §2–§3).
- **Ingreso regular inactivo o ausente ⇒ no-op** en la materialización (sin base estable) y `MissingRegularIncomeError` al configurar; el ítem de menú queda deshabilitado con «Requiere ingreso regular» (research §2/§6, FR-006).
- **Etiqueta garantizada por triple vía** (seed + dato en migración 0004 + ensure por slug en cada generación) para sobrevivir al mantenimiento futuro del catálogo (research §4).
- **Guarda de céntimo 0**: rechazo al configurar con literal propio; no-op sin registrar al materializar (research §7).
- **Toast de desactivación**: «Aportación desactivada» (concuerda en género; ui-contract §3).
- **E2E en Cuenta de Miembro B + mes en curso con limpieza final obligatoria**: el fichero corre primero alfabéticamente sobre la BD compartida y la desactivación de ambas configs evita re-materializaciones de specs posteriores (research §8).
- **ADR 0017** registra puntos base, half-up, el segundo materializador perezoso y el ensure de etiqueta; AGENTS.md generaliza la convención de materialización y el roadmap se amendmenta (FR-008) al cerrar la feature (research §9).

## Constitution Check (post-diseño, Phase 1)

Re-evaluación tras generar `research.md`, `data-model.md`, `contracts/ui-contract.md` y `quickstart.md`:

| # | Principio | Estado post-diseño | Notas |
|---|-----------|--------------------|-------|
| I | Simplicidad Primero | ✅ PASS | El diseño no añade proyectos, paquetes ni abstracciones: duplica el patrón verificado de 018 con módulo propio (más simple que generalizar). Complejidad tracked: (ninguna). |
| II | Spec-Driven Development | ✅ PASS | FR-001→data-model §1/§3; FR-002→§1.2.1/§2.2; FR-003→research §5 + ui-contract §4; FR-004→§1.5; FR-005→guardas; FR-006→research §2/§6; FR-007→ui-contract §1–§2; FR-008→estructura (roadmap); FR-009→research §8 + quickstart gates. Una US (II, sin excepción). |
| III | Calidad Verificada | ✅ PASS | Matriz de tests por capa en research §8 (dominio con tabla half-up, aplicación con idempotencia/solo-adelante, action, componentes, repos tx) + e2e crítico con aislamiento y limpieza; quickstart «Gates automáticos» cierra SC-005. |
| IV | TypeScript Estricto + Zod | ✅ PASS | Discriminated union de estado de la action espejo de 018; VO y entidad validan en runtime; sin `any`; parse por cadenas (ui-contract §5). |
| V | Persistencia SQLite con Drizzle | ✅ PASS | `0004_aportacion-comun.sql` única vía de evolución (tablas + índice único + `INSERT OR IGNORE` idempotente del dato); idempotencia en BD, no en memoria (data-model §2). |
| VI | Producto en español, código en inglés | ✅ PASS | Literales UI/toasts/errores congelados en español (ui-contract §1–§4); código en inglés con glosario ES↔EN completo (data-model §5); diagramas y artefactos en español. |
| VII | Arquitectura Hexagonal + DDD Táctico | ✅ PASS | Dominio `common-contribution` puro (VO + entidad + errores, sin deps); puertos en aplicación (uno nuevo, tres consumidos intactos); acciones/UI/página = adaptadores inbound finos; repositorio Drizzle = outbound; diagrama de componentes con dependencias hacia el dominio; sin eventos/CQRS nuevos (ADR 0017 no introduce patrón, registra decisiones). |

**Resultado**: diseño aprobado; sin desviaciones que justificar. El plan queda listo para `/speckit.tasks`.
