# 6. Tests end-to-end con Playwright para flujos críticos

- **Fecha**: 2026-08-31
- **Estado**: Aceptado

## Contexto y problema

El desarrollo se realiza en solitario con agentes de IA y sin revisión humana: Vitest + Testing Library cubren la lógica de negocio (dominio/aplicación) y los componentes renderizados, pero ningún test verificaba los journeys completos de usuario a través de la aplicación real (navegador + ruta + persistencia). Las regresiones en esos flujos solo se detectarían en verificación manual.

## Opciones consideradas

1. **Sin e2e**: confiar en tests de dominio/componentes más la verificación manual del `quickstart.md` de cada feature.
2. **Playwright**: e2e multi-navegador, soporte first-class para Next.js, runner autogestionado en CI.
3. **Cypress**: e2e consolidado, pero runner y modelo de licencias más pesados para un proyecto personal.

## Decisión

Playwright como herramienta de tests end-to-end para los **flujos críticos de usuario** (p. ej. registrar un movimiento), ejecutados también en CI. Incorporado a la constitución v1.2.0: principio III (Calidad Verificada) y Restricciones Tecnológicas.

## Consecuencias

- **Positivas**: detección automática de regresiones en los journeys que más daño hacen si se rompen; verificación objetiva de los escenarios de aceptación de las specs.
- **Negativas**: coste de mantenimiento y tiempo de CI (mitigado limitando el alcance a los flujos críticos, no a toda la suite).
