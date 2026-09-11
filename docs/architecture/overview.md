# Visión General de la Arquitectura — Family Wallet

Documento de referencia técnica para la arquitectura Hexagonal (Ports & Adapters) + DDD Táctico en un monolito Next.js (App Router) utilizando Drizzle ORM y TypeScript. La UI se construye con Tailwind CSS + shadcn/ui (ADR 0005).

---

## 1. Mapeo de Capas y Estructura de Directorios

El código reside en `src/` organizado por capas concéntricas aisladas:

```text
src/
├── domain/                      <-- NÚCLEO: Dominio Puro (Sin dependencias externas)
│   ├── shared/
│   │   └── DomainError.ts       <-- Excepción base de dominio
│   ├── member/
│   │   ├── Member.ts            <-- Entidad
│   │   ├── MemberId.ts          <-- Value Object (ID con brand)
│   │   └── MemberErrors.ts
│   ├── account/
│   │   ├── Account.ts           <-- Entidad (invariante memberId según type)
│   │   ├── AccountId.ts · AccountType.ts
│   │   └── AccountErrors.ts
│   ├── movement/                <-- Raíz del agregado principal
│   │   ├── Movement.ts          <-- Factory create/rehydrate, inmutable
│   │   ├── Money.ts             <-- VO céntimos enteros (ADR 0007)
│   │   ├── MonthlyClosure.ts    <-- VO cierre mensual calculado (ADR 0010)
│   │   ├── MovementId.ts · MovementType.ts · ExpenseNature.ts
│   │   ├── MovementErrors.ts    <-- InvalidMoneyError, InvalidMovementError (con field)
│   │   └── *.test.ts            <-- Tests co-localizados junto al SUT
│   └── tag/
│       ├── Tag.ts · TagId.ts · TagStatus.ts
│       └── TagErrors.ts         <-- DuplicateTagNameError, InactiveTagError, ...
│
├── application/                 <-- ORQUESTACIÓN: Casos de Uso y PUERTOS (depende solo de domain)
│   ├── movement/
│   │   ├── CreateMovement.ts    <-- Caso de uso (reglas FR-005/FR-006) + DEFAULT_TAG_SLUG
│   │   ├── ListMovements.ts     <-- Query mes+cuenta
│   │   ├── GetMonthlyClosure.ts <-- Query cierre del mes vía puerto + VO (ADR 0010)
│   │   ├── dto.ts               <-- CreateMovementDTO, MovementDTO, AccountDTO, TagDTO, MonthlyClosureDTO
│   │   └── MovementRepository.ts<-- PUERTO DE SALIDA (interfaz)
│   ├── account/
│   │   ├── AccountRepository.ts <-- PUERTO (incluye getBalance, ADR 0009)
│   │   └── ListAccounts.ts
│   ├── tag/
│   │   ├── TagRepository.ts     <-- PUERTO (incluye findBySlug para el default)
│   │   └── ListActiveTags.ts
│   └── member/
│       └── MemberRepository.ts  <-- PUERTO
│
├── app/                         <-- ADAPTADOR INBOUND (FINO): solo lo que Next.js rutea
│   ├── page.tsx                 <-- Pantalla principal: valida searchParams (Zod) y delega en use cases
│   ├── layout.tsx · globals.css
│
└── infrastructure/
    ├── db/                      <-- ADAPTADOR OUTBOUND: Persistencia Drizzle
    │   ├── schema/              <-- members, accounts, tags, movements, movement_tags
    │   ├── client.ts            <-- file: dev / libsql:// prod (env), reutilizado en dev por HMR
    │   ├── mappers/             <-- fila Drizzle <-> entidad de dominio
    │   ├── DrizzleMovementRepository.ts   (db.batch atómico movimiento+tags)
    │   ├── DrizzleAccountRepository.ts    (getBalance = SUM con signo según type)
    │   ├── DrizzleTagRepository.ts · DrizzleMemberRepository.ts
    │   ├── seed-data.ts         <-- Datos precargados tipados (miembros, cuentas, 12 tags)
    │   └── test-support.ts      <-- createTestDb(): libsql :memory: + migraciones
    └── primary/                 <-- ADAPTADOR INBOUND: Server Actions y UI
        ├── actions/
        │   └── create-movement.action.ts  <-- 'use server': Zod (FormData) -> use case -> estado por campo (ADR 0008)
        └── ui/
            ├── components/ui/   <-- shadcn/ui (copiado y versionado)
            ├── movement-form.tsx · account-month-selector.tsx
            ├── movement-list.tsx · account-balance.tsx · empty-state.tsx
            ├── monthly-closure-panel.tsx  <-- Panel de cierre del mes (solo formatea)
            └── format.ts        <-- Intl es-ES ÚNICAMENTE aquí (ADR 0007)
```

---

## 2. Invariantes y Reglas de Dependencia

### Matriz de Permisos de Importación

