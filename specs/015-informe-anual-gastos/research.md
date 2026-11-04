# Research: Informe anual de gastos por categorías

**Branch**: `015-informe-anual-gastos` | **Date**: 2026-11-04

## R1. Ruta y URL del informe

- **Decision**: Ruta nueva `/reports/annual-expenses` con query param `?year=YYYY` (por defecto, año actual vía `currentYear()` de `ui/format.ts`).
- **Rationale**: Espacio de nombres propio para «Informes» que hoy contiene un solo informe pero está preparado para los anotados como futuros (aportaciones por miembro/mes, drill-down mensual ~028). El patrón `?year=` replica exactamente el de `/annual` (009): validación Zod `z.string().regex(/^\d{4}$/)` sobre `searchParams` y fallback al año actual.
- **Alternativas consideradas**: `/annual-expenses` (plano, sin hueco para más informes); `/reports/gastos` (identificador no inglés, contra la convención de código en inglés de la constitución VI).

## R2. Selector de año

- **Decision**: Reutilizar `year-selector.tsx` generalizándolo con una prop opcional `basePath` (por defecto `"/annual"`, el nuevo informe pasa `"/reports/annual-expenses"`); misma ventana `buildYearWindow(year, 6)` y navegación `router.replace` en `useTransition`.
- **Rationale**: El componente actual hardcodea `/annual?year=`; una prop opcional es el cambio mínimo sin romper 009. La ventana de ±6 años resuelve el rango de «años navegables» que la spec deja al plan (alcance razonable para un uso familiar; sin borde inferior porque los datos históricos son limitados).
- **Alternativas consideradas**: Componente nuevo duplicado (viola DRY sin beneficio); años derivados de `SELECT DISTINCT` sobre movimientos (año vacío rompería la navegación hacia años sin datos y añade un puerto nuevo innecesario).

## R3. Menú «Informes» en la navegación global

- **Decision**: `global-nav.tsx` (server) añade un quinto destino mediante un subcomponente cliente `reports-nav-menu.tsx` (shadcn `DropdownMenu`, patrón ya usado en `tag-catalog.tsx` / `account-card-grid.tsx`) con un único ítem «Gastos por categoría» → `/reports/annual-expenses`. Nueva variante de `active: "reports"`.
- **Rationale**: GlobalNav es un server component sin estado; un dropdown requiere interactividad, así que se aisla en un client component mínimo que recibe `active` como prop. Los enlaces existentes (Panel, Resumen, Cuenta de resultados, Etiquetas) quedan intactos (FR-004).
- **Alternativas consideradas**: Menú CSS `:hover` sin JS (inaccesible en táctil); `NavigationMenu` de shadcn (no está copiado en el repo; añadirlo es más superficie que un DropdownMenu ya versionado).

## R4. Fuente de datos y agregación (sin cambios de esquema)

- **Decision**: El caso de uso `GetAnnualCategoryExpenseReport` compone tres lecturas existentes: `MovementRepository.listByYear(year)`, `TagRepository.findAll()` (mapea `tagId → categoryId`, **incluye desactivadas**) y `CategoryRepository.findAll()` (todas las categorías, genérica identificada por `DEFAULT_CATEGORY_SLUG`). La matriz, exclusiones, medias y totales se calculan en un agregado puro de dominio `AnnualCategoryExpenseReport.fromMovements(...)` (estilo `AnnualIncomeStatement`).
- **Rationale**: La convención del repo es que los repositorios devuelven filas (`MovementDTO[]`) y la aritmética viva en el dominio; `MovementDTO.tag` no expone `categoryId` (y 027 congela `MovementTagDTO`), así que el join tag→categoría se hace en memoria en el caso de uso con `TagRepository.findAll()` — cero cambios de DTO/esquema (FR-005). Usar `findAll()` (no `findAllActive()`) garantiza que gastos históricos con etiqueta desactivada computen (escenario 8).
- **Alternativas consideradas**: Extender `MovementTagDTO` con `categoryId` (toca el DTO congelado por 027 y arrastra el join a todas las lecturas de movimientos); query SQL agregada `GROUP BY category, month` (rompe el patrón dominio-calcula y duplica la lógica de exclusión fuera del dominio); nuevo puerto `listExpenseLinesByYear` (más superficie sin necesidad: el volumen familiar es decenas de movimientos/mes).

## R5. Exclusión de la aportación común

