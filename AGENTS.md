# AGENTS.md — Guía para agentes de IA (Family Wallet)

Webapp familiar para gestionar gastos e ingresos: 3 cuentas (2 personales + 1 común), movimientos con naturaleza propio/común y tags múltiples. Producto en español, uso individual sin login.

## Reglas de oro (leer antes de actuar)

1. **Lee siempre `.specify/memory/constitution.md`**: es la ley del proyecto; todo plan la valida (Constitution Check).
2. **Nada de código de funcionalidad sin spec → plan → tasks aprobados** (flujo Spec Kit). Los fixes triviales (typos, lint) están exentos.
3. **Antes de dar por terminado cualquier cambio de código**: ejecuta `npm run lint`, `npm run typecheck` y `npm run test` y verifica que están en verde.
4. **Respetar estrictamente la dirección de dependencias**: Dominio → Aplicación → Adaptadores. El dominio NUNCA importa nada de Next.js, Drizzle, Zod o la UI.
5. **Nunca hagas commit/push sin petición explícita del usuario** (excepción: los hooks de auto-commit de Spec Kit habilitados por el propietario; ver «Flujo de trabajo Spec Kit»).
6. **Mantenimiento de documentación**: si fijas o descubres una convención del proyecto que no está documentada, actualiza `AGENTS.md` (y `docs/` si aplica) en el mismo cambio. Las decisiones arquitectónicas nuevas se registran como ADR en `docs/architecture/adr/`.

## Stack (decisiones fijadas en constitución v1.1.1)

| Área | Decisión |
|------|----------|
| Arquitectura | Monolito Next.js (App Router), TypeScript estricto |
| Arquitectura interna | Hexagonal + DDD táctico: dominio y aplicación puros, UI/API/persistencia como adaptadores |
| Persistencia | Drizzle ORM + SQLite (fichero en dev) / Turso libSQL (prod) |
| Validación | Zod en fronteras (API, formularios) |
| UI | Tailwind CSS + shadcn/ui (componentes copiados y versionados en el repo; sin otras librerías de componentes salvo justificación en el plan) |
| Tests | Vitest + Testing Library; Playwright para e2e de flujos críticos |
| Calidad | ESLint + Prettier |
| CI | GitHub Actions: lint + typecheck + tests en cada push |
| Despliegue | Local (`npm run dev`) y Vercel + Turso (plan gratuito, sin estado en serverless) |

## Arquitectura Interna & Reglas Hexagonales (Invariantes)

El proyecto sigue una arquitectura **Hexagonal (Ports & Adapters)**. Para mantener las capas desacopladas, debes cumplir estas reglas en la generación de código:

- **Dominio (`src/domain/`)**:
  - Contiene Entidades, Value Objects, Excepciones de Dominio y Eventos de dominio (solo cuando estén justificados en el plan).
  - **Cero dependencias externas**: Prohibido importar frameworks (Next.js, React), ORMs (Drizzle) o librerías de infraestructura.
- **Aplicación (`src/application/`)**:
  - Contiene Casos de Uso y **Puertos** (Interfaces de Entrada/Salida).
  - Orquesta la lógica del dominio. Depende únicamente de la capa de `domain`.
- **Adaptadores (`src/infrastructure/` y `src/app/`)**:
  - **Entrada (Inbound)**: Route Handlers y páginas de Next.js en `src/app/` (único directorio que Next.js rutea; adaptadores finos que validan y delegan), Server Actions y componentes UI en `src/infrastructure/primary/`.
  - **Salida (Outbound)**: Repositorios Drizzle, clientes de base de datos, servicios externos.
  - Implementan los puertos definidos en la capa de aplicación.

> **Progressive Disclosure**: Si necesitas crear o refactorizar código de una capa o módulo complejo, consulta la guía de arquitectura detallada y diagramas en `docs/architecture/overview.md` (si existe; si no, la spec del Spec Kit activa es la fuente de verdad).

## Flujo de trabajo Spec Kit

El proyecto sigue desarrollo dirigido por especificaciones. Comandos (en este orden):

