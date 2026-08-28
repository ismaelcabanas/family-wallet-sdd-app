# 3. Persistencia con Drizzle ORM: SQLite en dev, Turso (libSQL) en producción

- **Fecha**: 2026-08-26
- **Estado**: Aceptado

## Contexto y problema

Se requiere persistencia relacional para un único usuario con volumen de datos muy bajo (centenas de movimientos/mes). El despliegue elegido es Vercel (plan gratuito), cuyo serverless tiene filesystem efífero: una BD en fichero se perdería en cada redeploy. Se valora además poder desarrollar en local sin servicios externos.

## Opciones consideradas

1. **SQLite en fichero**: cero administración, pero inviable en serverless.
2. **PostgreSQL serverless (Neon / Vercel Postgres)**: funciona en Vercel, pero cambia el dialecto y añade un servicio mayor del necesario.
3. **Turso (libSQL)**: SQLite gestionado con plan gratuito, compatible con Vercel, manteniendo fichero local en desarrollo.
4. **IndexedDB (solo navegador)**: sin backend de datos, pero riesgo de pérdida y sin acceso multi-dispositivo.

## Decisión

Drizzle ORM con SQLite en fichero para desarrollo y Turso (libSQL) para producción; migraciones versionadas con drizzle-kit como única vía de evolución del esquema (constitución, principio V).

## Consecuencias

- **Positivas**: mismo dialecto SQL en dev y prod; desarrollo local sin dependencias externas; plan gratuito suficiente; migración futura a PostgreSQL razonable vía Drizzle si el multiusuario lo exige.
- **Negativas**: dependencia del servicio Turso en producción (aceptada; exportación del dato posible al ser SQLite).
