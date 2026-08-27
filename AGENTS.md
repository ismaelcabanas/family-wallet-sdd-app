# AGENTS.md — Guía para agentes de IA (Family Wallet)

Webapp familiar para gestionar gastos e ingresos: 3 cuentas (2 personales + 1 común), movimientos con naturaleza propio/común y tags múltiples. Producto en español, uso individual sin login.

## Reglas de oro (leer antes de actuar)

1. **Lee siempre `.specify/memory/constitution.md`**: es la ley del proyecto; todo plan la valida (Constitution Check).
2. **Nada de código de funcionalidad sin spec → plan → tasks aprobados** (flujo Spec Kit). Los fixes triviales (typos, lint) están exentos.
3. **Antes de dar por terminado cualquier cambio de código**: ejecuta `npm run lint`, `npm run typecheck` y `npm run test` y verifica que están en verde.
4. **Nunca hagas commit/push sin petición explícita del usuario.**

## Stack (decisiones fijadas en constitución v1.0.0)

| Área | Decisión |
|------|----------|
| Arquitectura | Monolito Next.js (App Router), TypeScript estricto |
| Arquitectura interna | Hexagonal + DDD táctico (constitución, principio VII): dominio y aplicación puros, UI/API/persistencia como adaptadores |
| Persistencia | Drizzle ORM + SQLite (fichero en dev) / Turso libSQL (prod) |
| Validación | Zod en fronteras (API, formularios) |
| Tests | Vitest + Testing Library |
| Calidad | ESLint + Prettier |
| CI | GitHub Actions: lint + typecheck + tests en cada push |
| Despliegue | Local (`npm run dev`) y Vercel + Turso (plan gratuito, sin estado en serverless) |

## Flujo de trabajo Spec Kit

El proyecto sigue desarrollo dirigido por especificaciones. Comandos (en este orden):

```
/speckit.specify    # crea specs/NNN-<short-name>/spec.md (actualiza .specify/feature.json)
/speckit.clarify    # resuelve dudas de la spec (opcional)
/speckit.plan       # genera plan.md, research.md, data-model.md, contracts/, quickstart.md
/speckit.tasks      # genera tasks.md a partir del plan
/speckit.implement  # ejecuta las tareas
```

- El directorio de feature activo se resuelve desde `.specify/feature.json`.
- `specs/001-family-wallet/` es el **roadmap maestro**: NO se implementa directamente; las features hijas (`002-...`, `003-...`) desarrollan sus historias.
- Cada `/speckit.plan` valida contra la constitución y justifica desviaciones en Complexity Tracking.

## Estructura del repositorio

```
specs/                    # especificaciones por feature (NNN-secuenciales)
  001-family-wallet/      # roadmap maestro (spec + checklists)
.specify/                 # configuración Spec Kit, plantillas, scripts
  memory/constitution.md  # constitución del proyecto (leer siempre)
AGENTS.md                 # este archivo
```

El scaffold de la aplicación Next.js se creará como primer trabajo de la feature `002-registro-movimientos`; hasta entonces no existe `package.json` ni código fuente.

## Referencias

- [CodelyTV/typescript-ddd-example](https://github.com/CodelyTV/typescript-ddd-example): referencia de estilo para hexagonal + DDD táctico (organización de capas y patrones). NO copiar su stack (MongoDB, RabbitMQ), CQRS ni EDA sin justificación en el plan (constitución, principio VII).

## Convenciones

- **Idioma**: UI, specs y documentación en español; identificadores de código en inglés (excepto términos de dominio intraducibles, documentados en el glosario del data-model).
- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- **Moneda**: EUR con 2 decimales; los cálculos monetarios evitan aritmética de coma flotante directa.
- **Comentarios**: no se añaden comentarios salvo petición explícita; el código se explica por sí mismo y la intención vive en specs/plan.