```
/speckit.specify    # crea specs/NNN-<short-name>/spec.md (actualiza .specify/feature.json)
/speckit.clarify    # resuelve dudas de la spec (opcional)
/speckit.plan       # genera plan.md, research.md, data-model.md, contracts/, quickstart.md
/speckit.tasks      # genera tasks.md a partir del plan
/speckit.implement  # ejecuta las tareas
/speckit.finish     # cierra el ciclo: mergea la PR (rebase), borra ramas y desactiva la feature
```

- El directorio de feature activo se resuelve desde `.specify/feature.json`.
- **Auto-commits por fase**: los hooks de la extensión git (`before_*`/`after_*` → `speckit.git.commit` en `.specify/extensions.yml`) están habilitados como automáticos; commitean los artefactos de cada fase con mensaje Conventional Commit generado al efecto (`commit_style: conventional` en `.specify/extensions/git/git-config.yml`).
- **PR automática tras implementar**: el hook `after_implement` de la extensión `pr` (`.specify/extensions/pr/`, prioridad 20 — corre tras el auto-commit) hace `git push -u origin feature/NNN-…` y crea con `gh` una PR a `main` (título `feat: <título de la spec>` — Conventional Commit, cuerpo con el Summary de la spec y enlaces a spec/plan/tasks). Es idempotente (si ya existe la PR, muestra su URL) y degrada sin error si no hay rama feature, remote, `gh` o autenticación.
- **Cierre de feature (`/speckit.finish`, extensión `finish`)**: tras revisar la PR, cierra el ciclo con `gh pr merge --rebase --delete-branch`. Guardas: PR abierta, CI verde (`gh pr checks`, una PR sin checks continúa con aviso), fila de la feature marcada «Completada» en el roadmap maestro, árbol limpio y rama sincronizada con su upstream. Después: borra rama local y remota, limpia `.specify/feature.json` (a `{}`, dejando la siguiente feature arrancar limpio) y lo commitea/pushea en `main` como `chore(NNN)`. Aborta con error claro si cualquier guarda falla; nunca fuerza el merge.
- `specs/001-family-wallet/` es el **roadmap maestro**: NO se implementa directamente; las features hijas (`002-...`, `003-...`) desarrollan sus historias.
- Cada `/speckit.plan` valida contra la constitución y justifica desviaciones en Complexity Tracking.
- **Granularidad** (constitución II, v1.2.1): una feature hija comprende por defecto una única US pequeña que entrega valor por sí sola; si una spec termina agrupando varias USs con valor independiente, se divide en features separadas. Agrupar historias en una misma spec es una excepción que decide y justifica el propietario (p. ej. 003: edición y eliminación comparten formulario y recorrido UI).
- **Diagramas de diseño en el plan**: cada `/speckit.plan` incluye diagramas mermaid del diseño congelado: clases del modelo en `data-model.md` (sección «Diagrama de clases»), y componentes por capa + secuencia del happy path en `plan.md` (sección «Diagramas de diseño», definida en la plantilla `.specify/templates/plan-template.md`). Son la foto del diseño de la feature; `docs/architecture/diagrams/` sigue siendo la documentación viva que la implementación extiende reutilizándolos como base.

## Estructura del repositorio

```
src/
  domain/                  # núcleo puro: entidades, VOs, errores (sin deps externas)
  application/             # casos de uso y puertos (interfaces in/out)
  app/                     # adaptador inbound fino (page.tsx, layout.tsx, globals.css)
  infrastructure/
    db/                    # adaptador outbound: schema Drizzle, migraciones, repositorios, seed
    primary/               # adaptador inbound: Server Actions (actions/) y UI (ui/, shadcn en ui/components/ui/)
e2e/                       # Playwright (flujo crítico)
scripts/seed.ts            # seed idempotente (tsx)
drizzle/                   # migraciones SQL versionadas (committed)
specs/                     # especificaciones por feature (NNN-secuenciales)
  001-family-wallet/       # roadmap maestro (spec + checklists)
.specify/                  # configuración Spec Kit, plantillas, scripts
  memory/constitution.md   # constitución del proyecto (leer siempre)
docs/
  architecture/            # overview, ADRs y diagramas (C4, secuencia, dominio)
AGENTS.md                  # este archivo
```

