# Research — Importación de movimientos desde Excel, PoC (028)

**Feature**: 028-importacion-excel | **Fecha**: 2026-11-06

Prueba de concepto: subir la hoja mensual CSV de **una cuenta y un mes** (descargada de Google Drive), previsualizar lo detectado (importable / ignorado / error por fila) y confirmar una importación **transaccional todo-o-nada** por la vía de escritura existente. Este research fija el estado verificado en código, las decisiones de diseño (con sus alternativas desechadas) y resuelve los puntos que la spec delega al plan. Fuente primaria: **muestras reales** «Balance 2026.xlsx - Enero Isma.csv» y «Balance 2026.xlsx - Junio Isma.csv» (aportadas por el propietario, en `~/Downloads`; analizadas 2026-11-06) + decisiones del propietario cerradas hoy (mapeo de `Gasto Fijo`, fusión de nota, entrada UI).

## §1. Estructura del fichero — dialecto congelado con la muestra real (FR-002)

Verificado sobre ambas muestras:

- **CSV RFC 4180** exportado de Google Sheets: separador coma, campos con comillas cuando contienen comas (Junio fila 7: `"Maria, Zoe, Aisha"`), **importes con punto decimal** («7.85», «42.21», «1366.54»), finales de línea CRLF o LF, posible BOM UTF-8.
- **13 columnas en orden fijo** (cabecera exacta): `Fecha de Operación`, `Concepto`, `Descripción`, `Tipo de Transacción`, `Importe`, `Categoría`, `Balance`, `Aportación Común`, `Gastos Comunes`, `Gastos Personales`, `Ahorro`, `Gastos Alimentación`, `Ahorro Total`. Las 7 últimas son **cálculos de la hoja**: siempre se ignoran, jamás se validan ni importan (FR-002).
- **`Fecha de Operación` viene vacía en el 100 % de las filas de ambas muestras** → la resolución por defecto (vacía ⇒ día 1 del mes declarado, decisión clarify) es el caso real, no un edge.
- **Filas totalmente vacías**: bloques enteros de filas en blanco (Enero filas 14–33) → se ignoran (FR-002).
- **Tipos observados**: `Gasto`, `Gasto Común`, `Gasto Fijo`, `Ingreso`, `Ahorro`. Valores de `Categoría`: todos existen en el catálogo seed (`Regalos`, `Ocio`, `Salud`, `Hogar`, `Suscripciones online`, `Alimentación`, `Viaje`, `Ropa`, `Coche`, `Sin Clasificar`); `Nomina` (ingreso) va **sin categoría**; `Ahorros` solo en la fila excluida.
- **Filas de configuración** (Enero filas 34–36): concepto `Aportación Común` con tipo `Gasto Fijo` (1920), `Nomina`/`Ingreso`, `Ahorro`/`Ahorro` (600). Las excluidas por FR-003 son exactamente: **concepto `Aportación Común` (comparación exacta tras trim) o tipo `Ahorro`**. La fila de Junio «Aportación Cuenta Común» (tipo `Gasto Común`, 1000) **no** coincide con el concepto excluido ⇒ se importa como gasto compartido de `Hogar`, conforme a la regla congelada.

**Parser: implementación propia, sin dependencia nueva.** Un módulo puro (~50 líneas) que cubre RFC 4180 estricto (comillas, comillas escapadas `""`, comas dentro de comillas, CRLF/LF, BOM) + validación de cabecera exacta. No existe ninguna librería CSV en `package.json` (verificado).

- **Rationale**: la muestra es un CSV simple y estable; el parser estricto son menos líneas que la integración de `papaparse` (~40 KB min) y mantiene el árbol de dependencias del monolito mínimo (constitución I). La decisión clarify «CSV en vez de xlsx» ya evitó la dependencia de lectura de Excel; añadir una librería CSV ahora contradiría su motivación.
- **Alternativas desechadas**: `papaparse` (dependencia nueva innecesaria para 13 columnas); usar `xlsx`/`exceljs` para leer `.xlsx` nativo (rechazado en clarify).

## §2. Tabla de mapeo congelada — verificación numérica contra la propia hoja (FR-003)

La hoja calcula sus buckets con los tipos; la verificación contra la columna derivada de la fila resumen de Enero confirma el mapeo columna a columna:

- Σ filas tipo `Gasto` (50 + 7.85 + 25.9 + 44 + 12 + 2 + 40 + 5) = **186,75 = valor exacto de la columna «Gastos Personales»** ⇒ `Gasto` → gasto de naturaleza **personal**.
- Las 4 filas `Gasto Común` (16 + 42.21 + 11.41 + 3.9) alimentan la columna «Gastos Comunes» ⇒ `Gasto Común` → gasto de naturaleza **compartido** (pagado desde la cuenta personal — paridad del escenario 2 de 001/002).
- `Gasto Fijo` solo aparece en la fila excluida «Aportación Común» en ambas muestras; su bucket es la columna «Aportación Común». **Decisión del propietario (2026-11-06)**: si apareciese en otra fila, se mapaea como `Gasto` — gasto **personal** + etiqueta de la categoría (coherente con 019: la aportación se anota como gasto propio).
- `Ingreso` → ingreso sin naturaleza, **etiqueta opcional** (la `Categoría` de la hoja si existe: Junio la lleva en «Hacienda»→`Sin Clasificar` y «Cumpleaños Isma»→`Regalos`; «Nomina» va sin categoría).
- `Ahorro` → fila ignorada por configuración (el ahorro vive en el KPI informativo de 023, no como movimiento).

**Tabla congelada** (se replica en data-model §3):

| Tipo de Transacción | tipo | naturaleza | etiqueta | estado |
|---|---|---|---|---|
| `Gasto` | expense | personal | `Categoría` (obligatoria) | importa |
| `Gasto Común` | expense | shared | `Categoría` (obligatoria) | importa |
| `Gasto Fijo` | expense | personal | `Categoría` (obligatoria) | importa (si no es la fila excluida) |
| `Ingreso` | income | — | `Categoría` (opcional) | importa |
| `Ahorro` | — | — | — | **ignorada** (config) |
| (concepto `Aportación Común`) | — | — | — | **ignorada** (config) |

El mapeo es **independiente de la cuenta de destino** (la hoja declara su semántica por tipo; el usuario elige la cuenta correcta al subir). El dominio vigente lo tolera sin excepciones: `Movement.create` solo exige naturaleza no nula en gastos y el par tipo/naturaleza resultante siempre es válido en cualquier cuenta (FR-006, sin bypass).

- **Alternativas desechadas**: rechazar tipos personales en cuenta común (sobre-ingeniería para un PoC de uso individual); mapear `Gasto Fijo` a error (contradice FR-003, que lo lista importable); derivar naturaleza de la cuenta de destino (rompería la semántica de la hoja de un miembro, donde `Gasto Común` es compartido aunque la cuenta sea personal).

## §3. Nota fusionada — «Concepto — Descripción» (decisión del propietario, 2026-11-06)

Desde 014 el movimiento tiene una única `note` obligatoria. Regla congelada para importar: `nota = concepto` si la descripción está vacía; `nota = "{concepto} — {descripcion}"` (raya) si ambas existen. Ej. muestra: «Regalo — Cumple David», «Carrera — OPie Randobike», «Fisio». Una fila sin concepto **ni** descripción produce nota vacía ⇒ error de fila con el mensaje de dominio («La nota es obligatoria.», vía `Movement`); una fila con solo descripción usa la descripción como nota.

- **Alternativas desechadas**: «Concepto: Descripción» (elegida por el propietario la raya); descartar la descripción (pérdida de información gratuita).

## §4. Entrada UI — página `/import` + nav «Importar» (decisión del propietario, 2026-11-06)

Asistente de dos pasos en página propia: (1) selección — `Select` de cuenta (nombres derivados de `ListAccounts`), `Select` de mes (ventana `buildMonthWindow(currentMonth(), 24)`, paridad de `MonthSelector`) y fichero CSV; (2) previsualización — totales por tipo, filas con errores, filas ignoradas, etiquetas que se crearán y tabla de movimientos; confirmación solo con 0 errores y ≥1 movimiento. Enlace nuevo «Importar» en `GlobalNav` (nueva clave `active: "import"`; no necesita `month`).

