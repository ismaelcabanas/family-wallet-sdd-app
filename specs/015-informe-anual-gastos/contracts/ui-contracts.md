# Contracts: Informe anual de gastos por categorías

**Branch**: `015-informe-anual-gastos` | **Date**: 2026-11-04

El proyecto es una webapp de uso individual sin API pública; los contratos de esta feature son de **UI/ruta** (frontera usuario ↔ adaptador inbound) y de **componente presentacional** (frontera página ↔ UI).

## C1. Ruta del informe (contrato de URL)

`GET /reports/annual-expenses?year=YYYY`

| Aspecto | Contrato |
|---|---|
| `year` (opcional) | 4 dígitos. Inválido o ausente → fallback al año actual (`currentYear()`), sin error. |
| Render | Server component de lectura pura; sin envíos ni estado mutable. |
| Contenido | `GlobalNav` (con `active: "reports"`) + selector de año + tabla del informe (ver C2). |
| Título | «Informe anual de gastos» + año consultado. |

## C2. Tabla del informe (contrato de componente)

`<AnnualCategoryExpenseReportTable report={AnnualCategoryExpenseReportDTO} />` — server component presentacional puro; renderiza exactamente los datos del DTO, sin recalcular nada (constitución VII).

| Región | Contrato |
|---|---|
| Cabecera | Columna «Categoría» + 12 columnas de mes (etiquetas cortas «Ene»…«Dic») + columna final «Media anual». |
| Filas | Una `<tr>` por `report.rows` **en el orden del DTO** (orden catálogo: genérica primero, resto alfabético es-ES). Importes `formatAmountCents`. |
| Fila total 1 | `<tfooter>` «Gasto mensual» con `monthlyTotalCents[i]` y `monthlyTotalAverageCents` en la columna final. |
| Fila total 2 | `<tfooter>` «Gastos personales» con `monthlyPersonalTotalCents[i]` y `personalTotalAverageCents`. |
| Accesibilidad | `<table>` con `<caption>`/`aria-label` «Informe de gastos por categoría de {año}»; celdas `<td>`/`<th scope="row">` semánticas. |
| Responsive | Contenedor con scroll horizontal (`overflow-x-auto`); 12 columnas siempre presentes (meses vacíos a 0,00 €). |

## C3. Selector de año (contrato de componente)

`<YearSelector year basePath />` (generalización del de 009, retrocompatible: `basePath` opcional, por defecto `"/annual"`). Cliente: `Select` con ventana `buildYearWindow(year, 6)`; al cambiar navega a `{basePath}?year={año}` con `router.replace` en `useTransition`. Para esta feature se instancia con `basePath="/reports/annual-expenses"`.

## C4. Menú «Informes» (contrato de navegación)

`<ReportsNavMenu active />` — client component dentro de `GlobalNav`:

- Trigger con etiqueta visible «Informes»; menú desplegable (shadcn `DropdownMenu`) con **un único ítem**: «Gastos por categoría» → `/reports/annual-expenses`.
- Ítem con `aria-current="page"` + énfasis visual cuando `active === "reports"`.
- Los enlaces existentes de `GlobalNav` (Panel `/`, Resumen `/summary`, Cuenta de resultados `/annual`, Etiquetas `/tags`) permanecen invariables en destino y comportamiento (FR-004).

## C5. Contrato del caso de uso (frontera aplicación)

`GetAnnualCategoryExpenseReport.execute(year: string): Promise<AnnualCategoryExpenseReportDTO>` — valida `^\d{4}$` (error de dominio en caso contrario); DTO definido en `data-model.md`. No expone puertos nuevos ni muta nada.
