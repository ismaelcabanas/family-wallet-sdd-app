<!--
Sync Impact Report
- Version change: (nueva) → 1.0.0
- Modified principles: n/a (ratificación inicial; placeholders de la plantilla sustituidos)
- Added sections: Core Principles I–VI, Restricciones Tecnológicas y de Despliegue, Flujo de Desarrollo y Gates de Calidad, Gobernanza
- Removed sections: ninguno
- Follow-up TODOs: ninguno

Sync Impact Report (v1.1.0, 2026-08-27)
- Version change: 1.0.0 → 1.1.0 (MINOR: nuevo principio)
- Modified principles: ninguno renombrado
- Added sections: Principio VII (Arquitectura Hexagonal + DDD Táctico); bullet de arquitectura interna en Restricciones Tecnológicas
- Removed sections: ninguno
- Follow-up TODOs: ninguno

Sync Impact Report (v1.1.1, 2026-08-27)
- Version change: 1.1.0 → 1.1.1 (PATCH: clarificación, referencia de estilo añadida)
- Modified principles: VII (añadida referencia CodelyTV/typescript-ddd-example como referencia de estilo, no de stack)
- Added sections: ninguno
- Removed sections: ninguno
- Follow-up TODOs: ninguno
-->

# Family Wallet Constitution

## Core Principles

### I. Simplicidad Primero
Family Wallet es una aplicación familiar de uso individual. TODO el software MUST mantenerse como un monolito único: un solo proyecto Next.js, sin microservicios, sin librerías internas organizativas ni abstracciones prematuras (YAGNI). Cualquier propuesta de nuevo proyecto, paquete o capa de indirección MUST justificarse en el Complexity Tracking del plan. Rationale: el valor está en el producto, no en la arquitectura; un monolito es auditable y mantenible por una sola persona.

### II. Spec-Driven Development (NO NEGOCIABLE)
Toda funcionalidad MUST nacer de una especificación escrita siguiendo el flujo Spec Kit (`/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`). El roadmap maestro (`specs/001-family-wallet/spec.md`) define la visión; las features hijas (numeradas secuencialmente bajo `specs/`) desarrollan cada slice con ciclo completo e independiente. Está PROHIBIDO implementar código de funcionalidad sin spec, plan y tasks previos aprobados.

### III. Calidad Verificada
Todo cambio de código MUST pasar los gates de calidad: lint, typecheck y tests en verde. La lógica de negocio (cálculo de cierres, totales, cuadres) MUST estar cubierta por tests automatizados; la corrección aritmética frente al Excel actual es un criterio de aceptación explícito. Un push que falle cualquier gate de CI MUST considerarse bloqueado.

### IV. TypeScript Estricto End-to-End
Un único lenguaje: TypeScript en modo estricto en cliente y servidor, compartiendo tipos entre ambos. Los datos que crucen una frontera (API, formularios, ficheros) MUST validarse en tiempo de ejecución (Zod). Está PROHIBIDO usar `any` salvo justificación documentada en el propio código.

### V. Persistencia SQLite con Drizzle
La persistencia MUST usar SQLite vía Drizzle ORM: fichero local en desarrollo y Turso (libSQL) en producción. Las migraciones MUST estar versionadas en el repositorio y ser la única vía de evolución del esquema. No se admiten otros ORMs ni acceso directo a SQL sin pasar por Drizzle, salvo en migraciones. Rationale: preserva el dialecto SQLite elegido y habilita el despliegue serverless en Vercel sin estado.

### VI. Producto en Español, Código en Inglés
La interfaz, el lenguaje de negocio, las specs y la documentación MUST estar en español. Los identificadores de código (variables, funciones, tipos, ficheros) MUST estar en inglés, con excepción de términos de dominio intraducibles que se documentan en el glosario del data-model de cada feature.

