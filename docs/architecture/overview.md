# Visión General de la Arquitectura — Family Wallet

Documento de referencia técnica para la arquitectura Hexagonal (Ports & Adapters) + DDD Táctico en un monolito Next.js (App Router) utilizando Drizzle ORM y TypeScript. La UI se construye con Tailwind CSS + shadcn/ui (ADR 0005).

---

## 1. Mapeo de Capas y Estructura de Directorios

El código reside en `src/` organizado por capas concéntricas aisladas:

```text
src/
├── domain/                      <-- NÚCLEO: Dominio Puro (Sin dependencias externas)
│   ├── account/                 <-- Bounded Context / Módulo
│   │   ├── Account.ts           <-- Agregado / Entidad
│   │   ├── AccountId.ts         <-- Value Object
│   │   └── AccountErrors.ts     <-- Excepciones de Dominio
│   └── movement/
│       ├── Movement.ts
│       ├── Money.ts             <-- VO para manejo seguro de EUR (evita flotantes)
│       └── MovementType.ts
│
├── application/                 <-- ORQUESTACIÓN: Casos de Uso y Puertos
│   ├── movement/
│   │   ├── CreateMovement.ts    <-- Caso de Uso (Servicio de Aplicación)
│   │   ├── CreateMovementDTO.ts <-- DTOs de entrada/salida
│   │   └── MovementRepository.ts<-- PUERTO DE SALIDA (Interfaz)
│   └── common/
│       └── UnitOfWork.ts        <-- PUERTO DE SALIDA (Para transacciones)
│
├── app/                         <-- ADAPTADOR INBOUND (FINO): rutas exigidas por Next.js
│   ├── api/movements/route.ts   <-- Route Handler fino: valida (Zod) y delega al caso de uso
│   ├── movimientos/page.tsx     <-- Páginas App Router (Server Components finos)
│   └── layout.tsx
│
├── infrastructure/              <-- ADAPTADORES: Implementaciones Concretas
│   ├── db/                      <-- Adaptador de Persistencia
│   │   ├── schema/              <-- Tablas Drizzle (SQLite / Turso)
│   │   │   └── movements.ts
│   │   ├── client.ts            <-- Conexión Drizzle
│   │   └── DrizzleMovementRepository.ts <-- Implementa MovementRepository
│   │
│   └── primary/                 <-- Adaptadores de Entrada (Inbound)
│       ├── actions/             <-- Server Actions de Next.js
│       │   └── create-movement.action.ts
│       └── ui/                  <-- Componentes React (Client / Server Components)
│           └── components/
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
  - Definir interfaz `MovementRepository` con métodos `save(movement)` y `findById(id)`.
* **Caso de Uso (Servicio de Aplicación)**:
  Recibe interfaces inyectadas (puertos) para ejecutar la lógica de orquestación.

### C. Persistencia con Drizzle ORM (`src/infrastructure/db/`)

Drizzle se trata puramente como un detalle de infraestructura.

1. **Esquema de BD separado del Dominio**:
   Las tablas de Drizzle en `schema/*.ts` representan la estructura relacional de la BD (SQLite/Turso), NO las entidades de dominio.
2. **Mapeadores (Mappers)**:
   Los repositorios concretos leen la BD mediante Drizzle y mapean los registros a objetos de Dominio antes de retornarlos.

Ejemplo en `src/infrastructure/db/DrizzleMovementRepository.ts`:

- Implementa `MovementRepository`.
- Usa `MovementMapper.toPersistence(movement)` para mapear el dominio a tabla Drizzle.
- Ejecuta `db.insert(movementsTable).values(rawData)`.

### D. Adaptadores de Entrada: Next.js App Router

Los Route Handlers, Server Actions y componentes actúan como adaptadores Inbound:

> **Nota de enrutamiento**: Next.js App Router SOLO rutea ficheros dentro de `src/app/`. Los Route Handlers (`route.ts`) y las páginas viven ahí como **adaptadores finos** que validan y delegan la lógica a `src/application/`; no contienen reglas de negocio. Las Server Actions y el resto de componentes UI residen en `src/infrastructure/primary/` al no depender del enrutamiento basado en ficheros.

1. Reciben el Request o FormData.
2. Validan las fronteras con Zod.
3. Instancian el Repositorio de Infraestructura y el Caso de Uso.
4. Ejecutan el Caso de Uso.
5. Capturan errores de dominio y los traducen a respuestas HTTP o estados de UI.

---

## 4. Estrategia de Testing

* **Pruebas Unitarias (`domain` y `application`)**:
  * Súper rápidas, sin dependencias de base de datos ni contexto de Next.js.
  * Se prueba la lógica de negocio usando Mocks o In-Memory Stubs de los puertos (`InMemoryMovementRepository`).
* **Pruebas de Integración (`infrastructure`)**:
  * Verifican que `DrizzleMovementRepository` funciona correctamente contra una BD SQLite en memoria.
* **Pruebas de Componentes (UI)**:
  * Pruebas con Vitest + Testing Library para componentes y flujos de usuario renderizados.
* **Pruebas E2E (Playwright)**:
  * Cubren los flujos críticos de usuario de extremo a extremo (p. ej. registrar un movimiento) contra la aplicación en ejecución, y se ejecutan también en CI.
