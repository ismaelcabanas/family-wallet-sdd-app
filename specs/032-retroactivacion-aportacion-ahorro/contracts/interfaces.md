# Interface Contracts: Registro manual de la aportación común en meses pasados

**Feature**: 032-retroactivacion-aportacion-ahorro  
**Fecha**: 2026-11-11

---

## Resumen

Esta feature no introduce interfaces externas (API pública, CLI, etc.). Los contratos documentados son **internos** (puertos de la capa de aplicación y DTOs de la frontera).

---

## Contratos de la capa de aplicación

### Puerto: MovementRepository

**Ubicación**: `src/application/MovementRepository.ts`

```typescript
export interface MovementRepository {
  create(movement: Movement): Promise<Movement>
  update(movement: Movement): Promise<Movement>
  delete(movement: Movement): Promise<void>
  findAllByAccountAndMonth(accountId: string, mes: string): Promise<MovementDTO[]>
  findCommonContributionByConfigAndMonth(configId: string, mes: string): Promise<CommonContributionMonthDTO | null>
}
```

**Descripción**: Repositorio para operaciones CRUD de movimientos y consultas de aportaciones.

**Implementación**: `src/infrastructure/db/DrizzleMovementRepository.ts`

---

### Puerto: ContributionConfigRepository

**Ubicación**: `src/application/ContributionConfigRepository.ts`

```typescript
export interface ContributionConfigRepository {
  findById(configId: string): Promise<ContributionConfigDTO | null>
  findByAccountAndMonth(accountId: string, mes: string): Promise<ContributionConfigDTO | null>
}
```

**Descripción**: Repositorio para consultas de configs de aportación.

**Implementación**: `src/infrastructure/db/DrizzleContributionConfigRepository.ts`

---

### Caso de uso: CreateMovement

**Ubicación**: `src/application/MovementUseCase.ts`

```typescript
export interface CreateMovementInput {
  accountId: string
  date: string
  note: string | null
  amountCents: number
  type: MovementType
}

export interface CreateMovementOutput {
  success: boolean
  movement?: MovementDTO
  error?: string
}
```

**Descripción**: Crea un movimiento y, si es de tipo «Aportación común», escribe la fila del registro en la misma transacción.

**Lógica**:
1. Validar que la cuenta existe y es personal
2. Si `type === MovementType.CONTRIBUTION_COMMON`:
   - Consultar `common_contribution_months` por `configId` y `mes`
   - Si existe → error (regla de unicidad)
   - Si no existe → INSERT en el registro (idempotencia)
3. Crear el movimiento con `nature = "own"` y `tagId = "contribution-common"`
4. Enlazado: `UPDATE common_contribution_months SET movement_id = ? WHERE config_id = ? AND mes = ?`

---

### Caso de uso: UpdateMovement

**Ubicación**: `src/application/MovementUseCase.ts`

```typescript
export interface UpdateMovementInput {
  movementId: string
  date?: string
  note?: string | null
  amountCents?: number
}

export interface UpdateMovementOutput {
  success: boolean
  movement?: MovementDTO
  error?: string
}
```

**Descripción**: Actualiza un movimiento existente.

**Lógica**:
- Para movimientos de tipo «Aportación común»: solo permitir editar `date`, `note`, `amountCents`
- El registro del mes no cambia (el KPI lee el movimiento enlazado)

---

### DTOs de la frontera

#### MovementDTO

```typescript
export interface MovementDTO {
  id: string
  accountId: string
  date: string
  note: string | null
  amountCents: number
  nature: MovementNature
  tagId: string | null
  type: MovementType
  createdAt: string
  updatedAt: string
}
```

#### CommonContributionMonthDTO

```typescript
export interface CommonContributionMonthDTO {
  id: string
  configId: string
  mes: string
  movementId: string | null
  amountCents: number
  createdAt: string
}
```

#### ContributionConfigDTO

```typescript
export interface ContributionConfigDTO {
  id: string
  accountId: string
  activatedAtMonth: string
  percentage: number
  active: boolean
  createdAt: string
}
```

---

## Contratos de validación (Zod)

### Input de alta de movimiento

```typescript
// src/application/validators/MovementValidator.ts

export const createMovementSchema = z.object({
  accountId: z.string().uuid(),
  date: z.string().date(),
  note: z.string().nullable(),
  amountCents: z.number().int().positive(),
  type: z.enum(['CONTRIBUTION_COMMON', 'PERSONAL', 'SHARED']),
})
```

### Input de edición de movimiento

```typescript
export const updateMovementSchema = z.object({
  movementId: z.string().uuid(),
  date: z.string().date().optional(),
  note: z.string().nullable().optional(),
  amountCents: z.number().int().positive().optional(),
})
```

---

## Contratos de la UI

### Tipo de gasto en el formulario

**Ubicación**: `src/infrastructure/primary/ui/movement-form.tsx`

El formulario de movimiento ofrece un tipo de gasto independiente «Aportación común»:

```typescript
type MovementType = 'CONTRIBUTION_COMMON' | 'PERSONAL' | 'SHARED'

// En el Select de tipo
<Select>
  <option value="PERSONAL">Gasto personal</option>
  <option value="SHARED">Gasto común</option>
  <option value="CONTRIBUTION_COMMON">Aportación común</option>
</Select>
```

**Comportamiento**:
- Si `type === 'CONTRIBUTION_COMMON'`:
  - Naturaleza = `own` (implícita)
  - Tag = «Aportación Común» (implícita)
  - El usuario solo teclea importe, fecha y nota

---

## Contratos de persistencia

### Migración: 0008 (existing)

**Ubicación**: `drizzle/0008-contribution-common-tag.sql`

```sql
-- Ya existe, sin cambios
ALTER TABLE common_contribution_months
  ADD COLUMN movement_id BIGINT REFERENCES movements(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX idx_common_contribution_months_config_mes
  ON common_contribution_months(config_id, mes);
```

**Nota**: Esta migración ya existe desde la feature 021. No se requiere nueva migración.

---

## Contratos de integración

### Server Action: Create Movement

**Ubicación**: `src/infrastructure/primary/actions/movement-create.action.ts`

```typescript
export async function createMovementAction(
  prevState: FormData,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const input = createMovementSchema.parse({
    accountId: formData.get('accountId'),
    date: formData.get('date'),
    note: formData.get('note') || null,
    amountCents: parseInt(formData.get('amountCents')),
    type: formData.get('type'),
  });

  const output = await movementUseCase.execute(input);

  if (!output.success) {
    return { success: false, error: output.error };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
```

---

## Referencias

- **Spec**: `specs/032-retroactivacion-aportacion-ahorro/spec.md`
- **Data Model**: `specs/032-retroactivacion-aportacion-ahorro/data-model.md`
- **Constitución**: `.specify/memory/constitution.md` (principio VII)