| Capa | Puede Importar De... | Prohibido Importar De... |
| :--- | :--- | :--- |
| domain | Nada interno ni librerías de terceros (solo TS puro). | application, infrastructure, next, drizzle-orm, zod, react. |
| application | domain. | infrastructure, next, drizzle-orm, react. |
| infrastructure | domain, application, librerías externas (Drizzle, Zod, React, Next.js). | Ninguna restricción de capa, pero no contiene regla de negocio. |

> **Checklist de Validación Rápida**: Si un archivo en `src/domain/` o `src/application/` tiene `import { ... } from 'drizzle-orm'` o `'next/server'`, ES UN ERROR ARQUITECTÓNICO.

---

## 3. Patrones de Implementación

### A. Dominio (`src/domain/`)

* **Entidades y Agregados**: Clases o tipos inmutables/mutables controlados mediante métodos explícitos.
* **Value Objects**: Garantizan validación de inmutabilidad (ej. `Money` valida que el importe tenga 2 decimales y no sea negativo si no aplica).
* **Manejo de Errores**: Excepciones de dominio personalizadas que extienden de `DomainError`.

### B. Aplicación y Puertos (`src/application/`)

* **Puertos de Salida (Interfaces)**:
  Ejemplo en `src/application/movement/MovementRepository.ts`:
  - Interfaz `MovementRepository` con `create(movement)` y `listByMonthAndAccount(accountId, month)`.
  - Los puertos hablan el idioma del dominio (entidades/VOs) o DTOs simples (`dto.ts`), nunca tipos de Drizzle.
* **Caso de Uso (Servicio de Aplicación)**:
  Recibe los puertos inyectados por constructor y orquesta la lógica (p. ej. `CreateMovement` aplica las reglas de naturaleza FR-005 y de tag por defecto FR-006).

### C. Persistencia con Drizzle ORM (`src/infrastructure/db/`)

Drizzle se trata puramente como un detalle de infraestructura.

1. **Esquema de BD separado del Dominio**:
   Las tablas de Drizzle en `schema/*.ts` representan la estructura relacional de la BD (SQLite/Turso), NO las entidades de dominio.
2. **Mapeadores (Mappers)**:
   Los repositorios concretos leen la BD mediante Drizzle y mapean los registros a objetos de Dominio antes de retornarlos.

Ejemplo en `src/infrastructure/db/DrizzleMovementRepository.ts`:

- Implementa `MovementRepository`.
- Usa `mapMovementToRow(movement)` para mapear el dominio a la tabla Drizzle.
- Inserta movimiento + tags en un único `db.batch` (atómico en libSQL); el listado usa un rango semicerrado `[YYYY-MM-01, mesSiguiente-01)` sargable sobre el índice `(account_id, date)`.

### D. Adaptadores de Entrada: Next.js App Router

Los Route Handlers (si surgieran), Server Actions y componentes actúan como adaptadores Inbound:

> **Nota de enrutamiento**: Next.js App Router SOLO rutea ficheros dentro de `src/app/`. Los Route Handlers (`route.ts`) y las páginas viven ahí como **adaptadores finos** que validan y delegan la lógica a `src/application/`; no contienen reglas de negocio. Las Server Actions y el resto de componentes UI residen en `src/infrastructure/primary/` al no depender del enrutamiento basado en ficheros.

1. Reciben el Request o FormData.
2. Validan las fronteras con Zod.
3. Instancian el Repositorio de Infraestructura y el Caso de Uso.
4. Ejecutan el Caso de Uso.
5. Capturan errores de dominio y los traducen a respuestas HTTP o estados de UI.

---

## 4. Estrategia de Testing

* **Tests co-localizados junto a su SUT** (`*.test.ts` / `*.test.tsx` en el mismo directorio que el módulo); los e2e en `e2e/`.
* **Vitest con `test.projects`** (config en `vitest.config.mts`):
  * Proyecto `node`: dominio, aplicación, repositorios Drizzle y Server Actions (`*.test.ts`).
  * Proyecto `ui` (jsdom + @vitejs/plugin-react + @testing-library): componentes (`src/infrastructure/primary/ui/**/*.test.tsx`); setup con jest-dom y stub de `ResizeObserver`.
* **Pruebas Unitarias (`domain` y `application`)**: lógica de negocio con dobles en memoria de los puertos (sin BD ni contexto de Next.js).
* **Pruebas de Integración (`infrastructure`)**: repositorios contra libsql `:memory:` aplicando las migraciones versionadas de `drizzle/` (`test-support.ts`).
* **Pruebas de Componentes (UI)**: la Server Action se mockea con `vi.mock` y el estado de `useActionState` se controla desde el test.
* **Pruebas E2E (Playwright)**: flujo crítico de registro contra `build + start` con una BD aislada y determinista (`e2e.sqlite`, recreada por `pretest:e2e`); serie dentro de cada spec porque comparten estado de BD; también en CI (ADR 0006).

## 5. Diagramas

- [Diagramas C4 (contexto, contenedores, componentes)](./diagrams/c4.md)
- [Secuencia del flujo crítico "registrar movimiento"](./diagrams/registro-movimiento-sequence.md) (ADR 0008)
- [Clases del modelo de dominio](./diagrams/domain-model.md)
