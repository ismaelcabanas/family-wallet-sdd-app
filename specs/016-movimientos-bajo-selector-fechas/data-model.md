# Data Model: Listado de movimientos bajo el selector de fechas

**Feature**: 016-movimientos-bajo-selector-fechas | **Fecha**: 2026-09-30

## 1. Modelo de datos

### 1.1 Entidades y Value Objects

**Sin cambios.** La feature es una reordenación de presentación de la página de cuenta de 011 (FR-003): reutiliza tal cual **Cuenta** (`Account`, `AccountId`, `AccountType`), **Movimiento** (`Movement`, `Money`, `MovementType`, `MovementNature`) y **Tag** (`Tag`, `TagName`), definidos en 002/003 (ver `specs/002-registro-movimientos/data-model.md` y `docs/architecture/diagrams/domain-model.md`).

### 1.2 DTOs y composición de la página

Tampoco cambian los DTOs que consume la página: `AccountDTO` (`ListAccounts`), `MovementDTO` (`ListMovements`), `MonthlyClosureDTO` (`GetMonthlyClosure`), `TagDTO` (`ListActiveTags`) y el balance en céntimos (`AccountRepository.getBalance`).

Lo único que define esta feature es la **composición (orden de bloques) de `/accounts/[accountId]`**, materializada en `src/app/accounts/[accountId]/page.tsx`:

| Orden | Bloque | Componente | Naturaleza |
|-------|--------|------------|------------|
| 1 | Cabecera: nombre de cuenta + `GlobalNav` | `page.tsx` + `GlobalNav` (012) | server |
| 2 | Subtítulo de tipo de cuenta | `page.tsx` | server |
| 3 | **Selector de mes/año** | `MonthStepper` (011) | client |
| 4 | **Listado de movimientos del mes** (agrupado por fecha; estado vacío dentro) | `GroupedMovementList` (011) | client |
| 5 | Balance acumulado («Acumulado hasta {mes}») | `AccountBalance` | server |
| 6 | Formulario de alta embebido | `MovementForm` (002) | client |
| 7 | Cierre mensual | `MonthlyClosurePanel` (005) | server |

Invariante de composición (FR-001/FR-002): entre 3 y 4 no puede interponerse ningún bloque; 5–7 conservan su orden relativo previo.

### 1.3 Diagrama de clases (diseño)

No hay piezas nuevas de dominio ni de aplicación. El diagrama de clases vivo sigue siendo `docs/architecture/diagrams/domain-model.md` (sin cambios en esta feature); el diseño de la feature se captura en los diagramas de componentes y secuencia de [plan.md](./plan.md).

## 2. Persistencia

**Sin cambios** (FR-003): mismo esquema Drizzle de 002/003, mismas cinco lecturas (`ListAccounts`, `ListMovements`, `AccountRepository.getBalance`, `GetMonthlyClosure`, `ListActiveTags`), sin migraciones ni consultas nuevas.

## 3. Reglas de validación

Sin cambios. La página mantiene sus validaciones Zod en la frontera URL: `accountId` (`^\d+$` + existencia → 404 explícito si no) y `month` (`^\d{4}-(0[1-9]|1[0-2])$`, con caída al mes actual si es inválido). La reordenación no introduce datos nuevos que validar.

## 4. Transiciones de estado

No aplica: no hay estado nuevo ni máquinas de estado; la página sigue siendo una proyección de solo lectura del mes visible con interacciones ya entregadas (alta, edición, eliminación, navegación de meses).

## 5. Glosario

| Término | Significado |
|---------|-------------|
| list-first | Composición de página de cuenta con el listado de movimientos inmediatamente bajo el selector de mes/año (entregada por esta feature; prevista originalmente en 013) |
| bloque | Cada sección mayor de la página de cuenta (selector, listado, balance, formulario, cierre) compuesta en `page.tsx` |

Sin términos intraducibles nuevos en código (no hay identificadores nuevos).
