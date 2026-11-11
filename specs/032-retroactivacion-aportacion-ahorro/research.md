# Research: Registro manual de la aportación común en meses pasados

**Feature**: 032-retroactivacion-aportacion-ahorro  
**Fecha**: 2026-11-11

---

## Decisiones Técnicas

### 1. Tipo de gasto «Aportación común» en la frontera UI

**Decision**: El tipo de gasto «Aportación común» es un concepto de la **frontera UI** (no un `MovementType` de dominio).

**Rationale**: 
- La naturaleza **propia** y la etiqueta protegida «Aportación Común» ya existen en el dominio.
- El materializador de 019/021 crea movimientos con `nature = "own"` y la etiqueta protegida automáticamente.
- Para el registro manual, el usuario solo debe teclear importe, fecha y nota; el sistema asigna implícitamente naturaleza y etiqueta.
- Esto evita duplicar entidades de dominio y mantiene la simplicidad (principio I).

**Alternativas consideradas**:
- **Opción A**: Crear un nuevo `MovementType` de dominio `ManualContribution`. → **Rechazada**: viola principio I (abstracción prematura) y complica el dominio sin necesidad.
- **Opción B**: Ofrecer la etiqueta «Aportación Común» en el Select genérico de etiquetas. → **Rechazada**: la etiqueta debe permanecer oculta para evitar selección manual (FR-001).
- **Opción C**: Usar un tipo de gasto independiente en la UI que compone gasto + naturaleza propia + etiqueta protegida. → **Elegida**: paridad con el materializador, sin cambios en el dominio.

---

### 2. Escritura del registro de materialización (`common_contribution_months`)

**Decision**: La creación manual de un movimiento de aportación escribe la fila del registro en la **misma transacción** que el movimiento.

**Rationale**:
- El KPI «Aportación común» (`GetMonthNetContribution`) lee el registro, no los movimientos directamente.
- Para que el KPI refleje la aportación manual, el registro debe existir en la misma tx.
- El registro ya tiene `movement_id` nullable; al crear el movimiento manual, se enlaza la fila existente (sin migraciones).
- Idempotencia: `UNIQUE (config, mes)` + `ON CONFLICT DO NOTHING` evita duplicados.

**Alternativas consideradas**:
- **Opción A**: Crear el movimiento y luego INSERT en el registro en tx separada. → **Rechazada**: riesgo de inconsistencia si el movimiento falla.
- **Opción B**: Usar `ON CONFLICT DO UPDATE` para ajustar el importe. → **Rechazada**: el importe manual es el neto real, no se ajusta.
- **Opción C**: INSERT en el registro dentro de la misma tx que el movimiento, enlazando `movement_id`. → **Elegida**: coherencia garantizada.

---

### 3. Regla de unicidad: máximo 1 movimiento de aportación por cuenta y mes

**Decision**: Validación en el **caso de uso** (capa de aplicación), no en el repositorio.

**Rationale**:
- La regla es de negocio (FR-001), no de persistencia.
- El caso de uso consulta `common_contribution_months` por `config_id` y `mes`, y devuelve error si existe.
- El repositorio solo escribe la fila si no existe (`ON CONFLICT DO NOTHING`).

**Alternativas consideradas**:
- **Opción A**: Validar en el repositorio (Drizzle). → **Rechazada**: el repositorio es un adaptador, la lógica de negocio vive en la aplicación.
- **Opción B**: Validar en la UI con optimista. → **Rechazada**: la validación debe ser autoritativa en servidor.
- **Opción C**: Validar en el caso de uso consultando el registro. → **Elegida**: coherente con arquitectura hexagonal.

---

### 4. Borrado del movimiento manual elimina la fila del registro

**Decision**: El borrado de un movimiento de aportación manual elimina también su fila del registro en la **misma transacción**.

**Rationale**:
- Regla «0 o 1» reversible (FR-004): el mes vuelve a «sin aportación» y admite registrar otro.
- La fila huérfana (movimiento generado borrado por 021) sigue admitiendo registro manual.
- La edición de un movimiento manual no afecta el registro (el KPI lee el movimiento enlazado).

**Alternativas consideradas**:
- **Opción A**: El borrado del movimiento deja la fila huérfana. → **Rechazada**: inconsistencia entre movimiento y KPI.
- **Opción B**: El borrado del movimiento no afecta el registro. → **Rechazada**: el mes quedaría en estado indefinido.
- **Opción C**: DELETE en el registro enlazado dentro de la misma tx que el borrado del movimiento. → **Elegida**: coherencia garantizada.