### VII. Arquitectura Hexagonal + DDD Táctico
El código MUST organizarse en capas hexagonales — dominio, aplicación y adaptadores (UI, API, persistencia) — con el dominio aislado de Next.js, Drizzle y cualquier detalle de infraestructura; las dependencias apuntan siempre hacia el dominio. El dominio se modela con patrones tácticos de DDD: entidades, value objects (p. ej. `Money`, `MovementType`), servicios de dominio y repositorios definidos como puertos en el dominio e implementados como adaptadores. Existe un único contexto delimitado (Family Wallet); crear contextos adicionales MUST justificarse en el plan. En el frontend, la UI actúa como adaptador que consume el dominio y la capa de aplicación compartidos; PROHIBIDO duplicar lógica de negocio en componentes. La introducción de patrones adicionales (eventos de dominio, CQRS, sagas) MUST justificarse por un caso de uso real en el Complexity Tracking del plan.

Referencia de estilo para la organización en capas y los patrones tácticos: [CodelyTV/typescript-ddd-example](https://github.com/CodelyTV/typescript-ddd-example). Se adopta como referencia de estilo, NO de stack: su CQRS, EDA e infraestructura (MongoDB, RabbitMQ) NO aplican por defecto y quedan sujetas a la justificación exigida en este principio.

## Restricciones Tecnológicas y de Despliegue

- **Runtime**: Node.js LTS + TypeScript estricto; monolito Next.js (App Router).
- **Arquitectura interna**: hexagonal + DDD táctico (principio VII). El dominio y la capa de aplicación son módulos puros (sin imports de Next.js/React/Drizzle), compartidos entre servidor y UI; la UI consume la aplicación, no el SQL ni el HTTP directamente.
- **Persistencia**: Drizzle ORM sobre SQLite (fichero en dev) y Turso/libSQL (producción). Migraciones versionadas con drizzle-kit.
- **Validación**: Zod en todas las fronteras de datos.
- **Testing**: Vitest para unitarios e integración; Testing Library para componentes.
- **Calidad estática**: ESLint + Prettier.
- **CI**: GitHub Actions ejecutando lint + typecheck + tests en cada push y pull request.
- **Despliegue**: local para desarrollo (`npm run dev`) y Vercel (plan gratuito) + Turso para producción. Está PROHIBIDO asumir estado en el filesystem serverless: cualquier dato persistente vive en Turso.
- **Coste**: infraestructura gratuita; cualquier decisión que implique coste recurrente MUST aprobarse explícitamente por el propietario del proyecto.

## Flujo de Desarrollo y Gates de Calidad

1. Cada feature hija sigue el ciclo Spec Kit completo; el directorio activo se resuelve desde `.specify/feature.json`.
2. `/speckit.plan` MUST ejecutar el Constitution Check contra este documento antes de diseñar, y reevaluarlo tras el diseño; las desviaciones MUST justificarse en la tabla de Complexity Tracking del plan.
3. Definition of Done de una feature: gates de CI en verde, tests de lógica de negocio en verde y escenarios del `quickstart.md` de la feature verificados manualmente.
4. Commits siguiendo Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), en español el enunciado cuando aporte claridad.
5. La feature se considera entregada cuando sustituye al Excel en la parte de su alcance y los criterios de éxito de su spec se cumplen.

## Gobernanza

- Esta constitución PREVALECE sobre cualquier preferencia ad hoc de agentes o herramientas.
- Las enmiendas se realizan con `/speckit.constitution` y siguen versionado semántico: MAJOR (eliminación/redefinición de principios), MINOR (nuevos principios o secciones), PATCH (clarificaciones).
- Toda revisión de un plan o implementación MUST verificar el cumplimiento de esta constitución.
- El documento de guía para agentes de IA en tareas de desarrollo es `AGENTS.md` (raíz del repositorio); ambos documentos MUST mantenerse consistentes.

**Version**: 1.1.1 | **Ratified**: 2026-08-26 | **Last Amended**: 2026-08-27