## Referencias

- [CodelyTV/typescript-ddd-example](https://github.com/CodelyTV/typescript-ddd-example): referencia de estilo para hexagonal + DDD táctico (organización de capas y patrones). NO copiar su stack (MongoDB, RabbitMQ), CQRS ni EDA sin justificación en el plan (constitución, principio VII).

## Convenciones

- **Idioma**: UI, specs y documentación en español; identificadores de código en inglés (excepto términos de dominio intraducibles, documentados en el glosario del data-model).
- **Ramas**: las features se desarrollan en ramas `feature/NNN-<short-name>` (p. ej. `feature/005-cierre-mensual`), creadas por la extensión git de Spec Kit (`branch_template` en `.specify/extensions/git/git-config.yml`) con el número de la spec a la que corresponden; se integran en `main` tras completar el ciclo.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- **Moneda**: EUR con 2 decimales como céntimos enteros (VO `Money`, ADR 0007); los cálculos monetarios evitan aritmética de coma flotante directa. El formateo `Intl es-ES` vive solo en `src/infrastructure/primary/ui/format.ts`.
- **Tests**: co-localizados junto a su SUT (`*.test.ts(x)`); Vitest con `test.projects` (`node` para dominio/aplicación/infra/actions, `ui` jsdom para componentes). Las Server Actions se mockean con `vi.mock`; los repositorios se prueban contra libsql `:memory:` con las migraciones de `drizzle/`.
- **E2E**: Playwright contra `build + start` con BD aislada determinista (`e2e.sqlite`, recreada por `pretest:e2e`); specs en serie dentro de cada fichero porque comparten estado de BD; además, cada spec debe operar en una combinación cuenta/mes propia para no colisionar con los demás specs, y `workers: 1` fuerza el orden alfabético de ficheros sobre la misma BD — necesario porque algunas specs asertan el balance histórico absoluto de una cuenta (p. ej. `registro-movimientos`), que cualquier movimiento en otro mes contaminaría si otro fichero corriera antes o en paralelo.
- **Diálogos por fila**: los diálogos de acciones de fila (editar/eliminar) se montan a nivel del componente listado (`grouped-movement-list.tsx`) con el DTO capturado en estado del cliente, nunca dentro de la propia fila; tras `revalidatePath` la fila puede desaparecer del árbol y un diálogo anclado a ella perdería el estado de `useActionState` (toast y cierre nunca llegarían). El estado vacío del listado también se renderiza dentro del propio `grouped-movement-list.tsx` (client), nunca como swap condicional en `page.tsx`: vaciar la vista (p. ej. eliminar el último movimiento visible) desmontaría el listado y con él el diálogo activo. Aplica igual a la vista de administración de etiquetas (`tag-catalog.tsx`, 004): menú ⋮ por fila, diálogos de renombrado/fusión/desactivación a nivel del listado y «Reactivar» como action directa + `useTransition` con toast (familia ADR 0015).
- **Inputs de formulario en diálogos con `useActionState`**: controlados con `useState`, nunca `defaultValue` (patrón `rename-tag-dialog.tsx`, 004). React 19 restablece los inputs **no controlados** al resolverse la action del `<form>`, de modo que un error de dominio (estado `{ status: "error" }`) borraría el valor tecleado por el usuario; el controlado lo conserva (SC-004) y el error se muestra con `role="alert"` + `aria-describedby`.
- **Tarjetas lanzaderas con menú de configuración (020)**: las tarjetas del panel de cuentas (`account-card-grid.tsx`, client) usan el patrón **stretched-link**: `div.relative` con los estilos de tarjeta + `<Link>` que envuelve nombre+etiqueta y se estira con `after:absolute after:inset-0`; el trigger ⋮ (≥ 44 px, `relative z-10`, `aria-label="Configuración de {nombre}"`) queda por encima — el clic en ⋮ nunca navega y el resto de la tarjeta sí, con HTML válido (un `<button>` nunca dentro del `<a>`; el contenido del menú abre en portal de Radix). El menú solo se renderiza donde hay opciones aplicables (hoy: cuentas personales; el ítem «Ingreso regular» deriva su estado de la función pura `regularIncomeMenuStatus` sobre el prop `regularIncomes` que `/` lee en servidor). El diálogo se monta condicionalmente **dentro de la tarjeta** — excepción consciente y documentada de «diálogos por fila»: las tarjetas son catálogo estable (no desaparecen tras `revalidatePath`), así que el estado de `useActionState` no se pierde; cada apertura es una instancia fresca (patrón 014/018).
- **Captación continua (tanda)**: los diálogos de alta continua remontan el **componente de formulario completo** (incluida su instancia de `useActionState`) con `key={savedCount}` desde el padre, nunca el `<form>` interno suelto: el remonte interno pierde el binding de la action prop en el envío siguiente. Los valores estables viajan como `carry` (`{ date, type, nature }`) en estado del padre y se aplican como `defaultValue`/estado inicial del remonte; los variables (nota/importe/tag) nacen vacíos y el foco se programa en el primer campo vacío tras el remonte. El `intent` (`continue|close`) viaja en botones submit HTML (`name="intent"`) y vuelve en el estado de la action; el efecto de éxito se blinda contra re-ejecuciones re-montando el guardado (flag/reset por envío). Patrón fijado por 014 (`create-movement-dialog.tsx`).
- **Captación inline de subentidades (junto a un control del formulario)**: cuando un formulario necesita crear una entidad menor en caliente (p. ej. una etiqueta junto al Select «Etiqueta», patrón «+ Nueva etiqueta» de 017), se usa **action directa + `useTransition`** —sin `<form>` anidado (HTML inválido) ni `useActionState`— porque el valor ya vive en estado local y la action devuelve un **resultado** (`{ ok, tag | message }`), no un estado de formulario: es una consulta, no un envío. El botón que dispara es `type="button"`; Enter en el input se intercepta (`preventDefault`) para no enviar el formulario padre; Escape cancela la captación sin cerrar el diálogo (`data-tag-creation-input` en el input + `onEscapeKeyDown` que hace `preventDefault` en el `DialogContent` cuando el foco está ahí). La disponibilidad inmediata se garantiza con estado `extraTags` **a nivel de diálogo** (padre del remonte `key={savedCount}` de la tanda, igual que `savedCount`/`carry`) + `revalidatePath("/", "layout")` en la action. Excepción documentada al patrón «toda action con `useActionState`» (ADR 0015).
- **Materialización perezosa (ingresos regulares y aportaciones comunes)**: la página de cuenta (`src/app/accounts/[accountId]/page.tsx`) invoca `MaterializeRegularIncomes.ensureForAccountAndMonth` y, a continuación, `MaterializeCommonContributions.ensureForAccountAndMonth` **antes** de leer (dos awaits secuenciales antes del `Promise.all`: cubren listado, cierre y balance del mismo render); son el **único disparador** de la materialización — los agregados (`/summary`, `/annual`) y los repositorios/use cases de lectura nunca materializan (decisión del propietario 2026-10-12; ADR 0016/0017). La idempotencia vive en el registro de meses de cada agregado (`regular_income_months` / `common_contribution_months`, `UNIQUE (config, mes)` + `ON CONFLICT DO NOTHING` en la misma tx que el movimiento), **nunca** en la existencia del movimiento: así el borrado del movimiento generado es definitivo y las ediciones de config son solo-adelante. `currentMonth` entra como parámetro calculado por el adaptador (`ui/format.ts`), sin puerto Clock.
- **Aportación neta y re-sincronización del mes en curso (021, ADR 0019)**: desde 021 la aportación mensual es un importe **neto** — `ContributionPercentage.netAppliedToCents(ingreso, Σ gastos)` = `max(0, bruto − gastos comunes del mes en la cuenta personal)` — y el materializador de aportaciones **re-sincroniza el mes en curso en la misma lectura** (`ensureForAccountAndMonth`: guardas §1.2.1 de la spec): altas/ediciones/eliminaciones de gastos `nature = "shared"` ajustan el importe del movimiento enlazado vía `movements.update(Movement.recreate(...))` al consultar, sin hooks en el CRUD (las actions ya revalidan la página). El alcance del descuento vive sellado en `MovementRepository.sumSharedExpenseCents` (SUM SQL por cuenta + mes). La fila del registro es dueña del **enlace blando** `movement_id` (migración `0005`, sin FK; filas legacy se resuelven perezosamente por heurística acotada en el repositorio): **retirada** (neto 0) borra movimiento **y fila** (`withdrawMaterialization`; la generación queda reabierta y la aportación reaparece si los gastos bajan), mientras que el **borrado del usuario** deja la fila sin movimiento → no-op definitivo. La guarda `config.active` solo aplica a la generación: desactivar a mitad de mes no congela el ajuste del mes en curso (clarify 2026-10-18). Meses cerrados (`month !== currentMonth`) quedan congelados.
- **Bloque KPIs sticky en cuentas personales (022, amendado por 023)**: primer uso de `position: sticky` del repo — `AccountMonthKpis` (`account-month-kpis.tsx`) es un **server component presentacional puro** (sin JS, sin estado cliente, sin selector dentro) con `sticky top-0 z-20` y fondo sangrado `-mx-4 px-4 sm:-mx-6 sm:px-6` (cubre el padding de `main`) + tarjeta interior `rounded-lg border bg-card p-4`; se monta como hijo directo de `<main>` solo en cuentas **personales**, entre `MonthStepper` y `GroupedMovementList`, con etiqueta pasiva `monthLabel(month)`. Desde 023 el `dl` tiene **3 métricas** en orden congelado («Aportación común» · «Ahorro del mes» · «Saldo del mes», `grid grid-cols-3 gap-3`). La fuente de datos es **exclusivamente casos de uso**: la aportación neta llega de `GetMonthNetContribution` (DTO `{configured, amountCents}` sobre los puertos de 019/021, importe = movimiento enlazado, **nunca recálculo**), el ahorro de `GetMonthSavings` (DTO espejo, importe = fila del registro de deducciones, **nunca recálculo**) y el saldo del mes es **neto del ahorro**: la página de cuenta compone **una única resta** `netMonthBalanceCents = closure.monthBalanceCents − savings.amountCents` y se la pasa calculada (la UI jamás recalcula ni resta — constitución VII; KPI y cierre coherentes por construcción, difieren exactamente en el importe deducido).
- **Apartado informativo con registro de meses congelado, sin movimiento (023)**: variante del patrón de materialización perezosa de 018/019 (ADR 0016/0017) para cantidades **informativas que no son movimientos** (hoy: el ahorro por miembro). La idempotencia y el congelado viven en una tabla registro propia (`savings_allocation_months`, `UNIQUE (config, mes)` + `ON CONFLICT DO NOTHING RETURNING` en tx de **un solo INSERT**) que **congela el importe** (`amount_cents`) en el momento de registrar: el KPI lee esa fila (`GetMonthSavings`), **nunca** recalcula, y no existe borrado del mes. **Sin re-sync del mes en curso** (diferencia deliberada con 021): la base es plana sobre configs (porcentaje sobre el ingreso bruto regular), así que un mes ya consultado jamás cambia por consultas posteriores; la reactivación resetea `activatedAtMonth` y el hueco inactivo no se deduce. La guardia de configuración consulta **existencia** de ingreso regular (paridad 019); el requisito de **activo** aplica solo al deducir (no-op sin registrar el mes si falta — mes abierto). `MaterializeSavingsAllocations.ensureForAccountAndMonth` es el **tercer await secuencial** de la página de cuenta (tras 018/019, antes del `Promise.all`) y **nunca** toca `movements` ni computa en agregados (cierre/resumen/anual/balance intactos).
- **BD**: `db.sqlite` en dev; la URL se puede sobreescribir con `DATABASE_URL` (así funcionan los e2e). Migraciones solo por script (`npm run db:migrate`), nunca en runtime serverless; en producción (Turso) se ejecutan desde local como paso pre-deploy con `drizzle.prod.config.ts` y `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`.
- **Seed**: idempotente (`onConflictDoNothing` sobre claves naturales); datos editables en `src/infrastructure/db/seed-data.ts`.
- **Comentarios**: no se añaden comentarios salvo petición explícita; el código se explica por sí mismo y la intención vive en specs/plan.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
