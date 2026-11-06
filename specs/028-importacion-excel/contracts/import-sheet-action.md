# Contrato de la Server Action: importSheetAction

**Feature**: 028-importacion-excel | **Fichero**: `src/infrastructure/primary/actions/import-sheet.action.ts` | **Tipo**: acción directa (familia ADR 0015: devuelve un resultado, se invoca con `useTransition`; no es `useActionState` + FormData — el `File` viaja como argumento desde estado del cliente)

## 1. Firma y entrada

```ts
importSheetAction(input: {
  accountId: string;   // dígitos
  month: string;       // "YYYY-MM"
  intent: "preview" | "confirm";
  file: File;          // CSV de la hoja mensual
}): Promise<ImportSheetResult>
```

Validación Zod en frontera (constitución IV). Mensajes congelados:

| Campo | Regla | Mensaje |
|---|---|---|
| `accountId` | `^\d+$` | «Selecciona una cuenta.» |
| `month` | `^\d{4}-(0[1-9]|1[0-2])$` | «Selecciona un mes.» |
| `intent` | `"preview" \| "confirm"` | «No se ha podido procesar la importación. Inténtalo de nuevo.» |
| `file` | presente | «Adjunta el fichero CSV de la hoja mensual.» |
| `file` | tamaño ≤ 512 KB | «El fichero es demasiado grande (máximo 512 KB).» |
| `file` | nombre con extensión `.csv` | «El fichero debe ser un CSV exportado de Google Sheets.» |

## 2. Errores de fichero (parseo, FR-002) — `{ status: "error"; message }`

| Condición | Mensaje |
|---|---|
| Codificación/CSV ilegible (comillas sin cerrar, etc.) | «El fichero no es un CSV válido.» |
| Cabecera ≠ 13 columnas exactas (`SHEET_COLUMNS`) | «La estructura del fichero no coincide con la esperada (cabecera de 13 columnas de la hoja mensual).» |
| Sin filas de datos tras descartar vacías | «El fichero no contiene movimientos.» |

Los errores **de fila** no son errores de action: viajan en la previsualización (`preview.rows[].status: "error"` con `reason`).

## 3. Resultados

```ts
type ImportSheetResult =
  | { status: "idle" }
  | { status: "preview"; preview: SheetImportPreviewDTO }
  | { status: "imported"; movementsCreated: number; tagsCreated: number; accountId: number; month: string }
  | { status: "error"; message: string };
```

| Estado | Cuándo | Contenido |
|---|---|---|
| `idle` | Estado inicial del asistente | — |
| `preview` | `intent: "preview"` y plan calculado | `SheetImportPreviewDTO` completa (incluye filas con error e ignoradas; data-model §4) |
| `imported` | `intent: "confirm"` y persistencia atómica completada | Contadores + `accountId`/`month` para el enlace de éxito |
| `error` | Args inválidos, fichero inválido, cuenta inexistente, o plan inválido al confirmar | `message` (tablas §1, §2 y §4) |

## 4. Mapeo de errores de aplicación (confirm y preview)

| Excepción/condición | Mensaje |
|---|---|
| `AccountNotFoundError` | «Selecciona una cuenta.» |
| `CategoryNotFoundError` (sin categoría genérica) | «No se ha podido preparar la importación (falta la categoría General). Inténtalo de nuevo.» |
| Confirm con plan con errores o 0 movimientos (catálogo o fichero cambiaron desde la previsualización) | «La previsualización ya no es válida (p. ej. una etiqueta ha cambiado). Revisa el fichero y vuelve a previsualizarlo.» |
| Error inesperado de persistencia (rollback) | «No se ha podido importar. No se ha creado ningún movimiento; inténtalo de nuevo.» |

## 5. Efectos

- **Solo `intent: "confirm"` en éxito** escribe: `revalidatePath("/", "layout")` (pueden crearse etiquetas — paridad 027 con el Select «Etiqueta»; cubre listados y KPIs). `preview` nunca persiste ni revalida.
- La confirmación **re-parsea y re-valida** el fichero recibido (no confía en la previsualización previa; research §5).