- **Alternativa desechada**: diálogo desde el panel `/` (espacio insuficiente para la tabla de previsualización de 50–100 filas; el patrón de diálogos del repo es para formularios compactos).

## §5. Acción directa + `useTransition` con el `File` en estado del cliente (excepción ADR 0015)

El asistente **no** usa `useActionState` + `<form action>`: React 19 restablece los inputs **no controlados** al resolverse la action (convención SC-004/027), lo que vaciaría el `<form>` — y un `<input type="file">` no puede ser controlado ni restaurado con `defaultValue`. Patrón congelado (familia ADR 0015, «consulta con resultado, no estado de formulario»):

- El `File` se guarda en estado del cliente (`onChange` del input); la acción se invoca **directamente** (`importSheetAction({accountId, month, intent, file})`) dentro de `useTransition`, dos veces con el mismo fichero: `intent: "preview"` y `intent: "confirm"`.
- **La confirmación re-parsea y re-valida en servidor**: no se confía en nada calculado por el cliente; si el catálogo cambió entre previsualizar y confirmar (p. ej. una etiqueta se desactivó), el plan recalculado contiene errores y la acción devuelve el estado de error «La previsualización ya no es válida…», con lo que el asistente vuelve al paso 1.
- Cualquier cambio de cuenta/mes/fichero tras previsualizar **invalida la previsualización en cliente** (vuelve al paso 1): se evita confirmar algo distinto de lo revisado.
- Límite práctico: hoja mensual ~5–10 KB; el límite por defecto de Server Actions (1 MB) sobra. Se añade guard explícito de tamaño en la acción (≤ 512 KB) con mensaje propio.

## §6. Atomicidad todo-o-nada — nuevo puerto `SheetImportRepository` (FR-005)

No existe UnitOfWork en la aplicación (verificado: las únicas `db.transaction` viven en adaptadores Drizzle, p. ej. `DrizzleTagRepository.mergeInto` y los `registerMaterialization` de 018/019/023 — el patrón del repo es «método multi-escritura en el puerto, transacción dentro del adaptador»). Se sigue exactamente ese patrón:

- **Puerto nuevo** en `src/application/import/SheetImportRepository.ts`: `persist(plan): Promise<{movementsCreated, tagsCreated}>`.
- **Adaptador** `DrizzleSheetImportRepository`: una sola `db.transaction` que (1) resuelve slugs únicos de las etiquetas nuevas contra el catálogo (paridad `deriveTagSlug` + sufijo `-2…` de `CreateTag`), las inserta (activas, en la categoría genérica, `categoryId` resuelto por el caso de uso) y recupera sus ids; (2) por cada movimiento construye `Movement.create(...)` — **validación de dominio dentro de la transacción**, cualquier `InvalidMovementError`/`InvalidMoneyError` revierte todo — y lo inserta.
- Los casos de uso calculan el plan dos veces (previsualizar y confirmar) con un **núcleo puro compartido** `buildSheetImportPlan` (sin IO); la confirmación lo recalcula fresco y solo persiste si no hay errores.
- Creación de etiquetas en caliente: nacen en la genérica «General» (`DEFAULT_CATEGORY_SLUG`), activas, con slug único — misma regla que `CreateTag` (017/026/027); la deduplicación de categorías repetidas dentro del fichero es una sola etiqueta (dedupe por `lower(name)`).

**Alternativas desechadas**: UnitOfWork/composición de transacción en aplicación (patrón nuevo no justificado, constitución VII + I); llamar a `CreateTag` + `CreateMovement` secuencialmente (no atómico: una etiqueta quedaría creada si un movimiento falla — viola FR-005); escritura SQL directa desde la action (prohibido, constitución V y FR-006).

## §7. Resolución de etiquetas de las categorías de la hoja (Edge Cases + FR-006)

- **Match exacto case-insensitive** contra las etiquetas **activas** (paridad de `findByName` con índice `lower(name)` — `tags_name_nocase_uq`).
- **Categoría sin equivalente activo**: se crea la etiqueta con ese nombre en la genérica (decisión clarify), listada en la previsualización («Etiquetas que se crearán»).
- **Categoría que solo existe como etiqueta desactivada** → **error de fila** («La etiqueta "{nombre}" está desactivada…»): no puede crearse un duplicado (índice `lower(name)` único, verificado en schema) ni reactivarse en silencio (la reactivación es una acción explícita de 004). El usuario puede reactivarla en `/tags` y re-importar.
- **Gasto sin categoría** → error de fila (etiqueta obligatoria en gastos desde 014). **Ingreso sin categoría** → sin etiqueta (opcional).
- El slug de las nuevas se resuelve **en la transacción de persistencia** (el catálogo vive allí); la previsualización solo muestra nombres.

