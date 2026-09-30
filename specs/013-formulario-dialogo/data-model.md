# Data Model: Formulario de alta en diálogo desde el listado

**Feature**: 013-formulario-dialogo | **Fecha**: 2026-09-30

## 1. Modelo de datos

### 1.1 Entidades y Value Objects

**Sin cambios.** La feature es de presentación pura (FR-005): reutiliza tal cual **Cuenta** (`Account`, `AccountId`, `AccountType`), **Movimiento** (`Movement`, `Money`, `MovementType`, `MovementNature`) y **Tag** (`Tag`, `TagName`), definidos en 002/003 (ver `specs/002-registro-movimientos/data-model.md` y `docs/architecture/diagrams/domain-model.md`).

### 1.2 DTOs, componentes y composición de la página

Tampoco cambian los DTOs (`AccountDTO`, `MovementDTO`, `MonthlyClosureDTO`, `TagDTO`, balance en céntimos) ni el caso de uso `CreateMovement` ni la Server Action `createMovement` (misma firma y `CreateMovementState`). Lo que define esta feature es la **composición de UI**:

| Elemento | Estado | Detalle |
|---|---|---|
| `MovementForm` (wrapper embebido) | **ELIMINADO de la página** (FR-004) | El fichero `movement-form.tsx` conserva `MovementFormFields` y `MovementFormInitialValues` (usados por los diálogos); el wrapper `MovementForm` se elimina o queda muerto → eliminar |
| `CreateMovementDialog` | **NUEVO** (client, `src/infrastructure/primary/ui/create-movement-dialog.tsx`) | Calco de `EditMovementDialog` con `createMovement`; props: `accountId`, `accountName`, `accountType`, `tags`, `onClose` |
| `GroupedMovementList` | **AMPLIADO** | Estado `creating: boolean`; botón «Nuevo movimiento» en cabecera de la sección y junto al estado vacío; render condicional del diálogo a nivel del listado (convención AGENTS.md) |
| `EmptyState` | **AMPLIADO** | Acepta `children` (CTA); texto «Pulsa «Nuevo movimiento» para registrar el primero.» |
| `/accounts/[accountId]/page.tsx` | **MODIFICADO** | Sin bloque `MovementForm`; pasa `accountName`/`accountType` a `GroupedMovementList` |

Composición resultante de la página (orden congelado, FR-004 escenario 6):

| Orden | Bloque | Componente | Naturaleza |
|-------|--------|------------|------------|
| 1 | Cabecera: nombre de cuenta + `GlobalNav` | `page.tsx` + `GlobalNav` (012) | server |
| 2 | Subtítulo de tipo de cuenta | `page.tsx` | server |
| 3 | Selector de mes/año | `MonthStepper` (011) | client |
| 4 | Listado de movimientos con **CTA «Nuevo movimiento»** (+ diálogo de alta) y diálogos de edición/eliminación | `GroupedMovementList` (011, ampliado) | client |
| 5 | Balance acumulado («Acumulado hasta {mes}») | `AccountBalance` | server |
| 6 | Cierre mensual | `MonthlyClosurePanel` (005) | server |

Invariante: el alta de movimientos solo existe como diálogo del CTA (FR-004, SC-002); el CTA está disponible con y sin movimientos (FR-001).

### 1.3 Diagrama de clases (diseño)

No hay piezas nuevas de dominio ni de aplicación. El diagrama de clases vivo sigue siendo `docs/architecture/diagrams/domain-model.md` (sin cambios en esta feature); el diseño UI se captura en los diagramas de componentes y secuencia de [plan.md](./plan.md) y en el contrato [contracts/ui-contract.md](./contracts/ui-contract.md).

## 2. Persistencia

**Sin cambios** (FR-005): mismo esquema Drizzle, mismas cinco lecturas de la página (`ListAccounts`, `ListMovements`, `AccountRepository.getBalance`, `GetMonthlyClosure`, `ListActiveTags`), sin migraciones ni consultas nuevas. La escritura sigue siendo `createMovement` → `CreateMovement` (002) intactos.

## 3. Reglas de validación

Sin cambios. La validación del alta sigue siendo `movementFormSchema` (Zod, `src/infrastructure/primary/actions/movement-form.schema.ts`) sobre el `FormData` del formulario del diálogo: fecha real, concepto ≥ 1, importe `^\d{1,9}([.,]\d{1,2})?$` > 0, tipo `expense|income`, naturaleza obligatoria en gastos, `tagIds` deduplicados. Errores → `CreateMovementState { status: "error", errors, values }` con los mismos mensajes por campo; el diálogo permanece abierto (FR-003).

## 4. Transiciones de estado

La única máquina de estado nueva es la del diálogo de alta (estado de UI):

```text
[cerrado] --CTA «Nuevo movimiento»--> [abierto: formulario limpio, fecha hoy]
[abierto] --Guardar válido (success)--> toast «Movimiento guardado» + revalidación --> [cerrado]
[abierto] --Guardar inválido (error)--> [abierto: errores por campo, valores conservados]
[abierto] --Cancelar / X / Escape--> descartar sin confirmación --> [cerrado]
[abierto] --envío en curso--> botón Guardar disabled («Guardando…»)
```

Tras cada cierre, la reapertura remonta el formulario limpio (el diálogo se desmonta al cerrar; no hay estado residual).

## 5. Glosario

| Término | Significado |
|---------|-------------|
| CTA | Call To Action: botón «Nuevo movimiento» junto al listado que abre el diálogo de alta (término de UI extendido en el equipo) |
| diálogo de alta | `CreateMovementDialog`: modal con `MovementFormFields` en modo alta (cuenta fijada), invocado desde el CTA |
| modo alta | Uso de `MovementFormFields` con `accountId`/`accountName`/`accountType` y sin `initialValues` (cuenta fijada, fecha por defecto hoy) |

Sin términos intraducibles nuevos en código (los identificadores nuevos — `CreateMovementDialog`, `creating` — están en inglés).