---

### 5. Materializador de 019/021 intacto

**Decision**: El materializador de aportaciones comunes **no cambia** con esta feature.

**Rationale**:
- El materializador sigue generando movimientos solo en la ventana `activatedAtMonth ≤ mes ≤ mesEnCurso`.
- El registro manual puede ocurrir en meses pasados (fuera de la ventana) o en el mes en curso (dentro de la ventana).
- Si el mes en curso ya tiene registro (manual o materializador), el materializador respeta la fila existente (idempotencia).
- Las configs (`activatedAtMonth`, porcentajes) no cambian con el registro manual (FR-003).

**Alternativas consideradas**:
- **Opción A**: El materializador borra el registro manual en el mes en curso. → **Rechazada**: el usuario elige el importe manual (neto real).
- **Opción B**: El materializador ajusta el importe del registro manual. → **Rechazada**: el importe manual es el neto real, no calculado.
- **Opción C**: El materializador respeta el registro existente. → **Elegida**: idempotencia por registro.

---

### 6. Edición de movimiento de aportación

**Decision**: La edición de un movimiento de aportación (manual o generado) solo permite modificar **importe, nota y fecha**. Tipo, naturaleza y etiqueta son inmutables.

**Rationale**:
- Identidad fija (FR-004): convertir una aportación en gasto normal = borrar y crear uno nuevo.
- El KPI lee el movimiento enlazado, así que un cambio de importe se refleja automáticamente.
- Mover la fecha a otro mes: la fila del registro queda para el mes original (el movimiento editado sigue enlazado).

**Alternativas consideradas**:
- **Opción A**: Permitir editar tipo, naturaleza y etiqueta. → **Rechazada**: degradaría la identidad de la aportación.
- **Opción B**: Mover la fecha cambia el mes del registro. → **Rechazada**: la fila del registro es por mes, no por movimiento.
- **Opción C**: Solo editar importe, nota y fecha; la fecha no afecta el mes del registro. → **Elegida**: identidad fija.

---

## Arquitectura Hexagonal

### Capas involucradas

```
┌─────────────────────────────────────────────────────────┐
│                    Adaptador Inbound                     │
│  (src/app/ + src/infrastructure/primary/)               │
│  - import/movements/action.tsx                          │
│  - movement-form.tsx (tipo «Aportación común»)          │
└─────────────────────────────────────────────────────────┐
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Capa de Aplicación                      │
│  (src/application/)                                      │
│  - MovementUseCase.create()                             │
│  - MovementUseCase.update()                             │
│  - MovementRepository (puerto)                          │
└─────────────────────────────────────────────────────────┐
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Dominio                               │
│  (src/domain/)                                           │
│  - Movement (entidad)                                   │
│  - Tag (entidad, «Aportación Común» protegida)          │
│  - ContributionConfig (entidad)                         │
└─────────────────────────────────────────────────────────┐
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Adaptador Outbound                       │
│  (src/infrastructure/db/)                                │
│  - DrizzleSheetImportRepository                          │
│  - Migraciones (0008: common_contribution_months)       │
└─────────────────────────────────────────────────────────┘
```

### Dependencias

- **Dominio**: cero dependencias externas (principio VII).
- **Aplicación**: depende solo del dominio.
- **Adaptadores inbound**: Next.js, React, Zod.
- **Adaptadores outbound**: Drizzle ORM, SQLite.

---

## Tests

### Unitarios (Vitest)

- **Caso de uso**: `createMovement` con tipo «Aportación común» → escribe movimiento + fila en la misma tx.
- **Regla de unicidad**: segundo movimiento en el mismo mes → error.
- **Borrado**: movimiento manual → elimina fila del registro.

### Componentes (Testing Library)

- **Formulario de movimiento**: tipo «Aportación común» ofrecido con config activa; importe/naturaleza/etiqueta implícitos.
- **Error de unicidad**: mensaje con `role="alert"` al intentar guardar duplicado.

### E2E (Playwright)

- **Escenario**: alta manual de aportación en mes pasado → listado + KPI correctos.
- **Aislamiento**: combinación cuenta/mes propia (convención e2e).

---

## Referencias

- **Spec**: `specs/032-retroactivacion-aportacion-ahorro/spec.md`
- **Constitución**: `.specify/memory/constitution.md` (principios I, III, VII)
- **Materializador vigente**: spec 019/021
- **Importador**: spec 028 (no extendido para «Aportación Común»)
