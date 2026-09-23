# Contrato de UI: Cuenta de Resultados Anual

**Feature**: `009-cuenta-resultados-anual` | **Ruta**: `src/app/annual/page.tsx` (`/annual`) | **Componentes**: `src/infrastructure/primary/ui/annual-statement-panel.tsx` (servidor), `src/infrastructure/primary/ui/year-selector.tsx` (cliente)

Vista nueva de ámbito anual familiar (todas las cuentas, 12 meses), independiente de la pantalla principal (002/005) y del resumen global mensual (006). Ninguna de las dos se altera salvo los enlaces de entrada (§1.2).

---

## 1. Navegación y URL (FR-001, FR-007)

### 1.1 Ruta `/annual`

> El path va en inglés por consistencia con los identificadores de código (constitución VI); la UI visible permanece en español ("Cuenta de resultados de {Año}", "Volver").

- Server component fino (adaptador): valida `searchParams.year` con Zod (`/^\d{4}$/`); si falta o es inválido, por defecto al año actual (`currentYear()`).
- URL canónica: `/annual?year=YYYY`. El cambio de año actualiza la URL con `router.replace` (mismo patrón del selector de 006, sin recarga completa).
- Estructura de la página: enlace "Volver" a `/` + título + selector de año + panel (§2).

### 1.2 Enlaces de entrada

- En `/` (cabecera, junto a "Resumen global"): enlace **"Cuenta de resultados"** → `/annual?year={año del mes activo del selector}` (preserva el contexto temporal). Único cambio en la pantalla principal.
- En `/summary` (cabecera, junto a "Volver"): enlace **"Cuenta de resultados"** → `/annual?year={año del mes visible}`. Único cambio en `/summary`.
- En `/annual` (cabecera, junto a "Volver"): enlace **"Resumen global"** → `/summary?month={año visible}-01` (las dos vistas derivadas familiares quedan cruzadas; abre el resumen del enero del año visible).

### 1.3 Selector de año (`year-selector.tsx`)

- Componente cliente reutilizable, análogo exacto al `month-selector.tsx` de 006: `Select` shadcn con `aria-label="Año visible"`, opciones de `buildYearWindow(year, 6)` (13 años, radio ±6), etiqueta literal `String(year)`, navegación a `/annual?year=...` vía `router.replace` dentro de `startTransition`.

## 2. Estructura de la página y el panel

```text
/annual?year=2026
┌───────────────────────────────────────────────────────────────────────────┐
│ ← Volver   Resumen global        Family Wallet                            │
│                                                                           │
│ [Año ▾]                                                                   │  ← year-selector
│                                                                           │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ Cuenta de resultados de 2026                                          │ │  ← ÚNICO título visible
│ │                                                                       │ │
│ │ │ (scroll horizontal en pantallas estrechas)                          │ │
│ │ │              Ene    Feb  …  Dic      Total año   Media mensual      │ │
│ │ │ Miembro A   2100,00  …             25.200,00      2.100,00          │ │  ← tabla mensual
│ │ │ Miembro B   1600,00  …             19.200,00      1.600,00          │ │
│ │ │ Cuenta común 1920,00 …             23.040,00      1.920,00          │ │
│ │ │ Total ingresos 5620,00 …           67.440,00      5.620,00          │ │
│ │ │ Gasto real  3970,00  …             47.640,00      3.970,00          │ │
│ │ │ Sin gastos personales 3900,00 …    46.800,00      3.900,00          │ │
│ │ │ Saldo        +1650,00 …            +19.800,00     +1.650,00         │ │
│ │ │ Saldo acumulado +1650,00 …         +19.800,00     —                 │ │  ← sin media
│ │                                                                       │ │
│ │ Desglose de gastos por tag                                            │ │
│ │ │              Ene    Feb  …  Dic      Total año   Media mensual      │ │
│ │ │ Vivienda     850,00  …              10.200,00      850,00           │ │  ← desglose por tag
│ │ │ Hipoteca     850,00  …              10.200,00      850,00           │ │
│ │ │ …                                                                   │ │
│ │ │ Gasto real  3970,00  …              47.640,00      3.970,00         │ │  ← filas de totales
│ │ │ Sin gastos personales 3900,00 …     46.800,00      3.900,00         │ │
│ │                                                                       │ │
│ │ Nota: los gastos con varias tags computan en cada una; las filas      │ │
│ │ pueden no sumar el total de gastos.                                   │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
```

