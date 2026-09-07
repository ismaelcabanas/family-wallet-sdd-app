# Family Wallet

Webapp familiar para gestionar los gastos e ingresos de una unidad familiar: 3 cuentas (2 personales + 1 común), movimientos con naturaleza personal/compartido y clasificación flexible mediante múltiples tags. Sustituye el registro manual actual basado en hojas Excel.

## Funcionalidad implementada

- **Registro de movimientos** (feature `002-registro-movimientos`): gastos e ingresos con fecha, concepto, descripción opcional, importe (aritmética exacta en céntimos), cuenta, naturaleza (solo gastos: personal/compartido) y 0..n tags del catálogo (sin selección → tag por defecto «Sin Clasificar»)
- **Pantalla principal** (`/`): selectores de cuenta y mes (estado en la URL), balance acumulado por cuenta, formulario siempre visible con validación por campo y listado mensual ordenado por fecha descendente
- **Datos preconfigurados**: 2 miembros, 3 cuentas y 12 tags precargadas por seed idempotente

Ámbito diferido a features futuras (ver `specs/001-family-wallet/`): cierre mensual, análisis agregado, gestión del catálogo de tags, edición/eliminación de movimientos.

## Estado

Feature `002-registro-movimientos` implementada. El desarrollo continúa por especificaciones (Spec Kit); la roadmap maestra está en `specs/001-family-wallet/spec.md`.

## Stack

| Área | Decisión |
|------|----------|
| Arquitectura | Monolito Next.js (App Router), TypeScript estricto |
| Arquitectura interna | Hexagonal + DDD táctico: dominio y aplicación puros; UI, Server Actions y persistencia como adaptadores |
| Persistencia | Drizzle ORM + SQLite (fichero en dev) / Turso libSQL (prod) |
| Validación | Zod en fronteras (Server Actions, searchParams) |
| UI | Tailwind CSS + shadcn/ui (componentes copiados y versionados en el repo) |
| Tests | Vitest + Testing Library · Playwright e2e del flujo crítico |
| Calidad | ESLint + Prettier · CI en GitHub Actions (lint + typecheck + tests + e2e) |
| Despliegue | Local (`npm run dev`) y Vercel + Turso (plan gratuito, sin estado en serverless) |

Detalle completo y justificación en `.specify/memory/constitution.md`.

## Desarrollo dirigido por especificaciones

El proyecto sigue el flujo Spec Kit, donde toda funcionalidad nace de una especificación:

```
/speckit.specify → /speckit.clarify → /speckit.plan → /speckit.tasks → /speckit.implement
```

- `specs/001-family-wallet/` es la **roadmap maestro**: define visión e historias priorizadas; no se implementa directamente
- Las features hijas (`002-...`, `003-...`, ...) desarrollan cada slice con ciclo completo e independiente
- Todo plan valida contra la constitución del proyecto (Constitution Check)

## Estructura del repositorio

```
src/
  domain/                  # núcleo puro: entidades, VOs (Money), errores de dominio
  application/             # casos de uso y puertos (interfaces de entrada/salida)
  app/                     # adaptador inbound fino (solo lo que Next.js rutea: page.tsx, layout.tsx)
  infrastructure/
    db/                    # adaptador outbound: esquema Drizzle, migraciones, repositorios, seed
    primary/               # adaptador inbound: Server Actions y componentes UI
e2e/                       # Playwright (flujo crítico de registro)
scripts/                   # seed idempotente (tsx)
drizzle/                   # migraciones SQL versionadas
specs/                     # especificaciones por feature (NNN-secuenciales)
docs/architecture/         # overview, ADRs y diagramas (C4, secuencia, dominio)
```

## Puesta en marcha

```bash
npm install            # dependencias
npm run db:migrate     # aplica las migraciones versionadas (crea SQLite local)
npm run db:seed        # precarga 2 miembros, 3 cuentas y 12 tags (idempotente)
npm run dev            # http://localhost:3000
```

Gates de calidad:

```bash
npm run lint           # ESLint en verde
npm run typecheck      # tsc --noEmit en verde
npm run test           # Vitest (dominio, aplicación, infraestructura, UI) en verde
npm run test:e2e       # Playwright: flujo crítico de registro (levanta build+start con BD aislada e2e.sqlite)
```

Otros comandos: `npm run format` (Prettier), `npm run build` / `npm run start`.

### Producción (Turso + Vercel)

Migración y seed como paso local pre-deploy (sin secretos en CI):

```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:migrate -- --config=drizzle.prod.config.ts
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:seed
```

Después, deploy a Vercel con las mismas variables de entorno configuradas.

## Mapa de documentación

| Documento | Audiencia | Propósito |
|-----------|-----------|-----------|
| `README.md` | Personas | Visión general del proyecto y punto de entrada |
| `AGENTS.md` | Agentes de IA | Reglas operativas, flujo de trabajo y convenciones |
| `.specify/memory/constitution.md` | Todos | Ley del proyecto: principios, stack y gates que todo plan valida |
| `docs/architecture/overview.md` | Desarrolladores | Detalle de capas hexagonales, matriz de dependencias y patrones |
| `docs/architecture/adr/` | Desarrolladores | Decisiones arquitectónicas registradas (ADRs) |
| `docs/architecture/diagrams/` | Desarrolladores | Diagramas C4, secuencia del flujo crítico y modelo de dominio |
| `specs/` | Todos | Especificaciones y artefactos por feature |