- **Decision**: El agregado de dominio excluye por etiqueta protegida: `isProtectedTagSlug` / `CONTRIBUTION_TAG_SLUG` (`src/domain/tag/SystemTags.ts`) — regla declarativa por etiqueta, agnóstica de la materialización.
- **Rationale**: Lo fija la spec (asunción explícita): si un usuario registra a mano un gasto con esa etiqueta, también queda excluido.
- **Alternativas consideradas**: Excluir por introspección de `common_contribution_months` (acopla el informe a la infraestructura de 019/021 y no cubre el gasto manual).

## R6. Definición operativa de «gasto personal» (fila de totales)

- **Decision**: Gasto personal = `type = "expense"` **AND** `nature = "own"` **AND** cuenta de tipo personal (la columna `type` de `accounts` distingue personales de la común), excluida la etiqueta protegida. El caso de uso pasa al dominio el tipo de cada cuenta (`AccountRepository.findAll()` ya devuelve `AccountDTO` con el tipo y el nombre derivado).
- **Rationale**: La spec FR-002 dice «gastos de naturaleza propia registrados en las cuentas de los miembros»: exige ambas condiciones (naturaleza propia + cuenta personal), que es además la semántica del KPI «Gasto personal» de 022/024. La exclusión de la aportación común aplica también aquí (edge case «Gasto personal y aportación»).
- **Alternativas consideradas**: Solo `nature = "own"` sin filtrar cuenta (un gasto propio anotado en la común no está «en las cuentas de los miembros»); recalcular restando la aportación al total mensual (frágil si existen gastos manuales con la etiqueta protegida).

## R7. Media anual ÷ 12 y redondeo

- **Decision**: Media = total anual ÷ 12 con redondeo half-up al céntimo, calculado en el dominio (`Math.floor(totalCents / 12 + 0.5)` para positivos, encapsulado en el agregado); siempre ÷ 12, también en año en curso.
- **Rationale**: Decisión cerrada del propietario (spec, edge cases). El patrón de céntimos enteros evita coma flotante (ADR 0007).
- **Alternativas consideradas**: Dividir por meses con datos o transcurridos (descartado explícitamente por el propietario).

## R8. Aislamiento e2e

- **Decision**: Spec nueva `e2e/informe-anual-gastos.spec.ts` que opera en un **año propio** (p. ej. `2024`, no usado por ningún spec existente — `cuenta-resultados-anual` usa 2027) y registra sus movimientos en ese año; al ser orden alfabético con `workers: 1`, su posición no depende del estado que dejen otros ficheros más allá del seed.
- **Rationale**: El informe lee todas las cuentas y meses del año; solo un año exclusivo garantiza determinismo sobre la BD compartida (convención AGENTS.md). El seed siembra en meses del año actual, así que 2024 queda vacío y determinista para el spec.
- **Alternativas consideradas**: Año actual (colisiona con los agregados de mes en curso que otros specs escriben).

## R9. Presentación de la tabla ancha

- **Decision**: Tabla semántica `<table>` dentro de un contenedor `overflow-x-auto` (13 columnas + cabecera de fila); cabeceras de mes con `MONTH_SHORT_LABELS` («Ene»…«Dic») y columna final «Media anual»; primera columna sticky no necesaria en v1. Componente server presentacional puro `annual-expense-report-table.tsx`.
- **Rationale**: Estructura fija tipo Excel pedida por la spec; scroll horizontal es el mecanismo responsive mínimo para móvil; la UI solo anida datos ya agregados (constitución VII).
- **Alternativas consideradas**: Cartas/tarjetas por mes (pierde la vista anual de un vistazo); tabla con columnas ocultas en móvil (oculta meses).

## R10. Ubicación del código por capas

- **Decision**: Dominio `src/domain/movement/AnnualCategoryExpenseReport.ts`; aplicación `src/application/movement/GetAnnualCategoryExpenseReport.ts` + DTOs en `src/application/movement/dto.ts`; adaptador inbound `src/app/reports/annual-expenses/page.tsx` + UI en `src/infrastructure/primary/ui/` (`annual-expense-report-table.tsx`, `reports-nav-menu.tsx`, generalización de `year-selector.tsx`). Tests co-localizados; repositorios existentes sin cambios.
- **Rationale**: Réplica exacta del patrón vigente de 009 (`GetAnnualIncomeStatement` + `AnnualIncomeStatement`) — sin puertos nuevos, sin fábrica de composición (el wiring inline por página es la convención).
- **Alternativas consideradas**: Carpeta `src/application/report/` separada (un solo contexto delimitado; el informe de gastos es un agregado más del contexto de movimientos).
