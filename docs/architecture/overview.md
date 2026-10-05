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
│   │   ├── Movement.ts          <-- Factory create/recreate/rehydrate, inmutable (ADR 0011)
│   │   ├── Money.ts             <-- VO céntimos enteros (ADR 0007)
│   │   ├── MonthlyClosure.ts    <-- VO cierre mensual calculado (ADR 0010)
│   │   ├── GlobalMonthlySummary.ts <-- VO resumen global del mes: compone MonthlyClosure + desglose por miembro (ADR 0012)
│   │   ├── AnnualIncomeStatement.ts <-- VO cuenta de resultados anual: compone 12 GlobalMonthlySummary + ingresos por miembro + saldo acumulado + medias /12 (ADR 0013)
│   │   ├── MovementId.ts · MovementType.ts · ExpenseNature.ts
│   │   ├── MovementErrors.ts    <-- InvalidMoneyError, InvalidMovementError, MovementNotFoundError
│   │   └── *.test.ts            <-- Tests co-localizados junto al SUT
│   └── tag/
│       ├── Tag.ts · TagId.ts · TagStatus.ts
│       ├── TagSlug.ts            <-- deriveTagSlug(name): función pura slug (ADR 0015)
│       └── TagErrors.ts         <-- DuplicateTagNameError (lanzado desde 017), InactiveTagError, ...
│
├── application/                 <-- ORQUESTACIÓN: Casos de Uso y PUERTOS (depende solo de domain)
│   ├── movement/
│   │   ├── CreateMovement.ts    <-- Caso de uso (reglas FR-005/FR-006)
│   │   ├── UpdateMovement.ts    <-- findById -> recreate (preserva id/createdAt) -> update (ADR 0011)
│   │   ├── DeleteMovement.ts    <-- findById -> delete físico (ADR 0011)
│   │   ├── movement-inputs.ts   <-- Resolutores de naturaleza y tag única (sin default desde 014) compartidos por alta y edición
│   │   ├── ListMovements.ts     <-- Query mes+cuenta
│   │   ├── GetMonthlyClosure.ts <-- Query cierre del mes vía puerto + VO (ADR 0010)
│   │   ├── GetGlobalMonthlySummary.ts <-- Query resumen global del mes: listByMonth + findAll vía puertos + VO (ADR 0012)
│   │   ├── GetAnnualIncomeStatement.ts <-- Query cuenta de resultados anual: listByYear + cuentas + miembros vía puertos + VO (ADR 0013)
│   │   ├── dto.ts               <-- CreateMovementDTO, UpdateMovementDTO, MovementDTO, AccountDTO (con memberId), TagDTO, MonthlyClosureDTO, GlobalMonthlySummaryDTO, AnnualIncomeStatementDTO
│   │   └── MovementRepository.ts<-- PUERTO DE SALIDA (interfaz; incluye listByMonth y listByYear, ADR 0012/0013)
│   ├── account/
│   │   ├── AccountRepository.ts <-- PUERTO (incluye getBalance con corte opcional asOf inclusive, ADR 0009)
│   │   └── ListAccounts.ts
│   ├── tag/
│   │   ├── TagRepository.ts     <-- PUERTO (findBySlug; findByName espejo de lower(name) + save desde 017, ADR 0015)
│   │   ├── ListActiveTags.ts
│   │   └── CreateTag.ts         <-- Vía de creación del catálogo (017): trim, duplicado case-insensitive, slug derivado + colisiones -2/-3…, alta activa
│   └── member/
│       └── MemberRepository.ts  <-- PUERTO
│
├── app/                         <-- ADAPTADOR INBOUND (FINO): solo lo que Next.js rutea
│   ├── page.tsx                 <-- Panel de cuentas: await connection() + ListAccounts → GlobalNav + AccountCardGrid (sin searchParams, feature 012)
│   ├── accounts/[accountId]/page.tsx <-- Página de cuenta (/accounts/{id}?month=): 404 explícito si no existe, balance con corte a fin de mes (adaptador fino, patrón ADR 0008); GlobalNav active="panel"; composición list-first lectura por defecto: MonthStepper → GroupedMovementList (con CTA «Nuevo movimiento») → AccountBalance → MonthlyClosurePanel (features 016 + 013; sin formulario embebido)
│   ├── summary/page.tsx         <-- Resumen global del mes (/summary?month=): adaptador fino igual que '/' (ADR 0012); GlobalNav active="summary"
│   ├── annual/page.tsx          <-- Cuenta de resultados anual (/annual?year=): adaptador fino, patrón ADR 0008 (ADR 0013); GlobalNav active="annual"
│   ├── layout.tsx · globals.css
│
└── infrastructure/
    ├── db/                      <-- ADAPTADOR OUTBOUND: Persistencia Drizzle
    │   ├── schema/              <-- members, accounts, tags, movements (tag_id FK 0..1 desde 014; movement_tags eliminada)
    │   ├── client.ts            <-- file: dev / libsql:// prod (env), reutilizado en dev por HMR
    │   ├── mappers/             <-- fila Drizzle <-> entidad de dominio
    │   ├── DrizzleMovementRepository.ts   (db.batch atómico movimiento+tags; findById/update pone updated_at, delete físico — ADR 0011)
    │   ├── DrizzleAccountRepository.ts    (getBalance = SUM con signo según type; asOf opcional añade lte(date) inclusive, corte cubierto por el índice (account_id, date))
    │   ├── DrizzleTagRepository.ts (findByName espejo de lower(name), save INSERT con traducción del constraint a DuplicateTagNameError — 017) · DrizzleMemberRepository.ts
    │   ├── seed-data.ts         <-- Datos precargados tipados (miembros, cuentas, 12 tags)
    │   └── test-support.ts      <-- createTestDb(): libsql :memory: + migraciones
    └── primary/                 <-- ADAPTADOR INBOUND: Server Actions y UI
        ├── actions/
        │   ├── movement-form.schema.ts    <-- Schema Zod del formulario compartido alta/edición (FR-002)
        │   ├── create-movement.action.ts  <-- 'use server': Zod (FormData) -> use case -> estado por campo (ADR 0008); revalida '/' y '/accounts/[accountId]' (patrón "page")
        │   ├── create-tag.action.ts       <-- 'use server' (017, ADR 0015): createTag(name) -> CreateTagResult {ok,tag|message}; revalidatePath('/', 'layout')
        │   ├── update-movement.action.ts  <-- 'use server': compone el aviso "movido de mes" (FR-007; sin cambio de cuenta desde 014), la UI solo lo muestra; doble revalidación
        │   └── delete-movement.action.ts  <-- 'use server': schema mínimo movementId; doble revalidación
        └── ui/
            ├── components/ui/   <-- shadcn/ui (copiado y versionado)
            ├── global-nav.tsx   <-- Navegación global de servidor (Panel · Resumen global · Cuenta de resultados; aria-current, mes por prop con currentMonth() por defecto, feature 012)
            ├── account-card-grid.tsx <-- Rejilla server de tarjetas-Link del panel de cuentas (/ lanzador puro: nombre+tipo, feature 012)
            ├── movement-form.tsx (MovementFormFields con modos alta/edición: cuenta fijada o Select, naturaleza dinámica; sin wrapper embebido desde 013; captación inline «+ Nueva etiqueta» junto al Select desde 017 — action directa + useTransition, ADR 0015)
            ├── create-movement-dialog.tsx (diálogo de alta del CTA «Nuevo movimiento», feature 013; calco del patrón de 003 con createMovement; extraTags sobrevive al remonte de la tanda desde 017)
            ├── grouped-movement-list.tsx (client de /accounts/[id]: agrupa por fecha el orden de ListMovements, fila rediseñada tags/nota/importe, CTA «Nuevo movimiento» en cabecera y estado vacío, diálogos de alta/edición/eliminación al nivel del listado, vacío interno; único listado tras 012)
            ├── edit-movement-dialog.tsx · delete-movement-dialog.tsx
            ├── account-balance.tsx (subtitle prop: «Acumulado hasta …» en la página de cuenta) · empty-state.tsx
            ├── month-selector.tsx        <-- Selector de mes cliente reutilizable (router.replace, ADR 0012)
            ├── month-stepper.tsx         <-- Selector ‹ › + picker de la página de cuenta (router.replace preservando accountId; › y picker acotados al mes actual real)
            ├── year-selector.tsx         <-- Selector de año cliente reutilizable (router.replace, ADR 0013)
            ├── global-summary-panel.tsx  <-- Panel del resumen global: KPIs + desgloses por tag y por miembro (solo formatea)
            ├── annual-statement-panel.tsx <-- Panel de la cuenta anual: tabla mensual Ene–Dic + desglose por tag (solo formatea, ADR 0013)
            ├── monthly-closure-panel.tsx  <-- Panel de cierre del mes (solo formatea)
            └── format.ts        <-- Intl es-ES ÚNICAMENTE aquí (ADR 0007); monthEndIsoDate/shiftMonth derivan calendario (helpers puros)
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
  - Interfaz `MovementRepository` con `create(movement)`, `listByMonthAndAccount(accountId, month)`, `listByMonth(month)` (lectura global del mes, ADR 0012), `listByYear(year)` (lectura global del año, ADR 0013), `findById(id)`, `update(movement)` y `delete(id)` (ADR 0011).
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
- [Secuencia de la página de cuenta](./diagrams/pagina-cuenta-sequence.md) (feature 011: apertura con balance acumulado a fin de mes; 016: composición list-first)
- [Secuencia del panel de cuentas](./diagrams/panel-cuentas-sequence.md) (feature 012: `/` como lanzador de cuentas)
- [Secuencia del resumen global mensual](./diagrams/resumen-global-sequence.md) (ADR 0012)
- [Secuencia de la cuenta de resultados anual](./diagrams/cuenta-anual-sequence.md) (ADR 0013)
- [Clases del modelo de dominio](./diagrams/domain-model.md)
