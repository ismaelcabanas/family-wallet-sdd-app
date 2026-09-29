# Contrato de UI: Panel de Cuentas

**Feature**: `012-panel-cuentas` | **Rutas**: `/` (panel, server, reescrito), `/accounts/[accountId]`, `/summary`, `/annual` (sustitución de nav local) | **Componentes**: `GlobalNav`, `AccountCardGrid` (server, nuevos) | **Eliminados**: navs locales de las 4 páginas, `AccountMonthSelector`, `MovementList`

El panel consume `ListAccounts` sin cálculo (FR-002); la extensión semántica de rutas existentes está en [data-model §3](../data-model.md). La página de cuenta es la de 011 salvo su cabecera; `/summary` y `/annual` no cambian funcionalmente (FR-003).

---

## 1. Panel `/` — lanzador de cuentas (FR-001, FR-002, US1)

### 1.1 Ruta y comportamiento

| Aspecto | Regla |
|---|---|
| Datos | `await connection()` + `ListAccounts().execute()`; siempre cuentas actuales por petición |
| Query params | **No se lee ninguno**: `/?month=…` residual se ignora sin error (edge case de la spec) |
| Contenido exclusivo | Una rejilla de tarjetas de cuentas: **sin** selector de cuenta, **sin** formulario de alta, **sin** listado de movimientos, **sin** cierre (US1-4) |
| Importes | Ninguno en toda la ruta (lanzador puro; decisión 2026-09-29) |

### 1.2 Estructura

```text
┌──────────────────────────────────────────────────────────────┐
│ Family Wallet        [Panel*] [Resumen global] [Cuenta de    │  ← GlobalNav (§2); * = activo
│                                              resultados]     │
├──────────────────────────────────────────────────────────────┤
│ Cuentas                                                       │  ← h1 (título de la vista)
│                                                               │
│ ┌───────────────────────┐  ┌───────────────────────┐         │
│ │ Cuenta de Miembro A   │  │ Cuenta de Miembro B   │   …     │  ← AccountCardGrid: rejilla
│ │ Cuenta personal de    │  │ Cuenta personal de    │         │     responsiva sm:2 / lg:3,
│ │ Miembro A             │  │ Miembro B             │         │     orden = ListAccounts (id asc)
│ └───────────────────────┘  └───────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 Tarjeta (US1-1, US1-2, US1-3)

| Aspecto | Regla |
|---|---|
| Elemento | `li` de la lista `ul[aria-label="Cuentas"]`; todo el contenido es un único `Link` (toda la tarjeta clicable) |
| Destino | `/accounts/{id}` **sin `?month=`**: la página de cuenta abre su mes actual por defecto (FR-001) |
| Nombre | `account.name` en peso prominente (p. ej. «Cuenta de Miembro A») |
| Tipo | «Cuenta común» / «Cuenta personal de {miembro}» como etiqueta secundaria — mismas cadenas que el subtítulo de 011 |
| Contenido adicional | **Ninguno**: sin balance, sin gasto del mes, sin contadores; tarjetas con y sin movimientos equivalentes en tamaño (US1-3) |
| Orden | El de `ListAccounts` (id ascendente), determinista; sin reordenación |
| Escalado | Más cuentas → más filas en la rejilla; sin máximo fijo |

## 2. Navegación global — `GlobalNav` (FR-003, US2)

### 2.1 Ubicación y presencia

- Renderizada por **todas** las páginas (`/`, `/accounts/[accountId]`, `/summary`, `/annual`) en la cabecera, sustituyendo el bloque `<nav>` local de cada una (SC-004).
- `<nav aria-label="Navegación principal">` con tres enlaces, en este orden: **Panel** · **Resumen global** · **Cuenta de resultados**. El h1 de cada página se conserva (en `/` «Family Wallet», en cuenta el nombre de la cuenta, etc.).

### 2.2 Destinos y contexto temporal (clarificación 2026-09-29: conservar el mes visible)

| Enlace | Destino desde `/` (sin mes) | Desde `/accounts/[id]?month=M` | Desde `/summary?month=M` | Desde `/annual?year=Y` |
|---|---|---|---|---|
| Panel | — (activo) | `/` | `/` | `/` |
| Resumen global | `/summary?month={mes actual}` | `/summary?month=M` | — (activo) | `/summary?month={Y}-01` |
| Cuenta de resultados | `/annual?year={año actual}` | `/annual?year={M.slice(0,4)}` | `/annual?year={M.slice(0,4)}` | — (activo) |

- «Panel» enlaza siempre a `/` sin query (el panel no depende del mes).
- `month` ausente/inválido en la página origen → los enlaces usan el mes (o año, derivado a `${Y}-01`) ya resuelto por la página origen; `GlobalNav` cae a `currentMonth()` si no recibe prop.
- `/summary` y `/annual` conservan intactos su selector de mes/año y todo su comportamiento (FR-003).

### 2.3 Estado activo (US2-3)

| Página actual | Enlace activo |
|---|---|
| `/` | Panel |
| `/accounts/[id]` | **Panel** (la página de cuenta computa como «Panel») |
| `/summary` | Resumen global |
| `/annual` | Cuenta de resultados |

- Activo: `aria-current="page"` + `font-medium text-foreground`. Inactivos: `text-muted-foreground` con subrayado en hover (estilo actual). Sin animaciones.

## 3. Página de cuenta tras 012 (FR-004)

- **Retirado**: cualquier selector o enlace de cambio de cuenta (el selector «Cuenta activa» desaparece con la pasarela; nunca existió en `/accounts/[id]`). Se entra desde el panel o por URL directa.
- **Sin cambios funcionales**: stepper ‹ › + picker, balance acumulado a mes, formulario embebido (hasta 013), cierre, listado agrupado con edición/eliminación. El selector de cuenta **del diálogo de edición** (003) se conserva: es parte de la edición, no navegación.
- Cabecera: bloque local `<nav>` sustituido por `GlobalNav active="panel" month={month}`.

## 4. Accesibilidad y responsive

- `aria-current="page"` como señal asistiva del destino actual, reforzada con peso tipográfico (no solo color) — research §7.
- Tarjetas: lista de enlaces con nombre accesible completo (nombre + tipo); navegación por teclado en orden natural; rejilla colapsa a 1 columna en móvil (usable, no optimizado — assumption heredada de 011).
- Ancho de página `max-w-4xl` en `/`, `/accounts/[id]` y `/summary`; `/annual` mantiene `max-w-5xl` (sus tablas).

## 5. Textos exactos (FR-007)

| Elemento | Texto |
|---|---|
| Enlaces del nav | «Panel» · «Resumen global» · «Cuenta de resultados» |
| Landmark del nav | `aria-label="Navegación principal"` |
| h1 del panel | «Family Wallet» |
| Título de la lista | `aria-label="Cuentas"` |
| Tarjeta — nombre | `{Nombre de la cuenta}` (p. ej. «Cuenta de Miembro A») |
| Tarjeta — tipo | «Cuenta común» / «Cuenta personal de {miembro}» |
| Destino de tarjeta | `/accounts/{id}` |

No hay textos nuevos en `/summary`, `/annual` ni en la página de cuenta más allá del nav (sus contratos de 006/009/011 siguen vigentes).

## 6. Fuera de este contrato

CTA «Nuevo movimiento» en diálogo (`013`); formulario rediseñado con nota única (`014`); anual agrupada (`015`); gestión de cuentas/tarjetas (`008`); indicadores financieros en la tarjeta (retirados por decisión del propietario); breadcrumbs, búsqueda, dark mode.