- La página **no añade título propio**: su cabecera es el enlace "Volver" (+ "Resumen global") y "Family Wallet"; el único título visible es el de la tabla mensual — **"Cuenta de resultados de {Año}"** (patrón de 005/006).
- El panel (`AnnualStatementPanel`) expone dos secciones `<section aria-labelledby>`:
  1. **Tabla mensual** (título "Cuenta de resultados de {Año}"): tabla semántica con columna de rótulos + 12 columnas Ene–Dic (abreviaturas de 3 letras: "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic") + "Total año" + "Media mensual". Filas (orden fijo): una por miembro del catálogo (nombre del catálogo), "Cuenta común", "Total ingresos", "Gasto real", "Sin gastos personales", "Saldo", "Saldo acumulado".
  2. **Desglose de gastos por tag** (título "Desglose de gastos por tag"): misma estructura de columnas; una fila por tag con gastos en el año (orden total anual desc, empate alfabético `es`) + filas finales "Gasto real" y "Sin gastos personales" (FR-005); nota permanente de 005/006 bajo la tabla.
- Ambas tablas en contenedor `overflow-x-auto` (scroll horizontal en pantallas estrechas); números como texto, `tabular-nums` para alineación de columnas (opcional de estilo, no contrato).

## 3. Formato, textos y estados

| Elemento | Texto/Formato exacto |
|---|---|
| Enlace entrada en `/` y `/summary` | "Cuenta de resultados" (cabecera) |
| Enlace vuelta en `/annual` | "Volver" (a `/`); "Resumen global" (a `/summary?month={año}-01`) |
| Título tabla mensual | "Cuenta de resultados de {Año}" (p. ej. "Cuenta de resultados de 2026") |
| Cabeceras de mes | "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic" |
| Cabeceras de totales | "Total año", "Media mensual" |
| Filas tabla mensual | Nombre del miembro (catálogo); "Cuenta común"; "Total ingresos"; "Gasto real"; "Sin gastos personales"; "Saldo"; "Saldo acumulado" |
| Importes | `Intl es-ES` EUR con 2 decimales, sin signo (ingresos/gastos); la fila "Saldo" y "Saldo acumulado" usan `formatSignedCents` (`+`/`−` U+2212/sin signo si 0) en celdas, total y media |
| Media mensual | `totalCents / 12` redondeado al céntimo (p. ej. total 100,00 € → 8,33 €); fila "Saldo acumulado" SIN columna de media (celda "—") |
| Celdas sin datos | `0,00 €` explícito en todas las celdas de la tabla mensual (año/mes/miembro sin movimientos); filas de miembros siempre presentes (FR-002/FR-007) |
| Desglose por tag | título "Desglose de gastos por tag"; solo tags con gastos en el año; nota permanente de 005/006 ("Los gastos con varias tags computan en cada una; las filas pueden no sumar el total de gastos.") |
| Estado vacío del desglose por tag | "Sin gastos este año." (año sin gastos; la tabla mensual NO se oculta) |
| Año futuro / sin datos | Estructura completa a ceros, sin errores (FR-007) |
| Idioma | Todo en español (FR-010) |

## 4. Accesibilidad y responsive (guía PoC, mismo criterio que 002/005/006 §4)

- Página con `<main>`; cada sección como `<section aria-labelledby>`; tablas **semánticas** (`<table>` con `<th scope="row">` para rótulos de fila y `<th scope="col">` para meses/totales; `caption` con `sr-only` opcional), como la tabla de miembros de 006.
- Scroll horizontal en contenedor `overflow-x-auto` para las 15 columnas; sin scroll de página; primera columna sin sticky (YAGNI, research §5).
- Números como texto; selector de año con `aria-label="Año visible"`.

## 5. Fuera de este contrato

Cuadre mensual (`010-cuadre-mensual`); gestión de tags (`004`), filtrado/búsqueda (`007`), cuentas y miembros (`008`); exportación/impresión de la vista anual; comparativas entre años, proyecciones y presupuestos; columnas sticky o vista alternada por trimestres; cambios en las regiones de `/` y `/summary` (solo se añaden los enlaces de §1.2).
