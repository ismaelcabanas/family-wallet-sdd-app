# 2. Arquitectura Hexagonal + DDD Táctico

- **Fecha**: 2026-08-27
- **Estado**: Aceptado

## Contexto y problema

La lógica de negocio (cierres mensuales, totales por naturaleza/tag, balance acumulado, cuadre) es el corazón del producto y su corrección es un criterio de aceptación explícito (debe replicar el Excel actual). Además, gran parte del código lo generarán agentes de IA, por lo que las reglas estructurales deben ser explícitas y verificables.

## Opciones consideradas

1. **Capas simples**: lógica de negocio en Route Handlers/componentes con utilidades compartidas.
2. **Hexagonal + DDD completo** (estilo CodelyTV con CQRS y EDA): eventos de dominio, buses, separación comandos/consultas.
3. **Hexagonal + DDD táctico pragmático**: dominio y aplicación puros, puertos en aplicación, adaptadores para UI/API/persistencia; sin CQRS/EDA salvo justificación.

## Decisión

Opción 3 (constitución, principio VII): dominio con entidades, value objects (`Money`, `MovementType`) y servicios de dominio; puertos (incluidos repositorios) definidos en la capa de aplicación; Route Handlers/páginas en `src/app/` y Server Actions/UI/repositorios Drizzle como adaptadores. Referencia de estilo: [CodelyTV/typescript-ddd-example](https://github.com/CodelyTV/typescript-ddd-example) (estilo, no stack). Detalle en `docs/architecture/overview.md`.

## Consecuencias

- **Positivas**: tests de lógica de negocio rápidos sin base de datos ni Next.js (stubs en memoria de los puertos); reglas de dependencia codificables en CI (dependency-cruiser/eslint boundaries) previniendo drift entre doc y código; agentes IA reciben reglas inequívocas.
- **Negativas**: más ficheros y ceremonia inicial frente a capas simples.
- **Notas**: la introducción de eventos de dominio, CQRS o contextos adicionales requiere justificación en el Complexity Tracking del plan (principio VII, constitución v1.1.x).
