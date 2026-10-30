# 20. Nombre de cuenta personal derivado del miembro: `accounts.name` nullable, unicidad nocase y derivación en lectura

- **Fecha**: 2026-10-30
- **Estado**: Aceptado (feature 008, `specs/008-gestion-cuentas-miembros/`)
- **Relacionados**: [ADR 0011](./0011-edicion-reconstruccion-validada.md) (edición por reconstrucción validada), [ADR 0016](./0016-materializacion-perezosa-ingresos-regulares.md)/[ADR 0017](./0017-aportacion-comun-porcentaje-materializacion.md) (materialización perezosa), [ADR 0018](./0018-mantenimiento-catalogo-tags.md) (patrón rename + índice `lower(name)` de tags), [ADR 0009](./0009-balance-derivado-no-persistido.md) (vistas derivadas por construcción)

## Contexto y problema

El catálogo de miembros y cuentas nace del seed con nombres de plataforma («Miembro A/B», «Cuenta común») y no tenía vía de gestión. La feature 008 añade el **renombrado** de miembros y de la cuenta común desde el panel (`/`), con una regla de modelo nueva: el nombre mostrado de una cuenta personal **se deriva siempre** del miembro como «Cuenta de {miembro}» (FR-004) — no existe renombrado independiente. Tres decisiones de esquema/lectura: (1) qué pasa con `accounts.name` en las personales, (2) unicidad ignorando mayúsculas para miembros y cuentas, y (3) dónde vive la derivación que consumen todas las vistas. Research en `specs/008-gestion-cuentas-miembros/research.md` §1–§4.

## Opciones consideradas

1. **Mantener `NOT NULL UNIQUE` y derivar solo en lectura (sin migración)**: los nombres almacenados de las personales («Cuenta de Miembro A») seguirían ocupando el espacio UNIQUE y **bloquearían** renombrar la común a un derivado («Cuenta de Isma») — colisión visual que la spec acepta explícitamente; la unicidad case-insensitive seguiría sin garantía en BD.
2. **Escribir el derivado en `accounts.name` al renombrar el miembro**: escritura en cascada que FR-004 prohíbe, reabre la colisión UNIQUE y duplica el dato (derivable) que puede desincronizarse.
3. **Columna `display_name` calculada + trigger**: lógica de negocio en BD, invisible para el dominio, sin consumidor que la exija (YAGNI, constitución I).
4. **Unicidad solo a nivel de aplicación**: pierde el backstop de BD ante la carrera check-then-update.
5. **Derivar en cada componente UI**: duplica negocio en la UI, prohibido por la constitución VII.
6. **Derivar en la entidad (`Account.displayName(memberName)`)**: viable, pero obliga a cargar el nombre del miembro junto a la entidad cuando el DTO ya trae el join.

## Decisión

- **`accounts.name` nullable + NULL en personales (migración `0007`)**: el nombre de una cuenta personal **no existe como dato**. La migración recrea la tabla (estilo `0002`) con `CASE WHEN type = 'personal' THEN NULL ELSE name END`, preservando ids (FKs de `movements` y configs intactas). Con NULL, renombrar un miembro no escribe nada en `accounts` y la colisión visual aceptada no choca con ningún UNIQUE (los NULL de SQLite nunca colisionan en índices únicos).
- **Unicidad ignorando mayúsculas en BD** (patrón tags de 004, ADR 0018): `members_name_nocase_uq` y `accounts_name_nocase_uq` como `uniqueIndex` sobre `lower(name)`. El check amable vive en el caso de uso (`findByName` nocase autoexcluyéndose, espejo de `RenameTag`) y la carrera final la responde la BD: `DrizzleMemberRepository.update`/`DrizzleAccountRepository.update` traducen la violación del índice a `DuplicateMemberNameError`/`DuplicateAccountNameError`.
- **Derivación única en lectura, aplicada por el repositorio**: la función pura de aplicación `personalAccountDisplayName(memberName)` = `` `Cuenta de ${memberName ?? "miembro"}` `` (fallback «miembro», paridad con notas/etiquetas) la aplica `mapRowToAccountDTO` en `DrizzleAccountRepository.findAll`: **`AccountDTO.name` pasa a ser el nombre mostrado** (común → nombre almacenado; personal → derivado, nunca NULL). El DTO no cambia de forma, así que panel, página de cuenta, `/summary` y `/annual` quedan intactos y propagan los renombrados en la siguiente lectura (`revalidatePath("/", "layout")`); la UI jamás concatena «Cuenta de» (constitución VII).
- **El renombrado vive en el dominio** (ADR 0011): `Member.rename(name)` (trim + no vacío, conserva id) y `Account.rename(name)` **solo en `shared`** — `personal` lanza `AccountNotRenamableError`, garantizando que ninguna capa superior pueda esquivar FR-004. Use cases `RenameMember`/`RenameAccount` espejo de `RenameTag`; `Account.name: string | null` con invariante type↔nombre reforzada en `create` (personal con nombre → error; shared con vacío → error).

## Consecuencias

- Una migración versionada con transformación de datos (recreación de `accounts`); los índices `lower(name)` habrían fallado con duplicados case-insensitive previos — imposible con el seed (verificado).
- Seed idempotente por atribución: las personales se siembran solo si no existe cuenta `(type = 'personal', member_id = miembro)`; la común por existencia de su nombre (el `onConflictDoNothing(target: name)` dejó de aplicar al ser el índice una expresión).
- Renombrar un miembro **no toca** movimientos ni configs: las notas materializadas congelan el nombre del momento (son contenido del movimiento, FR-001/SC-002); las materializaciones futuras usan el nombre vigente.
- Nota de implementación: drizzle-kit generó el índice de accounts con la expresión envuelta en backticks (`` `lower("name")` ``), que SQLite interpreta como columna inexistente; se ajustó a mano a `lower("name")` (forma ya usada en `0000` para tags).
