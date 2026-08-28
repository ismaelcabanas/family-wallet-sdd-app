# Family Wallet

Webapp familiar para gestionar los gastos e ingresos de una unidad familiar: 3 cuentas (2 personales + 1 común), movimientos con naturaleza propio/común y clasificación flexible mediante múltiples tags. Sustituye el registro manual actual basado en hojas Excel.

## Funcionalidad prevista

- **Registro de gastos e ingresos** con fecha, concepto, descripción, importe, cuenta, naturaleza (propio/común) y múltiples tags
- **Cierre mensual por cuenta**: ingresos, gastos comunes y personales, saldo y balance acumulado, con desglose por tag
- **Análisis agregado**: resumen global familiar, cuadre mensual (ingresos − gastos = variación de saldo) y cuenta de resultados anual
- **Gestión del catálogo de tags**: crear, renombrar, fusionar y desactivar, partiendo de las categorías históricas del Excel

Ámbito diferido a fases futuras: multiusuario con regla de reparto de gastos comunes, transferencias entre cuentas, seguimiento del ahorro, importación de histórico desde Excel.

## Estado

En fase de especificación (Spec Kit). La roadmap maestra está aprobada (`specs/001-family-wallet/spec.md`) y la primera feature de implementación será `002-registro-movimientos`. Aún no existe `package.json` ni código fuente: el scaffold de Next.js se creará como primer trabajo de dicha feature.

## Stack

| Área | Decisión |
|------|----------|
| Arquitectura | Monolito Next.js (App Router), TypeScript estricto |
| Arquitectura interna | Hexagonal + DDD táctico: dominio y aplicación puros; UI, API y persistencia como adaptadores |
| Persistencia | Drizzle ORM + SQLite (fichero en dev) / Turso libSQL (prod) |
| Validación | Zod en fronteras (API, formularios) |
| Tests | Vitest + Testing Library |
| Calidad | ESLint + Prettier · CI en GitHub Actions (lint + typecheck + tests) |
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
specs/                    # especificaciones por feature (NNN-secuenciales)
  001-family-wallet/      # roadmap maestro (spec + checklists)
.specify/                 # configuración Spec Kit, plantillas, scripts
  memory/constitution.md  # constitución del proyecto
docs/
  architecture/           # documentación de arquitectura (overview, ADRs)
AGENTS.md                 # guía para agentes de IA
README.md                 # este archivo
```

## Mapa de documentación

| Documento | Audiencia | Propósito |
|-----------|-----------|-----------|
| `README.md` | Personas | Visión general del proyecto y punto de entrada |
| `AGENTS.md` | Agentes de IA | Reglas operativas, flujo de trabajo y convenciones |
| `.specify/memory/constitution.md` | Todos | Ley del proyecto: principios, stack y gates que todo plan valida |
| `docs/architecture/overview.md` | Desarrolladores | Detalle de capas hexagonales, matriz de dependencias y patrones |
| `specs/` | Todos | Especificaciones y artefactos por feature |

## Puesta en marcha

Pendiente hasta completar la feature `002-registro-movimientos` (scaffold de Next.js). Una vez exista:

```bash
npm install
npm run dev     # desarrollo con SQLite local
npm run lint && npm run typecheck && npm run test
```

Despliegue en Vercel + Turso siguiendo la configuración descrita en la constitución.
