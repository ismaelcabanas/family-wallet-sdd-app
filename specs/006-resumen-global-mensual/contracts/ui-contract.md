# Contrato de UI: Resumen Global Mensual

**Feature**: `006-resumen-global-mensual` | **Ruta**: `src/app/resumen/page.tsx` (`/resumen`) | **Componentes**: `src/infrastructure/primary/ui/global-summary-panel.tsx` (servidor), `src/infrastructure/primary/ui/month-selector.tsx` (cliente)

Vista nueva de ámbito familiar (todas las cuentas), independiente de la pantalla principal por cuenta de 002/005. La pantalla principal no se altera salvo un enlace de entrada (§1.2).

---

## 1. Navegación y URL (FR-001, FR-007)

### 1.1 Ruta `/resumen`

- Server component fino (adaptador): valida `searchParams.month` con Zod (`/^\d{4}-(0[1-9]|1[0-2])$/`, mismo esquema que `/`); si falta o es inválido, por defecto al mes actual (`currentMonth()`).
- URL canónica: `/resumen?month=YYYY-MM`. El cambio de mes actualiza la URL con `router.replace` (mismo patrón del selector de 002, sin recarga completa).
- Estructura de la página: enlace "Volver" a `/` + título + selector de mes + panel del resumen (§2).

### 1.2 Enlace de entrada desde la pantalla principal

- En `/` (cabecera, junto al título "Family Wallet"): enlace **"Resumen global"** → `/resumen?month={mes activo del selector}` (preserva el contexto temporal).
- Es el único cambio en la pantalla principal; regiones de 002/003/005 intactas (sus contratos no cambian).

### 1.3 Selector de mes (`month-selector.tsx`)

- Componente cliente reutilizable (variant del `account-month-selector` de 002 sin cuenta): `Select` shadcn con `buildMonthWindow(month, 24)`, etiqueta "Mes", navegación a `/resumen?month=...` vía `router.replace` dentro de `startTransition` (mismo patrón existente). Diseñado para que `009-cuenta-resultados-anual` pueda reutilizarlo.

## 2. Estructura de la página y el panel

```text
/resumen?month=2026-09
┌─────────────────────────────────────────────┐
│ ← Volver          Family Wallet             │
│                                             │
│ Resumen global de Septiembre 2026           │  ← monthLabel existente
│                                             │
│ [Mes ▾]                                     │  ← month-selector (sin cuenta)
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ [Ingresos]   [Gastos]   [Saldo del mes] │ │  ← KPIs (grid 3 col. escritorio / apilado móvil)
│ │  3.100,50 €  1.270,50 €  +1.830,00 €    │ │
│ │                                         │ │
│ │ Gastos compartidos     Gastos personales│ │  ← sub-desglose por naturaleza
│ │  1.191,00 €            79,50 €          │ │
│ │                                         │ │
│ │ Desglose por tag                        │ │  ← misma regla/orden que el cierre de 005
│ │ Alimentación          500,00 €          │ │
│ │ Vivienda              850,00 €          │ │
│ │ ...                                    │ │
│ │                                         │ │
│ │ Desglose por miembro                    │ │  ← NUEVO
│ │                 personales  compartidos │ │
│ │ Miembro A          60,00 €    120,50 €  │ │
│ │ Miembro B           0,00 €     50,00 €  │ │
│ │ Cuenta común        19,50 €    970,50 € │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

- Título de página: **"Resumen global de {Mes YYYY}"** (primera letra mayúscula vía `monthLabel`); el mes es el seleccionado, no necesariamente el actual.
- El panel (`GlobalSummaryPanel`) replica la estructura del `MonthlyClosurePanel` de 005 (sección con `aria-labelledby`, grid de KPIs, naturaleza, desglose por tag con su nota) y añade el desglose por miembro.

## 3. Formato, textos y estados

| Elemento | Texto/Formato exacto |
|---|---|
| Enlace entrada en `/` | "Resumen global" (junto al título de la cabecera) |
| Enlace vuelta en `/resumen` | "Volver" (a `/`) |
| KPI Ingresos / Gastos | labels "Ingresos" / "Gastos"; importes `Intl es-ES` EUR sin signo |
| KPI Saldo del mes | label "Saldo del mes"; `+`/`−` (U+2212)/sin signo si 0 — helper `formatSignedCents` existente |
| Naturaleza | labels "Gastos compartidos" / "Gastos personales"; importes sin signo |
| Desglose por tag | título "Desglose por tag"; filas `nombre  importe`; nota permanente de 005 ("Los gastos con varias tags computan en cada una; las filas pueden no sumar el total de gastos."); orden importe desc, empate alfabético (`es`) |
| Desglose por miembro | título "Desglose por miembro"; cabeceras de columna "personales" y "compartidos"; una fila por miembro con gastos + fila "Cuenta común" si la común tiene gastos; importes sin signo |
| Fila Cuenta común | etiqueta "Cuenta común" para `memberName: null` (la etiqueta vive solo en la UI) |
| Orden desglose por miembro | total de la fila (personal+compartido) descendente; empate → nombre ascendente (`es`); "Cuenta común" al final en empates |
| Mes sin movimientos | KPIs a `0,00 €`, saldo `0,00 €`, ambos desgloses muestran "Sin gastos este mes." (el panel NO se oculta) |
| Miembro sin gastos | no genera fila (solo filas con datos) |
| Idioma | Todo en español (FR-007) |

## 4. Accesibilidad y responsive (guía PoC, mismo criterio que 002/005 §4)

- Página con `<main>`; panel como `<section aria-labelledby>`; el desglose por miembro como tabla semántica o lista de definición con cabeceras percibibles.
- Grid de KPIs y desgloses apilados en móvil; sin scroll horizontal.
- Números como texto (mismo patrón que el resto de la app).

## 5. Fuera de este contrato

Cuadre mensual con saldos reales (`010-cuadre-mensual`); cuenta de resultados anual y balance acumulado multimes (`009-cuenta-resultados-anual`); ingresos desglosados por miembro (009); enlaces directos mes→mes (anterior/siguiente); exportación/impresión; cambios en las regiones de la pantalla principal de 002/003/005 (solo se añade el enlace de §1.2).