## §8. Fechas — mes declarado en la UI (Edge Cases, clarify 2026-11-06)

- Fecha vacía (el 100 % de las muestras) ⇒ **día 1 del mes seleccionado** (`{month}-01`).
- Fecha presente ⇒ debe ser ISO real **y del mes declarado** (`YYYY-MM` prefijo); fuera de mes ⇒ error de fila. La validación de calendario real la aporta `Movement` (única fuente); la pertenencia al mes la añade el núcleo puro (necesita el mes declarado).

## §9. E2E — aislamiento cuenta/mes (FR-009, constitución III, convención AGENTS)

Años tocados por los specs existentes (verificado): **2023** (informe anual, «año vacío»), **2024** (informe `YEAR`), **2025** (`/annual?year=2025`, `/summary?month=2025-01`), **2026** (año en curso, múltiples), **2028** (año vacío). Ranura libre: **2027**, dentro de la ventana ±24 meses de `buildMonthWindow` (seleccionable en el Select del asistente). Combinación congelada: **Cuenta común · marzo 2027**, fichero propio del spec generado con `page.setInputFiles` (payload en buffer, sin fixture en disco).

- El fichero e2e usa **solo categorías existentes en el seed** (como la muestra real): la importación e2e no crea etiquetas y no contamina el catálogo global que `jerarquia-etiquetas.spec.ts` (que corre después, orden alfabético con `workers: 1`) verifica. La creación de etiquetas queda cubierta en unitarios/integración.
- Orden alfabético: `importacion-excel` corre antes que `informe-anual-gastos` — ninguno de los dos lee el año del otro (2027 vs 2023/2024), sin interferencias.

## §10. Matriz de cobertura de tests (FR-009, SC-004)

| Nivel | SUT | Casos clave |
|---|---|---|
| Unitario (node) | `parse-sheet-csv` | RFC 4180 (comillas, comas embebidas, `""`, CRLF, BOM), cabecera exacta, filas vacías, fila con nº columnas ≠ 13 |
| Unitario (node) | `buildSheetImportPlan` | Un caso por tipo de la tabla §2, exclusión config, fecha vacía→día 1 / fuera de mes→error, nota fusionada, importes (punto decimal, céntimos, 0/negativo/coma/mal formato→error fila), categoría faltante por tipo, tag activa/inactiva/nueva, dedupe de nuevas, totales, colección completa de errores |
| Unitario (node) | `BuildSheetImportPreview` / `ConfirmSheetImport` | Dobles en memoria; confirm rechaza plan con errores; nada persiste sin confirmación |
| Integración (node) | `DrizzleSheetImportRepository` | libsql `:memory:` + migraciones: persiste N+M; **fallo intermedio ⇒ rollback total** (ni etiquetas ni movimientos) |
| Unitario (node) | `importSheetAction` | `vi.mock` de los casos de uso: Zod de args, fichero (vacío, demasiado grande, sin CSV válido → error de formato), estados preview/imported/error |
| Componente (ui/jsdom) | `import-sheet-wizard` | Pasos, totales y filas renderizadas, confirmar deshabilitado con errores, cambio de parámetro invalida previsualización, éxito con enlace |
| E2E (Playwright) | `importacion-excel.spec.ts` | Subida → previsualización → confirmación → listado de Cuenta común · 2027-03; fichero con fila inválida → error visible y nada creado; estructura no reconocida → error de formato |

## §11. NEEDS CLARIFICATION — resumen

Ninguno pendiente: los tres puntos abiertos (mapeo de `Gasto Fijo`, formato de nota fusionada, ubicación de la entrada) se cerraron hoy con el propietario (§2, §3, §4). El resto de incógnitas técnicas quedaron resueltas contra código y muestras reales (§1, §5–§9).
