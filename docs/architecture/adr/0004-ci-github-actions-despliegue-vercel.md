# 4. CI con GitHub Actions y despliegue en Vercel + Turso

- **Fecha**: 2026-08-26
- **Estado**: Aceptado

## Contexto y problema

El repositorio vive en GitHub. La constitución exige gates de calidad (lint, typecheck, tests) en cada push como condición de bloqueo. El proyecto debe mantener coste cero de infraestructura.

## Opciones consideradas

1. **Sin CI**: máxima fricción cero inicial, pero sin verificación automática de los gates constitucionales.
2. **GitHub Actions básico**: lint + typecheck + tests en cada push/PR.
3. **CI/CD completo**: pipeline con despliegue automático a producción en cada merge.

## Decisión

GitHub Actions ejecutando lint + typecheck + tests en cada push y pull request (constitución, sección de restricciones tecnológicas). El despliegue a Vercel + Turso es manual por ahora.

## Consecuencias

- **Positivas**: regresiones detectadas antes de merge; coste cero con repos privados incluidos en el plan gratuito de Actions para este volumen.
- **Negativas**: sin despliegue automático (revisable cuando exista código y tests estables; sería una enmienda de este ADR).
- **Notas**: cuando exista scaffold (feature 002), se añadirá verificación arquitectónica (dependency-cruiser) al pipeline (ver ADR-0002).
