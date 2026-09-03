# Contrato: Server Action `createMovement`

**Feature**: `002-registro-movimientos` | **Adaptador**: `src/infrastructure/primary/actions/create-movement.action.ts`

Única frontera de mutación de la feature. La UI la consume vía `useActionState`; no existe endpoint HTTP público (decisión ADR 0008, ver [research.md §2](../research.md)).

---

## 1. Entrada (FormData)

| Campo | Tipo FormData | Obligatorio | Reglas de validación (Zod) |
|---|---|---|---|
| `date` | string `YYYY-MM-DD` | Sí | Fecha ISO de calendario **real** válida: rechaza 31 en meses de 30, 29 de febrero en no bisiestos, etc. (bisiestos aceptados). El rango mensual de las queries cubre febrero/bisiestos por construcción (`[mes-01, mesSiguiente-01)`). |
| `concept` | string | Sí | No vacío tras trim. |
| `description` | string | No | Trim; `null` si vacío. |
| `amount` | string | Sí | Regex `^\d{1,9}([.,]\d{1,2})?$`. Acepta "850", "850,00", "850.00"; con un decimal se rellena a 2 ("850,5" → 850,50). **Rechaza** separadores de miles ("1.234,56") y más de 2 decimales ("850,005") como formato inválido. Parseo a céntimos por manipulación de string (pad a 2); resultado > 0. |
| `accountId` | string (dígitos) | Sí | Entero positivo; la cuenta existe. |
| `type` | `'expense' \| 'income'` | Sí | Enum. |
| `nature` | `'personal' \| 'shared'` | Condicional | Obligatorio si `type = 'expense'`. Prohibido si `type = 'income'`: la UI no lo envía para ingresos y, si llegara un valor, **se rechaza** con error de validación. La UI lo envía preseleccionado (`'personal'` en cuentas personales; fijo `'shared'` en la común). |
| `tagIds` | múltiples strings (checkboxes) | No | 0..n; enteros; deduplicado; cada tag existe y está activa. Si llega vacío, el caso de uso asigna la tag por defecto "Sin Clasificar" (FR-006). |

Notas:
- `amount` llega como **string** (input del formulario); jamás se parsea con `parseFloat` (FR-003).
- `accountId` llega como **campo oculto** fijado por la cuenta activa del contexto (no editable en el formulario, ver [ui-contract.md §2.3](./ui-contract.md)); se valida igualmente en la frontera.
- Selección múltiple de tags via checkboxes del catálogo activo.

## 2. Salida (estado para `useActionState`)

```ts
type CreateMovementState =
  | { status: 'idle' }                                    // estado inicial
  | { status: 'success'; message: string }                // p. ej. "Movimiento guardado"
  | {
      status: 'error'
      errors: Partial<Record<                              // errores POR CAMPO (FR-011)
        | 'date' | 'concept' | 'amount'
        | 'accountId' | 'type' | 'nature' | 'tagIds' | '_form'
      , string[]>>
      values: {                                            // valores introducidos conservados
        date: string; concept: string; description: string
        amount: string; accountId: string; type: string
        nature: string; tagIds: string[]
      }
    }
```

- `_form`: errores no atribuibles a un campo (p. ej. fallo inesperado de persistencia).
- `values`: los inputs renderizan estos valores como `defaultValue` tras un fallo (FR-011/FR-015).

## 3. Mensajes de error por campo (español, FR-012)

| Campo / condición | Mensaje |
|---|---|
| `date` ausente/inválida | "Indica una fecha válida." |
| `concept` vacío | "El concepto es obligatorio." |
| `amount` vacío | "El importe es obligatorio." |
| `amount` formato inválido | "Introduce un importe válido (ej. 850,00)." |
| `amount` ≤ 0 | "El importe debe ser mayor que cero. Los abonos se registran como ingresos." |
| `accountId` ausente/inválido | "Selecciona una cuenta." |
| `type` ausente | "Selecciona el tipo de movimiento." |
| `nature` ausente en gasto | "Selecciona la naturaleza del gasto (personal o compartido)." |
| `nature` presente en un ingreso | "Los ingresos no llevan naturaleza." |
| `tagIds` con id inexistente/inactiva | "Una de las etiquetas seleccionadas ya no está disponible." |
| `_form` error inesperado | "No se ha podido guardar el movimiento. Inténtalo de nuevo." |

## 4. Comportamiento (side effects)

1. **Éxito**: persiste vía `CreateMovement` (use case + puerto `MovementRepository`, transacción `db.batch` con sus tags; asigna la tag por defecto "Sin Clasificar" si no se seleccionó ninguna), `revalidatePath('/')` (listado + balances refrescados en el mismo roundtrip), devuelve `{ status: 'success' }`; la UI muestra toast, resetea el formulario y permanece en la pantalla (FR-015).
2. **Fallo de validación**: **nada se persiste**; devuelve errores por campo + valores conservados.
3. **Excepción de dominio** (p. ej. `InvalidMovementError`): mapeada a `errors` del campo correspondiente.
4. La action NO hace redirect ni navegación.
